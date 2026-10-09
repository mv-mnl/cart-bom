import { conquian } from '@cartas/conquian';
import { describe, expect, it } from 'vitest';
import { DURACION_INTERCAMBIO } from './anim/tiempos';
import { esperaAlHumano, pausaIA } from './store';

const inicio = conquian.setup(3, 'cola');
const pasa = (s: typeof inicio, p: number) =>
  conquian.apply(s, { type: 'pasarCarta', player: p, cardId: s.jugadores[p]?.mano[0]?.id ?? '' });

describe('cola de la computadora en el intercambio', () => {
  it('espera a que elijas tu carta; después eligen los rivales', () => {
    expect(esperaAlHumano(inicio)).toBe(true);
    expect(esperaAlHumano(pasa(inicio, 0))).toBe(false);
  });

  it('al terminar el intercambio espera a que se vea la carta que recibió cada quien', () => {
    const casi = pasa(pasa(inicio, 0), 1);
    const despues = pasa(casi, 2);
    expect(despues.fase.type).toBe('voltear');
    expect(pausaIA(despues, casi)).toBeGreaterThanOrEqual(DURACION_INTERCAMBIO * 1000);
    expect(pausaIA(despues, despues)).toBeLessThan(DURACION_INTERCAMBIO * 1000);
  });

  it('antes de sacar del mazo la pausa es más corta que entre jugadas', () => {
    const voltear = pasa(pasa(pasa(inicio, 0), 1), 2);
    const oferta = conquian.apply(voltear, { type: 'voltear', player: 0 });
    expect(pausaIA(voltear, voltear)).toBeLessThan(pausaIA(oferta, voltear));
  });
});
