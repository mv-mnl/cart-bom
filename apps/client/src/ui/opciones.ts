import {
  ordenarJuego,
  tipoDeJuego,
  type ConquianAction,
  type Desmoche,
  type Juego,
} from '@cartas/conquian';
import { VALORES_40, type Card } from '@cartas/core';
import type { Vista } from '../vista';
import { conArticulo as conArticuloDe, datosPalo, nombreValor, type EstiloBaraja } from './baraja';

/** Cartas de la mano seleccionadas y, quizá, una carta de un poker propio (desmoche). */
export interface Seleccion {
  readonly cartas: readonly string[];
  readonly desmoche: Desmoche | null;
}

export const SIN_SELECCION: Seleccion = { cartas: [], desmoche: null };

/** Una jugada lista para mostrarse como botón. */
export interface Opcion {
  readonly accion: ConquianAction;
  readonly etiqueta: string;
  /** Las cartas que se mueven, para dibujarlas en miniatura. */
  readonly cartas: readonly Card[];
}

export function nombreJuego(
  cartas: readonly Card[],
  tipo: Juego['tipo'],
  estilo: EstiloBaraja = 'espanola',
): string {
  const [primera] = cartas;
  if (!primera) return 'juego';
  if (tipo === 'escalera') return `escalera de ${datosPalo(primera.palo, estilo).nombre}`;
  return `${cartas.length === 4 ? 'poker' : 'tercia'} de ${nombreValor(primera.valor, estilo)}`;
}

const mismoConjunto = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const mismoDesmoche = (a: Desmoche | undefined, b: Desmoche | null) =>
  a === undefined ? b === null : a.juegoId === b?.juegoId && a.cardId === b.cardId;

/** Convierte una acción en algo que una persona entiende. */
export function describir(
  { view }: Vista,
  accion: ConquianAction,
  estilo: EstiloBaraja = 'espanola',
): Opcion {
  const conArticulo = (carta: Card) => conArticuloDe(carta, estilo);
  const jugador = view.jugadores[view.yo];
  const deMano = (id: string) => view.mano.filter((c) => c.id === id);
  const { fase } = view;

  switch (accion.type) {
    case 'pasar':
      return { accion, etiqueta: 'Pasar', cartas: [] };
    case 'voltear':
      return { accion, etiqueta: 'Sacar del mazo', cartas: [] };
    case 'pasarCarta': {
      const cartas = deMano(accion.cardId);
      const carta = cartas[0];
      return { accion, etiqueta: carta ? `Pasar ${conArticulo(carta)}` : 'Pasar', cartas };
    }
    case 'botar': {
      const cartas = deMano(accion.cardId);
      const carta = cartas[0];
      return { accion, etiqueta: carta ? `Botar ${conArticulo(carta)}` : 'Botar', cartas };
    }
    case 'bajar':
    case 'agregar':
    case 'tomar': {
      const mesa = accion.type === 'tomar' && fase.type === 'oferta' ? fase.carta : null;
      const desmochada = accion.desmoche
        ? jugador?.juegos
            .find((j) => j.id === accion.desmoche?.juegoId)
            ?.cartas.find((c) => c.id === accion.desmoche?.cardId)
        : undefined;
      const cartas = [
        ...(mesa ? [mesa] : []),
        ...(desmochada ? [desmochada] : []),
        ...accion.cardIds.flatMap(deMano),
      ];
      const destino =
        'juegoId' in accion && accion.juegoId !== undefined
          ? jugador?.juegos.find((j) => j.id === accion.juegoId)
          : undefined;
      const valores = view.config.baraja.valores ?? VALORES_40;
      let etiqueta: string;
      if (destino) {
        const que = mesa ? `${conArticulo(mesa)}` : 'las cartas';
        etiqueta = `Agregar ${que} a tu ${nombreJuego(destino.cartas, destino.tipo, estilo)}`;
      } else {
        const tipo = tipoDeJuego(cartas, valores) ?? 'tercia';
        const juego = nombreJuego(cartas, tipo, estilo);
        etiqueta = mesa ? `Bajar ${juego} con ${conArticulo(mesa)}` : `Bajar ${juego}`;
      }
      if (desmochada) etiqueta += ` (desmochando ${conArticulo(desmochada)})`;
      // Las de una escalera se muestran en orden (8 9 10 J), no en el orden en que se juntaron.
      const enOrden =
        tipoDeJuego(cartas, valores) === 'escalera'
          ? ordenarJuego(cartas, 'escalera', valores)
          : cartas;
      return { accion, etiqueta, cartas: enOrden };
    }
  }
}

/** Qué se puede hacer exactamente con lo que el jugador tiene seleccionado. */
export function opcionesSeleccion(
  vista: Vista,
  sel: Seleccion,
  estilo: EstiloBaraja = 'espanola',
): Opcion[] {
  if (sel.cartas.length === 0 && !sel.desmoche) return [];
  const sola = !sel.desmoche && sel.cartas.length === 1 ? sel.cartas[0] : undefined;
  const acciones = vista.acciones.filter((a) => {
    switch (a.type) {
      case 'pasar':
      case 'voltear':
        return false;
      case 'pasarCarta':
      case 'botar':
        return a.cardId === sola;
      default:
        return mismoConjunto(a.cardIds, sel.cartas) && mismoDesmoche(a.desmoche, sel.desmoche);
    }
  });
  // Primero las jugadas que bajan; botar al final.
  const peso = (a: ConquianAction) => (a.type === 'tomar' ? 0 : a.type === 'botar' ? 2 : 1);
  return acciones.sort((a, b) => peso(a) - peso(b)).map((a) => describir(vista, a, estilo));
}

/**
 * Las mejores jugadas disponibles ahora, para sugerirlas: primero las que bajan más
 * cartas de la mano. No incluye pasar ni botar, ni mover cartas sin bajar nada.
 */
export function sugerencias(vista: Vista, maximo = 4, estilo: EstiloBaraja = 'espanola'): Opcion[] {
  const deMano = (a: ConquianAction) => ('cardIds' in a ? a.cardIds.length : 0);
  const total = (a: ConquianAction) =>
    deMano(a) + (a.type === 'tomar' ? 1 : 0) + ('desmoche' in a && a.desmoche ? 1 : 0);
  return vista.acciones
    .filter(
      (a) => a.type === 'tomar' || ((a.type === 'bajar' || a.type === 'agregar') && deMano(a) > 0),
    )
    .sort(
      (a, b) =>
        Number(b.type === 'tomar') - Number(a.type === 'tomar') ||
        deMano(b) - deMano(a) ||
        total(b) - total(a),
    )
    .slice(0, maximo)
    .map((a) => describir(vista, a, estilo));
}
