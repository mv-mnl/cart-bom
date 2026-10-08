import gsap from 'gsap';
import type { Sprite, Texture } from 'pixi.js';

/** Dónde y cómo debe quedar una carta. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly escala: number;
}

export interface OpcionesMovimiento {
  readonly retraso?: number;
  /** zIndex al terminar; mientras viaja va por encima de las demás. */
  readonly zIndexFinal?: number;
}

let reducidoForzado: boolean | null = null;
/** Para probar: fuerza el movimiento reducido (true/false) o vuelve a la preferencia del sistema (null). */
export function forzarMovimientoReducido(valor: boolean | null): void {
  reducidoForzado = valor;
}

/** Con `prefers-reduced-motion` todo dura casi cero. */
export function movimientoReducido(): boolean {
  if (reducidoForzado !== null) return reducidoForzado;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Más lejos, un poco más de tiempo, dentro de un rango que se sienta ágil. */
function duracion(sprite: Sprite, destino: Pose, minimo = 0.16): number {
  if (movimientoReducido()) return 0;
  const distancia = Math.hypot(destino.x - sprite.x, destino.y - sprite.y);
  return Math.min(0.5, Math.max(minimo, distancia / 1400));
}

/** La animación en curso de cada carta, para poder detenerla. */
const activas = new WeakMap<Sprite, gsap.core.Timeline>();
/**
 * La cara de una carta que se está volteando. Si la volteada se interrumpe (otro movimiento,
 * un arrastre), hay que dejarla de cara: React no lo corrige porque para él nunca cambió.
 */
const carasPendientes = new WeakMap<Sprite, Texture>();

function detener(sprite: Sprite): void {
  activas.get(sprite)?.kill();
  activas.delete(sprite);
  const cara = carasPendientes.get(sprite);
  if (cara) {
    sprite.texture = cara;
    carasPendientes.delete(sprite);
  }
}

/**
 * Detiene la animación de una carta que sale de la pantalla. Hay que llamarlo antes de que
 * el sprite se destruya: si no, la animación seguiría escribiendo en un objeto muerto.
 */
export function olvidarCarta(sprite: Sprite): void {
  detener(sprite);
}

function timelineSobre(sprite: Sprite, { retraso = 0, zIndexFinal }: OpcionesMovimiento) {
  const tl = gsap.timeline({ delay: retraso });
  activas.set(sprite, tl);
  if (zIndexFinal !== undefined) {
    tl.call(() => {
      sprite.zIndex = 50_000 + zIndexFinal;
    });
    tl.eventCallback('onComplete', () => {
      sprite.zIndex = zIndexFinal;
    });
  }
  return tl;
}

/** Pone la carta en su lugar sin animar. */
export function colocarCarta(sprite: Sprite, pose: Pose): void {
  detener(sprite);
  sprite.position.set(pose.x, pose.y);
  sprite.rotation = pose.rotation;
  sprite.scale.set(pose.escala);
}

/** Lleva una carta de donde esté a su nuevo lugar. */
export function moverCarta(
  sprite: Sprite,
  destino: Pose,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline {
  detener(sprite);
  const d = duracion(sprite, destino);
  return timelineSobre(sprite, opciones)
    .to(
      sprite,
      { x: destino.x, y: destino.y, rotation: destino.rotation, duration: d, ease: 'power2.out' },
      0,
    )
    .to(sprite.scale, { x: destino.escala, y: destino.escala, duration: d, ease: 'power2.out' }, 0);
}

/** La carta viaja boca abajo y se voltea a la mitad del camino. */
export function voltearCarta(
  sprite: Sprite,
  destino: Pose,
  cara: Texture,
  dorso: Texture,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline {
  detener(sprite);
  if (movimientoReducido()) {
    sprite.texture = cara;
    colocarCarta(sprite, destino);
    return gsap.timeline();
  }
  const d = Math.max(0.36, duracion(sprite, destino));
  sprite.texture = dorso;
  carasPendientes.set(sprite, cara);
  return timelineSobre(sprite, opciones)
    .to(
      sprite,
      { x: destino.x, y: destino.y, rotation: destino.rotation, duration: d, ease: 'power2.out' },
      0,
    )
    .to(sprite.scale, { y: destino.escala, duration: d, ease: 'power2.out' }, 0)
    .to(sprite.scale, { x: 0, duration: d / 2, ease: 'power1.in' }, 0)
    .call(
      () => {
        sprite.texture = cara;
        carasPendientes.delete(sprite);
      },
      undefined,
      d / 2,
    )
    .to(sprite.scale, { x: destino.escala, duration: d / 2, ease: 'power1.out' }, d / 2);
}
