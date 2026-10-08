import { PALOS, VALORES_52, type Palo, type Valor } from '@cartas/core';
import { Container, Graphics, Text, type Renderer, type Texture } from 'pixi.js';
import { datosPalo, etiquetaCorta, type EstiloBaraja } from '../ui/baraja';

/** Tamaño base de la textura; los sprites se escalan según la pantalla. */
export const CARTA_W = 120;
export const CARTA_H = 180;
export const DORSO = 'dorso';

const COLOR_PALO: Record<Palo, number> = {
  oros: 0xc9970c,
  copas: 0xb3261e,
  espadas: 0x2a5599,
  bastos: 0x2e7d32,
};

function dibujarPalo(g: Graphics, palo: Palo, cx: number, cy: number): void {
  const color = COLOR_PALO[palo];
  switch (palo) {
    case 'oros':
      g.circle(cx, cy, 28).fill(color).circle(cx, cy, 18).stroke({ width: 4, color: 0xfff1b8 });
      break;
    case 'copas':
      g.moveTo(cx - 26, cy - 26)
        .lineTo(cx + 26, cy - 26)
        .quadraticCurveTo(cx + 24, cy + 6, cx, cy + 8)
        .quadraticCurveTo(cx - 24, cy + 6, cx - 26, cy - 26)
        .fill(color);
      g.rect(cx - 4, cy + 6, 8, 18).fill(color);
      g.roundRect(cx - 16, cy + 22, 32, 8, 4).fill(color);
      break;
    case 'espadas':
      g.moveTo(cx, cy - 40)
        .lineTo(cx + 7, cy - 30)
        .lineTo(cx + 7, cy + 16)
        .lineTo(cx - 7, cy + 16)
        .lineTo(cx - 7, cy - 30)
        .fill(color);
      g.roundRect(cx - 22, cy + 14, 44, 8, 4).fill(color);
      g.rect(cx - 4, cy + 22, 8, 14).fill(color);
      g.circle(cx, cy + 40, 6).fill(color);
      break;
    case 'bastos':
      g.moveTo(cx - 8, cy + 38)
        .lineTo(cx - 14, cy - 34)
        .quadraticCurveTo(cx, cy - 46, cx + 14, cy - 34)
        .lineTo(cx + 8, cy + 38)
        .fill(color);
      g.circle(cx - 12, cy - 8, 5)
        .fill(color)
        .circle(cx + 12, cy + 10, 5)
        .fill(color);
      break;
  }
}

function carta(palo: Palo, valor: Valor): Container {
  const c = new Container();
  const g = new Graphics()
    .roundRect(0, 0, CARTA_W, CARTA_H, 12)
    .fill(0xfdfaf2)
    .stroke({ width: 3, color: 0x3b3b3b });
  dibujarPalo(g, palo, CARTA_W / 2, CARTA_H / 2 + 6);
  c.addChild(g);
  const texto = etiquetaCorta(valor, 'espanola');
  const estilo = {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 34,
    fontWeight: '700' as const,
    fill: COLOR_PALO[palo],
  };
  const arriba = new Text({ text: texto, style: estilo });
  arriba.position.set(10, 4);
  const abajo = new Text({ text: texto, style: estilo });
  abajo.anchor.set(1, 1);
  abajo.position.set(CARTA_W - 10, CARTA_H - 4);
  c.addChild(arriba, abajo);
  return c;
}

function dorso(): Container {
  const c = new Container();
  const g = new Graphics()
    .roundRect(0, 0, CARTA_W, CARTA_H, 12)
    .fill(0x7a1f2b)
    .stroke({ width: 3, color: 0x3b3b3b })
    .roundRect(10, 10, CARTA_W - 20, CARTA_H - 20, 8)
    .stroke({ width: 3, color: 0xe8c66a });
  for (let y = 24; y < CARTA_H - 20; y += 18) {
    g.moveTo(18, y).lineTo(CARTA_W - 18, y + 10);
  }
  g.stroke({ width: 2, color: 0xa8424f });
  c.addChild(g);
  return c;
}

// ---------- baraja americana ----------

const FUENTE = 'system-ui, "Segoe UI Symbol", "DejaVu Sans", sans-serif';

function cartaAmericana(palo: Palo, valor: Valor): Container {
  const { simbolo, color } = datosPalo(palo, 'americana');
  const marca = simbolo ?? '?';
  const rango = etiquetaCorta(valor, 'americana');
  const c = new Container();
  c.addChild(
    new Graphics()
      .roundRect(0, 0, CARTA_W, CARTA_H, 12)
      .fill(0xffffff)
      .stroke({ width: 3, color: 0x3b3b3b }),
  );
  const estilo = (fontSize: number) => ({
    fontFamily: FUENTE,
    fontSize,
    fontWeight: '700' as const,
    fill: color,
  });

  // Esquinas: rango y palo, arriba a la izquierda y de cabeza abajo a la derecha.
  const esquina = () => {
    const e = new Container();
    const r = new Text({ text: rango, style: estilo(30) });
    r.anchor.set(0.5, 0);
    const p = new Text({ text: marca, style: estilo(24) });
    p.anchor.set(0.5, 0);
    p.y = 30;
    e.addChild(r, p);
    return e;
  };
  const arriba = esquina();
  arriba.position.set(18, 4);
  const abajo = esquina();
  abajo.position.set(CARTA_W - 18, CARTA_H - 4);
  abajo.rotation = Math.PI;
  c.addChild(arriba, abajo);

  // Centro: el palo grande; las figuras llevan además su letra en un recuadro.
  // Figuras: J, Q y K (10–12). El diez numérico (DIEZ) se dibuja como las demás numéricas.
  if (valor === 10 || valor === 11 || valor === 12) {
    c.addChild(
      new Graphics()
        .roundRect(30, 34, CARTA_W - 60, CARTA_H - 68, 8)
        .fill({ color, alpha: 0.08 })
        .stroke({ width: 2, color, alpha: 0.6 }),
    );
    const letra = new Text({ text: rango, style: estilo(50) });
    letra.anchor.set(0.5);
    letra.position.set(CARTA_W / 2, CARTA_H / 2 - 16);
    const p = new Text({ text: marca, style: estilo(34) });
    p.anchor.set(0.5);
    p.position.set(CARTA_W / 2, CARTA_H / 2 + 26);
    c.addChild(letra, p);
  } else {
    const p = new Text({ text: marca, style: estilo(valor === 1 ? 84 : 64) });
    p.anchor.set(0.5);
    p.position.set(CARTA_W / 2, CARTA_H / 2 + 4);
    c.addChild(p);
  }
  return c;
}

function dorsoAmericano(): Container {
  const c = new Container();
  const g = new Graphics()
    .roundRect(0, 0, CARTA_W, CARTA_H, 12)
    .fill(0x1f4e9a)
    .stroke({ width: 3, color: 0x3b3b3b })
    .roundRect(9, 9, CARTA_W - 18, CARTA_H - 18, 8)
    .stroke({ width: 3, color: 0xffffff });
  // Rombos en rejilla.
  for (let y = 22; y < CARTA_H - 16; y += 16) {
    for (let x = 22; x < CARTA_W - 16; x += 16) {
      g.moveTo(x, y - 6)
        .lineTo(x + 6, y)
        .lineTo(x, y + 6)
        .lineTo(x - 6, y)
        .closePath();
    }
  }
  g.stroke({ width: 1.5, color: 0x8fb3ec });
  c.addChild(g);
  return c;
}

/**
 * Genera una vez todas las texturas de los dos estilos (52 cartas posibles + dorso cada uno),
 * con claves `estilo/palo-valor` y `estilo/dorso`.
 * Los sprites solo cambian de textura; nunca se crean texturas por cuadro.
 */
export function crearTexturas(renderer: Renderer): Map<string, Texture> {
  const texturas = new Map<string, Texture>();
  const generar = (id: string, contenido: Container) => {
    texturas.set(
      id,
      renderer.generateTexture({ target: contenido, resolution: 2, antialias: true }),
    );
    contenido.destroy({ children: true });
  };
  for (const palo of PALOS) {
    // Todos los valores posibles (la americana completa los incluye todos).
    for (const valor of VALORES_52) {
      generar(`espanola/${palo}-${valor}`, carta(palo, valor));
      generar(`americana/${palo}-${valor}`, cartaAmericana(palo, valor));
    }
  }
  generar(`espanola/${DORSO}`, dorso());
  generar(`americana/${DORSO}`, dorsoAmericano());
  return texturas;
}

/** Clave de la textura en el mapa, según el estilo de baraja. */
export const texturaDe = (estilo: EstiloBaraja, clave: string) => `${estilo}/${clave}`;

/** Textura de una carta por su id (los ids de varias barajas terminan en `-n`). */
export function claveTextura(cardId: string): string {
  const [palo, valor] = cardId.split('-');
  return `${palo}-${valor}`;
}
