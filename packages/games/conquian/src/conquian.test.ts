import { VALORES_52, createDeck, createRng, type Card, type Palo, type Valor } from '@cartas/core';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULT, conquian, createConquian, obligadoATomar } from './conquian';
import type { ConquianState, Fase, Juego } from './types';

const c = (palo: Palo, valor: Valor): Card => ({ id: `${palo}-${valor}`, palo, valor });

/** Arma un estado a mano para probar una situación concreta. */
function estado(opts: {
  manos: Card[][];
  juegos?: Juego[][];
  mazo?: Card[];
  fase: Fase;
}): ConquianState {
  return {
    config: CONFIG_DEFAULT,
    jugadores: opts.manos.map((mano, i) => ({ mano, juegos: opts.juegos?.[i] ?? [] })),
    mazo: opts.mazo ?? [c('bastos', 12), c('bastos', 11)],
    muertas: [],
    fase: opts.fase,
    siguienteJuego: 10,
  };
}

const oferta = (carta: Card, cola: number[]): Fase => ({
  type: 'oferta',
  carta,
  origen: 'mazo',
  de: cola[0] ?? 0,
  cola,
  voltea: ((cola[0] ?? 0) + 1) % cola.length,
});

describe('setup', () => {
  it('reparte 9 cartas a cada uno y deja el resto en el mazo', () => {
    const s = conquian.setup(2, 'semilla');
    expect(s.jugadores.map((j) => j.mano.length)).toEqual([9, 9]);
    expect(s.mazo).toHaveLength(22);
    expect(s.fase.type).toBe('intercambio');
  });

  it('es reproducible con la misma semilla', () => {
    expect(conquian.setup(3, 'x')).toEqual(conquian.setup(3, 'x'));
    expect(conquian.setup(3, 'x')).not.toEqual(conquian.setup(3, 'y'));
  });

  it('acepta de 2 a 4 jugadores', () => {
    expect(() => conquian.setup(1, 's')).toThrow();
    expect(() => conquian.setup(5, 's')).toThrow();
    expect(() => conquian.setup(4, 's')).not.toThrow();
  });
});

describe('intercambio', () => {
  it('cada uno le pasa una carta al de su derecha y luego le toca voltear al jugador 0', () => {
    let s = conquian.setup(3, 'intercambio');
    const elegidas = s.jugadores.map((j) => j.mano[0]?.id ?? '');
    s = conquian.apply(s, { type: 'pasarCarta', player: 0, cardId: elegidas[0] ?? '' });
    s = conquian.apply(s, { type: 'pasarCarta', player: 1, cardId: elegidas[1] ?? '' });
    expect(s.fase.type).toBe('intercambio');
    s = conquian.apply(s, { type: 'pasarCarta', player: 2, cardId: elegidas[2] ?? '' });

    const ids = (p: number) => s.jugadores[p]?.mano.map((x) => x.id) ?? [];
    expect(ids(1)).toContain(elegidas[0]);
    expect(ids(2)).toContain(elegidas[1]);
    expect(ids(0)).toContain(elegidas[2]);
    expect(ids(0)).not.toContain(elegidas[0]);
    expect(s.jugadores.every((j) => j.mano.length === 9)).toBe(true);
    expect(s.fase).toEqual({ type: 'voltear', jugador: 0 });
  });

  it('no se puede elegir dos veces ni una carta ajena', () => {
    let s = conquian.setup(2, 'i');
    const ajena = s.jugadores[1]?.mano[0]?.id ?? '';
    expect(() => conquian.apply(s, { type: 'pasarCarta', player: 0, cardId: ajena })).toThrow();
    s = conquian.apply(s, {
      type: 'pasarCarta',
      player: 0,
      cardId: s.jugadores[0]?.mano[0]?.id ?? '',
    });
    const otra = s.jugadores[0]?.mano[1]?.id ?? '';
    expect(() => conquian.apply(s, { type: 'pasarCarta', player: 0, cardId: otra })).toThrow();
  });
});

describe('tomar la carta de la mesa', () => {
  const base = () =>
    estado({
      manos: [
        [c('oros', 5), c('copas', 5), c('oros', 1), c('espadas', 2)],
        [c('bastos', 1), c('bastos', 2), c('bastos', 3), c('copas', 7)],
      ],
      fase: oferta(c('bastos', 5), [0, 1]),
    });

  it('la baja de inmediato en un juego nuevo y nunca entra a la mano', () => {
    const s = conquian.apply(base(), {
      type: 'tomar',
      player: 0,
      cardIds: ['oros-5', 'copas-5'],
    });
    const j0 = s.jugadores[0];
    expect(j0?.juegos).toHaveLength(1);
    expect(j0?.juegos[0]?.cartas.map((x) => x.id).sort()).toEqual([
      'bastos-5',
      'copas-5',
      'oros-5',
    ]);
    expect(j0?.mano.map((x) => x.id)).toEqual(['oros-1', 'espadas-2']);
    expect(s.fase).toEqual({ type: 'botar', jugador: 0 });
  });

  it('se puede agregar a un juego propio ya bajado', () => {
    const s0 = estado({
      manos: [[c('oros', 1)], [c('copas', 1)]],
      juegos: [
        [{ id: 'j1', tipo: 'escalera', cartas: [c('bastos', 2), c('bastos', 3), c('bastos', 4)] }],
      ],
      fase: oferta(c('bastos', 5), [0, 1]),
    });
    const s = conquian.apply(s0, { type: 'tomar', player: 0, cardIds: [], juegoId: 'j1' });
    expect(s.jugadores[0]?.juegos[0]?.cartas.map((x) => x.valor)).toEqual([2, 3, 4, 5]);
  });

  it('no se puede agregar a un juego de otro jugador', () => {
    const s0 = estado({
      manos: [[c('oros', 1)], [c('copas', 1)]],
      juegos: [
        [],
        [{ id: 'j1', tipo: 'escalera', cartas: [c('bastos', 2), c('bastos', 3), c('bastos', 4)] }],
      ],
      fase: oferta(c('bastos', 5), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, { type: 'tomar', player: 0, cardIds: [], juegoId: 'j1' }),
    ).toThrow();
  });

  it('falla si las cartas no forman juego', () => {
    expect(() =>
      conquian.apply(base(), { type: 'tomar', player: 0, cardIds: ['oros-1', 'espadas-2'] }),
    ).toThrow();
  });

  it('falla si no es su turno', () => {
    expect(() =>
      conquian.apply(base(), { type: 'tomar', player: 1, cardIds: ['bastos-1', 'bastos-2'] }),
    ).toThrow(/turno/);
  });
});

describe('carta que entra en un juego propio', () => {
  const tercia: Juego = {
    id: 'j1',
    tipo: 'tercia',
    cartas: [c('oros', 3), c('espadas', 3), c('bastos', 3)],
  };
  const conTercia = (carta: Card, origen: 'mazo' | 'botada' = 'mazo') =>
    estado({
      manos: [[c('oros', 5), c('copas', 7)], [c('copas', 1)]],
      juegos: [[tercia]],
      fase: { type: 'oferta', carta, origen, de: 1, cola: [0, 1], voltea: 1 },
    });

  it('si la volteada entra en un juego que ya bajó, está obligado a tomarla', () => {
    const s = conTercia(c('copas', 3));
    expect(obligadoATomar(s, 0)).toBe(true);
    expect(conquian.validActions(s, 0).some((a) => a.type === 'pasar')).toBe(false);
    expect(() => conquian.apply(s, { type: 'pasar', player: 0 })).toThrow(/tomarla/);
  });

  it('también si se la botaron', () => {
    const s = conTercia(c('copas', 3), 'botada');
    expect(() => conquian.apply(s, { type: 'pasar', player: 0 })).toThrow(/tomarla/);
    const t = conquian.apply(s, { type: 'tomar', player: 0, cardIds: [], juegoId: 'j1' });
    expect(t.jugadores[0]?.juegos[0]?.cartas).toHaveLength(4);
    expect(t.fase).toEqual({ type: 'botar', jugador: 0 });
  });

  it('si no entra en ningún juego suyo, puede pasar', () => {
    const s = conTercia(c('copas', 4));
    expect(obligadoATomar(s, 0)).toBe(false);
    expect(conquian.validActions(s, 0)).toContainEqual({ type: 'pasar', player: 0 });
  });

  it('que haga juego nuevo con su mano no lo obliga', () => {
    const s = estado({
      manos: [[c('oros', 5), c('espadas', 5)], [c('copas', 1)]],
      fase: oferta(c('copas', 5), [0, 1]),
    });
    expect(obligadoATomar(s, 0)).toBe(false);
    expect(conquian.validActions(s, 0)).toContainEqual({ type: 'pasar', player: 0 });
  });

  it('que entre en el juego de otro no lo obliga', () => {
    const s = estado({
      manos: [[c('oros', 5)], [c('copas', 1)]],
      juegos: [[], [tercia]],
      fase: oferta(c('copas', 3), [0, 1]),
    });
    expect(obligadoATomar(s, 0)).toBe(false);
  });
});

describe('pasar', () => {
  it('la carta pasa al siguiente', () => {
    const s0 = estado({ manos: [[], [], []], fase: oferta(c('oros', 3), [0, 1, 2]) });
    const s = conquian.apply(s0, { type: 'pasar', player: 0 });
    expect(s.fase).toMatchObject({ type: 'oferta', cola: [1, 2] });
  });

  it('si nadie quiere la volteada queda muerta y voltea el de la derecha', () => {
    let s = estado({
      manos: [[c('oros', 1)], [c('oros', 2)], [c('oros', 4)]],
      mazo: [c('copas', 6), c('copas', 7)],
      fase: oferta(c('espadas', 12), [1, 2, 0]),
    });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    s = conquian.apply(s, { type: 'pasar', player: 2 });
    s = conquian.apply(s, { type: 'pasar', player: 0 });
    expect(s.muertas.map((x) => x.id)).toEqual(['espadas-12']);
    expect(s.fase).toEqual({ type: 'voltear', jugador: 2 });
    s = conquian.apply(s, { type: 'voltear', player: 2 });
    expect(s.mazo).toHaveLength(1);
    expect(s.fase).toMatchObject({ type: 'oferta', carta: c('copas', 6), cola: [2, 0, 1] });
  });

  it('si el 0 voltea y la usa el 2, el 2 paga y luego voltea el de su derecha', () => {
    let s = estado({
      manos: [[], [], [c('oros', 4), c('copas', 4), c('oros', 1)], []],
      mazo: [c('copas', 6), c('copas', 7)],
      fase: oferta(c('espadas', 4), [0, 1, 2, 3]),
    });
    s = conquian.apply(s, { type: 'pasar', player: 0 });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    s = conquian.apply(s, { type: 'tomar', player: 2, cardIds: ['oros-4', 'copas-4'] });
    s = conquian.apply(s, { type: 'botar', player: 2, cardId: 'oros-1' });
    expect(s.fase).toMatchObject({ origen: 'botada', cola: [3, 0, 1] });
    s = conquian.apply(s, { type: 'pasar', player: 3 });
    s = conquian.apply(s, { type: 'pasar', player: 0 });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    expect(s.muertas.map((x) => x.id)).toEqual(['oros-1']);
    expect(s.fase).toEqual({ type: 'voltear', jugador: 3 });
    s = conquian.apply(s, { type: 'voltear', player: 3 });
    expect(s.fase).toMatchObject({ origen: 'mazo', carta: c('copas', 6), cola: [3, 0, 1, 2] });
  });

  it('si se acaba el mazo sin ganador es empate', () => {
    let s = estado({
      manos: [[c('oros', 1)], [c('oros', 2)]],
      mazo: [],
      fase: oferta(c('copas', 4), [0, 1]),
    });
    s = conquian.apply(s, { type: 'pasar', player: 0 });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    expect(conquian.result(s)).toEqual({ type: 'empate' });
    expect(() => conquian.apply(s, { type: 'pasar', player: 0 })).toThrow(/terminó/);
  });
});

describe('botar', () => {
  it('la carta botada se ofrece a los demás en orden, sin el que botó', () => {
    const s0 = estado({
      manos: [[], [c('oros', 1), c('oros', 7)], [], []],
      fase: { type: 'botar', jugador: 1 },
    });
    const s = conquian.apply(s0, { type: 'botar', player: 1, cardId: 'oros-7' });
    expect(s.fase).toMatchObject({
      type: 'oferta',
      carta: c('oros', 7),
      origen: 'botada',
      cola: [2, 3, 0],
    });
    expect(s.jugadores[1]?.mano.map((x) => x.id)).toEqual(['oros-1']);
  });

  it('solo puede botar quien tomó la carta y una carta de su mano', () => {
    const s0 = estado({
      manos: [[c('oros', 1)], [c('oros', 2)]],
      fase: { type: 'botar', jugador: 0 },
    });
    expect(() => conquian.apply(s0, { type: 'botar', player: 1, cardId: 'oros-2' })).toThrow();
    expect(() => conquian.apply(s0, { type: 'botar', player: 0, cardId: 'oros-2' })).toThrow();
  });

  it('no se puede botar sin haber tomado', () => {
    const s0 = estado({ manos: [[c('oros', 1)], []], fase: oferta(c('copas', 4), [0, 1]) });
    expect(() => conquian.apply(s0, { type: 'botar', player: 0, cardId: 'oros-1' })).toThrow();
  });
});

describe('bajar desde la mano', () => {
  it('se puede bajar un juego sin tomar carta; la oferta sigue en pie', () => {
    const s0 = estado({
      manos: [[c('oros', 4), c('copas', 4), c('espadas', 4), c('oros', 1)], []],
      fase: oferta(c('bastos', 6), [0, 1]),
    });
    const s = conquian.apply(s0, {
      type: 'bajar',
      player: 0,
      cardIds: ['oros-4', 'copas-4', 'espadas-4'],
    });
    expect(s.jugadores[0]?.juegos).toHaveLength(1);
    expect(s.jugadores[0]?.mano.map((x) => x.id)).toEqual(['oros-1']);
    expect(s.fase).toEqual(s0.fase);
  });

  it('se puede agregar desde la mano a un juego propio', () => {
    const s0 = estado({
      manos: [[c('bastos', 4), c('oros', 1)], []],
      juegos: [
        [{ id: 'j1', tipo: 'tercia', cartas: [c('oros', 4), c('copas', 4), c('espadas', 4)] }],
      ],
      fase: oferta(c('bastos', 12), [0, 1]),
    });
    const s = conquian.apply(s0, {
      type: 'agregar',
      player: 0,
      juegoId: 'j1',
      cardIds: ['bastos-4'],
    });
    expect(s.jugadores[0]?.juegos[0]?.cartas).toHaveLength(4);
  });

  it('rechaza un juego inválido o cartas que no están en la mano', () => {
    const s0 = estado({
      manos: [[c('oros', 4), c('copas', 4), c('oros', 1)], []],
      fase: oferta(c('bastos', 12), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, { type: 'bajar', player: 0, cardIds: ['oros-4', 'copas-4', 'oros-1'] }),
    ).toThrow();
    expect(() =>
      conquian.apply(s0, { type: 'bajar', player: 0, cardIds: ['oros-4', 'copas-4', 'bastos-4'] }),
    ).toThrow();
    expect(() =>
      conquian.apply(s0, { type: 'bajar', player: 0, cardIds: ['oros-4', 'oros-4', 'copas-4'] }),
    ).toThrow();
  });
});

describe('desmoche', () => {
  const pokerDeAses: Juego = {
    id: 'j1',
    tipo: 'tercia',
    cartas: [c('oros', 1), c('copas', 1), c('espadas', 1), c('bastos', 1)],
  };

  it('del poker de As saca un As y con el 2 de la mano y el 3 de la mesa hace escalera', () => {
    const s0 = estado({
      manos: [[c('oros', 2), c('copas', 12)], []],
      juegos: [[pokerDeAses]],
      fase: oferta(c('oros', 3), [0, 1]),
    });
    const s = conquian.apply(s0, {
      type: 'tomar',
      player: 0,
      cardIds: ['oros-2'],
      desmoche: { juegoId: 'j1', cardId: 'oros-1' },
    });
    const juegos = s.jugadores[0]?.juegos ?? [];
    expect(juegos.find((j) => j.id === 'j1')?.cartas.map((x) => x.id)).toEqual([
      'copas-1',
      'espadas-1',
      'bastos-1',
    ]);
    const escalera = juegos.find((j) => j.id !== 'j1');
    expect(escalera?.tipo).toBe('escalera');
    expect(escalera?.cartas.map((x) => x.id)).toEqual(['oros-1', 'oros-2', 'oros-3']);
    expect(s.jugadores[0]?.mano.map((x) => x.id)).toEqual(['copas-12']);
    expect(s.fase).toEqual({ type: 'botar', jugador: 0 });
  });

  it('también se puede desmochar al bajar solo desde la mano', () => {
    const s0 = estado({
      manos: [[c('oros', 2), c('oros', 3), c('copas', 12)], []],
      juegos: [[pokerDeAses]],
      fase: oferta(c('bastos', 12), [0, 1]),
    });
    const s = conquian.apply(s0, {
      type: 'bajar',
      player: 0,
      cardIds: ['oros-2', 'oros-3'],
      desmoche: { juegoId: 'j1', cardId: 'oros-1' },
    });
    expect(s.jugadores[0]?.juegos).toHaveLength(2);
    expect(s.fase).toEqual(s0.fase);
  });

  it('una tercia no se puede desmochar: quedaría con menos de 3', () => {
    const tercia: Juego = { ...pokerDeAses, cartas: pokerDeAses.cartas.slice(0, 3) };
    const s0 = estado({
      manos: [[c('oros', 2)], []],
      juegos: [[tercia]],
      fase: oferta(c('oros', 3), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, {
        type: 'tomar',
        player: 0,
        cardIds: ['oros-2'],
        desmoche: { juegoId: 'j1', cardId: 'oros-1' },
      }),
    ).toThrow(/poker/);
  });

  it('una escalera no se puede desmochar', () => {
    const escalera: Juego = {
      id: 'j1',
      tipo: 'escalera',
      cartas: [c('copas', 1), c('copas', 2), c('copas', 3), c('copas', 4)],
    };
    const s0 = estado({
      manos: [[c('oros', 1), c('espadas', 1)], []],
      juegos: [[escalera]],
      fase: oferta(c('bastos', 1), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, {
        type: 'tomar',
        player: 0,
        cardIds: ['oros-1', 'espadas-1'],
        desmoche: { juegoId: 'j1', cardId: 'copas-1' },
      }),
    ).toThrow(/poker/);
  });

  it('no se puede desmochar el poker de otro jugador', () => {
    const s0 = estado({
      manos: [[c('oros', 2)], []],
      juegos: [[], [pokerDeAses]],
      fase: oferta(c('oros', 3), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, {
        type: 'tomar',
        player: 0,
        cardIds: ['oros-2'],
        desmoche: { juegoId: 'j1', cardId: 'oros-1' },
      }),
    ).toThrow();
  });

  it('falla si la carta desmochada no forma juego con las demás', () => {
    const s0 = estado({
      manos: [[c('copas', 2)], []],
      juegos: [[pokerDeAses]],
      fase: oferta(c('oros', 3), [0, 1]),
    });
    expect(() =>
      conquian.apply(s0, {
        type: 'tomar',
        player: 0,
        cardIds: ['copas-2'],
        desmoche: { juegoId: 'j1', cardId: 'oros-1' },
      }),
    ).toThrow();
  });

  it('validActions ofrece el desmoche', () => {
    const s0 = estado({
      manos: [[c('oros', 2), c('copas', 12)], []],
      juegos: [[pokerDeAses]],
      fase: oferta(c('oros', 3), [0, 1]),
    });
    expect(conquian.validActions(s0, 0)).toContainEqual({
      type: 'tomar',
      player: 0,
      cardIds: ['oros-2'],
      desmoche: { juegoId: 'j1', cardId: 'oros-1' },
    });
  });
});

describe('ganar', () => {
  const nueveBajadas: Juego[] = [
    { id: 'j1', tipo: 'escalera', cartas: [c('oros', 1), c('oros', 2), c('oros', 3)] },
    { id: 'j2', tipo: 'escalera', cartas: [c('copas', 1), c('copas', 2), c('copas', 3)] },
    { id: 'j3', tipo: 'tercia', cartas: [c('oros', 7), c('copas', 7), c('espadas', 7)] },
  ];

  it('con la carta 9 bajada y sin mano todavía no gana: espera la 10', () => {
    const s0 = estado({
      manos: [[c('oros', 12), c('copas', 12), c('espadas', 12)], []],
      juegos: [nueveBajadas.slice(0, 2)],
      fase: oferta(c('bastos', 1), [0, 1]),
    });
    const s = conquian.apply(s0, {
      type: 'bajar',
      player: 0,
      cardIds: ['oros-12', 'copas-12', 'espadas-12'],
    });
    expect(s.jugadores[0]?.mano).toHaveLength(0);
    expect(conquian.result(s)).toBeNull();
  });

  it('gana al tomar la carta 10 sin botar', () => {
    const s0 = estado({
      manos: [[], []],
      juegos: [nueveBajadas],
      fase: oferta(c('bastos', 7), [0, 1]),
    });
    const s = conquian.apply(s0, { type: 'tomar', player: 0, cardIds: [], juegoId: 'j3' });
    expect(conquian.result(s)).toEqual({ type: 'ganador', ganadores: [0] });
  });

  it('gana si después de tomar baja todo lo que le queda, sin botar', () => {
    const cuarta: Juego = {
      id: 'j1',
      tipo: 'tercia',
      cartas: [c('oros', 7), c('copas', 7), c('espadas', 7), c('bastos', 7)],
    };
    let s = estado({
      manos: [
        [c('bastos', 4), c('bastos', 5), c('oros', 12), c('copas', 12), c('espadas', 12)],
        [],
      ],
      juegos: [[cuarta]],
      fase: oferta(c('bastos', 6), [0, 1]),
    });
    s = conquian.apply(s, { type: 'tomar', player: 0, cardIds: ['bastos-4', 'bastos-5'] });
    expect(s.fase).toEqual({ type: 'botar', jugador: 0 });
    s = conquian.apply(s, {
      type: 'bajar',
      player: 0,
      cardIds: ['oros-12', 'copas-12', 'espadas-12'],
    });
    expect(conquian.result(s)).toEqual({ type: 'ganador', ganadores: [0] });
  });
});

describe('view', () => {
  it('no muestra las manos ajenas ni el mazo', () => {
    const s = conquian.setup(3, 'vista');
    const v = conquian.view(s, 1);
    expect(v.mano).toEqual(s.jugadores[1]?.mano);
    expect(v.jugadores.map((j) => j.cartasEnMano)).toEqual([9, 9, 9]);
    expect(v.mazo).toBe(s.mazo.length);
    const texto = JSON.stringify(v);
    for (const otro of [0, 2]) {
      for (const carta of s.jugadores[otro]?.mano ?? [])
        expect(texto).not.toContain(`"${carta.id}"`);
    }
    for (const carta of s.mazo) expect(texto).not.toContain(`"${carta.id}"`);
  });

  it('lleva las reglas de la partida, que son públicas', () => {
    const juego = createConquian({ cartasPorJugador: 9, baraja: { valores: [1, 2, 3, 4, 5] } });
    const v = juego.view(juego.setup(2, 'reglas'), 0);
    expect(v.config).toEqual({ cartasPorJugador: 9, baraja: { valores: [1, 2, 3, 4, 5] } });
  });

  it('en el intercambio no revela qué carta eligieron los demás', () => {
    let s = conquian.setup(2, 'vista2');
    const elegida = s.jugadores[0]?.mano[0]?.id ?? '';
    s = conquian.apply(s, { type: 'pasarCarta', player: 0, cardId: elegida });
    expect(conquian.view(s, 0).fase).toEqual({
      type: 'intercambio',
      miCarta: elegida,
      listos: [true, false],
    });
    expect(JSON.stringify(conquian.view(s, 1))).not.toContain(`"${elegida}"`);
  });

  it('todos ven quién puso la carta en la mesa y a quién se le ofrece', () => {
    let s = estado({
      manos: [[c('oros', 1)], [c('oros', 2)], [c('oros', 4)]],
      mazo: [c('copas', 6), c('copas', 7)],
      fase: oferta(c('espadas', 12), [1, 2, 0]),
    });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    for (const p of [0, 1, 2]) {
      expect(conquian.view(s, p).fase).toEqual({
        type: 'oferta',
        carta: c('espadas', 12),
        origen: 'mazo',
        de: 1,
        turno: 2,
      });
    }
  });
});

describe('voltear', () => {
  const s0 = () =>
    estado({
      manos: [[c('oros', 1)], [c('oros', 2)], [c('oros', 4)]],
      mazo: [c('copas', 6), c('copas', 7)],
      fase: { type: 'voltear', jugador: 1 },
    });

  it('solo puede voltear a quien le toca, y no puede hacer otra cosa', () => {
    expect(conquian.validActions(s0(), 1)).toEqual([{ type: 'voltear', player: 1 }]);
    expect(conquian.validActions(s0(), 0)).toEqual([]);
    expect(() => conquian.apply(s0(), { type: 'voltear', player: 0 })).toThrow(/turno/);
    expect(() => conquian.apply(s0(), { type: 'pasar', player: 1 })).toThrow();
  });

  it('saca la de arriba del mazo y se la ofrece primero a él', () => {
    const s = conquian.apply(s0(), { type: 'voltear', player: 1 });
    expect(s.mazo.map((x) => x.id)).toEqual(['copas-7']);
    expect(s.fase).toEqual({
      type: 'oferta',
      carta: c('copas', 6),
      origen: 'mazo',
      de: 1,
      cola: [1, 2, 0],
      voltea: 2,
    });
  });

  it('no se puede voltear fuera de su momento', () => {
    const s = estado({
      manos: [[c('oros', 1)], [c('oros', 2)]],
      fase: oferta(c('copas', 4), [0, 1]),
    });
    expect(() => conquian.apply(s, { type: 'voltear', player: 0 })).toThrow(/voltear/);
  });

  it('todos ven a quién le toca voltear', () => {
    expect(conquian.view(s0(), 0).fase).toEqual({ type: 'voltear', jugador: 1 });
  });
});

describe('quién puso la carta en la mesa', () => {
  it('la volteada es del que voltea y lo sigue siendo mientras la pasan', () => {
    let s = estado({
      manos: [[c('oros', 1)], [c('oros', 2)], [c('oros', 4)]],
      mazo: [c('copas', 6), c('copas', 7)],
      fase: oferta(c('espadas', 12), [1, 2, 0]),
    });
    s = conquian.apply(s, { type: 'pasar', player: 1 });
    expect(s.fase).toMatchObject({ de: 1, cola: [2, 0] });
    s = conquian.apply(s, { type: 'pasar', player: 2 });
    s = conquian.apply(s, { type: 'pasar', player: 0 });
    s = conquian.apply(s, { type: 'voltear', player: 2 });
    expect(s.fase).toMatchObject({ origen: 'mazo', carta: c('copas', 6), de: 2 });
  });

  it('la botada es del que la botó', () => {
    const s0 = estado({
      manos: [[], [c('oros', 1), c('oros', 7)], [], []],
      fase: { type: 'botar', jugador: 1 },
    });
    const s = conquian.apply(s0, { type: 'botar', player: 1, cardId: 'oros-7' });
    expect(s.fase).toMatchObject({ origen: 'botada', de: 1, cola: [2, 3, 0] });
  });
});

describe('partidas al azar', () => {
  it('toda acción de validActions se puede aplicar, no se pierden cartas y la partida termina', () => {
    const total = createDeck().length;
    for (let partida = 0; partida < 150; partida++) {
      const jugadores = 2 + (partida % 3);
      const rng = createRng(`azar-${partida}`);
      let s = conquian.setup(jugadores, `partida-${partida}`);
      for (let paso = 0; conquian.result(s) === null; paso++) {
        expect(paso).toBeLessThan(2000);
        const acciones = s.jugadores.flatMap((_, p) => conquian.validActions(s, p));
        expect(acciones.length).toBeGreaterThan(0);
        // Un poco sesgado a tomar y bajar para que haya ganadores.
        const buenas = acciones.filter((a) => a.type !== 'pasar');
        const lista = buenas.length > 0 && rng.next() < 0.7 ? buenas : acciones;
        const accion = lista[rng.int(lista.length)];
        if (!accion) throw new Error('sin acción');
        s = conquian.apply(s, accion);

        const enMesa = s.fase.type === 'oferta' ? 1 : 0;
        const cartas =
          s.mazo.length +
          s.muertas.length +
          enMesa +
          s.jugadores.reduce(
            (n, j) => n + j.mano.length + j.juegos.reduce((m, g) => m + g.cartas.length, 0),
            0,
          );
        expect(cartas).toBe(total);
      }
    }
  });
});

describe('baraja americana completa (52)', () => {
  const completa = createConquian({ cartasPorJugador: 9, baraja: { valores: VALORES_52 } });

  it('con 4 jugadores quedan 16 cartas en el mazo', () => {
    const s = completa.setup(4, 'completa');
    expect(s.jugadores.map((j) => j.mano.length)).toEqual([9, 9, 9, 9]);
    expect(s.mazo).toHaveLength(16);
  });

  it('partidas al azar: no se pierden cartas y terminan', () => {
    for (let partida = 0; partida < 40; partida++) {
      const rng = createRng(`c-${partida}`);
      let s = completa.setup(2 + (partida % 3), `completa-${partida}`);
      for (let paso = 0; completa.result(s) === null; paso++) {
        expect(paso).toBeLessThan(3000);
        const acciones = s.jugadores.flatMap((_, p) => completa.validActions(s, p));
        const buenas = acciones.filter((a) => a.type !== 'pasar');
        const lista = buenas.length > 0 && rng.next() < 0.7 ? buenas : acciones;
        const accion = lista[rng.int(lista.length)];
        if (!accion) throw new Error('sin acción');
        s = completa.apply(s, accion);
        const enMesa = s.fase.type === 'oferta' ? 1 : 0;
        const total =
          s.mazo.length +
          s.muertas.length +
          enMesa +
          s.jugadores.reduce(
            (n, j) => n + j.mano.length + j.juegos.reduce((m, g) => m + g.cartas.length, 0),
            0,
          );
        expect(total).toBe(52);
      }
    }
  });
});
