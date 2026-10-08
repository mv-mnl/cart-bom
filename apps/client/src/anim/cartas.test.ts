import type { Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { moverCarta, olvidarCarta, voltearCarta } from './cartas';

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
