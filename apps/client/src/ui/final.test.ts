import { CONFIG_DEFAULT, type ConquianState, type Fase, type Juego } from '@cartas/conquian';
import type { Card, Palo, Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { resumenFinal } from './final';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });
const juego = (id: string, cartas: Card[]): Juego => ({ id, tipo: 'escalera', cartas });

function estado(juegos: Juego[][], fase: Fase): ConquianState {
  return {
    config: CONFIG_DEFAULT,
    jugadores: juegos.map((js) => ({ mano: [], juegos: js })),
    mazo: [],
    muertas: [],
    fase,
    siguienteJuego: 10,
  };
}

const terminado = (ganadores: number[] | null): Fase => ({
  type: 'terminado',
  resultado: ganadores ? { type: 'ganador', ganadores } : { type: 'empate' },
});

const tres = (palo: Palo, id: string) => juego(id, [c(palo, 1), c(palo, 2), c(palo, 3)]);
const nombres = ['Tú', 'Compu 1', 'Compu 2'];

describe('resumenFinal', () => {
  it('es null mientras la partida sigue', () => {
    const s = estado([[], []], { type: 'botar', jugador: 0 });
    expect(resumenFinal(s, nombres, 0)).toBeNull();
  });

  it('si ganaste: título, meta de 10 y tú primero', () => {
    const s = estado(
      [[tres('oros', 'a'), tres('copas', 'b'), tres('espadas', 'c')], [tres('bastos', 'd')], []],
      terminado([0]),
    );
    const r = resumenFinal(s, nombres, 0);
    expect(r?.tipo).toBe('ganaste');
    expect(r?.titulo).toBe('¡Ganaste!');
    expect(r?.meta).toBe(10);
    expect(r?.filas.map((f) => [f.nombre, f.bajadas, f.gano])).toEqual([
      ['Tú', 9, true],
      ['Compu 1', 3, false],
      ['Compu 2', 0, false],
    ]);
  });

  it('si ganó otro: dice quién y lo pone primero aunque haya bajado menos', () => {
    const s = estado(
      [[tres('oros', 'a'), tres('copas', 'b')], [tres('bastos', 'd')], []],
      terminado([1]),
    );
    const r = resumenFinal(s, nombres, 0);
    expect(r?.tipo).toBe('perdiste');
    expect(r?.titulo).toBe('Ganó Compu 1');
    expect(r?.filas[0]?.nombre).toBe('Compu 1');
    expect(r?.filas.find((f) => f.esHumano)?.nombre).toBe('Tú');
  });

  it('empate cuando se acaba el mazo', () => {
    const r = resumenFinal(estado([[], []], terminado(null)), nombres, 0);
    expect(r?.tipo).toBe('empate');
    expect(r?.filas.every((f) => !f.gano)).toBe(true);
  });
});
