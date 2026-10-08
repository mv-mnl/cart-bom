import { describe, expect, it } from 'vitest';
import { conquian } from './conquian';
import { jugadaIA } from './ia';
import type { ConquianState } from './types';

/** Juega una partida completa con la IA en todos los puestos. */
function partidaIA(jugadores: number, seed: string): ConquianState {
  let s = conquian.setup(jugadores, seed);
  for (let paso = 0; conquian.result(s) === null; paso++) {
    if (paso > 2000) throw new Error('la partida no terminó');
    const player = s.jugadores.findIndex((_, p) => conquian.validActions(s, p).length > 0);
    const accion = jugadaIA(s, player);
    if (!accion) throw new Error(`la IA no encontró jugada para ${player}`);
    s = conquian.apply(s, accion);
  }
  return s;
}

describe('jugadaIA', () => {
  it('siempre devuelve una jugada válida y la partida termina', () => {
    for (let i = 0; i < 60; i++) partidaIA(2 + (i % 3), `ia-${i}`);
  });

  it('a veces gana alguien (no solo empates)', () => {
    const resultados = Array.from({ length: 60 }, (_, i) =>
      conquian.result(partidaIA(2, `g-${i}`)),
    );
    expect(resultados.some((r) => r?.type === 'ganador')).toBe(true);
  });

  it('no devuelve jugada si no es su turno', () => {
    const s = conquian.setup(2, 'turno');
    const conElegida = conquian.apply(s, {
      type: 'pasarCarta',
      player: 0,
      cardId: s.jugadores[0]?.mano[0]?.id ?? '',
    });
    expect(jugadaIA(conElegida, 0)).toBeNull();
  });
});
