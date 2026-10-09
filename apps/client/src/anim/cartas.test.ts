import gsap from 'gsap';
import type { Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { llevarA, moverCarta, olvidarCarta, repartirCarta, vaHacia, voltearCarta } from './cartas';

const cara = { nombre: 'cara' } as unknown as Texture;
const dorso = { nombre: 'dorso' } as unknown as Texture;

/** Lo mínimo de un Sprite que usan las animaciones. */
function spriteFalso(): Sprite {
  const scale = {
    x: 1,
    y: 1,
    set(v: number) {
      scale.x = v;
      scale.y = v;
    },
  };
  return { x: 0, y: 0, rotation: 0, zIndex: 0, texture: cara, scale } as unknown as Sprite;
}

const destino = { x: 300, y: 200, rotation: 0, escala: 1 };

describe('voltearCarta', () => {
  it('empieza boca abajo', () => {
    const s = spriteFalso();
    voltearCarta(s, destino, cara, dorso);
    expect(s.texture).toBe(dorso);
    olvidarCarta(s);
  });

  it('si otro movimiento la interrumpe, queda de cara (no se queda de dorso)', () => {
    const s = spriteFalso();
    voltearCarta(s, destino, cara, dorso);
    moverCarta(s, { ...destino, y: 250 });
    expect(s.texture).toBe(cara);
    olvidarCarta(s);
  });

  it('si se empieza a arrastrar a media volteada, queda de cara', () => {
    const s = spriteFalso();
    voltearCarta(s, destino, cara, dorso);
    olvidarCarta(s);
    expect(s.texture).toBe(cara);
  });
});

describe('moverCarta', () => {
  it('al cruzar la mesa vuela y aterriza exactamente en su lugar', () => {
    const s = spriteFalso();
    const tl = moverCarta(s, { x: 400, y: 300, rotation: 0.3, escala: 0.7 });
    tl.progress(0.3);
    // A medio camino va levantada (más grande que al salir y que al llegar).
    expect(s.scale.x).toBeGreaterThan(1);
    tl.progress(1);
    expect([s.x, s.y, s.rotation, s.scale.x, s.scale.y]).toEqual([400, 300, 0.3, 0.7, 0.7]);
  });

  it('un movimiento corto solo se acomoda, sin levantarse', () => {
    const s = spriteFalso();
    const tl = moverCarta(s, { x: 20, y: 0, rotation: 0, escala: 1 });
    tl.progress(0.5);
    expect(s.scale.x).toBe(1);
    tl.progress(1);
    expect(s.x).toBe(20);
  });
});

describe('velocidad', () => {
  it('a 0.5 la animación y su retraso duran el doble', () => {
    const s = spriteFalso();
    const normal = moverCarta(s, destino, { retraso: 0.1 });
    const lenta = moverCarta(spriteFalso(), destino, { retraso: 0.1, velocidad: 0.5 });
    expect(lenta.timeScale()).toBe(0.5);
    // Empieza al doble del retraso (en tiempo real), no al cuádruple.
    const ahora = gsap.globalTimeline.time();
    expect(lenta.startTime() - ahora).toBeCloseTo((normal.startTime() - ahora) * 2);
    expect(lenta.duration()).toBeCloseTo(normal.duration());
    olvidarCarta(s);
  });
});

describe('vaHacia', () => {
  it('sabe a dónde va una carta mientras se mueve, y lo olvida al detenerla', () => {
    const s = spriteFalso();
    moverCarta(s, destino, { velocidad: 0.5 });
    expect(vaHacia(s, destino)).toBe(true);
    expect(vaHacia(s, { ...destino, x: 10 })).toBe(false);
    olvidarCarta(s);
    expect(vaHacia(s, destino)).toBe(false);
  });
});

describe('repartirCarta', () => {
  it('tu carta sale boca abajo y, si se interrumpe, queda de cara', () => {
    const s = spriteFalso();
    repartirCarta(s, destino, cara, dorso);
    expect(s.texture).toBe(dorso);
    moverCarta(s, { ...destino, y: 250 });
    expect(s.texture).toBe(cara);
    olvidarCarta(s);
  });

  it('al terminar queda de cara y exactamente en su lugar', () => {
    const s = spriteFalso();
    repartirCarta(s, destino, cara, dorso).progress(1);
    expect(s.texture).toBe(cara);
    expect([s.x, s.y, s.rotation, s.scale.x, s.scale.y]).toEqual([300, 200, 0, 1, 1]);
  });

  it('la de un rival llega boca abajo', () => {
    const s = spriteFalso();
    repartirCarta(s, destino, null, dorso).progress(1);
    expect(s.texture).toBe(dorso);
    expect([s.x, s.y]).toEqual([300, 200]);
  });
});

describe('llevarA', () => {
  it('no corta un reparto: sigue su animación, pero hacia el nuevo lugar', () => {
    const s = spriteFalso();
    const tl = repartirCarta(s, destino, cara, dorso);
    const nuevo = { ...destino, x: 500, y: 150 };
    llevarA(s, nuevo);
    // Sigue en su animación (no se volteó de golpe) y ya va al nuevo lugar.
    expect(s.texture).toBe(dorso);
    expect(vaHacia(s, nuevo)).toBe(true);
    tl.progress(1);
    expect(s.texture).toBe(cara);
    expect([s.x, s.y]).toEqual([500, 150]);
    olvidarCarta(s);
  });

  it('no corta un volteo: como en el reparto, sigue hacia el nuevo lugar y se voltea al llegar', () => {
    const s = spriteFalso();
    const tl = voltearCarta(s, destino, cara, dorso);
    const nuevo = { ...destino, x: 500 };
    llevarA(s, nuevo);
    expect(s.texture).toBe(dorso);
    expect(vaHacia(s, nuevo)).toBe(true);
    tl.progress(1);
    expect(s.texture).toBe(cara);
    expect([s.x, s.y]).toEqual([500, 200]);
    olvidarCarta(s);
  });

  it('una carta en movimiento normal va directo al nuevo lugar', () => {
    const s = spriteFalso();
    moverCarta(s, destino);
    const nuevo = { ...destino, x: 500 };
    llevarA(s, nuevo);
    expect(vaHacia(s, nuevo)).toBe(true);
    olvidarCarta(s);
  });
});

describe('llevarA con textura', () => {
  it('si la carta cambió de cara durante una animación protegida, al final queda con la nueva', () => {
    const s = spriteFalso();
    const tl = repartirCarta(s, destino, cara, dorso);
    // La elegiste para pasar (boca abajo) mientras se volteaba en el reparto.
    llevarA(s, { ...destino, x: 500 }, { textura: dorso });
    tl.progress(1);
    expect(s.texture).toBe(dorso);
    olvidarCarta(s);
  });
});

describe('repartirCarta con parada', () => {
  it('primero va a su lugar de espera, espera ahí y luego cruza hasta el destino', () => {
    const s = spriteFalso();
    const lugar = { x: 100, y: 100, rotation: 0.25, escala: 0.8 };
    const tl = repartirCarta(s, destino, null, dorso, {
      giro: false,
      parada: { pose: lugar, tramo: 0.3, espera: 0.5 },
    });
    // Al final del tramo y durante la espera, está en su lugar.
    tl.seek(0.5);
    expect([s.x, s.y, s.rotation]).toEqual([100, 100, 0.25]);
    tl.progress(1);
    expect([s.x, s.y, s.rotation, s.scale.x]).toEqual([300, 200, 0, 1]);
  });
});
