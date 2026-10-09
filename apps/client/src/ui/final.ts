import type { ConquianView } from '@cartas/conquian';
import { bajadasDe, resultado as resultadoDe } from '../vista';

export interface FilaFinal {
  readonly nombre: string;
  readonly bajadas: number;
  readonly gano: boolean;
  /** Es quien mira la pantalla. */
  readonly esHumano: boolean;
}

export interface ResumenFinal {
  readonly tipo: 'ganaste' | 'perdiste' | 'empate';
  readonly titulo: string;
  readonly detalle: string;
  /** Cartas que hay que bajar para ganar. */
  readonly meta: number;
  /** Ganadores primero; después, quien bajó más. */
  readonly filas: readonly FilaFinal[];
}

/** Qué se muestra en la pantalla final, o null si la partida sigue. */
export function resumenFinal(view: ConquianView, nombres: readonly string[]): ResumenFinal | null {
  const resultado = resultadoDe(view);
  if (!resultado) return null;
  const { yo } = view;
  const meta = view.config.cartasPorJugador + 1;
  const ganadores = resultado.type === 'ganador' ? resultado.ganadores : [];
  const nombre = (p: number) => nombres[p] ?? `Jugador ${p + 1}`;

  const filas = view.jugadores
    .map((_, p) => ({
      nombre: nombre(p),
      bajadas: bajadasDe(view, p),
      gano: ganadores.includes(p),
      esHumano: p === yo,
    }))
    .sort((a, b) => Number(b.gano) - Number(a.gano) || b.bajadas - a.bajadas);

  if (resultado.type === 'empate') {
    return {
      tipo: 'empate',
      titulo: 'Empate',
      detalle: 'Se acabó el mazo sin ganador.',
      meta,
      filas,
    };
  }
  if (ganadores.includes(yo)) {
    return {
      tipo: 'ganaste',
      titulo: '¡Ganaste!',
      detalle: `Bajaste tus ${meta} cartas.`,
      meta,
      filas,
    };
  }
  const quien = nombre(ganadores[0] ?? -1);
  return {
    tipo: 'perdiste',
    titulo: `Ganó ${quien}`,
    detalle: `${quien} bajó sus ${meta} cartas.`,
    meta,
    filas,
  };
}
