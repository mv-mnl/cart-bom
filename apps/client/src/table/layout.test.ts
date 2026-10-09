import { conquian, type ConquianState } from '@cartas/conquian';
import { describe, expect, it } from 'vitest';
import { SIN_SELECCION } from '../ui/opciones';
import { layoutMesa, textoOferta, zonaEn, type Escena } from './layout';
import { DORSO } from './texturas';

const escenaDe = (state: ConquianState, zonaArmado = false): Escena =>
  layoutMesa(conquian.view(state, 0), 1280, 760, {
    sel: SIN_SELECCION,
    nombres: ['Tú', 'Compu 1', 'Compu 2'],
    zonaArmado,
  });

const dentro = (z: { x: number; y: number; ancho: number; alto: number }, x: number, y: number) =>
  x >= z.x && x <= z.x + z.ancho && y >= z.y && y <= z.y + z.alto;

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

describe('tu lugar del intercambio (modos con arrastre)', () => {
  it('se suelta justo donde cae la carta en la animación, y gana sobre la zona de armado', () => {
    const e = escenaDe(inicio, true);
    const lugar = e.anclas.pasadas[0];
    if (!lugar) throw new Error('sin lugar');
    expect(zonaEn(e, lugar.x, lugar.y)).toEqual({ tipo: 'pasada' });
    // La carta elegida termina exactamente ahí.
    const despues = escenaDe(pasan(inicio, [0]), true);
    const pasada = despues.cartas.find((c) => c.key === miCarta);
    expect([pasada?.x, pasada?.y]).toEqual([lugar.x, lugar.y]);
  });

  it('no se encima con la zona de armado y se marca con su hueco y para quién es', () => {
    const e = escenaDe(inicio, true);
    const armado = e.zonas.find((z) => z.clave === 'armado');
    const lugar = e.anclas.pasadas[0];
    if (!armado || !lugar) throw new Error('falta algo');
    expect(dentro(armado, lugar.x, lugar.y)).toBe(false);
    expect(e.marcos.some((m) => m.tipo === 'hueco')).toBe(true);
    expect(e.etiquetas.find((t) => t.key === 'pasada-para')?.texto).toBe('Para Compu 1');
  });

  it('cuando ya la elegiste, ya no hay dónde soltar otra', () => {
    const e = escenaDe(pasan(inicio, [0]), true);
    expect(e.zonas.some((z) => z.clave === 'pasada')).toBe(false);
    expect(e.marcos.some((m) => m.tipo === 'hueco')).toBe(false);
  });
});

describe('lugares del intercambio: la misma regla para todos', () => {
  const pantallas: [number, number][] = [
    [2000, 1150],
    [1280, 760],
    [390, 780],
  ];
  for (const n of [2, 3, 4]) {
    for (const [ancho, alto] of pantallas) {
      it(`${n} jugadores en ${ancho}×${alto}: frente a su dueño, sin tocar el centro ni encimarse`, () => {
        const state = conquian.setup(n, 'lugares');
        const e = layoutMesa(conquian.view(state, 0), ancho, alto, {
          sel: SIN_SELECCION,
          nombres: [],
          zonaArmado: true,
        });
        const { centro, jugadores, pasadas, mazo } = e.anclas;
        pasadas.forEach((l, p) => {
          const dueno = jugadores[p];
          if (!dueno) throw new Error('sin dueño');
          // Más cerca de su dueño que del lado contrario.
          const haciaDueno =
            (l.x - centro.x) * (dueno.x - centro.x) + (l.y - centro.y) * (dueno.y - centro.y);
          expect(haciaDueno).toBeGreaterThan(0);
          // No tapa el mazo.
          expect(Math.abs(l.x - mazo.x) > 40 || Math.abs(l.y - mazo.y) > 60).toBe(true);
        });
        // Ninguna se encima con otra.
        for (let i = 0; i < pasadas.length; i++)
          for (let j = i + 1; j < pasadas.length; j++) {
            const a = pasadas[i];
            const b = pasadas[j];
            if (!a || !b) continue;
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40);
          }
      });
    }
  }
});

describe('la carta de la mesa', () => {
  // Tras el intercambio voltea el 0 (tú) y la carta se te ofrece primero.
  const ofrecida = pasan(inicio, [0, 1, 2]);
  const carta = (s: ConquianState) => {
    const { fase } = s;
    return fase.type === 'oferta'
      ? escenaDe(s).cartas.find((c) => c.key === fase.carta.id)
      : undefined;
  };

  it('se ve normal y se puede tocar cuando te la ofrecen a ti', () => {
    const c = carta(ofrecida);
    expect(c?.apagada).toBe(false);
    expect(c?.toque).toEqual({ tipo: 'mesa' });
  });

  it('se ve en gris y no se toca mientras la decide otro', () => {
    const s = conquian.apply(ofrecida, { type: 'pasar', player: 0 });
    const c = carta(s);
    expect(c?.apagada).toBe(true);
    expect(c?.toque).toBeNull();
  });
});

describe('textoOferta', () => {
  const nombres = ['Tú', 'Ana', 'Beto'];
  const fase = (origen: 'mazo' | 'botada', de: number, turno: number) =>
    ({
      type: 'oferta',
      carta: { id: 'oros-1', palo: 'oros', valor: 1 },
      origen,
      de,
      turno,
    }) as const;

  it('si es para ti, te pregunta', () => {
    expect(textoOferta(fase('mazo', 1, 0), 0, nombres)).toBe('¿Te sirve?');
  });
  it('si la volteó quien la decide, dice quién la volteó', () => {
    expect(textoOferta(fase('mazo', 1, 1), 0, nombres)).toBe('Volteó Ana');
  });
  it('si se la pasaron o la botaron, dice para quién es', () => {
    expect(textoOferta(fase('mazo', 1, 2), 0, nombres)).toBe('Para Beto');
    expect(textoOferta(fase('botada', 0, 1), 0, nombres)).toBe('Para Ana');
  });
});
