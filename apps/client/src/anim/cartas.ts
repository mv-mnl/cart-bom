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
  /** 1 es normal; 0.5 va a la mitad de velocidad (también el retraso). */
  readonly velocidad?: number;
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

/** A dónde va cada carta mientras se mueve. */
const destinos = new WeakMap<Sprite, Pose>();

/**
 * La carta ya va en camino a `pose`. Así un cambio de estado a media animación
 * (por ejemplo, la computadora eligiendo carta durante el reparto) no la reinicia.
 */
export function vaHacia(sprite: Sprite, pose: Pose): boolean {
  const d = destinos.get(sprite);
  return (
    d !== undefined &&
    activas.has(sprite) &&
    Math.abs(d.x - pose.x) < 0.5 &&
    Math.abs(d.y - pose.y) < 0.5 &&
    Math.abs(d.rotation - pose.rotation) < 0.001 &&
    Math.abs(d.escala - pose.escala) < 0.001
  );
}

function detener(sprite: Sprite): void {
  activas.get(sprite)?.kill();
  activas.delete(sprite);
  destinos.delete(sprite);
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

function timelineSobre(
  sprite: Sprite,
  destino: Pose,
  { retraso = 0, zIndexFinal, velocidad = 1 }: OpcionesMovimiento,
) {
  const tl = gsap.timeline({ delay: retraso / velocidad }).timeScale(velocidad);
  activas.set(sprite, tl);
  destinos.set(sprite, destino);
  tl.eventCallback('onComplete', () => {
    if (activas.get(sprite) !== tl) return;
    activas.delete(sprite);
    destinos.delete(sprite);
    if (zIndexFinal !== undefined) sprite.zIndex = zIndexFinal;
  });
  if (zIndexFinal !== undefined) {
    tl.call(() => {
      sprite.zIndex = 50_000 + zIndexFinal;
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
  return timelineSobre(sprite, destino, opciones)
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
  return timelineSobre(sprite, destino, opciones)
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
