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

/** Qué tanto se curva el viaje del reparto (proporción de la distancia). */
const CURVA_REPARTO = 0.18;
/** Cuánto "se levanta" la carta a medio camino. */
const ALZA_REPARTO = 1.18;
/** Giro extra con el que sale del mazo (radianes). */
const GIRO_REPARTO = 0.6;

/**
 * Reparto de una carta: sale boca abajo del mazo y cruza la mesa en curva, girando y
 * levantándose a medio camino. Si es tuya (`cara`), al llegar se voltea con un salto para
 * que se note qué te tocó; si es de un rival (`cara` null), llega boca abajo.
 */
export function repartirCarta(
  sprite: Sprite,
  destino: Pose,
  cara: Texture | null,
  dorso: Texture,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline {
  detener(sprite);
  if (movimientoReducido()) {
    if (cara) sprite.texture = cara;
    colocarCarta(sprite, destino);
    return gsap.timeline();
  }
  sprite.texture = dorso;
  if (cara) carasPendientes.set(sprite, cara);

  const x0 = sprite.x;
  const y0 = sprite.y;
  const dx = destino.x - x0;
  const dy = destino.y - y0;
  // Punto de control de la curva: a mitad de camino, desviado hacia un lado.
  const cx = x0 + dx / 2 - dy * CURVA_REPARTO;
  const cy = y0 + dy / 2 + dx * CURVA_REPARTO;
  const viaje = Math.max(0.4, duracion(sprite, destino, 0.4));
  const lado = dx >= 0 ? 1 : -1;

  const avance = { t: 0 };
  const tl = timelineSobre(sprite, destino, opciones)
    .to(
      avance,
      {
        t: 1,
        duration: viaje,
        ease: 'power2.inOut',
        onUpdate: () => {
          const t = avance.t;
          const u = 1 - t;
          sprite.x = u * u * x0 + 2 * u * t * cx + t * t * destino.x;
          sprite.y = u * u * y0 + 2 * u * t * cy + t * t * destino.y;
        },
      },
      0,
    )
    // El giro empieza cuando sale (no antes): mientras espera, sigue derecha sobre el mazo.
    .fromTo(
      sprite,
      { rotation: destino.rotation - GIRO_REPARTO * lado },
      { rotation: destino.rotation, duration: viaje, ease: 'power2.out', immediateRender: false },
      0,
    )
    // Se levanta y vuelve a bajar: da sensación de que cruza la mesa por el aire.
    .to(
      sprite.scale,
      {
        x: destino.escala * ALZA_REPARTO,
        y: destino.escala * ALZA_REPARTO,
        duration: viaje / 2,
        ease: 'sine.out',
      },
      0,
    )
    .to(
      sprite.scale,
      { x: destino.escala, y: destino.escala, duration: viaje / 2, ease: 'sine.in' },
      viaje / 2,
    );

  if (!cara) return tl;
  // Ya en la mano: se voltea con un saltito para que se vea qué carta es.
  const volteo = 0.13;
  // Un salto de un 12 % de la altura de la carta.
  const salto = (cara.height || 0) * destino.escala * 0.12;
  return tl
    .to(sprite, { y: destino.y - salto, duration: volteo, ease: 'power1.out' }, viaje)
    .to(sprite.scale, { x: 0, y: destino.escala * 1.1, duration: volteo, ease: 'power1.in' }, viaje)
    .call(
      () => {
        sprite.texture = cara;
        carasPendientes.delete(sprite);
      },
      undefined,
      viaje + volteo,
    )
    .to(
      sprite.scale,
      { x: destino.escala * 1.1, duration: volteo, ease: 'power1.out' },
      viaje + volteo,
    )
    .to(sprite, { y: destino.y, duration: 0.28, ease: 'bounce.out' }, viaje + volteo * 2)
    .to(
      sprite.scale,
      { x: destino.escala, y: destino.escala, duration: 0.28, ease: 'back.out(2)' },
      viaje + volteo * 2,
    );
}
