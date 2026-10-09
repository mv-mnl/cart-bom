import {
  conquian,
  type ConquianAction,
  type ConquianState,
  type ConquianView,
} from '@cartas/conquian';
import type { GameResult } from '@cartas/core';
import { instantanea, type Instantanea } from '@cartas/shared';

/**
 * Todo lo que el cliente sabe de la partida: su vista y las jugadas que puede hacer.
 * Es lo mismo contra la computadora que en línea; el cliente nunca ve las manos ajenas
 * ni el mazo, así que no puede depender de ellos.
 */
export type Vista = Instantanea<ConquianView, ConquianAction>;

/** La vista de `player` en una partida local (contra la computadora o el laboratorio). */
export const vistaDe = (
  state: ConquianState,
  player: number,
  jugada: ConquianAction | null = null,
): Vista => instantanea(conquian, state, player, jugada);

/** Quien debe actuar ahora (fuera del intercambio). */
export function enTurno(view: ConquianView): number | null {
  if (view.fase.type === 'oferta') return view.fase.turno;
  if (view.fase.type === 'botar' || view.fase.type === 'voltear') return view.fase.jugador;
  return null;
}

export const resultado = (view: ConquianView): GameResult | null =>
  view.fase.type === 'terminado' ? view.fase.resultado : null;

/** Te ofrecen la carta de la mesa. */
export const ofertaMia = ({ view }: Vista): boolean =>
  view.fase.type === 'oferta' && view.fase.turno === view.yo;

/**
 * La carta de la mesa entra en un juego tuyo: tienes que tomarla. Las reglas ya quitan
 * `pasar` de tus jugadas cuando pasa eso.
 */
export const obligado = (vista: Vista): boolean =>
  ofertaMia(vista) && !vista.acciones.some((a) => a.type === 'pasar');

/** Cartas que tiene bajadas `player`. */
export const bajadasDe = (view: ConquianView, player: number): number =>
  view.jugadores[player]?.juegos.reduce((n, j) => n + j.cartas.length, 0) ?? 0;
