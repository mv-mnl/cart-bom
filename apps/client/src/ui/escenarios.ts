import {
  jugadaIA,
  type ConquianAction,
  type ConquianState,
  type createConquian,
} from '@cartas/conquian';
import type { Preparacion } from '../anim/escena';

type Conquian = ReturnType<typeof createConquian>;

/** Una jugada ya aplicada: el estado antes, la acción y el estado después. */
export interface Transicion {
  readonly antes: ConquianState;
  readonly accion: ConquianAction;
  readonly despues: ConquianState;
}

/** Lo que el laboratorio pone en la mesa y las jugadas que va a mostrar una por una. */
export interface Preparado {
  readonly inicio: ConquianState;
  /** Cómo aparece `inicio`: de golpe, o con las cartas llegando desde su origen. */
  readonly modo: Preparacion;
  readonly pasos: readonly ConquianAction[];
  /** La semilla de la partida donde se encontró, para poder reproducirla. */
  readonly semilla: string;
}

export interface Escenario {
  readonly id: string;
  readonly grupo: string;
  readonly nombre: string;
  readonly preparar: (
    juego: Conquian,
    jugadores: number,
    semilla: string,
    yo: number,
  ) => Preparado | null;
}

/** La siguiente jugada de quien tenga turno, decidida por la IA (también en tu asiento). */
export function siguienteJugada(juego: Conquian, state: ConquianState): ConquianAction | null {
  if (juego.result(state)) return null;
  for (let p = 0; p < state.jugadores.length; p++) {
    const accion = jugadaIA(state, p);
    if (accion) return accion;
  }
  return null;
}

/** Juega una partida completa con la IA en todos los asientos. */
export function* partida(
  juego: Conquian,
  jugadores: number,
  semilla: string,
  maxJugadas = 600,
): Generator<Transicion> {
  let state = juego.setup(jugadores, semilla);
  for (let i = 0; i < maxJugadas; i++) {
    const accion = siguienteJugada(juego, state);
    if (!accion) return;
    const despues = juego.apply(state, accion);
    yield { antes: state, accion, despues };
    state = despues;
  }
}

/**
 * Busca, en partidas jugadas por la IA, la primera jugada que cumpla `buscada` y devuelve
 * el estado justo antes, esa jugada y las `siguientes` que vengan después.
 * Prueba varias semillas derivadas de `semilla` porque hay jugadas raras (el desmoche).
 */
export function buscarJugada(
  juego: Conquian,
  jugadores: number,
  semilla: string,
  buscada: (t: Transicion) => boolean,
  siguientes = 0,
  intentos = 60,
): Preparado | null {
  for (let k = 0; k < intentos; k++) {
    const s = k === 0 ? semilla : `${semilla}-${k}`;
    const it = partida(juego, jugadores, s);
    for (const t of it) {
      if (!buscada(t)) continue;
      const pasos = [t.accion];
      for (let n = 0; n < siguientes; n++) {
        const r = it.next();
        if (r.done) break;
        pasos.push(r.value.accion);
      }
      return { inicio: t.antes, modo: 'colocar', pasos, semilla: s };
    }
  }
  return null;
}

/**
 * La IA baja todo lo que puede de una vez, así que nunca agrega desde la mano. Para verlo,
 * una bajada de 4 o más se parte en dos: bajar 3 (o más) y luego agregar la que quedó.
 */
function partirBajada(juego: Conquian, t: Transicion): ConquianAction[] | null {
  const { accion, antes } = t;
  if (accion.type !== 'bajar' || accion.desmoche || accion.cardIds.length < 4) return null;
  for (const suelta of accion.cardIds) {
    const bajar: ConquianAction = {
      ...accion,
      cardIds: accion.cardIds.filter((id) => id !== suelta),
    };
    const agregar: ConquianAction = {
      type: 'agregar',
      player: accion.player,
      juegoId: `j${antes.siguienteJuego}`,
      cardIds: [suelta],
    };
    try {
      juego.apply(juego.apply(antes, bajar), agregar);
      return [bajar, agregar];
    } catch {
      // Sin esa carta no queda juego (o no encaja al final); se prueba con otra.
    }
  }
  return null;
}

const tieneDesmoche = (a: ConquianAction) => 'desmoche' in a && a.desmoche !== undefined;
const ganador = (t: Transicion) => {
  const f = t.despues.fase;
  return f.type === 'terminado' && f.resultado.type === 'ganador' ? f.resultado.ganadores : null;
};
/** Tras tomar la carta de la mesa, el mismo jugador paga: se muestran las dos jugadas. */
const Y_PAGA = 1;

/** Una jugada que hace la IA; `quien` filtra si la hace quien mira o un rival. */
function jugada(
  id: string,
  grupo: string,
  nombre: string,
  quien: 'tu' | 'rival',
  buscada: (t: Transicion) => boolean,
  siguientes = 0,
): Escenario {
  return {
    id,
    grupo,
    nombre,
    preparar: (juego, jugadores, semilla, yo) =>
      buscarJugada(
        juego,
        jugadores,
        semilla,
        (t) => (quien === 'tu') === (t.accion.player === yo) && buscada(t),
        siguientes,
      ),
  };
}

export const ESCENARIOS: readonly Escenario[] = [
  {
    id: 'repartir',
    grupo: 'Reparto',
    nombre: 'Repartir',
    preparar: (juego, jugadores, semilla) => ({
      inicio: juego.setup(jugadores, semilla),
      modo: 'desdeOrigen',
      pasos: [],
      semilla,
    }),
  },
  {
    id: 'intercambio',
    grupo: 'Reparto',
    nombre: 'Pasar carta a la derecha',
    preparar: (juego, jugadores, semilla) => {
      const inicio = juego.setup(jugadores, semilla);
      const pasos: ConquianAction[] = [];
      for (const t of partida(juego, jugadores, semilla)) {
        if (t.accion.type !== 'pasarCarta') break;
        pasos.push(t.accion);
      }
      return { inicio, modo: 'colocar', pasos, semilla };
    },
  },
  {
    id: 'voltear',
    grupo: 'Turno',
    nombre: 'Nadie la quiere: a las muertas y se voltea otra',
    preparar: (juego, jugadores, semilla) =>
      buscarJugada(juego, jugadores, semilla, (t) => {
        const f = t.despues.fase;
        const a = t.antes.fase;
        return (
          t.accion.type === 'pasar' &&
          f.type === 'oferta' &&
          f.origen === 'mazo' &&
          a.type === 'oferta' &&
          a.carta.id !== f.carta.id
        );
      }),
  },
  jugada('pasar', 'Turno', 'Tú pasas', 'tu', (t) => t.accion.type === 'pasar'),
  jugada(
    'tomar-tu',
    'Turno',
    'Tú tomas de la mesa y pagas',
    'tu',
    (t) => t.accion.type === 'tomar' && !t.accion.juegoId && !tieneDesmoche(t.accion),
    Y_PAGA,
  ),
  jugada(
    'tomar-rival',
    'Turno',
    'Rival toma de la mesa y paga',
    'rival',
    (t) => t.accion.type === 'tomar' && !t.accion.juegoId && !tieneDesmoche(t.accion),
    Y_PAGA,
  ),
  jugada(
    'tomar-agregar',
    'Turno',
    'Tomar y agregar a un juego',
    'tu',
    (t) => t.accion.type === 'tomar' && t.accion.juegoId !== undefined,
    Y_PAGA,
  ),
  jugada(
    'bajar-tu',
    'Turno',
    'Tú bajas desde la mano',
    'tu',
    (t) => t.accion.type === 'bajar' && !tieneDesmoche(t.accion),
  ),
  jugada(
    'bajar-rival',
    'Turno',
    'Rival baja desde la mano',
    'rival',
    (t) => t.accion.type === 'bajar' && !tieneDesmoche(t.accion),
  ),
  {
    id: 'agregar',
    grupo: 'Turno',
    nombre: 'Bajar y luego agregar desde la mano',
    preparar: (juego, jugadores, semilla) => {
      let pasos: ConquianAction[] | null = null;
      const p = buscarJugada(
        juego,
        jugadores,
        semilla,
        (t) => (pasos = partirBajada(juego, t)) !== null,
      );
      return p && pasos ? { ...p, pasos } : null;
    },
  },
  jugada('botar-tu', 'Turno', 'Tú botas', 'tu', (t) => t.accion.type === 'botar'),
  jugada('botar-rival', 'Turno', 'Rival bota', 'rival', (t) => t.accion.type === 'botar'),
  {
    id: 'desmoche',
    grupo: 'Turno',
    nombre: 'Desmoche',
    preparar: (juego, jugadores, semilla) =>
      buscarJugada(juego, jugadores, semilla, (t) => tieneDesmoche(t.accion), 1, 300),
  },
  {
    id: 'ronda',
    grupo: 'Secuencias',
    nombre: 'Varias jugadas seguidas',
    preparar: (juego, jugadores, semilla) =>
      buscarJugada(juego, jugadores, semilla, (t) => t.antes.fase.type !== 'intercambio', 12),
  },
  {
    id: 'ganas',
    grupo: 'Final',
    nombre: 'Ganas',
    preparar: (juego, jugadores, semilla, yo) =>
      buscarJugada(juego, jugadores, semilla, (t) => ganador(t)?.includes(yo) === true),
  },
  {
    id: 'pierdes',
    grupo: 'Final',
    nombre: 'Gana un rival',
    preparar: (juego, jugadores, semilla, yo) =>
      buscarJugada(juego, jugadores, semilla, (t) => {
        const g = ganador(t);
        return g !== null && !g.includes(yo);
      }),
  },
  {
    id: 'empate',
    grupo: 'Final',
    nombre: 'Empate (se acaba el mazo)',
    preparar: (juego, jugadores, semilla) =>
      buscarJugada(juego, jugadores, semilla, (t) => {
        const f = t.despues.fase;
        return f.type === 'terminado' && f.resultado.type === 'empate';
      }),
  },
];
