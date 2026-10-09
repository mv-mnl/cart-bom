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

/** Por debajo de esta distancia (px) la carta solo se acomoda, sin vuelo (por ejemplo, al ordenar la mano). */
const DISTANCIA_VUELO = 60;
/** Balanceo de una carta que vuela de un lugar a otro (radianes, en el sentido del viaje). */
const BALANCEO = 0.22;

/**
 * Lleva una carta de donde esté a su nuevo lugar. Si cruza la mesa (botar, bajar, pasar)
 * vuela como en el reparto: en curva, levantándose y con un balanceo; al aterrizar se asienta.
 * Si apenas se mueve, se acomoda directo.
 */
export function moverCarta(
  sprite: Sprite,
  destino: Pose,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline {
  detener(sprite);
  if (opciones.textura) sprite.texture = opciones.textura;
  const tl = timelineSobre(sprite, destino, opciones);
  const distancia = Math.hypot(destino.x - sprite.x, destino.y - sprite.y);
  if (movimientoReducido() || distancia < DISTANCIA_VUELO) {
    const d = duracion(sprite, destino);
    return tl
      .to(
        sprite,
        { x: destino.x, y: destino.y, rotation: destino.rotation, duration: d, ease: 'power2.out' },
        0,
      )
      .to(
        sprite.scale,
        { x: destino.escala, y: destino.escala, duration: d, ease: 'power2.out' },
        0,
      );
  }
  const viaje = duracionVuelo(distancia, 0.3);
  trazarVuelo(
    tl,
    sprite,
    { ...destino },
    { x: sprite.x, y: sprite.y, escala: sprite.scale.x },
    0,
    viaje,
    {
      balanceo: BALANCEO,
    },
  );
  return asentar(tl, sprite, destino, viaje);
}

/** La carta está en una animación que no se corta (reparto, intercambio, volteo del mazo). */
const protegida = (sprite: Sprite) => {
  const tl = activas.get(sprite);
  return tl !== undefined && protegidas.has(tl);
};

/** Qué tanto avanza la carta hacia el siguiente cuando se la pasan (proporción, y tope en px). */
const EMPUJE = 0.32;
const EMPUJE_MAX = 110;

/**
 * La carta de la mesa pasa al siguiente: se desliza hacia él, ladeándose, y vuelve a su
 * lugar en el centro (aunque se haya movido), donde él la decide. Si se está volteando,
 * no la interrumpe y devuelve null.
 */
export function empujarCarta(
  sprite: Sprite,
  lugar: Pose,
  hacia: { readonly x: number; readonly y: number },
): gsap.core.Timeline | null {
  if (protegida(sprite) || movimientoReducido()) return null;
  const dx = hacia.x - lugar.x;
  const dy = hacia.y - lugar.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia < 1) return null;
  const avance = Math.min(distancia * EMPUJE, EMPUJE_MAX) / distancia;
  const lado = dx >= 0 ? 1 : -1;
  detener(sprite);
  // Si la mesa se reacomoda mientras tanto, el empujón no se corta: regresa al lugar nuevo.
  const obj = { ...lugar };
  seguibles.set(sprite, obj);
  const tl = timelineSobre(sprite, lugar, {});
  protegidas.add(tl);
  return tl
    .to(
      sprite,
      {
        x: () => obj.x + dx * avance,
        y: () => obj.y + dy * avance,
        rotation: () => obj.rotation + 0.14 * lado,
        duration: 0.22,
        ease: 'power2.out',
      },
      0,
    )
    .to(sprite.scale, { x: () => obj.escala * 1.06, y: () => obj.escala * 1.06, duration: 0.22 }, 0)
    .to(
      sprite,
      {
        x: () => obj.x,
        y: () => obj.y,
        rotation: () => obj.rotation,
        duration: 0.34,
        ease: 'power2.inOut',
      },
      0.3,
    )
    .to(
      sprite.scale,
      { x: () => obj.escala, y: () => obj.escala, duration: 0.34, ease: 'power2.inOut' },
      0.3,
    );
}

/** Qué tan alto sube la carta que se tira a las muertas (proporción de la distancia). */
const ARCO_TIRO = 0.45;

/**
 * Nadie quiso la carta: se tira a las muertas. Sube en arco dando una vuelta completa
 * y cae en la pila con un rebote. Si se está volteando, termina y luego va.
 */
export function tirarCarta(
  sprite: Sprite,
  destino: Pose,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline | null {
  const distancia = Math.hypot(destino.x - sprite.x, destino.y - sprite.y);
  if (protegida(sprite) || movimientoReducido() || distancia < DISTANCIA_VUELO) {
    llevarA(sprite, destino, opciones);
    return null;
  }
  detener(sprite);
  const desde = { x: sprite.x, y: sprite.y, rotation: sprite.rotation, escala: sprite.scale.x };
  const cx = (desde.x + destino.x) / 2;
  const cy = Math.min(desde.y, destino.y) - distancia * ARCO_TIRO;
  const lado = destino.x >= desde.x ? 1 : -1;
  const viaje = Math.max(0.45, duracionVuelo(distancia, 0.3));
  const tl = timelineSobre(sprite, destino, opciones);
  const avance = { t: 0 };
  tl.to(
    avance,
    {
      t: 1,
      duration: viaje,
      ease: 'power1.inOut',
      onUpdate: () => {
        const t = avance.t;
        const u = 1 - t;
        sprite.x = u * u * desde.x + 2 * u * t * cx + t * t * destino.x;
        sprite.y = u * u * desde.y + 2 * u * t * cy + t * t * destino.y;
      },
    },
    0,
  )
    .fromTo(
      sprite,
      { rotation: desde.rotation },
      {
        rotation: destino.rotation + Math.PI * 2 * lado,
        duration: viaje,
        ease: 'power1.out',
        immediateRender: false,
        onComplete: () => {
          sprite.rotation = destino.rotation;
        },
      },
      0,
    )
    .to(
      sprite.scale,
      { x: desde.escala * 1.2, y: desde.escala * 1.2, duration: viaje / 2, ease: 'sine.out' },
      0,
    )
    .to(
      sprite.scale,
      { x: destino.escala, y: destino.escala, duration: viaje / 2, ease: 'sine.in' },
      viaje / 2,
    );
  return asentar(tl, sprite, destino, viaje);
}

/**
 * La carta del mazo: cruza boca abajo como en el reparto y, al llegar, se voltea con un
 * saltito para que se vea qué salió.
 */
export function voltearCarta(
  sprite: Sprite,
  destino: Pose,
  cara: Texture,
  dorso: Texture,
  opciones: OpcionesMovimiento = {},
): gsap.core.Timeline {
  return repartirCarta(sprite, destino, cara, dorso, { ...opciones, giro: false });
}

/** Qué tanto se curva el viaje del reparto (proporción de la distancia). */
const CURVA_REPARTO = 0.18;
/** Cuánto "se levanta" la carta a medio camino. */
const ALZA_REPARTO = 1.18;
/** Giro extra con el que sale del mazo (radianes). */
const GIRO_REPARTO = 0.6;

/** Duración del vuelo según la distancia: más lejos, un poco más, sin pasar de medio segundo. */
function duracionVuelo(distancia: number, minimo: number): number {
  return Math.min(0.5, Math.max(minimo, distancia / 1400));
}

/** Qué tanto se levanta una carta según lo lejos que va: los viajes cortos casi no se alzan. */
function alzaPara(distancia: number): number {
  return 1 + (ALZA_REPARTO - 1) * Math.min(1, distancia / 350);
}

/**
 * El vuelo que comparten todas las animaciones: de `desde` a `obj` en curva, levantándose
 * a medio camino y girando hasta su rotación final. Lee `obj` en cada cuadro, así el destino
 * se puede corregir a medio camino.
 */
function trazarVuelo(
  tl: gsap.core.Timeline,
  sprite: Sprite,
  obj: Pose,
  desde: { readonly x: number; readonly y: number; readonly escala: number },
  t0: number,
  viaje: number,
  { giro = 0, balanceo = 0 }: { readonly giro?: number; readonly balanceo?: number },
): void {
  const dx = obj.x - desde.x;
  const dy = obj.y - desde.y;
  // Punto de control de la curva: a mitad de camino, desviado hacia un lado.
  const cx = desde.x + dx / 2 - dy * CURVA_REPARTO;
  const cy = desde.y + dy / 2 + dx * CURVA_REPARTO;
  const lado = dx >= 0 ? 1 : -1;
  // Se alza sobre la mayor de las dos escalas: de la mano a la mesa también se nota.
  const alza = alzaPara(Math.hypot(dx, dy));
  const arriba = () => Math.max(desde.escala, obj.escala) * alza;
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
        sprite.x = u * u * desde.x + 2 * u * t * cx + t * t * obj.x;
        sprite.y = u * u * desde.y + 2 * u * t * cy + t * t * obj.y;
      },
    },
    t0,
  );
  if (giro) {
    // El giro empieza cuando sale (no antes): mientras espera, sigue derecha sobre el mazo.
    tl.fromTo(
      sprite,
      { rotation: obj.rotation - giro * lado },
      { rotation: () => obj.rotation, duration: viaje, ease: 'power2.out', immediateRender: false },
      t0,
    );
  } else if (balanceo) {
    // Se ladea hacia donde va y se endereza al llegar.
    tl.to(
      sprite,
      { rotation: () => obj.rotation + balanceo * lado, duration: viaje / 2, ease: 'sine.out' },
      t0,
    ).to(
      sprite,
      { rotation: () => obj.rotation, duration: viaje / 2, ease: 'sine.inOut' },
      t0 + viaje / 2,
    );
  } else {
    tl.to(sprite, { rotation: () => obj.rotation, duration: viaje, ease: 'power2.out' }, t0);
  }
  // Se levanta y vuelve a bajar: da sensación de que cruza la mesa por el aire.
  tl.to(
    sprite.scale,
    {
      x: arriba,
      y: arriba,
      duration: viaje / 2,
      ease: 'sine.out',
    },
    t0,
  ).to(
    sprite.scale,
    { x: () => obj.escala, y: () => obj.escala, duration: viaje / 2, ease: 'sine.in' },
    t0 + viaje / 2,
  );
}

/** Al aterrizar, la carta se aplasta un poquito y rebota a su tamaño. */
function asentar(
  tl: gsap.core.Timeline,
  sprite: Sprite,
  destino: Pose,
  llega: number,
): gsap.core.Timeline {
  return tl
    .to(
      sprite.scale,
      { x: destino.escala * 0.95, y: destino.escala * 0.95, duration: 0.06, ease: 'power1.out' },
      llega,
    )
    .to(
      sprite.scale,
      { x: destino.escala, y: destino.escala, duration: 0.22, ease: 'back.out(3)' },
      llega + 0.06,
    );
}

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
  const viaje = duracionVuelo(Math.hypot(destino.x - x0, destino.y - y0), 0.4);

  const tl = timelineSobre(sprite, destino, opciones);
  if (parada) {
    const { pose, tramo } = parada;
    tl.to(
      sprite,
      { x: pose.x, y: pose.y, rotation: pose.rotation, duration: tramo, ease: 'power2.out' },
      0,
    ).to(sprite.scale, { x: pose.escala, y: pose.escala, duration: tramo, ease: 'power2.out' }, 0);
  }
  trazarVuelo(
    tl,
    sprite,
    obj,
    { x: x0, y: y0, escala: parada ? parada.pose.escala : sprite.scale.x },
    t0,
    viaje,
    {
      giro: giro ? GIRO_REPARTO : 0,
    },
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
