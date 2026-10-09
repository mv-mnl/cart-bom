import type { CardGame } from '@cartas/core';

/** Toda acción de un juego lleva quién la hace. */
export interface AccionDeJugador {
  readonly type: string;
  readonly player: number;
}

/**
 * Lo que los demás saben de una jugada: qué tipo fue y quién la hizo. Sin cartas: la carta
 * que alguien pasa en el intercambio no la debe ver nadie más. Lo que se bajó o botó ya se
 * ve en la vista nueva.
 */
export interface JugadaPublica {
  readonly type: string;
  readonly player: number;
}

/**
 * Lo que recibe un jugador después de cada jugada: su vista, lo que él puede hacer ahora
 * (sale de `validActions`, así el cliente nunca arma una jugada ilegal) y la jugada que
 * llevó a este momento (`null` al repartir).
 */
export interface Instantanea<View, Action> {
  readonly view: View;
  readonly acciones: readonly Action[];
  readonly jugada: JugadaPublica | null;
}

export function jugadaPublica(accion: AccionDeJugador): JugadaPublica {
  return { type: accion.type, player: accion.player };
}

/** Arma la instantánea de `player`. Solo lleva lo que ese jugador puede ver. */
export function instantanea<State, Action extends AccionDeJugador, View>(
  game: CardGame<State, Action, View>,
  state: State,
  player: number,
  jugada: Action | null = null,
): Instantanea<View, Action> {
  return {
    view: game.view(state, player),
    acciones: game.validActions(state, player),
    jugada: jugada && jugadaPublica(jugada),
  };
}

/**
 * Compara dos valores JSON (objetos, arreglos, textos, números). El servidor lo usa para
 * aceptar solo jugadas que estén tal cual en `validActions`: lo que manda el cliente no
 * se aplica directo, se aplica la jugada del servidor que coincide.
 */
export function igualJSON(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    igualJSON((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

// ---------- sala ----------

/** Nombre de la Room de Colyseus de cada juego: igual a su `id`. */
export const NOMBRE_SALA = { conquian: 'conquian' } as const;

export interface AsientoSala {
  readonly nombre: string;
  /** Lo juega la computadora (desde el principio o porque su jugador no regresó). */
  readonly compu: boolean;
  /** Su jugador se desconectó y se le está esperando. */
  readonly desconectado: boolean;
}

/** Qué cartas se usan. `completa`: 52 (americana) o 48 (española); `cuarenta`: sin 8, 9 ni 10. */
export type CartasSala = 'completa' | 'cuarenta';
export type BarajaSala = 'espanola' | 'americana';

/** Lo que manda quien crea la sala. */
export interface OpcionesCrear {
  readonly nombre: string;
  readonly cartas: CartasSala;
  readonly baraja: BarajaSala;
}

/** Lo que manda quien se une con el código. */
export interface OpcionesUnirse {
  readonly nombre: string;
}

/** La sala vista por un jugador: quién está sentado y si ya empezó. */
export interface Sala {
  /** El código para que otros se unan. */
  readonly codigo: string;
  readonly asientos: readonly AsientoSala[];
  /** Quien puede empezar la partida. */
  readonly anfitrion: number;
  /** Tu asiento (es tu número de jugador en la partida). */
  readonly yo: number;
  readonly enJuego: boolean;
  readonly minJugadores: number;
  readonly maxJugadores: number;
}

// ---------- mensajes ----------

/** Del cliente al servidor: solo intenciones. El servidor las valida. */
export type MensajeCliente<Action> =
  | { readonly type: 'jugar'; readonly accion: Action }
  /** El anfitrión empieza; los asientos que falten los juega la computadora. */
  | { readonly type: 'empezar'; readonly compus: number }
  /** Otra partida con los mismos asientos, cuando terminó la anterior. */
  | { readonly type: 'revancha' };

/** Del servidor a cada cliente. */
export type MensajeServidor<View, Action> =
  | ({ readonly type: 'sala' } & Sala)
  | ({ readonly type: 'estado' } & Instantanea<View, Action>)
  /** Lo que pidió no se hizo; nada cambió. */
  | { readonly type: 'rechazada'; readonly motivo: string };
