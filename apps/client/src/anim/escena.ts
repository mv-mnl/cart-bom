import type { Sprite, Texture } from 'pixi.js';
import type { Anclas, Escena, Origen, Punto } from '../table/layout';
import { DORSO } from '../table/texturas';
import { colocarCarta, moverCarta, voltearCarta, type Pose } from './cartas';

/** Separación entre cartas del reparto. */
const PASO_REPARTO = 0.035;

export interface ContextoAnimacion {
  readonly escena: Escena;
  readonly sprites: ReadonlyMap<string, Sprite>;
  /** Cartas que ya estaban en pantalla (se actualiza aquí). */
  readonly conocidas: Set<string>;
  readonly textura: (clave: string) => Texture | undefined;
  /** El sprite que se está arrastrando: lo maneja el arrastre, no la animación. */
  readonly ignorar: Sprite | null;
}

function resolver(origen: Origen, anclas: Anclas): Punto | null {
  if (origen.desde === 'mazo') return anclas.mazo;
  if (origen.desde === 'centro') return anclas.centro;
  return anclas.jugadores[origen.desde.jugador] ?? null;
}

/**
 * Cómo tratar la próxima escena, para el laboratorio de animaciones:
 * `colocar` pone todo en su lugar sin animar; `desdeOrigen` anima todas las cartas como
 * si fueran nuevas (por ejemplo, para repetir el reparto con las mismas cartas).
 */
export type Preparacion = 'colocar' | 'desdeOrigen';
let preparacion: Preparacion | null = null;
export function prepararEscena(modo: Preparacion): void {
  preparacion = modo;
}

const difiere = (sprite: Sprite, pose: Pose) =>
  Math.abs(sprite.x - pose.x) > 0.5 ||
  Math.abs(sprite.y - pose.y) > 0.5 ||
  Math.abs(sprite.rotation - pose.rotation) > 0.001 ||
  Math.abs(sprite.scale.x - pose.escala) > 0.001;

/**
 * Compara lo que hay en pantalla con la nueva escena y anima la diferencia:
 * las cartas que ya estaban viajan a su nuevo lugar; las nuevas llegan desde su origen
 * (el mazo, el centro o el asiento de quien la jugó). El estado del juego ya cambió:
 * esto solo lo muestra.
 */
export function animarEscena(ctx: ContextoAnimacion): void {
  const { escena, sprites, conocidas } = ctx;
  const modo = preparacion;
  preparacion = null;
  if (modo === 'desdeOrigen') conocidas.clear();
  if (modo === 'colocar') {
    escena.cartas.forEach((c, i) => {
      const sprite = sprites.get(c.key);
      conocidas.add(c.key);
      if (!sprite || sprite === ctx.ignorar) return;
      colocarCarta(sprite, { x: c.x, y: c.y, rotation: c.rotation, escala: c.escala });
      sprite.zIndex = i + 1;
      const cara = ctx.textura(c.textura);
      if (cara) sprite.texture = cara;
    });
    for (const key of conocidas)
      if (!escena.cartas.some((c) => c.key === key)) conocidas.delete(key);
    return;
  }
  const presentes = new Set<string>();
  escena.cartas.forEach((c, i) => {
    presentes.add(c.key);
    const sprite = sprites.get(c.key);
    if (!sprite || sprite === ctx.ignorar) return;
    const destino: Pose = { x: c.x, y: c.y, rotation: c.rotation, escala: c.escala };
    const zIndexFinal = i + 1;

    if (!conocidas.has(c.key)) {
      conocidas.add(c.key);
      const desde = c.origen ? resolver(c.origen, escena.anclas) : null;
      if (!c.origen || !desde) {
        colocarCarta(sprite, destino);
        return;
      }
      sprite.position.set(desde.x, desde.y);
      sprite.rotation = 0;
      sprite.scale.set(c.escala);
      const retraso = (c.origen.orden ?? 0) * PASO_REPARTO;
      const cara = ctx.textura(c.textura);
      const dorso = ctx.textura(DORSO);
      if (c.origen.voltear && cara && dorso) {
        voltearCarta(sprite, destino, cara, dorso, { retraso, zIndexFinal });
      } else {
        moverCarta(sprite, destino, { retraso, zIndexFinal });
      }
      return;
    }
    if (difiere(sprite, destino)) moverCarta(sprite, destino, { zIndexFinal });
  });
  for (const key of conocidas) if (!presentes.has(key)) conocidas.delete(key);
}
