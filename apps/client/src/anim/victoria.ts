import gsap from 'gsap';
import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  Text,
  type Application,
  type Texture,
} from 'pixi.js';
import { movimientoReducido } from './cartas';

const COLORES = [0xffd54a, 0xff6b6b, 0x4dd0e1, 0x81c784, 0xba68c8, 0xffffff];
/** Cuándo sube el letrero para dejarle lugar al panel (s). Debe coincidir con `entradaPanel`. */
const SUBIR_LETRERO = 1.1;

export type TipoFinal = 'ganaste' | 'perdiste' | 'empate';

let texturaConfeti: Texture | null = null;
/** Un rectángulo blanco que se tiñe de colores: una sola textura para todo el confeti. */
function confeti(app: Application): Texture {
  if (!texturaConfeti) {
    const g = new Graphics().rect(0, 0, 10, 6).fill(0xffffff);
    texturaConfeti = app.renderer.generateTexture(g);
    g.destroy();
  }
  return texturaConfeti;
}

let texturaRayos: Texture | null = null;
/** Rayos de luz detrás del letrero. Se dibujan una sola vez. */
function rayos(app: Application): Texture {
  if (!texturaRayos) {
    const radio = 400;
    const n = 14;
    const g = new Graphics();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = a + Math.PI / n;
      g.moveTo(radio, radio)
        .lineTo(radio + Math.cos(a) * radio, radio + Math.sin(a) * radio)
        .lineTo(radio + Math.cos(b) * radio, radio + Math.sin(b) * radio)
        .closePath();
    }
    g.fill({ color: 0xffe08a, alpha: 0.18 });
    g.circle(radio, radio, radio * 0.3).fill({ color: 0xffe08a, alpha: 0.12 });
    texturaRayos = app.renderer.generateTexture(g);
    g.destroy();
  }
  return texturaRayos;
}

interface Pedazo {
  readonly p: Particle;
  /** Cuadros que faltan para salir disparado. */
  espera: number;
  x0: number;
  y0: number;
  vx0: number;
  vy0: number;
  vx: number;
  vy: number;
  giro: number;
  fase: number;
}

/** Un disparo de confeti: desde dónde, hacia dónde y cuándo. */
interface Disparo {
  readonly x: number;
  readonly y: number;
  /** Ángulo central (radianes; -π/2 es hacia arriba). */
  readonly angulo: number;
  readonly abertura: number;
  readonly fuerza: number;
  readonly cantidad: number;
  /** Segundos desde que empieza la celebración. */
  readonly cuando: number;
}

function disparos(ancho: number, alto: number): Disparo[] {
  const fuerza = Math.max(12, Math.min(22, alto / 38));
  return [
    // Estallido desde el letrero.
    {
      x: ancho / 2,
      y: alto * 0.42,
      angulo: -Math.PI / 2,
      abertura: Math.PI * 0.9,
      fuerza,
      cantidad: 140,
      cuando: 0.15,
    },
    // Cañones desde las esquinas de abajo.
    {
      x: 0,
      y: alto,
      angulo: -Math.PI / 3,
      abertura: 0.5,
      fuerza: fuerza * 1.3,
      cantidad: 90,
      cuando: 0.6,
    },
    {
      x: ancho,
      y: alto,
      angulo: (-Math.PI * 2) / 3,
      abertura: 0.5,
      fuerza: fuerza * 1.3,
      cantidad: 90,
      cuando: 0.6,
    },
    // Una lluvia suave desde arriba, cuando ya está el panel.
    {
      x: ancho / 2,
      y: -20,
      angulo: Math.PI / 2,
      abertura: Math.PI * 0.95,
      fuerza: 3,
      cantidad: 80,
      cuando: 1.6,
    },
  ];
}

/**
 * Celebra el final sobre la mesa: oscurece, letrero con rebote y, si ganaste, rayos y confeti.
 * El letrero sube a los `SUBIR_LETRERO` s para dejarle lugar al panel de React.
 * Devuelve una función para limpiarlo todo.
 */
export function celebrar(
  app: Application,
  ancho: number,
  alto: number,
  texto: string,
  tipo: TipoFinal,
): () => void {
  const reducido = movimientoReducido();
  const gano = tipo === 'ganaste';
  const capa = new Container();
  capa.zIndex = 1_000_000;
  app.stage.addChild(capa);

  const fondo = new Graphics().rect(0, 0, ancho, alto).fill({ color: 0x03140c, alpha: 0.62 });
  capa.addChild(fondo);

  const yFinal = alto * 0.17;
  const tamano = Math.max(34, Math.min(80, ancho / 9));
  const grupo = new Container();
  grupo.position.set(ancho / 2, alto * 0.42);
  capa.addChild(grupo);

  let luz: Sprite | null = null;
  if (gano) {
    luz = new Sprite(rayos(app));
    luz.anchor.set(0.5);
    luz.scale.set((tamano * 5) / 800);
    grupo.addChild(luz);
  }

  const letrero = new Text({
    text: texto,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: tamano,
      fontWeight: '900',
      fill: gano ? 0xffd54a : tipo === 'empate' ? 0xe0f2e9 : 0xffffff,
      stroke: { color: 0x0a2e1e, width: 9 },
      dropShadow: { color: 0x000000, alpha: 0.45, blur: 8, distance: 5 },
    },
  });
  letrero.anchor.set(0.5);
  grupo.addChild(letrero);

  const tl = gsap.timeline();
  if (reducido) {
    grupo.y = yFinal;
    grupo.scale.set(0.8);
  } else {
    fondo.alpha = 0;
    grupo.scale.set(0);
    tl.to(fondo, { alpha: 1, duration: 0.35, ease: 'power1.out' }, 0)
      .to(grupo.scale, { x: 1, y: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' }, 0.05)
      .to(grupo, { y: yFinal, duration: 0.5, ease: 'power2.inOut' }, SUBIR_LETRERO)
      .to(grupo.scale, { x: 0.8, y: 0.8, duration: 0.5, ease: 'power2.inOut' }, SUBIR_LETRERO);
    if (!gano) {
      // Perder no se celebra: el letrero cae y se asienta en vez de rebotar.
      tl.fromTo(
        letrero,
        { rotation: -0.08 },
        { rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)' },
        0.05,
      );
    }
  }
  // Los rayos giran sin parar mientras se ve la pantalla.
  const giroLuz =
    luz && !reducido
      ? gsap.to(luz, { rotation: Math.PI * 2, duration: 24, ease: 'none', repeat: -1 })
      : null;

  // Confeti con ParticleContainer: cientos de pedazos en una sola llamada de dibujo.
  let pedazos: Pedazo[] = [];
  let actualizar: (() => void) | null = null;
  if (gano && !reducido) {
    const particulas = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: false, color: false },
    });
    capa.addChildAt(particulas, 1);
    const textura = confeti(app);
    let i = 0;
    for (const d of disparos(ancho, alto)) {
      for (let k = 0; k < d.cantidad; k++, i++) {
        const angulo = d.angulo + (Math.random() - 0.5) * d.abertura;
        const fuerza = d.fuerza * (0.45 + Math.random() * 0.55);
        const p = new Particle({
          texture: textura,
          x: -100,
          y: -100,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: 0.7 + Math.random() * 0.6,
          scaleY: 0.7 + Math.random() * 0.6,
          rotation: Math.random() * Math.PI,
          tint: COLORES[i % COLORES.length] ?? 0xffffff,
        });
        particulas.addParticle(p);
        pedazos.push({
          p,
          // A 60 cuadros por segundo; el disparo de arriba sale escalonado, como lluvia.
          espera: Math.round(
            (d.cuando + (d.y < 0 ? Math.random() * 1.2 : Math.random() * 0.08)) * 60,
          ),
          x0: d.y < 0 ? Math.random() * ancho : d.x,
          y0: d.y,
          vx0: Math.cos(angulo) * fuerza,
          vy0: Math.sin(angulo) * fuerza,
          vx: 0,
          vy: 0,
          giro: (Math.random() - 0.5) * 0.3,
          fase: Math.random() * Math.PI * 2,
        });
      }
    }
    let vivos = pedazos.length;
    actualizar = () => {
      // Independiente de los fps: `deltaTime` es 1 a 60 fps.
      // También respeta la velocidad global de GSAP (cámara lenta del laboratorio).
      const dt = Math.min(3, app.ticker.deltaTime) * gsap.globalTimeline.timeScale();
      for (const d of pedazos) {
        if (d.espera > 0) {
          d.espera -= dt;
          if (d.espera <= 0) {
            d.p.x = d.x0;
            d.p.y = d.y0;
            d.vx = d.vx0;
            d.vy = d.vy0;
          }
          continue;
        }
        if (d.p.y > alto + 20 && d.vy > 0) continue;
        d.vy = Math.min(d.vy + 0.35 * dt, 4.5);
        d.vx *= Math.pow(0.985, dt);
        d.fase += 0.12 * dt;
        // Al caer se mece de lado a lado, como papel.
        d.p.x += (d.vx + (d.vy > 2 ? Math.sin(d.fase) * 1.2 : 0)) * dt;
        d.p.y += d.vy * dt;
        d.p.rotation += d.giro * dt;
        if (d.p.y > alto + 20 && d.vy > 0) vivos--;
      }
      // Cuando ya cayó todo, se deja de calcular.
      if (vivos <= 0 && actualizar) {
        app.ticker.remove(actualizar);
        actualizar = null;
      }
    };
    app.ticker.add(actualizar);
  }

  return () => {
    tl.kill();
    giroLuz?.kill();
    if (actualizar) app.ticker.remove(actualizar);
    pedazos = [];
    capa.destroy({ children: true });
  };
}

/**
 * Entrada del panel final (React): aparece cuando el letrero ya subió, y luego cada fila.
 * `filas` son los elementos que entran escalonados.
 */
export function entradaPanel(
  panel: HTMLElement,
  filas: readonly HTMLElement[],
): gsap.core.Timeline {
  const tl = gsap.timeline();
  if (movimientoReducido()) {
    tl.set([panel, ...filas], { opacity: 1, y: 0, scale: 1 });
    return tl;
  }
  tl.fromTo(
    panel,
    { opacity: 0, y: 40, scale: 0.92 },
    { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' },
    SUBIR_LETRERO + 0.15,
  ).fromTo(
    filas,
    { opacity: 0, x: -16 },
    { opacity: 1, x: 0, duration: 0.3, stagger: 0.08, ease: 'power2.out' },
    '-=0.15',
  );
  return tl;
}
