import type { Card, Palo, Valor } from '@cartas/core';

/**
 * Cómo se ven las cartas. Las reglas son las mismas: la baraja americana es la
 * española con otros dibujos (oros ♦, copas ♥, espadas ♠, bastos ♣; Sota J, Caballo Q, Rey K).
 */
export type EstiloBaraja = 'espanola' | 'americana';

interface DatosPalo {
  readonly nombre: string;
  /** Símbolo para dibujar la carta (la española usa figuras, no texto). */
  readonly simbolo: string | null;
  readonly color: number;
}

interface DatosValor {
  /** Lo que va en la esquina de la carta. */
  readonly corto: string;
  /** Nombre en los mensajes ("la Sota de oros", "el As de picas"). */
  readonly largo: string;
  readonly femenino: boolean;
}

interface Estilo {
  readonly nombre: string;
  readonly palos: Readonly<Record<Palo, DatosPalo>>;
  readonly figuras: Readonly<Partial<Record<Valor, DatosValor>>>;
}

export const ESTILOS: Readonly<Record<EstiloBaraja, Estilo>> = {
  espanola: {
    nombre: 'Española',
    palos: {
      oros: { nombre: 'oros', simbolo: null, color: 0xc9970c },
      copas: { nombre: 'copas', simbolo: null, color: 0xb3261e },
      espadas: { nombre: 'espadas', simbolo: null, color: 0x2a5599 },
      bastos: { nombre: 'bastos', simbolo: null, color: 0x2e7d32 },
    },
    figuras: {
      1: { corto: '1', largo: 'As', femenino: false },
      10: { corto: 'S', largo: 'Sota', femenino: true },
      11: { corto: 'C', largo: 'Caballo', femenino: false },
      12: { corto: 'R', largo: 'Rey', femenino: false },
      // La española no tiene 10; solo aparece si la partida usa la americana completa.
      13: { corto: '10', largo: '10', femenino: false },
    },
  },
  americana: {
    nombre: 'Americana',
    palos: {
      oros: { nombre: 'diamantes', simbolo: '♦', color: 0xc62828 },
      copas: { nombre: 'corazones', simbolo: '♥', color: 0xc62828 },
      espadas: { nombre: 'picas', simbolo: '♠', color: 0x1f1f1f },
      bastos: { nombre: 'tréboles', simbolo: '♣', color: 0x1f1f1f },
    },
    figuras: {
      1: { corto: 'A', largo: 'As', femenino: false },
      10: { corto: 'J', largo: 'Jota', femenino: true },
      11: { corto: 'Q', largo: 'Reina', femenino: true },
      12: { corto: 'K', largo: 'Rey', femenino: false },
      13: { corto: '10', largo: '10', femenino: false },
    },
  },
};

export const datosPalo = (palo: Palo, estilo: EstiloBaraja) => ESTILOS[estilo].palos[palo];

export const etiquetaCorta = (valor: Valor, estilo: EstiloBaraja) =>
  ESTILOS[estilo].figuras[valor]?.corto ?? String(valor);

export const nombreValor = (valor: Valor, estilo: EstiloBaraja = 'espanola') =>
  ESTILOS[estilo].figuras[valor]?.largo ?? String(valor);

export function nombreCarta(carta: Card, estilo: EstiloBaraja = 'espanola'): string {
  return `${nombreValor(carta.valor, estilo)} de ${datosPalo(carta.palo, estilo).nombre}`;
}

/** "el 3 de oros", "la Sota de copas", "la Reina de picas". */
export function conArticulo(carta: Card, estilo: EstiloBaraja = 'espanola'): string {
  const femenino = ESTILOS[estilo].figuras[carta.valor]?.femenino ?? false;
  return `${femenino ? 'la' : 'el'} ${nombreCarta(carta, estilo)}`;
}
