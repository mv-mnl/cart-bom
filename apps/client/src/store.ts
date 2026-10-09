import {
  configPara,
  conquian,
  createConquian,
  jugadaIA,
  type ConquianAction,
  type ConquianState,
  type Desmoche,
} from '@cartas/conquian';
import type { MensajeCliente, Sala } from '@cartas/shared';
import { create } from 'zustand';
import { DURACION_INTERCAMBIO } from './anim/tiempos';
import {
  ARMADO_VACIO,
  agregarPieza,
  jugadaDelArmado,
  piezasDe,
  quitarPieza,
  type Armado,
  type Pieza,
} from './ui/arrastre';
import type { EstiloBaraja } from './ui/baraja';
import { SIN_SELECCION, type Seleccion } from './ui/opciones';
import type { OrdenMano } from './ui/orden';
import { jugadaAutomatica, vistaDe, type Vista } from './vista';

export const HUMANO = 0;
/**
 * Pausa entre jugadas de la computadora, para que se puedan seguir una por una.
 * La animación más larga (la carta del mazo: vuelo, volteo y asentado) dura hasta ~1.04 s.
 */
const PAUSA_IA_MS = 1200;
/**
 * Antes de tomar sola la carta que entra en un juego tuyo: lo que tarda en llegar a la mesa
 * y un momento para que se vea el "¡Te entra!".
 */
export const ESPERA_AUTOMATICA_MS = 1400;
/** En el intercambio, entre que un rival elige su carta y el siguiente. */
const PAUSA_INTERCAMBIO_MS = 600;
/** Antes de que la computadora saque del mazo: lo que se ve antes es la carta yéndose a las muertas. */
const PAUSA_VOLTEAR_MS = 800;

/** Basta con saber la fase: sirve igual con el estado completo que con una vista. */
interface ConFase {
  readonly fase: { readonly type: string };
}

/**
 * Cuánto esperar antes de la siguiente jugada de la computadora (o de un rival en línea),
 * para que se vea la anterior. Al terminar el intercambio espera a que cada quien vea la
 * carta que recibió.
 */
export function pausaIA(state: ConFase, anterior: ConFase | null): number {
  if (state.fase.type === 'intercambio') return PAUSA_INTERCAMBIO_MS;
  if (anterior?.fase.type === 'intercambio') return PAUSA_IA_MS + DURACION_INTERCAMBIO * 1000;
  if (state.fase.type === 'voltear') return PAUSA_VOLTEAR_MS;
  return PAUSA_IA_MS;
}

/** En el intercambio, la computadora espera a que elijas tu carta y luego elige uno por uno. */
export function esperaAlHumano(state: ConquianState): boolean {
  return state.fase.type === 'intercambio' && state.fase.elegidas[HUMANO] === null;
}

/**
 * Cómo se juega: solo tocando y con botones, solo arrastrando, o las dos cosas.
 * Las reglas son las mismas; cambia solo la forma de indicar la jugada.
 */
export type ModoControl = 'botones' | 'arrastrar' | 'mixto';

/** `completa`: americana de 52 o española de 48 (según la baraja). `cuarenta`: sin 8, 9 ni 10. */
export type CartasPartida = 'completa' | 'cuarenta';

/** El Conquián con las cartas elegidas. Las cartas se fijan al empezar la partida. */
export function conquianPara(cartas: CartasPartida, baraja: EstiloBaraja) {
  return createConquian(configPara(cartas, baraja));
}

/** Pone en la mesa un estado de la partida local y la vista del humano. */
export function enLocal(
  local: ConquianState | null,
  jugada: ConquianAction | null = null,
): Pick<Partida, 'local' | 'vista'> {
  return { local, vista: local && vistaDe(local, HUMANO, jugada) };
}

/** La conexión con la sala cuando se juega en línea. */
export interface EnLinea {
  /** `null` hasta que llega la primera noticia de la sala. */
  readonly sala: Sala | null;
  /** Se cayó la conexión y se está intentando volver. */
  readonly reconectando: boolean;
  readonly enviar: (mensaje: MensajeCliente<ConquianAction>) => void;
  readonly cerrar: () => void;
}

interface Partida {
  /**
   * La partida completa, solo cuando se juega contra la computadora (o en el laboratorio).
   * Es el motor local: la interfaz no la lee, solo lee `vista`.
   */
  readonly local: ConquianState | null;
  /** Lo que ve el jugador de este navegador y lo que puede hacer. La mesa sale de aquí. */
  readonly vista: Vista | null;
  /** Jugando en línea: las jugadas van al servidor y las vistas llegan de él. */
  readonly enLinea: EnLinea | null;
  /** Por qué se salió de una sala en línea (se muestra en el menú). */
  readonly errorRed: string | null;
  /**
   * Hacer solas las jugadas obligadas (tomar la carta que entra en un juego tuyo).
   * El laboratorio las apaga para que no se crucen con sus escenarios.
   */
  readonly automaticas: boolean;
  readonly nombres: readonly string[];
  readonly seleccion: Seleccion;
  /** Cómo se muestra la mano. Es solo de este navegador; no toca el estado del juego. */
  readonly ordenMano: OrdenMano;
  /** Orden que el jugador armó arrastrando (ids de carta), cuando `ordenMano` es `manual`. */
  readonly ordenManual: readonly string[];
  /** Explicación breve cuando algo no se pudo hacer (por ejemplo, soltar donde no va). */
  readonly aviso: string | null;
  /** Mostrar sugerencias de jugadas y explicaciones de cómo jugar. Se guarda en el navegador. */
  readonly ayudas: boolean;
  readonly modo: ModoControl;
  /** Cómo se ven las cartas: española o americana. Las reglas son las mismas. */
  readonly baraja: EstiloBaraja;
  /** Con qué cartas se juega la próxima partida: completa, o sin 8, 9 y 10 (40). */
  readonly cartas: CartasPartida;
  /** Sonido apagado. Se guarda en el navegador. */
  readonly silencio: boolean;
  /** Cartas en la zona de armado (solo del cliente hasta que forman juego). */
  readonly armado: Armado;
  /** Se cerró la pantalla final para ver cómo quedó la mesa. */
  readonly verMesa: boolean;
  nueva(jugadores: number): void;
  salir(): void;
  cerrarFinal(): void;
  toggleCarta(cardId: string): void;
  toggleDesmoche(desmoche: Desmoche): void;
  limpiarSeleccion(): void;
  ordenarMano(orden: OrdenMano): void;
  reordenarMano(ids: readonly string[]): void;
  avisar(texto: string | null): void;
  cambiarAyudas(activas: boolean): void;
  cambiarModo(modo: ModoControl): void;
  cambiarBaraja(baraja: EstiloBaraja): void;
  cambiarCartas(cartas: CartasPartida): void;
  cambiarSilencio(silencio: boolean): void;
  /** Pone una carta en la zona de armado; si con ella se forma un juego, se baja solo. */
  armar(pieza: Pieza): void;
  /** Regresa una carta de la zona de armado a su lugar. */
  desarmar(pieza: Pieza): void;
  /** Jugada del humano; viene de las opciones, que salen de validActions. */
  jugar(accion: ConquianAction): void;
  /** Muestra una vista nueva que llegó del servidor. */
  mostrar(vista: Vista): void;
}

let timerIA: ReturnType<typeof setTimeout> | null = null;

const CLAVE_ORDEN = 'cartas.ordenMano';
const CLAVE_AYUDAS = 'cartas.ayudas';
const CLAVE_MODO = 'cartas.modo';
const CLAVE_BARAJA = 'cartas.baraja';
const CLAVE_CARTAS = 'cartas.cartas';
const CLAVE_SILENCIO = 'cartas.silencio';

/** Lee una preferencia guardada; sin almacenamiento (modo privado, etc.) devuelve null. */
function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // No pasa nada si no se puede guardar.
  }
}

function leerOrden(): OrdenMano {
  const guardado = leer(CLAVE_ORDEN);
  return guardado === 'numero' ? 'numero' : 'palo';
}

function leerModo(): ModoControl {
  const guardado = leer(CLAVE_MODO);
  return guardado === 'botones' || guardado === 'arrastrar' ? guardado : 'mixto';
}

/** Detiene la jugada de la computadora que esté pendiente. */
export function cancelarIA() {
  if (timerIA !== null) clearTimeout(timerIA);
  timerIA = null;
}

export const usePartida = create<Partida>((set, get) => {
  /** Cola de la computadora: una jugada a la vez, con pausa entre cada una. */
  const programarIA = (anterior: ConquianState | null = null) => {
    cancelarIA();
    const state = get().local;
    if (!state || conquian.result(state) || esperaAlHumano(state)) return;
    const bot = state.jugadores.findIndex(
      (_, p) => p !== HUMANO && conquian.validActions(state, p).length > 0,
    );
    if (bot === -1) return;
    const pausa = pausaIA(state, anterior);
    timerIA = setTimeout(() => {
      const actual = get().local;
      const accion = actual && jugadaIA(actual, bot);
      if (accion) aplicar(accion);
    }, pausa);
  };

  /**
   * Cambia lo que se ve de la partida. Si jugó otro, se conserva lo que el humano tenía
   * seleccionado de su mano; si jugó él, se limpia.
   */
  const cambiosPorVista = (vista: Vista): Partial<Partida> => {
    const delHumano = vista.jugada === null || vista.jugada.player === vista.view.yo;
    const { seleccion } = get();
    return {
      vista,
      aviso: null,
      armado: ARMADO_VACIO,
      // Sin jugada es un reparto nuevo (la revancha): se quita la pantalla final.
      ...(vista.jugada === null ? { verMesa: false } : {}),
      seleccion: delHumano
        ? SIN_SELECCION
        : {
            cartas: seleccion.cartas.filter((id) => vista.view.mano.some((c) => c.id === id)),
            desmoche: null,
          },
    };
  };

  const aplicar = (accion: ConquianAction) => {
    const state = get().local;
    if (!state) return;
    const nuevo = conquian.apply(state, accion);
    const cambios = enLocal(nuevo, accion);
    set({ ...(cambios.vista && cambiosPorVista(cambios.vista)), local: nuevo });
    programarIA(state);
  };

  return {
    local: null,
    vista: null,
    enLinea: null,
    errorRed: null,
    automaticas: true,
    nombres: [],
    seleccion: SIN_SELECCION,
    ordenMano: leerOrden(),
    ordenManual: [],
    aviso: null,
    ayudas: leer(CLAVE_AYUDAS) !== 'no',
    modo: leerModo(),
    baraja: leer(CLAVE_BARAJA) === 'americana' ? 'americana' : 'espanola',

    cartas: leer(CLAVE_CARTAS) === 'cuarenta' ? 'cuarenta' : 'completa',

    silencio: leer(CLAVE_SILENCIO) === 'si',

    cambiarSilencio(silencio) {
      set({ silencio });
      guardar(CLAVE_SILENCIO, silencio ? 'si' : 'no');
    },

    cambiarCartas(cartas) {
      set({ cartas });
      guardar(CLAVE_CARTAS, cartas);
    },

    cambiarBaraja(baraja) {
      set({ baraja });
      guardar(CLAVE_BARAJA, baraja);
    },
    armado: ARMADO_VACIO,
    verMesa: false,

    cambiarModo(modo) {
      set({ modo, seleccion: SIN_SELECCION, armado: ARMADO_VACIO, aviso: null });
      guardar(CLAVE_MODO, modo);
    },

    armar(pieza) {
      const { vista, armado } = get();
      if (!vista) return;
      const nuevo = agregarPieza(armado, pieza);
      const accion = jugadaDelArmado(vista, nuevo);
      if (accion) {
        get().jugar(accion);
        return;
      }
      set({
        armado: nuevo,
        aviso:
          piezasDe(nuevo) >= 3 ? 'Esas cartas no forman juego. Regresa alguna a tu mano.' : null,
      });
    },

    desarmar(pieza) {
      set({ armado: quitarPieza(get().armado, pieza), aviso: null });
    },

    reordenarMano(ids) {
      set({ ordenMano: 'manual', ordenManual: ids, aviso: null });
    },

    avisar(texto) {
      set({ aviso: texto });
    },

    ordenarMano(orden) {
      set({ ordenMano: orden, ordenManual: [] });
      guardar(CLAVE_ORDEN, orden);
    },

    cambiarAyudas(activas) {
      set({ ayudas: activas });
      guardar(CLAVE_AYUDAS, activas ? 'si' : 'no');
    },

    nueva(jugadores) {
      // En línea, otra partida es una revancha en la misma sala.
      const { enLinea } = get();
      if (enLinea) return enLinea.enviar({ type: 'revancha' });
      cancelarIA();
      const seed = crypto.randomUUID();
      set({
        // Las cartas se fijan al empezar; cambiar la baraja a media partida solo cambia el dibujo.
        ...enLocal(conquianPara(get().cartas, get().baraja).setup(jugadores, seed)),
        nombres: Array.from({ length: jugadores }, (_, i) => (i === HUMANO ? 'Tú' : `Compu ${i}`)),
        seleccion: SIN_SELECCION,
        armado: ARMADO_VACIO,
        aviso: null,
        verMesa: false,
      });
      programarIA();
    },

    salir() {
      cancelarIA();
      get().enLinea?.cerrar();
      set({
        ...enLocal(null),
        enLinea: null,
        seleccion: SIN_SELECCION,
        armado: ARMADO_VACIO,
        aviso: null,
        verMesa: false,
      });
    },

    cerrarFinal() {
      set({ verMesa: true });
    },

    toggleCarta(cardId) {
      const { seleccion } = get();
      const { cartas } = seleccion;
      set({
        aviso: null,
        seleccion: {
          ...seleccion,
          cartas: cartas.includes(cardId)
            ? cartas.filter((id) => id !== cardId)
            : [...cartas, cardId],
        },
      });
    },

    toggleDesmoche(desmoche) {
      const { seleccion } = get();
      const igual =
        seleccion.desmoche?.juegoId === desmoche.juegoId &&
        seleccion.desmoche.cardId === desmoche.cardId;
      // Solo una carta desmochada a la vez: tocar otra la reemplaza.
      set({ seleccion: { ...seleccion, desmoche: igual ? null : desmoche } });
    },

    limpiarSeleccion() {
      set({ seleccion: SIN_SELECCION });
    },

    jugar(accion) {
      const { enLinea } = get();
      if (enLinea) enLinea.enviar({ type: 'jugar', accion });
      else aplicar(accion);
    },

    mostrar(vista) {
      set(cambiosPorVista(vista));
    },
  };
});

// Para depurar y para las pruebas en navegador: el estado queda accesible en la consola.
if (import.meta.env.DEV) {
  (globalThis as { __PARTIDA__?: unknown }).__PARTIDA__ = usePartida;
}

let timerAutomatica: ReturnType<typeof setTimeout> | null = null;

/** Cada vista nueva: si te toca una jugada obligada, se hace sola tras una pausa. */
usePartida.subscribe((s, previo) => {
  if (s.vista === previo.vista && s.automaticas === previo.automaticas) return;
  if (timerAutomatica !== null) clearTimeout(timerAutomatica);
  timerAutomatica = null;
  const vista = s.vista;
  const accion = vista && s.automaticas ? jugadaAutomatica(vista) : null;
  if (!accion) return;
  timerAutomatica = setTimeout(() => {
    timerAutomatica = null;
    // Solo si nada cambió mientras tanto.
    if (usePartida.getState().vista === vista) usePartida.getState().jugar(accion);
  }, ESPERA_AUTOMATICA_MS);
});
