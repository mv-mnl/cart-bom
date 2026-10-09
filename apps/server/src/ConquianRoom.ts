import type { ConquianAction, ConquianView } from '@cartas/conquian';
import {
  esBarajaSala,
  esCartasSala,
  type MensajeServidor,
  type OpcionesCrear,
  type OpcionesUnirse,
} from '@cartas/shared';
import { CloseCode, Room, ServerError, type Client, type Delayed } from '@colyseus/core';
import { randomUUID } from 'node:crypto';
import { MAX_JUGADORES, Rechazo, SalaConquian } from './sala';

/** Cuánto se le guarda el asiento a quien se desconecta a media partida (s). */
export const ESPERA_RECONEXION_S = Number(process.env.ESPERA_RECONEXION_S ?? 60);
/** En la sala de espera basta con lo que tarda en recargar la página (s). */
const ESPERA_RECONEXION_SALA_S = 15;
/** Pausa antes de cada jugada de la computadora, para que se pueda seguir (ms). */
export const PAUSA_COMPU_MS = Number(process.env.PAUSA_COMPU_MS ?? 1200);

/** Letras sin las que se confunden (I, L, O). */
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const LARGO_CODIGO = 5;

export function nuevoCodigo(): string {
  return Array.from(
    { length: LARGO_CODIGO },
    () => LETRAS[Math.floor(Math.random() * LETRAS.length)],
  ).join('');
}

type Mensaje = MensajeServidor<ConquianView, ConquianAction>;

/**
 * Una partida de Conquián en línea. El servidor manda: guarda la partida completa, valida
 * cada intención contra `validActions` y a cada quien le manda solo lo que puede ver.
 * El `roomId` es el código corto que se comparte para unirse.
 */
export class ConquianRoom extends Room {
  private sala!: SalaConquian;
  private turnoCompu: Delayed | null = null;

  override onCreate(opciones: Partial<OpcionesCrear>) {
    // Se asigna aquí y no como campo de la clase: así pasa por el setter de Colyseus.
    this.maxClients = MAX_JUGADORES;
    this.roomId = nuevoCodigo();
    const cartas = esCartasSala(opciones.cartas) ? opciones.cartas : 'completa';
    const baraja = esBarajaSala(opciones.baraja) ? opciones.baraja : 'espanola';
    this.sala = new SalaConquian(this.roomId, cartas, baraja);

    this.onMessage('jugar', (client, msg: { accion?: unknown }) =>
      this.intentar(client, () => {
        const accion = this.sala.jugar(client.sessionId, msg?.accion);
        this.difundir(accion);
      }),
    );
    this.onMessage('empezar', (client, msg: { compus?: unknown }) =>
      this.intentar(client, () => {
        this.sala.empezar(client.sessionId, msg?.compus, randomUUID());
        // Ya no se puede unir nadie: los asientos quedaron fijos.
        void this.lock();
        this.difundirSala();
        this.difundir(null);
      }),
    );
    this.onMessage('configurar', (client, msg: { cartas?: unknown; baraja?: unknown }) =>
      this.intentar(client, () => {
        this.sala.configurar(client.sessionId, msg?.cartas, msg?.baraja);
        this.difundirSala();
      }),
    );
    this.onMessage('revancha', (client) =>
      this.intentar(client, () => {
        this.sala.revancha(client.sessionId, randomUUID());
        this.difundirSala();
        this.difundir(null);
      }),
    );
  }

  override onJoin(client: Client, opciones: Partial<OpcionesUnirse>) {
    try {
      this.sala.sentar(client.sessionId, opciones?.nombre);
    } catch (e) {
      throw new ServerError(4000, e instanceof Error ? e.message : 'No se pudo entrar.');
    }
    this.difundirSala();
  }

  /** Se cayó la conexión: se le guarda el asiento un rato. */
  override async onDrop(client: Client) {
    this.sala.marcarConexion(client.sessionId, false);
    this.difundirSala();
    const espera = this.sala.enJuego ? ESPERA_RECONEXION_S : ESPERA_RECONEXION_SALA_S;
    await this.allowReconnection(client, espera);
  }

  override onReconnect(client: Client) {
    this.sala.marcarConexion(client.sessionId, true);
    this.difundirSala();
    const vista = this.sala.vista(client.sessionId, null);
    if (vista) this.enviar(client, { type: 'estado', ...vista });
  }

  /** Se fue (o no regresó a tiempo): su asiento lo juega la computadora. */
  override onLeave(client: Client, code?: number) {
    this.sala.quitar(client.sessionId);
    if (code !== CloseCode.CONSENTED || this.clients.length > 0) this.difundirSala();
    this.programarCompu();
  }

  override onDispose() {
    this.turnoCompu?.clear();
  }

  private intentar(client: Client, hacer: () => void) {
    try {
      hacer();
    } catch (e) {
      // Un error de las reglas o de un mensaje mal formado: no cambia nada.
      const motivo = e instanceof Rechazo ? e.message : 'Esa jugada no se puede hacer ahora.';
      this.enviar(client, { type: 'rechazada', motivo });
    }
  }

  private enviar(client: Client, mensaje: Mensaje) {
    client.send(mensaje.type, mensaje);
  }

  private difundirSala() {
    for (const client of this.clients) {
      this.enviar(client, { type: 'sala', ...this.sala.sala(client.sessionId) });
    }
  }

  /** Le manda a cada jugador su vista después de `jugada` (o del reparto, si es `null`). */
  private difundir(jugada: ConquianAction | null) {
    for (const client of this.clients) {
      const vista = this.sala.vista(client.sessionId, jugada);
      if (vista) this.enviar(client, { type: 'estado', ...vista });
    }
    // Al terminar, la sala cambia: el anfitrión ya puede cambiar el juego y empezar otra.
    if (this.sala.terminada) this.difundirSala();
    this.programarCompu();
  }

  /** Si le toca a un asiento de la computadora, juega después de una pausa. */
  private programarCompu() {
    this.turnoCompu?.clear();
    this.turnoCompu = null;
    if (!this.sala.jugadaCompu()) return;
    this.turnoCompu = this.clock.setTimeout(() => {
      this.turnoCompu = null;
      // Se vuelve a pedir: la partida pudo cambiar durante la pausa.
      const accion = this.sala.jugadaCompu();
      if (!accion) return;
      this.sala.aplicarCompu(accion);
      this.difundir(accion);
    }, PAUSA_COMPU_MS);
  }
}
