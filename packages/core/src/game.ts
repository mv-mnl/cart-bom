export type GameResult =
  { readonly type: 'ganador'; readonly ganadores: readonly number[] } | { readonly type: 'empate' };

/**
 * Contrato que implementa cada juego. Todo es puro: sin React, PixiJS, DOM ni red.
 * `View` es lo que un jugador puede ver; nunca incluye manos ajenas ni el orden del mazo.
 */
export interface CardGame<State, Action extends { readonly type: string }, View> {
  readonly id: string;
  readonly nombre: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  setup(players: number, seed: string): State;
  validActions(state: State, player: number): Action[];
  /** Lanza error si la acción es inválida. */
  apply(state: State, action: Action): State;
  view(state: State, player: number): View;
  result(state: State): GameResult | null;
}

/**
 * Cualquier juego, sin importar sus tipos concretos (para el registro y el menú).
 * Funciona porque los métodos de una interfaz son bivariantes en sus parámetros.
 */
export type AnyCardGame = CardGame<unknown, { readonly type: string }, unknown>;
