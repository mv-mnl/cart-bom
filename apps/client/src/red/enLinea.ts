import type { ConquianAction, ConquianView } from '@cartas/conquian';
import { NOMBRE_SALA, type MensajeServidor, type Sala } from '@cartas/shared';
import { Client, type Room } from '@colyseus/sdk';
import { pausaIA, usePartida, type EnLinea } from '../store';
import type { Vista } from '../vista';

type Mensaje = MensajeServidor<ConquianView, ConquianAction>;

/** Dónde está el servidor: `VITE_SERVIDOR`, o el mismo host en el puerto de Colyseus. */
function urlServidor(): string {
  const configurada: unknown = import.meta.env.VITE_SERVIDOR;
  if (typeof configurada === 'string' && configurada) return configurada;
  const ws = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${ws}://${location.hostname}:2567`;
}

/** Para volver a la sala si se recarga la página. Dura lo que la pestaña. */
const CLAVE_TOKEN = 'cartas.reconexion';

function guardarToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento solo se pierde poder volver tras recargar.
  }
}

function leerToken(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

/** Nombres como se muestran en la mesa: tú eres "Tú"; se marca quién no está. */
export function nombresDe(sala: Sala): string[] {
  return sala.asientos.map((a, i) => {
    if (i === sala.yo) return 'Tú';
    if (a.desconectado) return `${a.nombre} (sin conexión)`;
    return a.compu && !a.nombre.startsWith('Compu') ? `${a.nombre} (compu)` : a.nombre;
  });
}

/** Mensajes del servidor de Colyseus que se entienden en español. */
function explicar(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  if (/locked|not found|no rooms found|invalid/i.test(texto)) {
    return 'No se encontró esa sala o la partida ya empezó.';
  }
  if (/full/i.test(texto)) return 'La sala está llena.';
  if (/fetch|network|connect|ECONNREFUSED/i.test(texto)) {
    return 'No se pudo conectar con el servidor.';
  }
  return texto;
}

/**
 * Cola de vistas que llegan del servidor: se muestran una por una con la misma pausa que
 * las jugadas de la computadora, para que se vea cada jugada aunque lleguen juntas.
 * Tus propias jugadas se muestran en cuanto llegan (después de las que ya esperaban).
 */
function crearCola() {
  let pendientes: Vista[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mostradaEn = 0;
  let previa: Vista | null = null;

  const siguiente = () => {
    const vista = pendientes[0];
    if (timer !== null || !vista) return;
    const actual = usePartida.getState().vista;
    const deOtro = vista.jugada !== null && vista.jugada.player !== vista.view.yo;
    const pausa = actual && deOtro ? pausaIA(actual.view, previa?.view ?? null) : 0;
    const espera = Math.max(0, mostradaEn + pausa - performance.now());
    timer = setTimeout(() => {
      timer = null;
      pendientes.shift();
      previa = usePartida.getState().vista;
      usePartida.getState().mostrar(vista);
      mostradaEn = performance.now();
      siguiente();
    }, espera);
  };

  return {
    agregar(vista: Vista) {
      pendientes.push(vista);
      siguiente();
    },
    vaciar() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pendientes = [];
      previa = null;
    },
  };
}

/** Conecta la sala con el store. */
function usarSala(room: Room) {
  const cola = crearCola();
  let cerrada = false;
  guardarToken(room.reconnectionToken);

  const actualizar = (cambio: Partial<EnLinea>) => {
    const { enLinea } = usePartida.getState();
    if (enLinea) usePartida.setState({ enLinea: { ...enLinea, ...cambio } });
  };

  const enLinea: EnLinea = {
    sala: null,
    reconectando: false,
    enviar: (mensaje) => room.send(mensaje.type, mensaje),
    cerrar: () => {
      cerrada = true;
      cola.vaciar();
      guardarToken(null);
      void room.leave(true);
    },
  };
  usePartida.setState({
    enLinea,
    errorRed: null,
    local: null,
    vista: null,
    nombres: [],
    verMesa: false,
  });

  room.onMessage('*', (_tipo, payload: Mensaje) => {
    switch (payload.type) {
      case 'sala': {
        // El mensaje es la sala (con su `type` de más, que no estorba).
        actualizar({ sala: payload });
        usePartida.setState({ nombres: nombresDe(payload) });
        return;
      }
      case 'estado': {
        cola.agregar(payload);
        return;
      }
      case 'rechazada':
        usePartida.getState().avisar(payload.motivo);
        return;
    }
  });
  room.onDrop(() => actualizar({ reconectando: true }));
  room.onReconnect(() => {
    guardarToken(room.reconnectionToken);
    actualizar({ reconectando: false });
  });
  room.onLeave(() => {
    if (cerrada) return;
    // No fue a propósito y no se pudo volver: de regreso al menú con la explicación.
    cola.vaciar();
    guardarToken(null);
    usePartida.setState({
      enLinea: null,
      vista: null,
      errorRed: 'Se perdió la conexión con la sala.',
    });
  });
}

async function entrar(conectar: (c: Client) => Promise<Room>): Promise<void> {
  usePartida.getState().salir();
  try {
    usarSala(await conectar(new Client(urlServidor())));
  } catch (e) {
    usePartida.setState({ errorRed: explicar(e) });
  }
}

/** Crea una sala nueva con las cartas y la baraja elegidas en el menú. */
export function crearSala(nombre: string): Promise<void> {
  const { cartas, baraja, ayudas } = usePartida.getState();
  return entrar((c) => c.create(NOMBRE_SALA.conquian, { nombre, cartas, baraja, ayudas }));
}

/** Entra a una sala con su código. */
export function unirseSala(codigo: string, nombre: string): Promise<void> {
  return entrar((c) => c.joinById(codigo.trim().toUpperCase(), { nombre }));
}

/** Si se recargó la página estando en una sala, intenta volver a ella. */
export async function reanudarSala(): Promise<void> {
  const token = leerToken();
  if (!token) return;
  try {
    usarSala(await new Client(urlServidor()).reconnect(token));
  } catch {
    guardarToken(null);
  }
}
