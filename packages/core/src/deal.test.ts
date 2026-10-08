import { describe, expect, it } from 'vitest';
import { createDeck } from './cards';
import { barajar, repartir } from './deal';
import { createRng } from './rng';

describe('barajar', () => {
  it('es reproducible con la misma semilla', () => {
    const deck = createDeck();
    expect(barajar(deck, createRng('s'))).toEqual(barajar(deck, createRng('s')));
  });

  it('cambia el orden con semillas distintas', () => {
    const deck = createDeck();
    expect(barajar(deck, createRng('s1'))).not.toEqual(barajar(deck, createRng('s2')));
  });

  it('conserva las mismas cartas y no modifica el original', () => {
    const deck = createDeck();
    const copia = [...deck];
    const barajado = barajar(deck, createRng('s'));
    expect(deck).toEqual(copia);
    expect([...barajado].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...deck].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});

describe('repartir', () => {
  it('reparte en ronda y deja el resto como mazo', () => {
    const { manos, mazo } = repartir([1, 2, 3, 4, 5, 6, 7], 3, 2);
    expect(manos).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
    expect(mazo).toEqual([7]);
  });

  it('2 jugadores con 9 cartas dejan 22 en el mazo de 40', () => {
    const { manos, mazo } = repartir(createDeck(), 2, 9);
    expect(manos.map((m) => m.length)).toEqual([9, 9]);
    expect(mazo).toHaveLength(22);
  });

  it('falla si no alcanzan las cartas', () => {
    expect(() => repartir(createDeck(), 5, 9)).toThrow(/no alcanzan/);
  });

  it('rechaza parámetros inválidos', () => {
    expect(() => repartir([1, 2], 0, 1)).toThrow();
    expect(() => repartir([1, 2], 2, -1)).toThrow();
  });
});
