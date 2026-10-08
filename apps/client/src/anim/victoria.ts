import gsap from 'gsap';
import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Text,
  type Application,
  type Texture,
} from 'pixi.js';
import { movimientoReducido } from './cartas';

const COLORES = [0xffd54a, 0xff6b6b, 0x4dd0e1, 0x81c784, 0xba68c8, 0xffffff];

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

interface Pedazo {
  readonly p: Particle;
  vx: number;
  vy: number;
  giro: number;
}

/**
 * Celebra el final: un letrero que aparece con rebote y, si ganaste, confeti.
 * Devuelve una función para limpiarlo todo.
 */
export function celebrar(
  app: Application,
  ancho: number,
  alto: number,
  texto: string,
  conConfeti: boolean,
): () => void {
  const reducido = movimientoReducido();
  const capa = new Container();
  capa.zIndex = 1_000_000;
  app.stage.addChild(capa);

  const letrero = new Text({
    text: texto,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: Math.max(34, Math.min(72, ancho / 10)),
      fontWeight: '800',
      fill: conConfeti ? 0xffd54a : 0xffffff,
      stroke: { color: 0x0a2e1e, width: 8 },
      dropShadow: { color: 0x000000, alpha: 0.4, blur: 6, distance: 4 },
    },
  });
  letrero.anchor.set(0.5);
  letrero.position.set(ancho / 2, alto * 0.42);
  capa.addChild(letrero);

  const tl = gsap.timeline();
  if (reducido) {
    letrero.scale.set(1);
  } else {
    letrero.scale.set(0);
    tl.to(letrero.scale, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
  }

  // Confeti con ParticleContainer: cientos de pedazos en una sola llamada de dibujo.
  let pedazos: Pedazo[] = [];
  let actualizar: (() => void) | null = null;
  if (conConfeti && !reducido) {
    const particulas = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: false, color: false },
    });
    capa.addChildAt(particulas, 0);
    const textura = confeti(app);
    pedazos = Array.from({ length: 220 }, (_, i) => {
      const p = new Particle({
        texture: textura,
        x: ancho / 2 + (Math.random() - 0.5) * ancho * 0.3,
        y: alto * 0.4,
        anchorX: 0.5,
        anchorY: 0.5,
        rotation: Math.random() * Math.PI,
        tint: COLORES[i % COLORES.length] ?? 0xffffff,
      });
      particulas.addParticle(p);
      return {
        p,
        vx: (Math.random() - 0.5) * 14,
        vy: -6 - Math.random() * 12,
        giro: (Math.random() - 0.5) * 0.3,
      };
    });
    actualizar = () => {
      for (const d of pedazos) {
        d.vy += 0.35;
        d.vx *= 0.99;
        d.p.x += d.vx;
        d.p.y += d.vy;
        d.p.rotation += d.giro;
      }
      // Cuando ya cayó todo, se deja de calcular.
      if (pedazos.every((d) => d.p.y > alto + 20)) {
        if (actualizar) app.ticker.remove(actualizar);
        actualizar = null;
      }
    };
    app.ticker.add(actualizar);
  }

  return () => {
    tl.kill();
    if (actualizar) app.ticker.remove(actualizar);
    pedazos = [];
    capa.destroy({ children: true });
  };
}
