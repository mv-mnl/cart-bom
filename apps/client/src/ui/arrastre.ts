import { conquian, type ConquianAction, type ConquianState, type Desmoche } from '@cartas/conquian';
import type { Seleccion } from './opciones';

// ---------- zona de armado ----------

/**
 * Cartas puestas en la zona de armado mientras el jugador arma un juego.
 * Es solo del cliente: la partida no cambia hasta que forman un juego y se bajan.
 */
export interface Armado {
  readonly cartas: readonly string[];
  /** Si la carta de la mesa está en la zona. */
  readonly mesa: boolean;
  readonly desmoche: Desmoche | null;
}

export const ARMADO_VACIO: Armado = { cartas: [], mesa: false, desmoche: null };

/** Una carta que se puede poner en la zona de armado. */
export type Pieza =
  | { readonly tipo: 'mano'; readonly cardId: string }
  | { readonly tipo: 'mesa' }
  | { readonly tipo: 'desmoche'; readonly juegoId: string; readonly cardId: string };

export const piezasDe = (armado: Armado) =>
  armado.cartas.length + (armado.mesa ? 1 : 0) + (armado.desmoche ? 1 : 0);

export function agregarPieza(armado: Armado, pieza: Pieza): Armado {
  switch (pieza.tipo) {
    case 'mano':
      return armado.cartas.includes(pieza.cardId)
        ? armado
        : { ...armado, cartas: [...armado.cartas, pieza.cardId] };
    case 'mesa':
      return { ...armado, mesa: true };
    case 'desmoche':
      // Solo se desmocha una carta por jugada: la nueva reemplaza a la anterior.
      return { ...armado, desmoche: { juegoId: pieza.juegoId, cardId: pieza.cardId } };
  }
}

export function quitarPieza(armado: Armado, pieza: Pieza): Armado {
  switch (pieza.tipo) {
    case 'mano':
      return { ...armado, cartas: armado.cartas.filter((id) => id !== pieza.cardId) };
    case 'mesa':
      return { ...armado, mesa: false };
    case 'desmoche':
      return { ...armado, desmoche: null };
  }
}

const mismoConjunto = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const mismoDesmoche = (a: ConquianAction, d: Desmoche | null) =>
  'desmoche' in a && a.desmoche
    ? a.desmoche.juegoId === d?.juegoId && a.desmoche.cardId === d.cardId
    : d === null;

/** La jugada que forman exactamente las cartas de la zona de armado, si hay una. */
export function jugadaDelArmado(
  state: ConquianState,
  player: number,
  armado: Armado,
): ConquianAction | null {
  if (piezasDe(armado) < 3) return null;
  const tipo = armado.mesa ? 'tomar' : 'bajar';
  const accion = conquian
    .validActions(state, player)
    .find(
      (a) =>
        a.type === tipo &&
        !('juegoId' in a && a.juegoId !== undefined) &&
        mismoConjunto(a.cardIds, armado.cartas) &&
        mismoDesmoche(a, armado.desmoche),
    );
  return accion ?? null;
}

// ---------- arrastrar y soltar ----------

/** Lo que se está arrastrando. */
export type Arrastrado =
  | { readonly tipo: 'mano'; readonly cardId: string }
  /** La carta que te están ofreciendo en la mesa. */
  | { readonly tipo: 'mesa' }
  /** Una carta de un poker propio. */
  | { readonly tipo: 'desmoche'; readonly juegoId: string; readonly cardId: string }
  /** Una carta que ya estaba en la zona de armado. */
  | { readonly tipo: 'armado'; readonly pieza: Pieza };

/** Dónde se soltó. */
export type Destino =
  | { readonly tipo: 'centro' }
  /** Tu lugar del intercambio: ahí se suelta la carta que le pasas al de la derecha. */
  | { readonly tipo: 'pasada' }
  | { readonly tipo: 'muertas' }
  | { readonly tipo: 'armado' }
  | { readonly tipo: 'juego'; readonly juegoId: string }
  | { readonly tipo: 'mano' };

export type Resultado =
  | { readonly tipo: 'jugar'; readonly accion: ConquianAction }
  /** Soltar una carta propia dentro de la mano solo la reacomoda. */
  | { readonly tipo: 'reordenar' }
  | { readonly tipo: 'armar'; readonly pieza: Pieza }
  | { readonly tipo: 'desarmar'; readonly pieza: Pieza }
  | { readonly tipo: 'nada'; readonly motivo: string | null };

const NO_ENCAJA = 'Esa carta no encaja en ese juego.';

function esMiTurno(state: ConquianState, player: number): boolean {
  const { fase } = state;
  return (
    (fase.type === 'oferta' && fase.cola[0] === player) ||
    (fase.type === 'botar' && fase.jugador === player)
  );
}

/**
 * Decide qué pasa al soltar algo en un lugar. Solo devuelve jugadas que salen de
 * `validActions`; si no hay ninguna, explica por qué.
 */
export function alSoltar(
  state: ConquianState,
  player: number,
  arrastrado: Arrastrado,
  destino: Destino | null,
  sel: Seleccion,
): Resultado {
  if (!destino) return { tipo: 'nada', motivo: null };

  // Sacar una carta de la zona de armado: soltarla en cualquier otro lado la regresa.
  if (arrastrado.tipo === 'armado') {
    return destino.tipo === 'armado'
      ? { tipo: 'nada', motivo: null }
      : { tipo: 'desarmar', pieza: arrastrado.pieza };
  }

  const acciones = conquian.validActions(state, player);
  /** Busca una jugada con exactamente esas cartas de la mano y ese desmoche. */
  const buscar = (
    cumple: (a: ConquianAction) => boolean,
    cardIds: readonly string[],
    desmoche: Desmoche | null = sel.desmoche,
  ) =>
    acciones.find(
      (a) =>
        cumple(a) &&
        'cardIds' in a &&
        mismoConjunto(a.cardIds, cardIds) &&
        mismoDesmoche(a, desmoche),
    );
  const jugar = (accion: ConquianAction | undefined, motivo: string): Resultado =>
    accion ? { tipo: 'jugar', accion } : { tipo: 'nada', motivo };
  const armar = (pieza: Pieza): Resultado =>
    esMiTurno(state, player)
      ? { tipo: 'armar', pieza }
      : { tipo: 'nada', motivo: 'Espera tu turno.' };

  if (arrastrado.tipo === 'mano') {
    const { cardId } = arrastrado;
    switch (destino.tipo) {
      case 'mano':
        return { tipo: 'reordenar' };
      case 'armado':
        return armar(arrastrado);
      case 'pasada':
        return jugar(
          acciones.find((a) => a.type === 'pasarCarta' && a.cardId === cardId),
          'Ya elegiste la carta que pasas.',
        );
      case 'centro':
      case 'muertas':
        return jugar(
          acciones.find((a) => a.type === 'botar' && a.cardId === cardId),
          state.fase.type === 'intercambio'
            ? 'Para pasarla, suéltala en el lugar marcado junto a tu mano.'
            : 'Al centro solo se suelta la carta que vas a botar.',
        );
      case 'juego': {
        // La carta arrastrada junto con las que ya tenías seleccionadas.
        const agregar = (a: ConquianAction) =>
          a.type === 'agregar' && a.juegoId === destino.juegoId;
        const conSeleccion = [...new Set([...sel.cartas, cardId])];
        return jugar(buscar(agregar, conSeleccion) ?? buscar(agregar, [cardId], null), NO_ENCAJA);
      }
    }
  }

  if (arrastrado.tipo === 'desmoche') {
    const desmoche = { juegoId: arrastrado.juegoId, cardId: arrastrado.cardId };
    if (destino.tipo === 'armado') return armar(arrastrado);
    if (destino.tipo === 'juego' && destino.juegoId !== arrastrado.juegoId) {
      const agregar = (a: ConquianAction) => a.type === 'agregar' && a.juegoId === destino.juegoId;
      return jugar(buscar(agregar, [], desmoche), NO_ENCAJA);
    }
    return { tipo: 'nada', motivo: null };
  }

  // La carta de la mesa.
  if (state.fase.type !== 'oferta' || state.fase.cola[0] !== player) {
    return { tipo: 'nada', motivo: null };
  }
  switch (destino.tipo) {
    case 'muertas':
      return jugar(
        acciones.find((a) => a.type === 'pasar'),
        'Ahora no puedes pasar.',
      );
    case 'armado':
      return armar(arrastrado);
    case 'juego': {
      const tomar = (a: ConquianAction) => a.type === 'tomar' && a.juegoId === destino.juegoId;
      return jugar(buscar(tomar, sel.cartas) ?? buscar(tomar, [], null), NO_ENCAJA);
    }
    case 'mano':
      // Con cartas seleccionadas intenta bajar con ellas; si no, empieza a armar.
      if (sel.cartas.length === 0) return armar(arrastrado);
      return jugar(
        buscar((a) => a.type === 'tomar' && a.juegoId === undefined, sel.cartas),
        'Esas cartas no forman juego con la de la mesa.',
      );
    case 'centro':
    case 'pasada':
      return { tipo: 'nada', motivo: null };
  }
}

/** Mueve `cardId` a la posición `indice` dentro del orden mostrado. */
export function reordenar(ids: readonly string[], cardId: string, indice: number): string[] {
  const sin = ids.filter((id) => id !== cardId);
  const i = Math.max(0, Math.min(indice, sin.length));
  return [...sin.slice(0, i), cardId, ...sin.slice(i)];
}
