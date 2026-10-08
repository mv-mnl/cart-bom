import {
  DIEZ,
  VALORES_40,
  VALORES_48,
  VALORES_52,
  type Card,
  type Palo,
  type Valor,
} from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { ordenarJuego, tipoDeJuego } from './juegos';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });
const tipo = (cartas: Card[]) => tipoDeJuego(cartas, VALORES_40);

describe('tipoDeJuego', () => {
  it('tercia y cuarta del mismo valor', () => {
    expect(tipo([c('oros', 5), c('copas', 5), c('bastos', 5)])).toBe('tercia');
    expect(tipo([c('oros', 5), c('copas', 5), c('bastos', 5), c('espadas', 5)])).toBe('tercia');
  });

  it('una tercia no puede repetir palo', () => {
    const repetida = { id: 'oros-5-b', palo: 'oros', valor: 5 } as const;
    expect(tipo([c('oros', 5), repetida, c('copas', 5)])).toBeNull();
  });

  it('escalera de 3 o más del mismo palo', () => {
    expect(tipo([c('oros', 3), c('oros', 1), c('oros', 2)])).toBe('escalera');
    expect(tipo([c('copas', 4), c('copas', 5), c('copas', 6), c('copas', 7)])).toBe('escalera');
  });

  it('el 7 y la Sota son consecutivos', () => {
    expect(tipo([c('espadas', 6), c('espadas', 7), c('espadas', 10)])).toBe('escalera');
    expect(tipo([c('espadas', 10), c('espadas', 11), c('espadas', 12)])).toBe('escalera');
  });

  it('con la baraja de 48 el 7 y la Sota no son consecutivos', () => {
    expect(
      tipoDeJuego([c('espadas', 6), c('espadas', 7), c('espadas', 10)], VALORES_48),
    ).toBeNull();
  });

  it('con la americana completa, 9-10-J es escalera y 7-J ya no', () => {
    expect(tipoDeJuego([c('espadas', 9), c('espadas', DIEZ), c('espadas', 10)], VALORES_52)).toBe(
      'escalera',
    );
    expect(
      tipoDeJuego([c('espadas', 6), c('espadas', 7), c('espadas', 10)], VALORES_52),
    ).toBeNull();
  });

  it('el As no cierra con el Rey', () => {
    expect(tipo([c('oros', 11), c('oros', 12), c('oros', 1)])).toBeNull();
  });

  it('rechaza escaleras con huecos, palos mezclados o menos de 3 cartas', () => {
    expect(tipo([c('oros', 1), c('oros', 2), c('oros', 4)])).toBeNull();
    expect(tipo([c('oros', 1), c('copas', 2), c('oros', 3)])).toBeNull();
    expect(tipo([c('oros', 1), c('oros', 2)])).toBeNull();
    expect(tipo([c('oros', 5), c('copas', 5)])).toBeNull();
  });
});

describe('ordenarJuego', () => {
  it('ordena escaleras por valor', () => {
    const cartas = ordenarJuego(
      [c('oros', 10), c('oros', 6), c('oros', 7)],
      'escalera',
      VALORES_40,
    );
    expect(cartas.map((x) => x.valor)).toEqual([6, 7, 10]);
  });
});
