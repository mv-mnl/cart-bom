import type { Card, Palo, Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { ordenarMano } from './orden';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });
const mano = [c('bastos', 2), c('oros', 12), c('copas', 2), c('oros', 7), c('oros', 10)];
const ids = (cartas: readonly Card[]) => cartas.map((x) => x.id);

describe('ordenarMano', () => {
  it('por palo: agrupa por palo y dentro va en orden de escalera', () => {
    expect(ids(ordenarMano(mano, 'palo'))).toEqual([
      'oros-7',
      'oros-10',
      'oros-12',
      'copas-2',
      'bastos-2',
    ]);
  });

  it('por número: agrupa los valores iguales', () => {
    expect(ids(ordenarMano(mano, 'numero'))).toEqual([
      'copas-2',
      'bastos-2',
      'oros-7',
      'oros-10',
      'oros-12',
    ]);
  });

  it('manual respeta el orden del jugador y manda las cartas nuevas al final', () => {
    const manual = ['oros-7', 'bastos-2', 'oros-12'];
    expect(ids(ordenarMano(mano, 'manual', undefined, manual))).toEqual([
      'oros-7',
      'bastos-2',
      'oros-12',
      'copas-2',
      'oros-10',
    ]);
  });

  it('llegada deja la mano como está y nunca modifica el original', () => {
    const copia = [...mano];
    expect(ordenarMano(mano, 'llegada')).toBe(mano);
    ordenarMano(mano, 'palo');
    expect(mano).toEqual(copia);
  });
});
