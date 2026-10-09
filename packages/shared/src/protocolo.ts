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

// ---------- mensajes ----------

/** Del cliente al servidor: solo intenciones. El servidor las valida con `apply()`. */
export type MensajeCliente<Action> =
  | { readonly type: 'jugar'; readonly accion: Action }
  /** Pedir otra partida con los mismos jugadores al terminar. */
  | { readonly type: 'revancha' };

/** Del servidor a cada cliente. */
export type MensajeServidor<View, Action> =
  | ({ readonly type: 'estado' } & Instantanea<View, Action>)
  /** La jugada no se aplicó; el estado no cambió. */
  | { readonly type: 'rechazada'; readonly motivo: string };
