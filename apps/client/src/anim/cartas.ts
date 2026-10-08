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
  /** En `repartirCarta`: cuánto se queda levantada, ya de cara, antes de asentarse (s). */
  readonly lucir?: number;
  /**
   * Cara con la que debe quedar. Hace falta cuando cambió mientras otra animación la tenía
   * (por ejemplo, la elegiste para pasar mientras se volteaba en el reparto).
   */
  readonly textura?: Texture;
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

/**
 * Animaciones que no se deben cortar a la mitad (reparto, intercambio, volteo del mazo):
 * si la carta tiene que ir a otro lado, primero terminan y luego se mueve.
 */
const protegidas = new WeakSet<gsap.core.Timeline>();
/** Destino de un reparto o intercambio en curso, que se puede corregir sin cortarlo. */
const seguibles = new WeakMap<Sprite, { x: number; y: number; rotation: number; escala: number }>();
/** A dónde ir cuando termine la animación protegida. */
const pendientes = new WeakMap<Sprite, { destino: Pose; opciones: OpcionesMovimiento }>();

function detener(sprite: Sprite): void {
  activas.get(sprite)?.kill();
  activas.delete(sprite);
  destinos.delete(sprite);
  pendientes.delete(sprite);
  seguibles.delete(sprite);
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
  // `timeScale` también alarga el retraso (a 0.5, el retraso dura el doble).
  const tl = gsap.timeline({ delay: retraso }).timeScale(velocidad);
  activas.set(sprite, tl);
  destinos.set(sprite, destino);
  tl.eventCallback('onComplete', () => {
    if (activas.get(sprite) !== tl) return;
    activas.delete(sprite);
    destinos.delete(sprite);
    seguibles.delete(sprite);
    if (zIndexFinal !== undefined) sprite.zIndex = zIndexFinal;
    const pendiente = pendientes.get(sprite);
    if (pendiente) {
      pendientes.delete(sprite);
      moverCarta(sprite, pendiente.destino, pendiente.opciones);
    }
  });
  if (zIndexFinal !== undefined) {
    tl.call(() => {
      sprite.zIndex = 50_000 + zIndexFinal;
    });
  }
  return tl;
}

/**
 * Lleva una carta a su lugar. Si está en una animación protegida (reparto, intercambio,
 * volteo), no la corta: el reparto y el intercambio siguen hacia el nuevo lugar, y el
 * volteo termina y después se mueve. Si no, la mueve ya.
 */
export function llevarA(sprite: Sprite, destino: Pose, opciones: OpcionesMovimiento = {}): void {
  const tl = activas.get(sprite);
  if (tl && protegidas.has(tl)) {
    // Un reparto o intercambio sigue al nuevo destino; lo que ya empezó se corrige al final.
    const seguible = seguibles.get(sprite);
    if (seguible) {
      Object.assign(seguible, destino);
      destinos.set(sprite, destino);
    }
    pendientes.set(sprite, { destino, opciones });
    return;
  }
  moverCarta(sprite, destino, opciones);
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
  if (opciones.textura) sprite.texture = opciones.textura;
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
  const tl = timelineSobre(sprite, destino, opciones);
  protegidas.add(tl);
  return tl
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

/** Una parada antes de cruzar la mesa: a dónde va primero y cuánto espera ahí (s). */
export interface Parada {
  readonly pose: Pose;
  readonly tramo: number;
  readonly espera: number;
}

/**
 * Reparto de una carta: sale boca abajo del mazo y cruza la mesa en curva, girando y
 * levantándose a medio camino. Si es tuya (`cara`), al llegar se voltea con un salto para
 * que se note qué te tocó; si es de un rival (`cara` null), llega boca abajo.
 * También la usa el intercambio: sin el giro de salida (`giro` false) y, para la carta del
 * último en elegir, con una `parada` en su lugar de espera antes de cruzar.
 */
export function repartirCarta(
  sprite: Sprite,
  destino: Pose,
  cara: Texture | null,
  dorso: Texture,
  opciones: OpcionesMovimiento & { readonly giro?: boolean; readonly parada?: Parada } = {},
): gsap.core.Timeline {
  detener(sprite);
  if (movimientoReducido()) {
    if (cara) sprite.texture = cara;
    colocarCarta(sprite, destino);
    return gsap.timeline();
  }
  sprite.texture = dorso;
  if (cara) carasPendientes.set(sprite, cara);

  // Destino que se puede corregir a medio camino (por ejemplo, si la mesa cambia de tamaño):
  // los tramos leen de aquí al empezar.
  const obj = { ...destino };
  seguibles.set(sprite, obj);
  const { parada, giro = true } = opciones;
  // El cruce empieza en `t0`: después de la parada, si la hay.
  const t0 = parada ? parada.tramo + parada.espera : 0;
  const x0 = parada ? parada.pose.x : sprite.x;
  const y0 = parada ? parada.pose.y : sprite.y;
  const dx = destino.x - x0;
  const dy = destino.y - y0;
  // Punto de control de la curva: a mitad de camino, desviado hacia un lado.
  const cx = x0 + dx / 2 - dy * CURVA_REPARTO;
  const cy = y0 + dy / 2 + dx * CURVA_REPARTO;
  const viaje = Math.min(0.5, Math.max(0.4, Math.hypot(dx, dy) / 1400));
  const lado = dx >= 0 ? 1 : -1;

  const tl = timelineSobre(sprite, destino, opciones);
  if (parada) {
    const { pose, tramo } = parada;
    tl.to(
      sprite,
      { x: pose.x, y: pose.y, rotation: pose.rotation, duration: tramo, ease: 'power2.out' },
      0,
    ).to(sprite.scale, { x: pose.escala, y: pose.escala, duration: tramo, ease: 'power2.out' }, 0);
  }
  const avance = { t: 0 };
  tl.to(
    avance,
    {
      t: 1,
      duration: viaje,
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = avance.t;
        const u = 1 - t;
        sprite.x = u * u * x0 + 2 * u * t * cx + t * t * obj.x;
        sprite.y = u * u * y0 + 2 * u * t * cy + t * t * obj.y;
      },
    },
    t0,
  );
  if (giro) {
    // El giro empieza cuando sale (no antes): mientras espera, sigue derecha sobre el mazo.
    tl.fromTo(
      sprite,
      { rotation: destino.rotation - GIRO_REPARTO * lado },
      { rotation: () => obj.rotation, duration: viaje, ease: 'power2.out', immediateRender: false },
      t0,
    );
  } else {
    tl.to(sprite, { rotation: () => obj.rotation, duration: viaje, ease: 'power2.out' }, t0);
  }
  // Se levanta y vuelve a bajar: da sensación de que cruza la mesa por el aire.
  tl.to(
    sprite.scale,
    {
      x: () => obj.escala * ALZA_REPARTO,
      y: () => obj.escala * ALZA_REPARTO,
      duration: viaje / 2,
      ease: 'sine.out',
    },
    t0,
  ).to(
    sprite.scale,
    { x: () => obj.escala, y: () => obj.escala, duration: viaje / 2, ease: 'sine.in' },
    t0 + viaje / 2,
  );

  protegidas.add(tl);

  if (!cara) return tl;
  // Ya en la mano: se voltea con un saltito (y se queda arriba `lucir` s) para que se vea.
  const lucir = opciones.lucir ?? 0;
  const volteo = 0.13;
  // Un salto de un 12 % de la altura de la carta.
  const salto = (cara.height || 0) * destino.escala * 0.12;
  const llega = t0 + viaje;
  return tl
    .to(sprite, { y: () => obj.y - salto, duration: volteo, ease: 'power1.out' }, llega)
    .to(
      sprite.scale,
      { x: 0, y: () => obj.escala * 1.1, duration: volteo, ease: 'power1.in' },
      llega,
    )
    .call(
      () => {
        sprite.texture = cara;
        carasPendientes.delete(sprite);
      },
      undefined,
      llega + volteo,
    )
    .to(
      sprite.scale,
      { x: () => obj.escala * 1.1, duration: volteo, ease: 'power1.out' },
      llega + volteo,
    )
    .to(sprite, { y: () => obj.y, duration: 0.28, ease: 'bounce.out' }, llega + volteo * 2 + lucir)
    .to(
      sprite.scale,
      { x: () => obj.escala, y: () => obj.escala, duration: 0.28, ease: 'back.out(2)' },
      llega + volteo * 2 + lucir,
    );
}
