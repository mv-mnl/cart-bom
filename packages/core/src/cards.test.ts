import { describe, expect, it } from 'vitest';
import { DIEZ, VALORES_48, VALORES_52, createDeck, ordenEscalera } from './cards';

describe('createDeck', () => {
  it('crea la baraja de 40 sin 8 ni 9', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(40);
    expect(deck.some((c) => c.valor === 8 || c.valor === 9)).toBe(false);
  });

  it('tiene 10 cartas por palo', () => {
    const deck = createDeck();
    for (const palo of ['oros', 'copas', 'espadas', 'bastos'] as const) {
      expect(deck.filter((c) => c.palo === palo)).toHaveLength(10);
    }
  });

  it('crea la baraja de 48 con 8 y 9', () => {
    expect(createDeck({ valores: VALORES_48 })).toHaveLength(48);
  });

  it('crea la americana completa de 52 con ids únicos', () => {
    const deck = createDeck({ valores: VALORES_52 });
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('los ids son únicos, también con varias barajas', () => {
    const deck = createDeck({ copias: 2 });
    expect(deck).toHaveLength(80);
    expect(new Set(deck.map((c) => c.id)).size).toBe(80);
  });

  it('rechaza un número de copias inválido', () => {
    expect(() => createDeck({ copias: 0 })).toThrow();
    expect(() => createDeck({ copias: 1.5 })).toThrow();
  });
});

describe('ordenEscalera', () => {
  it('el 7 y la Sota son consecutivos en la baraja de 40', () => {
    expect(ordenEscalera(10) - ordenEscalera(7)).toBe(1);
  });

  it('el As va primero y el Rey al final; no cierran', () => {
    expect(ordenEscalera(1)).toBe(0);
    expect(ordenEscalera(12)).toBe(9);
  });

  it('con 8 y 9, el 7 y la Sota ya no son consecutivos', () => {
    expect(ordenEscalera(10, VALORES_48) - ordenEscalera(7, VALORES_48)).toBe(3);
  });

  it('en la americana completa el 10 va entre el 9 y la J', () => {
    expect(ordenEscalera(DIEZ, VALORES_52) - ordenEscalera(9, VALORES_52)).toBe(1);
    expect(ordenEscalera(10, VALORES_52) - ordenEscalera(DIEZ, VALORES_52)).toBe(1);
    expect(ordenEscalera(12, VALORES_52)).toBe(12);
  });

  it('rechaza un valor que no está en la baraja', () => {
    expect(() => ordenEscalera(8)).toThrow();
  });
});
