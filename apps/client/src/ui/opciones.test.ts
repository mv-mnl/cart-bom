import { CONFIG_DEFAULT, type ConquianState, type Juego } from '@cartas/conquian';
import type { Card, Palo, Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { SIN_SELECCION, opcionesSeleccion, sugerencias } from './opciones';
import { conArticulo, nombreCarta } from './baraja';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });

const escaleraBastos: Juego = {
  id: 'j1',
  tipo: 'escalera',
  cartas: [c('bastos', 1), c('bastos', 2), c('bastos', 3)],
};

function estado(mano: Card[], juegos: Juego[], carta: Card): ConquianState {
  return {
    config: CONFIG_DEFAULT,
    jugadores: [
      { mano, juegos },
      { mano: [c('copas', 1)], juegos: [] },
    ],
    mazo: [c('copas', 12)],
    muertas: [],
    fase: { type: 'oferta', carta, origen: 'mazo', de: 0, cola: [0, 1], voltea: 1 },
    siguienteJuego: 2,
  };
}

const sel = (cartas: string[]) => ({ cartas, desmoche: null });

describe('opcionesSeleccion', () => {
  const s = estado(
    [c('oros', 5), c('copas', 5), c('espadas', 5), c('oros', 1)],
    [escaleraBastos],
    c('bastos', 5),
  );

  it('con tres cincos y un cinco en la mesa ofrece el poker y la tercia de la mano', () => {
    const etiquetas = opcionesSeleccion(s, 0, sel(['oros-5', 'copas-5', 'espadas-5'])).map(
      (o) => o.etiqueta,
    );
    expect(etiquetas).toEqual(['Bajar poker de 5 con el 5 de bastos', 'Bajar tercia de 5']);
  });

  it('con dos cincos usa sola la carta de la mesa', () => {
    const [opcion] = opcionesSeleccion(s, 0, sel(['oros-5', 'copas-5']));
    expect(opcion?.accion).toEqual({ type: 'tomar', player: 0, cardIds: ['oros-5', 'copas-5'] });
    expect(opcion?.cartas.map((x) => x.id)).toEqual(['bastos-5', 'oros-5', 'copas-5']);
  });

  it('sin selección no hay opciones; con algo que no sirve, tampoco', () => {
    expect(opcionesSeleccion(s, 0, SIN_SELECCION)).toEqual([]);
    expect(opcionesSeleccion(s, 0, sel(['oros-5', 'oros-1']))).toEqual([]);
  });

  it('no da opciones a quien no tiene el turno', () => {
    expect(opcionesSeleccion(s, 1, sel(['copas-1']))).toEqual([]);
  });

  it('describe el desmoche', () => {
    const poker: Juego = {
      id: 'j1',
      tipo: 'tercia',
      cartas: [c('oros', 1), c('copas', 1), c('espadas', 1), c('bastos', 1)],
    };
    const conPoker = estado([c('oros', 2), c('copas', 12)], [poker], c('oros', 3));
    const [opcion] = opcionesSeleccion(conPoker, 0, {
      cartas: ['oros-2'],
      desmoche: { juegoId: 'j1', cardId: 'oros-1' },
    });
    expect(opcion?.etiqueta).toBe(
      'Bajar escalera de oros con el 3 de oros (desmochando el As de oros)',
    );
  });
});

describe('sugerencias', () => {
  it('sugiere agregar la carta de la mesa a un juego propio', () => {
    const s = estado([c('oros', 7), c('copas', 12)], [escaleraBastos], c('bastos', 4));
    expect(sugerencias(s, 0).map((o) => o.etiqueta)).toEqual([
      'Agregar el 4 de bastos a tu escalera de bastos',
    ]);
  });

  it('pone primero la jugada que baja más cartas de la mano', () => {
    const s = estado([c('oros', 1), c('oros', 2), c('oros', 4), c('copas', 12)], [], c('oros', 3));
    const [mejor] = sugerencias(s, 0);
    expect(mejor?.cartas.map((x) => x.valor).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('no sugiere nada si no hay jugada', () => {
    const s = estado([c('oros', 7), c('copas', 12)], [], c('bastos', 4));
    expect(sugerencias(s, 0)).toEqual([]);
  });
});

describe('conArticulo', () => {
  it('la Sota es femenina', () => {
    expect(conArticulo(c('oros', 10))).toBe('la Sota de oros');
    expect(conArticulo(c('oros', 11))).toBe('el Caballo de oros');
  });
});

describe('nombreCarta', () => {
  it('nombra las figuras', () => {
    expect(nombreCarta(c('oros', 1))).toBe('As de oros');
    expect(nombreCarta(c('copas', 11))).toBe('Caballo de copas');
  });
});

describe('baraja americana', () => {
  it('nombra las cartas con palos y figuras americanas', () => {
    expect(nombreCarta(c('espadas', 1), 'americana')).toBe('As de picas');
    expect(conArticulo(c('copas', 11), 'americana')).toBe('la Reina de corazones');
    expect(conArticulo(c('oros', 10), 'americana')).toBe('la Jota de diamantes');
    expect(conArticulo(c('bastos', 12), 'americana')).toBe('el Rey de tréboles');
  });

  it('las jugadas se describen con la baraja elegida', () => {
    const s = estado([c('oros', 7), c('copas', 12)], [escaleraBastos], c('bastos', 4));
    expect(sugerencias(s, 0, 4, 'americana').map((o) => o.etiqueta)).toEqual([
      'Agregar el 4 de tréboles a tu escalera de tréboles',
    ]);
  });
});
