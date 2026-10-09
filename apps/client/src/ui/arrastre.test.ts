import { CONFIG_DEFAULT, type ConquianState, type Fase, type Juego } from '@cartas/conquian';
import type { Card, Palo, Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { vistaDe } from '../vista';
import {
  ARMADO_VACIO,
  agregarPieza,
  alSoltar,
  alTocarMesa,
  jugadaDelArmado,
  quitarPieza,
  reordenar,
  type Armado,
} from './arrastre';
import { SIN_SELECCION } from './opciones';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });

const escalera: Juego = {
  id: 'j1',
  tipo: 'escalera',
  cartas: [c('bastos', 1), c('bastos', 2), c('bastos', 3)],
};

function estado(mano: Card[], fase: Fase, juegos: Juego[] = [escalera]): ConquianState {
  return {
    config: CONFIG_DEFAULT,
    jugadores: [
      { mano, juegos },
      { mano: [c('copas', 1)], juegos: [] },
    ],
    mazo: [c('copas', 12)],
    muertas: [],
    fase,
    siguienteJuego: 2,
  };
}

const oferta = (carta: Card): Fase => ({
  type: 'oferta',
  carta,
  origen: 'mazo',
  de: 0,
  cola: [0, 1],
  voltea: 1,
});
const botar: Fase = { type: 'botar', jugador: 0 };
const mano = [c('bastos', 4), c('oros', 5), c('copas', 5), c('oros', 12)];

describe('alSoltar: carta de la mano', () => {
  it('al centro mientras pagas, la bota', () => {
    const r = alSoltar(
      vistaDe(estado(mano, botar), 0),
      { tipo: 'mano', cardId: 'oros-12' },
      { tipo: 'centro' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'jugar', accion: { type: 'botar', player: 0, cardId: 'oros-12' } });
  });

  it('al centro cuando no toca botar, no hace nada y explica', () => {
    const r = alSoltar(
      vistaDe(estado(mano, oferta(c('espadas', 7))), 0),
      { tipo: 'mano', cardId: 'oros-12' },
      { tipo: 'centro' },
      SIN_SELECCION,
    );
    expect(r.tipo).toBe('nada');
  });

  it('a un juego propio donde encaja, la agrega', () => {
    const r = alSoltar(
      vistaDe(estado(mano, botar), 0),
      { tipo: 'mano', cardId: 'bastos-4' },
      { tipo: 'juego', juegoId: 'j1' },
      SIN_SELECCION,
    );
    expect(r).toEqual({
      tipo: 'jugar',
      accion: { type: 'agregar', player: 0, juegoId: 'j1', cardIds: ['bastos-4'] },
    });
  });

  it('a un juego donde no encaja, regresa', () => {
    const r = alSoltar(
      vistaDe(estado(mano, botar), 0),
      { tipo: 'mano', cardId: 'oros-12' },
      { tipo: 'juego', juegoId: 'j1' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'nada', motivo: 'Esa carta no encaja en ese juego.' });
  });

  it('dentro de la mano, solo reordena', () => {
    const r = alSoltar(
      vistaDe(estado(mano, botar), 0),
      { tipo: 'mano', cardId: 'oros-12' },
      { tipo: 'mano' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'reordenar' });
  });
});

describe('alSoltar: carta de la mesa', () => {
  it('a tu mano con las cartas seleccionadas, baja el juego nuevo', () => {
    const s = estado(mano, oferta(c('espadas', 5)));
    const r = alSoltar(
      vistaDe(s, 0),
      { tipo: 'mesa' },
      { tipo: 'mano' },
      { cartas: ['oros-5', 'copas-5'], desmoche: null },
    );
    expect(r).toEqual({
      tipo: 'jugar',
      accion: { type: 'tomar', player: 0, cardIds: ['oros-5', 'copas-5'] },
    });
  });

  it('a tu mano sin seleccionar nada, empieza a armar', () => {
    const r = alSoltar(
      vistaDe(estado(mano, oferta(c('espadas', 5))), 0),
      { tipo: 'mesa' },
      { tipo: 'mano' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'armar', pieza: { tipo: 'mesa' } });
  });

  it('soltarla otra vez en las muertas no pasa: para pasar se toca', () => {
    const r = alSoltar(
      vistaDe(estado(mano, oferta(c('espadas', 7))), 0),
      { tipo: 'mesa' },
      { tipo: 'muertas' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'nada', motivo: null });
  });

  it('tocarla cuando es para ti, pasa', () => {
    const r = alTocarMesa(vistaDe(estado(mano, oferta(c('espadas', 7))), 0));
    expect(r).toEqual({ tipo: 'jugar', accion: { type: 'pasar', player: 0 } });
  });

  it('si entra en un juego tuyo, tocarla no pasa y explica que hay que tomarla', () => {
    // `estado` pone la escalera de bastos 1-2-3: el 4 de bastos entra.
    const r = alTocarMesa(vistaDe(estado(mano, oferta(c('bastos', 4))), 0));
    expect(r).toEqual({ tipo: 'nada', motivo: 'Esa carta entra en tu juego: se agrega sola.' });
  });

  it('tocarla cuando es para otro no hace nada', () => {
    const paraOtro: Fase = { ...oferta(c('espadas', 7)), cola: [1, 0] } as Fase;
    expect(alTocarMesa(vistaDe(estado(mano, paraOtro), 0))).toEqual({ tipo: 'nada', motivo: null });
  });

  it('a un juego propio, la agrega', () => {
    const r = alSoltar(
      vistaDe(estado(mano, oferta(c('bastos', 4))), 0),
      { tipo: 'mesa' },
      { tipo: 'juego', juegoId: 'j1' },
      SIN_SELECCION,
    );
    expect(r).toEqual({
      tipo: 'jugar',
      accion: { type: 'tomar', player: 0, juegoId: 'j1', cardIds: [] },
    });
  });

  it('si no es tu turno no hace nada', () => {
    const s = estado(mano, { ...oferta(c('bastos', 4)), cola: [1, 0] } as Fase);
    expect(
      alSoltar(vistaDe(s, 0), { tipo: 'mesa' }, { tipo: 'juego', juegoId: 'j1' }, SIN_SELECCION)
        .tipo,
    ).toBe('nada');
  });
});

describe('reordenar', () => {
  it('mueve una carta a la posición indicada', () => {
    expect(reordenar(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(reordenar(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(reordenar(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b']);
  });
});

describe('zona de armado', () => {
  it('no baja nada con menos de 3 cartas', () => {
    const s = estado(mano, oferta(c('espadas', 5)));
    const armado = agregarPieza(agregarPieza(ARMADO_VACIO, { tipo: 'mesa' }), {
      tipo: 'mano',
      cardId: 'oros-5',
    });
    expect(jugadaDelArmado(vistaDe(s, 0), armado)).toBeNull();
  });

  it('con la de la mesa y dos de la mano forma la tercia', () => {
    const s = estado(mano, oferta(c('espadas', 5)));
    const armado: Armado = { cartas: ['oros-5', 'copas-5'], mesa: true, desmoche: null };
    expect(jugadaDelArmado(vistaDe(s, 0), armado)).toEqual({
      type: 'tomar',
      player: 0,
      cardIds: ['oros-5', 'copas-5'],
    });
  });

  it('solo con cartas de la mano baja desde la mano', () => {
    const conTercia = [...mano, c('espadas', 5)];
    const s = estado(conTercia, botar);
    const armado: Armado = {
      cartas: ['oros-5', 'copas-5', 'espadas-5'],
      mesa: false,
      desmoche: null,
    };
    expect(jugadaDelArmado(vistaDe(s, 0), armado)?.type).toBe('bajar');
  });

  it('con un desmoche arma la escalera de tu ejemplo', () => {
    const poker: Juego = {
      id: 'j1',
      tipo: 'tercia',
      cartas: [c('oros', 1), c('copas', 1), c('espadas', 1), c('bastos', 1)],
    };
    const s = estado([c('oros', 2), c('copas', 12)], oferta(c('oros', 3)), [poker]);
    let armado = agregarPieza(ARMADO_VACIO, { tipo: 'desmoche', juegoId: 'j1', cardId: 'oros-1' });
    armado = agregarPieza(armado, { tipo: 'mano', cardId: 'oros-2' });
    armado = agregarPieza(armado, { tipo: 'mesa' });
    expect(jugadaDelArmado(vistaDe(s, 0), armado)).toEqual({
      type: 'tomar',
      player: 0,
      cardIds: ['oros-2'],
      desmoche: { juegoId: 'j1', cardId: 'oros-1' },
    });
  });

  it('tres cartas que no forman juego no bajan nada', () => {
    const s = estado(mano, oferta(c('espadas', 5)));
    const armado: Armado = { cartas: ['oros-5', 'oros-12'], mesa: true, desmoche: null };
    expect(jugadaDelArmado(vistaDe(s, 0), armado)).toBeNull();
  });

  it('agregar y quitar piezas', () => {
    let a = agregarPieza(ARMADO_VACIO, { tipo: 'mano', cardId: 'x' });
    a = agregarPieza(a, { tipo: 'mano', cardId: 'x' });
    expect(a.cartas).toEqual(['x']);
    a = quitarPieza(a, { tipo: 'mano', cardId: 'x' });
    expect(a).toEqual(ARMADO_VACIO);
  });

  it('soltar una carta del armado fuera de la zona la regresa', () => {
    const pieza = { tipo: 'mano', cardId: 'oros-5' } as const;
    const r = alSoltar(
      vistaDe(estado(mano, botar), 0),
      { tipo: 'armado', pieza },
      { tipo: 'mano' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'desarmar', pieza });
  });

  it('no se arma si no es tu turno', () => {
    const s = estado(mano, { ...oferta(c('bastos', 4)), cola: [1, 0] } as Fase);
    const r = alSoltar(
      vistaDe(s, 0),
      { tipo: 'mano', cardId: 'oros-5' },
      { tipo: 'armado' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'nada', motivo: 'Espera tu turno.' });
  });
});

describe('alSoltar: intercambio', () => {
  const intercambio: Fase = { type: 'intercambio', elegidas: [null, null] };

  it('en tu lugar del intercambio, pasa la carta', () => {
    const r = alSoltar(
      vistaDe(estado(mano, intercambio), 0),
      { tipo: 'mano', cardId: 'oros-5' },
      { tipo: 'pasada' },
      SIN_SELECCION,
    );
    expect(r).toEqual({
      tipo: 'jugar',
      accion: { type: 'pasarCarta', player: 0, cardId: 'oros-5' },
    });
  });

  it('en el centro ya no la pasa: explica dónde soltarla', () => {
    const r = alSoltar(
      vistaDe(estado(mano, intercambio), 0),
      { tipo: 'mano', cardId: 'oros-5' },
      { tipo: 'centro' },
      SIN_SELECCION,
    );
    expect(r).toEqual({
      tipo: 'nada',
      motivo: 'Para pasarla, suéltala en el lugar marcado junto a tu mano.',
    });
  });

  it('si ya la elegiste, soltar otra en el lugar no hace nada', () => {
    const r = alSoltar(
      vistaDe(estado(mano, { type: 'intercambio', elegidas: ['oros-5', null] }), 0),
      { tipo: 'mano', cardId: 'oros-12' },
      { tipo: 'pasada' },
      SIN_SELECCION,
    );
    expect(r.tipo).toBe('nada');
  });
});

describe('alSoltar: el mazo', () => {
  const voltear = (jugador: number): Fase => ({ type: 'voltear', jugador });

  it('sacar la de arriba la voltea, se suelte donde se suelte (aun fuera de toda zona)', () => {
    for (const destino of [{ tipo: 'centro' } as const, { tipo: 'mano' } as const, null]) {
      const r = alSoltar(
        vistaDe(estado(mano, voltear(0)), 0),
        { tipo: 'mazo' },
        destino,
        SIN_SELECCION,
      );
      expect(r).toEqual({ tipo: 'jugar', accion: { type: 'voltear', player: 0 } });
    }
  });

  it('si no te toca, no saca nada y lo explica', () => {
    const r = alSoltar(
      vistaDe(estado(mano, voltear(1)), 0),
      { tipo: 'mazo' },
      { tipo: 'centro' },
      SIN_SELECCION,
    );
    expect(r).toEqual({ tipo: 'nada', motivo: 'Espera tu turno para sacar del mazo.' });
  });
});
