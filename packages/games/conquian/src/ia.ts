import { VALORES_40, ordenEscalera, type Card, type Valor } from '@cartas/core';
import { conquian } from './conquian';
import { tipoDeJuego } from './juegos';
import type { ConquianAction, ConquianState } from './types';

/**
 * Qué tan útil es una carta para la mano: cuenta compañeras del mismo valor
 * y del mismo palo a distancia 1 o 2 en la escalera.
 */
function utilidad(carta: Card, mano: readonly Card[], valores: readonly Valor[]): number {
  const orden = ordenEscalera(carta.valor, valores);
  let puntos = 0;
  for (const otra of mano) {
    if (otra.id === carta.id) continue;
    if (otra.valor === carta.valor) puntos += 2;
    if (otra.palo === carta.palo) {
      const distancia = Math.abs(ordenEscalera(otra.valor, valores) - orden);
      if (distancia === 1) puntos += 2;
      if (distancia === 2) puntos += 1;
    }
  }
  return puntos;
}

/** La carta que menos le sirve; en empate, la que encaja en menos juegos ajenos. */
function peorCarta(
  state: ConquianState,
  player: number,
  candidatas: readonly Card[],
): Card | undefined {
  const valores = state.config.baraja.valores ?? VALORES_40;
  const mano = state.jugadores[player]?.mano ?? [];
  const juegosAjenos = state.jugadores.filter((_, i) => i !== player).flatMap((j) => j.juegos);
  const leSirveAOtro = (c: Card) =>
    juegosAjenos.some((j) => tipoDeJuego([...j.cartas, c], valores) !== null) ? 1 : 0;
  const costo = (c: Card) => utilidad(c, mano, valores) * 10 + leSirveAOtro(c) * 5;
  return [...candidatas].sort((a, b) => costo(a) - costo(b))[0];
}

/**
 * Jugada de la computadora. Solo usa información que el jugador puede ver:
 * su mano, la carta en la mesa y los juegos bajados.
 */
export function jugadaIA(state: ConquianState, player: number): ConquianAction | null {
  const acciones = conquian.validActions(state, player);
  if (acciones.length === 0) return null;
  const mano = state.jugadores[player]?.mano ?? [];

  const pasarCarta = acciones.filter((a) => a.type === 'pasarCarta');
  if (pasarCarta.length > 0) {
    const carta = peorCarta(state, player, mano);
    return pasarCarta.find((a) => a.cardId === carta?.id) ?? pasarCarta[0] ?? null;
  }

  const voltear = acciones.find((a) => a.type === 'voltear');
  if (voltear) return voltear;

  // Lo que más cartas baje primero: tomar la carta de la mesa, bajar o agregar.
  // Se cuentan las cartas que salen de la mano o de la mesa; mover una carta
  // desmochada a otro juego sin bajar nada de la mano no le sirve.
  const cuantas = (a: ConquianAction) =>
    a.type === 'tomar' ? a.cardIds.length + 1 : 'cardIds' in a ? a.cardIds.length : 0;
  const jugadas = acciones
    .filter((a) => a.type === 'tomar' || a.type === 'bajar' || a.type === 'agregar')
    .filter((a) => cuantas(a) > 0)
    .sort((a, b) => cuantas(b) - cuantas(a) || (a.type === 'tomar' ? -1 : 1));
  const mejor = jugadas[0];
  if (mejor) return mejor;

  const botar = acciones.filter((a) => a.type === 'botar');
  if (botar.length > 0) {
    const carta = peorCarta(state, player, mano);
    return botar.find((a) => a.cardId === carta?.id) ?? botar[0] ?? null;
  }

  return acciones.find((a) => a.type === 'pasar') ?? null;
}
