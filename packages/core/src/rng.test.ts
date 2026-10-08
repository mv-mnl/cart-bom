import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const secuencia = (seed: string, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('la misma semilla da la misma secuencia', () => {
    expect(secuencia('partida-1', 20)).toEqual(secuencia('partida-1', 20));
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(secuencia('a', 20)).not.toEqual(secuencia('b', 20));
  });

  it('next() queda en [0, 1)', () => {
    for (const x of secuencia('rango', 1000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(max) queda en [0, max) y cubre todos los valores', () => {
    const rng = createRng('int');
    const vistos = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = rng.int(6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      vistos.add(n);
    }
    expect(vistos.size).toBe(6);
  });

  it('int rechaza max inválido', () => {
    const rng = createRng('x');
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(-1)).toThrow();
    expect(() => rng.int(2.5)).toThrow();
  });
});
