import type { Rng } from './rng';

/** Fisher–Yates. Devuelve un arreglo nuevo; no modifica el original. */
export function barajar<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export interface Reparto<T> {
  manos: T[][];
  mazo: T[];
}

/**
 * Reparte `porJugador` cartas a cada jugador, una a la vez en ronda,
 * tomando desde el inicio del arreglo. El resto queda como mazo.
 */
export function repartir<T>(mazo: readonly T[], jugadores: number, porJugador: number): Reparto<T> {
  if (!Number.isInteger(jugadores) || jugadores < 1) {
    throw new Error(`jugadores inválidos: ${jugadores}`);
  }
  if (!Number.isInteger(porJugador) || porJugador < 0) {
    throw new Error(`cartas por jugador inválidas: ${porJugador}`);
  }
  const total = jugadores * porJugador;
  if (total > mazo.length) {
    throw new Error(`no alcanzan las cartas: se necesitan ${total} y hay ${mazo.length}`);
  }
  const manos: T[][] = Array.from({ length: jugadores }, () => []);
  for (let i = 0; i < total; i++) {
    manos[i % jugadores]?.push(mazo[i] as T);
  }
  return { manos, mazo: mazo.slice(total) };
}
