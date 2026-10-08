export const PALOS = ['oros', 'copas', 'espadas', 'bastos'] as const;
export type Palo = (typeof PALOS)[number];

/**
 * 1–9 numéricas, 10 Sota (J), 11 Caballo (Q), 12 Rey (K) y 13 el diez numérico,
 * que solo existe en la baraja americana completa (ver `DIEZ`).
 */
export type Valor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/**
 * El 10 numérico de la baraja americana. Lleva 13 porque 10–12 ya son las figuras;
 * en las escaleras va entre el 9 y la J porque el orden sale de la lista de valores
 * de cada baraja (`ordenEscalera`), no del número.
 */
export const DIEZ = 13 satisfies Valor;

/** Baraja de 40 cartas (sin 8, 9 ni 10): la tradicional del Conquián. */
export const VALORES_40: readonly Valor[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
/** Baraja española completa: 48 cartas (con 8 y 9). */
export const VALORES_48: readonly Valor[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** Baraja americana completa: 52 cartas (A–10, J, Q, K). */
export const VALORES_52: readonly Valor[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, DIEZ, 10, 11, 12];

export interface Card {
  /** Estable durante toda la partida. Revela la carta: no mandarlo al cliente si está oculta. */
  readonly id: string;
  readonly palo: Palo;
  readonly valor: Valor;
}

export interface DeckOptions {
  /** Valores incluidos, en orden de escalera. Por defecto la baraja de 40. */
  readonly valores?: readonly Valor[];
  /** Cuántas barajas combinar. Por defecto 1. */
  readonly copias?: number;
}

export function createDeck(options: DeckOptions = {}): Card[] {
  const valores = options.valores ?? VALORES_40;
  const copias = options.copias ?? 1;
  if (!Number.isInteger(copias) || copias < 1) {
    throw new Error(`copias inválidas: ${copias}`);
  }
  const deck: Card[] = [];
  for (let copia = 0; copia < copias; copia++) {
    for (const palo of PALOS) {
      for (const valor of valores) {
        const id = copias === 1 ? `${palo}-${valor}` : `${palo}-${valor}-${copia}`;
        deck.push({ id, palo, valor });
      }
    }
  }
  return deck;
}

/**
 * Posición de un valor en el orden de escalera de la baraja usada.
 * Con la baraja de 40, el 7 y la Sota quedan consecutivos.
 */
export function ordenEscalera(valor: Valor, valores: readonly Valor[] = VALORES_40): number {
  const i = valores.indexOf(valor);
  if (i === -1) {
    throw new Error(`el valor ${valor} no está en esta baraja`);
  }
  return i;
}
