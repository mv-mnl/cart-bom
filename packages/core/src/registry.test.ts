import { describe, expect, it } from 'vitest';
import type { CardGame } from './game';
import { createRegistry } from './registry';

type Accion = { type: 'nada' };

const juegoFalso = (id: string): CardGame<{ turno: number }, Accion, { turno: number }> => ({
  id,
  nombre: id,
  minPlayers: 2,
  maxPlayers: 4,
  setup: () => ({ turno: 0 }),
  validActions: () => [{ type: 'nada' }],
  apply: (state) => state,
  view: (state) => state,
  result: () => null,
});

describe('createRegistry', () => {
  it('registra, busca y lista juegos', () => {
    const registry = createRegistry();
    registry.register(juegoFalso('a'));
    registry.register(juegoFalso('b'));
    expect(registry.get('a')?.id).toBe('a');
    expect(registry.get('c')).toBeUndefined();
    expect(registry.list().map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('no permite registrar dos juegos con el mismo id', () => {
    const registry = createRegistry();
    registry.register(juegoFalso('a'));
    expect(() => registry.register(juegoFalso('a'))).toThrow();
  });
});
