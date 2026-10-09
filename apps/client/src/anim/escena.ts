import type { Sprite, Texture } from 'pixi.js';
import type { Anclas, Escena, Origen, Punto } from '../table/layout';
import { DORSO } from '../table/texturas';
import {
  colocarCarta,
  llevarA,
  moverCarta,
  repartirCarta,
  vaHacia,
  voltearCarta,
  type Pose,
} from './cartas';
import {
  DURACION_INTERCAMBIO,
  ESPERA_PASADA,
  LUCIR_INTERCAMBIO,
  TRAMO_PASADA,
  PASO_REPARTO,
  VELOCIDAD_INTERCAMBIO,
  VELOCIDAD_REPARTO,
} from './tiempos';

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
  if ('pasada' in origen.desde) return anclas.pasadas[origen.desde.pasada] ?? null;
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

const pasadaDe = (origen: Origen | undefined): number | null =>
  origen !== undefined && typeof origen.desde === 'object' && 'pasada' in origen.desde
    ? origen.desde.pasada
    : null;
const esPasada = (origen: Origen | undefined) => pasadaDe(origen) !== null;
/** La carta sale del asiento de un jugador (la jugó de su mano). */
const deUnAsiento = (origen: Origen) =>
  typeof origen.desde === 'object' && 'jugador' in origen.desde;

/**
 * Quiénes tenían su carta esperando en la escena anterior (por mesa: la clave es su
 * conjunto de cartas conocidas). El último en elegir no alcanza a dejarla: su carta sale
 * de su mano cuando termina el intercambio.
 */
const pasadasVistas = new WeakMap<Set<string>, ReadonlySet<number>>();
function recordarPasadas(escena: Escena, conocidas: Set<string>): void {
  const vistas = new Set<number>();
  for (const c of escena.cartas) if (c.pasadaDe !== undefined) vistas.add(c.pasadaDe);
  pasadasVistas.set(conocidas, vistas);
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
    recordarPasadas(escena, conocidas);
    return;
  }
  // Si en esta escena terminó el intercambio, lo demás que llega (la primera carta del mazo)
  // espera a que se vea qué carta recibió cada quien.
  const terminaIntercambio = escena.cartas.some((c) => !conocidas.has(c.key) && esPasada(c.origen));
  const vistas = pasadasVistas.get(conocidas) ?? new Set<number>();
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
      const cara = ctx.textura(c.textura);
      const dorso = ctx.textura(DORSO);
      // Las tuyas se descubren al llegar; las de los rivales llegan boca abajo.
      const tuya = c.textura !== DORSO ? (cara ?? null) : null;
      const de = pasadaDe(c.origen);
      const lugar = de === null ? undefined : escena.anclas.pasadas[de];
      if (de !== null && lugar && dorso) {
        // La carta que te pasaron (o que se pasan los rivales) cruza la mesa como en el
        // reparto, y la tuya se queda un momento levantada para que se vea.
        // La del último en elegir nunca se vio esperando: primero sale de su mano hasta su
        // lugar. Las demás la esperan, y luego cruzan todas juntas.
        const tarde = !vistas.has(de);
        const asiento = escena.anclas.jugadores[de] ?? lugar;
        sprite.position.set(tarde ? asiento.x : lugar.x, tarde ? asiento.y : lugar.y);
        sprite.rotation = lugar.rotation;
        sprite.scale.set(lugar.escala);
        repartirCarta(sprite, destino, tuya, dorso, {
          zIndexFinal,
          velocidad: c.velocidad ?? VELOCIDAD_INTERCAMBIO,
          lucir: LUCIR_INTERCAMBIO,
          giro: false,
          ...(tarde
            ? { parada: { pose: lugar, tramo: TRAMO_PASADA, espera: ESPERA_PASADA } }
            : { retraso: TRAMO_PASADA + ESPERA_PASADA }),
        });
        return;
      }
      // Solo las cartas del reparto traen `orden`.
      const reparto = c.origen.orden !== undefined;
      const retraso =
        (c.origen.orden ?? 0) * PASO_REPARTO + (terminaIntercambio ? DURACION_INTERCAMBIO : 0);
      const velocidad = c.velocidad ?? (reparto ? VELOCIDAD_REPARTO : 1);
      if (reparto && dorso) {
        repartirCarta(sprite, destino, tuya, dorso, { retraso, zIndexFinal, velocidad });
      } else if ((c.origen.voltear || deUnAsiento(c.origen)) && tuya && dorso) {
        // Lo que sale del mazo o de la mano de un rival cruza boca abajo y se voltea al llegar.
        voltearCarta(sprite, destino, tuya, dorso, { retraso, zIndexFinal, velocidad });
      } else {
        moverCarta(sprite, destino, { retraso, zIndexFinal, velocidad });
      }
      return;
    }
    if (difiere(sprite, destino) && !vaHacia(sprite, destino)) {
      const textura = ctx.textura(c.textura);
      llevarA(sprite, destino, {
        zIndexFinal,
        velocidad: c.velocidad ?? 1,
        ...(textura ? { textura } : {}),
      });
    }
  });
  for (const key of conocidas) if (!presentes.has(key)) conocidas.delete(key);
  recordarPasadas(escena, conocidas);
}
