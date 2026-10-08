import type { AnyCardGame } from './game';

export interface GameRegistry {
  register(game: AnyCardGame): void;
  get(id: string): AnyCardGame | undefined;
  list(): AnyCardGame[];
}

/** Agregar un juego nuevo es solo registrarlo; el núcleo no cambia. */
export function createRegistry(): GameRegistry {
  const games = new Map<string, AnyCardGame>();
  return {
    register(game) {
      if (games.has(game.id)) {
        throw new Error(`juego ya registrado: ${game.id}`);
      }
      games.set(game.id, game);
    },
    get(id) {
      return games.get(id);
    },
    list() {
      return [...games.values()];
    },
  };
}
