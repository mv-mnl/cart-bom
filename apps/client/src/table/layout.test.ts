import { conquian, type ConquianState } from '@cartas/conquian';
import { describe, expect, it } from 'vitest';
import { SIN_SELECCION } from '../ui/opciones';
import { layoutMesa, type Escena } from './layout';
import { DORSO } from './texturas';

const escenaDe = (state: ConquianState): Escena =>
  layoutMesa(conquian.view(state, 0), 1280, 760, {
    sel: SIN_SELECCION,
    nombres: ['Tú', 'Compu 1', 'Compu 2'],
  });

/** Aplica pasarCarta con la primera carta de la mano de cada jugador indicado. */
function pasan(state: ConquianState, jugadores: number[]): ConquianState {
  return jugadores.reduce((s, p) => {
    const carta = s.jugadores[p]?.mano[0];
    if (!carta) throw new Error('sin cartas');
    return conquian.apply(s, { type: 'pasarCarta', player: p, cardId: carta.id });
  }, state);
}

const inicio = conquian.setup(3, 'layout');
const miCarta = inicio.jugadores[0]?.mano[0]?.id ?? '';

describe('layout del intercambio', () => {
  it('la carta que elegiste sale de tu mano y espera boca abajo frente a ti', () => {
    const e = escenaDe(pasan(inicio, [0]));
    const pasada = e.cartas.find((c) => c.key === miCarta);
    expect(pasada?.textura).toBe(DORSO);
    expect(pasada?.toque).toBeNull();
    expect(e.cartas.filter((c) => c.toque?.tipo === 'mano')).toHaveLength(8);
    expect([pasada?.x, pasada?.y]).toEqual([e.anclas.pasadas[0]?.x, e.anclas.pasadas[0]?.y]);
  });

  it('un rival que ya eligió tiene una carta menos en la mano y una esperando', () => {
    const e = escenaDe(pasan(inicio, [0, 1]));
    expect(e.cartas.filter((c) => c.key.startsWith('oculta-1-'))).toHaveLength(8);
    expect(e.cartas.filter((c) => c.key.startsWith('oculta-2-'))).toHaveLength(9);
    expect(e.cartas.some((c) => c.key === 'pasada-1')).toBe(true);
    expect(e.cartas.some((c) => c.key === 'pasada-2')).toBe(false);
  });

  it('al terminar, lo que llega a cada mano viene de donde esperaba la carta del de la izquierda', () => {
    const despues = pasan(inicio, [0, 1, 2]);
    const e = escenaDe(despues);
    expect(e.cartas.some((c) => c.key.startsWith('pasada-'))).toBe(false);
    const recibida = despues.jugadores[0]?.mano.at(-1)?.id;
    expect(e.cartas.find((c) => c.key === recibida)?.origen).toEqual({ desde: { pasada: 2 } });
    // Cada rival recibe con una clave nueva, incluido el último en elegir (que nunca dejó
    // su carta esperando): así siempre se ve llegar.
    expect(e.cartas.find((c) => c.key === 'recibida-1')?.origen).toEqual({ desde: { pasada: 0 } });
    expect(e.cartas.find((c) => c.key === 'recibida-2')?.origen).toEqual({ desde: { pasada: 1 } });
    expect(e.cartas.filter((c) => c.key.startsWith('oculta-2-'))).toHaveLength(8);
  });
});
