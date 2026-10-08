import { PALOS, ordenEscalera, type Card, type Valor } from '@cartas/core';

/** `tercia` incluye la cuarta: 3 o 4 cartas del mismo valor. */
export type TipoJuego = 'tercia' | 'escalera';

function esTercia(cartas: readonly Card[]): boolean {
  if (cartas.length < 3 || cartas.length > 4) return false;
  const valor = cartas[0]?.valor;
  const palos = new Set(cartas.map((c) => c.palo));
  return palos.size === cartas.length && cartas.every((c) => c.valor === valor);
}

function esEscalera(cartas: readonly Card[], valores: readonly Valor[]): boolean {
  if (cartas.length < 3) return false;
  const palo = cartas[0]?.palo;
  if (!cartas.every((c) => c.palo === palo && valores.includes(c.valor))) return false;
  const orden = cartas.map((c) => ordenEscalera(c.valor, valores)).sort((a, b) => a - b);
  return orden.every((o, i) => i === 0 || o === (orden[i - 1] ?? -1) + 1);
}

/** Qué tipo de juego forman las cartas, o `null` si no forman ninguno. */
export function tipoDeJuego(cartas: readonly Card[], valores: readonly Valor[]): TipoJuego | null {
  if (esTercia(cartas)) return 'tercia';
  if (esEscalera(cartas, valores)) return 'escalera';
  return null;
}

/** Orden para mostrar: escaleras por valor, tercias por palo. */
export function ordenarJuego(
  cartas: readonly Card[],
  tipo: TipoJuego,
  valores: readonly Valor[],
): Card[] {
  const clave =
    tipo === 'escalera'
      ? (c: Card) => ordenEscalera(c.valor, valores)
      : (c: Card) => PALOS.indexOf(c.palo);
  return [...cartas].sort((a, b) => clave(a) - clave(b));
}
