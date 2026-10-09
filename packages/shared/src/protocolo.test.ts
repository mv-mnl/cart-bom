import type { CardGame } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { instantanea, jugadaPublica } from './protocolo';

/** Juego mínimo: cada quien tiene una carta secreta y puede pasarla al otro. */
interface Estado {
  readonly manos: readonly string[];
  readonly turno: number;
}
type Accion = { readonly type: 'pasarCarta'; readonly player: number; readonly cardId: string };
interface Vista {
  readonly yo: number;
  readonly mano: string;
  readonly turno: number;
}

const juego: CardGame<Estado, Accion, Vista> = {
  id: 'prueba',
  nombre: 'Prueba',
  minPlayers: 2,
  maxPlayers: 2,
  setup: () => ({ manos: ['secreta-0', 'secreta-1'], turno: 0 }),
  validActions: (s, p) =>
    s.turno === p ? [{ type: 'pasarCarta', player: p, cardId: s.manos[p] ?? '' }] : [],
  apply: (s) => ({ ...s, turno: 1 - s.turno }),
  view: (s, p) => ({ yo: p, mano: s.manos[p] ?? '', turno: s.turno }),
  result: () => null,
};

describe('instantanea', () => {
  const s = juego.setup(2, 'x');

  it('lleva la vista y las jugadas de ese jugador', () => {
    const i = instantanea(juego, s, 0);
    expect(i.view).toEqual(juego.view(s, 0));
    expect(i.acciones).toEqual(juego.validActions(s, 0));
    expect(i.jugada).toBeNull();
  });

  it('a quien no le toca no le llega ninguna jugada', () => {
    expect(instantanea(juego, s, 1).acciones).toEqual([]);
  });

  it('nunca lleva la carta secreta de otro, ni la que pasó en la última jugada', () => {
    const [accion] = juego.validActions(s, 0);
    if (!accion) throw new Error('sin jugada');
    const i = instantanea(juego, juego.apply(s, accion), 1, accion);
    expect(i.jugada).toEqual({ type: 'pasarCarta', player: 0 });
    expect(JSON.stringify(i)).not.toContain('secreta-0');
  });
});

describe('jugadaPublica', () => {
  it('se queda solo con el tipo y quién la hizo', () => {
    const botar = { type: 'botar', player: 2, cardId: 'oros-1' };
    expect(jugadaPublica(botar)).toEqual({ type: 'botar', player: 2 });
  });
});
