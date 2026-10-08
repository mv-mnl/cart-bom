import { PALOS, VALORES_40, ordenEscalera, type Card, type Valor } from '@cartas/core';

/**
 * `llegada`: como se fueron recibiendo. `manual`: como el jugador las acomodó arrastrando;
 * las cartas nuevas que no estaban en su orden van al final.
 */
export type OrdenMano = 'llegada' | 'palo' | 'numero' | 'manual';

/** Devuelve la mano ordenada para mostrarla; no cambia el estado del juego. */
export function ordenarMano(
  mano: readonly Card[],
  orden: OrdenMano,
  valores: readonly Valor[] = VALORES_40,
  manual: readonly string[] = [],
): readonly Card[] {
  if (orden === 'llegada') return mano;
  if (orden === 'manual') {
    const pos = (c: Card) => {
      const i = manual.indexOf(c.id);
      return i === -1 ? manual.length + mano.indexOf(c) : i;
    };
    return [...mano].sort((a, b) => pos(a) - pos(b));
  }
  const palo = (c: Card) => PALOS.indexOf(c.palo);
  const valor = (c: Card) => ordenEscalera(c.valor, valores);
  return [...mano].sort((a, b) =>
    orden === 'palo'
      ? palo(a) - palo(b) || valor(a) - valor(b)
      : valor(a) - valor(b) || palo(a) - palo(b),
  );
}
