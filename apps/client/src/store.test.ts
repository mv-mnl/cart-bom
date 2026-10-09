import { CONFIG_DEFAULT, conquian, type ConquianState } from '@cartas/conquian';
import type { Card, Palo, Valor } from '@cartas/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DURACION_INTERCAMBIO } from './anim/tiempos';
import {
  ESPERA_AUTOMATICA_MS,
  HUMANO,
  enLocal,
  esperaAlHumano,
  pausaIA,
  usePartida,
} from './store';

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

describe('partida local', () => {
  it('la interfaz recibe solo la vista del humano, con la última jugada', () => {
    const { nueva, jugar, salir } = usePartida.getState();
    nueva(2);
    const inicial = usePartida.getState().vista;
    expect(inicial?.view.yo).toBe(HUMANO);
    expect(inicial?.jugada).toBeNull();
    const pasarCarta = inicial?.acciones.find((a) => a.type === 'pasarCarta');
    if (!pasarCarta) throw new Error('sin jugada de intercambio');
    jugar(pasarCarta);
    const { vista, local } = usePartida.getState();
    expect(vista?.jugada).toEqual({ type: 'pasarCarta', player: HUMANO });
    expect(vista?.view).toEqual(local && conquian.view(local, HUMANO));
    salir();
    expect(usePartida.getState().vista).toBeNull();
  });
});

describe('jugadas automáticas', () => {
  afterEach(() => {
    usePartida.getState().salir();
    vi.useRealTimers();
  });

  /** Partida de 2 donde al humano le ofrecen el 4 de bastos y tiene bajada la escalera 1-2-3. */
  function obligado(): ConquianState {
    const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });
    return {
      config: CONFIG_DEFAULT,
      jugadores: [
        {
          mano: [c('oros', 7), c('copas', 12)],
          juegos: [
            {
              id: 'j1',
              tipo: 'escalera',
              cartas: [c('bastos', 1), c('bastos', 2), c('bastos', 3)],
            },
          ],
        },
        { mano: [c('copas', 1)], juegos: [] },
      ],
      mazo: [c('espadas', 12)],
      muertas: [],
      fase: {
        type: 'oferta',
        carta: c('bastos', 4),
        origen: 'mazo',
        de: 0,
        cola: [0, 1],
        voltea: 1,
      },
      siguienteJuego: 2,
    };
  }

  it('la carta que entra en un juego tuyo se agrega sola después de la pausa', () => {
    vi.useFakeTimers();
    usePartida.setState(enLocal(obligado()));
    vi.advanceTimersByTime(ESPERA_AUTOMATICA_MS - 1);
    expect(usePartida.getState().vista?.view.fase.type).toBe('oferta');
    vi.advanceTimersByTime(1);
    const { vista } = usePartida.getState();
    expect(vista?.jugada).toEqual({ type: 'tomar', player: 0 });
    expect(vista?.view.jugadores[0]?.juegos[0]?.cartas).toHaveLength(4);
    expect(vista?.view.fase).toEqual({ type: 'botar', jugador: 0 });
  });

  it('apagadas (laboratorio), no se hace nada', () => {
    vi.useFakeTimers();
    usePartida.setState({ automaticas: false, ...enLocal(obligado()) });
    vi.advanceTimersByTime(ESPERA_AUTOMATICA_MS * 2);
    expect(usePartida.getState().vista?.view.fase.type).toBe('oferta');
    usePartida.setState({ automaticas: true });
  });
});
