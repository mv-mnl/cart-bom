import { CONFIG_DEFAULT, type ConquianState, type Fase, type Juego } from '@cartas/conquian';
import type { Card, Palo, Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { bajadasDe, enTurno, obligado, ofertaMia, resultado, vistaDe } from './vista';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });

const escalera: Juego = {
  id: 'j1',
  tipo: 'escalera',
  cartas: [c('bastos', 1), c('bastos', 2), c('bastos', 3)],
};

function estado(fase: Fase): ConquianState {
  return {
    config: CONFIG_DEFAULT,
    jugadores: [
      { mano: [c('oros', 7), c('copas', 12)], juegos: [escalera] },
      { mano: [c('copas', 1)], juegos: [] },
    ],
    mazo: [c('espadas', 12)],
    muertas: [],
    fase,
    siguienteJuego: 2,
  };
}

const oferta = (carta: Card, cola: number[]): Fase => ({
  type: 'oferta',
  carta,
  origen: 'mazo',
  de: 0,
  cola,
  voltea: 1,
});

describe('vista del cliente', () => {
  it('no lleva la mano del otro ni el mazo', () => {
    const texto = JSON.stringify(vistaDe(estado({ type: 'botar', jugador: 0 }), 0));
    expect(texto).not.toContain('"copas-1"');
    expect(texto).not.toContain('"espadas-12"');
  });

  it('obligado: la carta de la mesa entra en un juego tuyo', () => {
    const v = vistaDe(estado(oferta(c('bastos', 4), [0, 1])), 0);
    expect(ofertaMia(v)).toBe(true);
    expect(obligado(v)).toBe(true);
  });

  it('no obligado si no entra en tus juegos, ni si se le ofrece a otro', () => {
    expect(obligado(vistaDe(estado(oferta(c('oros', 1), [0, 1])), 0))).toBe(false);
    const paraOtro = vistaDe(estado(oferta(c('bastos', 4), [1, 0])), 0);
    expect(ofertaMia(paraOtro)).toBe(false);
    expect(obligado(paraOtro)).toBe(false);
  });

  it('turno, resultado y bajadas salen de la vista', () => {
    const v = vistaDe(estado({ type: 'voltear', jugador: 1 }), 0).view;
    expect(enTurno(v)).toBe(1);
    expect(resultado(v)).toBeNull();
    expect(bajadasDe(v, 0)).toBe(3);
    const fin = vistaDe(
      estado({ type: 'terminado', resultado: { type: 'ganador', ganadores: [1] } }),
      0,
    ).view;
    expect(resultado(fin)).toEqual({ type: 'ganador', ganadores: [1] });
  });
});
