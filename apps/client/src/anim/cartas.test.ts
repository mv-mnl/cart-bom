import type { Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { moverCarta, olvidarCarta, vaHacia, voltearCarta } from './cartas';

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

describe('velocidad', () => {
  it('a 0.5 la animación y su retraso duran el doble', () => {
    const s = spriteFalso();
    const normal = moverCarta(s, destino, { retraso: 0.1 });
    const lenta = moverCarta(spriteFalso(), destino, { retraso: 0.1, velocidad: 0.5 });
    expect(lenta.timeScale()).toBe(0.5);
    expect(lenta.delay()).toBeCloseTo(normal.delay() * 2);
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
