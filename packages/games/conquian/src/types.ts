import type { Card, DeckOptions, GameResult } from '@cartas/core';
import type { TipoJuego } from './juegos';

export interface ConquianConfig {
  /** Cartas que recibe cada jugador. Se gana al tener `cartasPorJugador + 1` bajadas. */
  readonly cartasPorJugador: number;
  readonly baraja: DeckOptions;
}

export interface Juego {
  /** Estable durante la partida, para las animaciones. */
  readonly id: string;
  readonly tipo: TipoJuego;
  readonly cartas: readonly Card[];
}

export interface Jugador {
  readonly mano: readonly Card[];
  readonly juegos: readonly Juego[];
}

export type Fase =
  /** Cada jugador elige una carta para pasarle al de su derecha. */
  | { readonly type: 'intercambio'; readonly elegidas: readonly (string | null)[] }
  /**
   * Una carta en la mesa (volteada del mazo o botada) se ofrece en orden.
   * `cola[0]` es a quien se le ofrece ahora; los demás esperan su turno.
   * Si nadie la quiere queda muerta y voltea `voltea`.
   */
  | {
      readonly type: 'oferta';
      readonly carta: Card;
      readonly origen: 'mazo' | 'botada';
      readonly cola: readonly number[];
      readonly voltea: number;
    }
  /** El jugador tomó la carta de la mesa y debe botar una de su mano. */
  | { readonly type: 'botar'; readonly jugador: number }
  | { readonly type: 'terminado'; readonly resultado: GameResult };

export interface ConquianState {
  readonly config: ConquianConfig;
  readonly jugadores: readonly Jugador[];
  readonly mazo: readonly Card[];
  readonly muertas: readonly Card[];
  readonly fase: Fase;
  readonly siguienteJuego: number;
}

/**
 * Desmoche: sacar una carta de un poker propio ya bajado (que queda en tercia)
 * para usarla en otro juego.
 */
export interface Desmoche {
  readonly juegoId: string;
  readonly cardId: string;
}

export type ConquianAction =
  | { readonly type: 'pasarCarta'; readonly player: number; readonly cardId: string }
  /** Bajar un juego nuevo con cartas de la mano (y quizá una desmochada). */
  | {
      readonly type: 'bajar';
      readonly player: number;
      readonly cardIds: readonly string[];
      readonly desmoche?: Desmoche;
    }
  /** Agregar cartas de la mano (y quizá una desmochada) a un juego propio ya bajado. */
  | {
      readonly type: 'agregar';
      readonly player: number;
      readonly juegoId: string;
      readonly cardIds: readonly string[];
      readonly desmoche?: Desmoche;
    }
  /**
   * Usar la carta ofrecida junto con `cardIds` de la mano: en un juego nuevo,
   * o agregándola al juego propio `juegoId`. Nunca entra a la mano.
   */
  | {
      readonly type: 'tomar';
      readonly player: number;
      readonly cardIds: readonly string[];
      readonly juegoId?: string;
      readonly desmoche?: Desmoche;
    }
  | { readonly type: 'pasar'; readonly player: number }
  | { readonly type: 'botar'; readonly player: number; readonly cardId: string };

export type FaseView =
  | {
      readonly type: 'intercambio';
      readonly miCarta: string | null;
      readonly listos: readonly boolean[];
    }
  | {
      readonly type: 'oferta';
      readonly carta: Card;
      readonly origen: 'mazo' | 'botada';
      readonly turno: number;
    }
  | { readonly type: 'botar'; readonly jugador: number }
  | { readonly type: 'terminado'; readonly resultado: GameResult };

/** Lo que ve un jugador: nunca las manos ajenas ni el orden del mazo. */
export interface ConquianView {
  readonly yo: number;
  readonly mano: readonly Card[];
  readonly jugadores: readonly {
    readonly cartasEnMano: number;
    readonly juegos: readonly Juego[];
  }[];
  readonly mazo: number;
  readonly muertas: readonly Card[];
  readonly fase: FaseView;
}
