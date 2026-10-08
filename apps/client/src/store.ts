import { VALORES_40, VALORES_48, VALORES_52 } from '@cartas/core';
import {
  conquian,
  createConquian,
  jugadaIA,
  type ConquianAction,
  type ConquianState,
  type Desmoche,
} from '@cartas/conquian';
import { create } from 'zustand';
import { DURACION_INTERCAMBIO } from './anim/tiempos';
import {
  ARMADO_VACIO,
  agregarPieza,
  jugadaDelArmado,
  piezasDe,
  quitarPieza,
  type Armado,
  type Pieza,
} from './ui/arrastre';
import type { EstiloBaraja } from './ui/baraja';
import { SIN_SELECCION, type Seleccion } from './ui/opciones';
import type { OrdenMano } from './ui/orden';

export const HUMANO = 0;
/** Pausa entre jugadas de la computadora, para que se puedan seguir una por una. */
const PAUSA_IA_MS = 900;
/** En el intercambio, entre que un rival elige su carta y el siguiente. */
const PAUSA_INTERCAMBIO_MS = 600;

/**
 * Cuánto esperar antes de la siguiente jugada de la computadora, para que se vea la anterior.
 * Al terminar el intercambio espera a que cada quien vea la carta que recibió.
 */
export function pausaIA(state: ConquianState, anterior: ConquianState | null): number {
  if (state.fase.type === 'intercambio') return PAUSA_INTERCAMBIO_MS;
  if (anterior?.fase.type === 'intercambio') return PAUSA_IA_MS + DURACION_INTERCAMBIO * 1000;
  return PAUSA_IA_MS;
}

/** En el intercambio, la computadora espera a que elijas tu carta y luego elige uno por uno. */
export function esperaAlHumano(state: ConquianState): boolean {
  return state.fase.type === 'intercambio' && state.fase.elegidas[HUMANO] === null;
}

/**
 * Cómo se juega: solo tocando y con botones, solo arrastrando, o las dos cosas.
 * Las reglas son las mismas; cambia solo la forma de indicar la jugada.
 */
export type ModoControl = 'botones' | 'arrastrar' | 'mixto';

/** `completa`: americana de 52 o española de 48 (según la baraja). `cuarenta`: sin 8, 9 ni 10. */
export type CartasPartida = 'completa' | 'cuarenta';

/** Valores de la baraja para una partida nueva. */
function valoresPara(cartas: CartasPartida, baraja: EstiloBaraja) {
  if (cartas === 'cuarenta') return VALORES_40;
  return baraja === 'americana' ? VALORES_52 : VALORES_48;
}

/** El Conquián con las cartas elegidas. Las cartas se fijan al empezar la partida. */
export function conquianPara(cartas: CartasPartida, baraja: EstiloBaraja) {
  return createConquian({ cartasPorJugador: 9, baraja: { valores: valoresPara(cartas, baraja) } });
}

interface Partida {
  readonly state: ConquianState | null;
  readonly nombres: readonly string[];
  readonly seleccion: Seleccion;
  /** Cómo se muestra la mano. Es solo de este navegador; no toca el estado del juego. */
  readonly ordenMano: OrdenMano;
  /** Orden que el jugador armó arrastrando (ids de carta), cuando `ordenMano` es `manual`. */
  readonly ordenManual: readonly string[];
  /** Explicación breve cuando algo no se pudo hacer (por ejemplo, soltar donde no va). */
  readonly aviso: string | null;
  /** Mostrar sugerencias de jugadas y explicaciones de cómo jugar. Se guarda en el navegador. */
  readonly ayudas: boolean;
  readonly modo: ModoControl;
  /** Cómo se ven las cartas: española o americana. Las reglas son las mismas. */
  readonly baraja: EstiloBaraja;
  /** Con qué cartas se juega la próxima partida: completa, o sin 8, 9 y 10 (40). */
  readonly cartas: CartasPartida;
  /** La última jugada aplicada (de cualquiera), para el sonido. `n` cambia en cada jugada. */
  readonly ultimaJugada: { readonly accion: ConquianAction; readonly n: number } | null;
  /** Sonido apagado. Se guarda en el navegador. */
  readonly silencio: boolean;
  /** Cartas en la zona de armado (solo del cliente hasta que forman juego). */
  readonly armado: Armado;
  /** Se cerró la pantalla final para ver cómo quedó la mesa. */
  readonly verMesa: boolean;
  nueva(jugadores: number): void;
  salir(): void;
  cerrarFinal(): void;
  toggleCarta(cardId: string): void;
  toggleDesmoche(desmoche: Desmoche): void;
  limpiarSeleccion(): void;
  ordenarMano(orden: OrdenMano): void;
  reordenarMano(ids: readonly string[]): void;
  avisar(texto: string | null): void;
  cambiarAyudas(activas: boolean): void;
  cambiarModo(modo: ModoControl): void;
  cambiarBaraja(baraja: EstiloBaraja): void;
  cambiarCartas(cartas: CartasPartida): void;
  cambiarSilencio(silencio: boolean): void;
  /** Pone una carta en la zona de armado; si con ella se forma un juego, se baja solo. */
  armar(pieza: Pieza): void;
  /** Regresa una carta de la zona de armado a su lugar. */
  desarmar(pieza: Pieza): void;
  /** Jugada del humano; viene de las opciones, que salen de validActions. */
  jugar(accion: ConquianAction): void;
}

let timerIA: ReturnType<typeof setTimeout> | null = null;

const CLAVE_ORDEN = 'cartas.ordenMano';
const CLAVE_AYUDAS = 'cartas.ayudas';
const CLAVE_MODO = 'cartas.modo';
const CLAVE_BARAJA = 'cartas.baraja';
const CLAVE_CARTAS = 'cartas.cartas';
const CLAVE_SILENCIO = 'cartas.silencio';

/** Lee una preferencia guardada; sin almacenamiento (modo privado, etc.) devuelve null. */
function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // No pasa nada si no se puede guardar.
  }
}

function leerOrden(): OrdenMano {
  const guardado = leer(CLAVE_ORDEN);
  return guardado === 'numero' ? 'numero' : 'palo';
}

function leerModo(): ModoControl {
  const guardado = leer(CLAVE_MODO);
  return guardado === 'botones' || guardado === 'arrastrar' ? guardado : 'mixto';
}

/** Detiene la jugada de la computadora que esté pendiente. */
export function cancelarIA() {
  if (timerIA !== null) clearTimeout(timerIA);
  timerIA = null;
}

export const usePartida = create<Partida>((set, get) => {
  /** Cola de la computadora: una jugada a la vez, con pausa entre cada una. */
  const programarIA = (anterior: ConquianState | null = null) => {
    cancelarIA();
    const { state } = get();
    if (!state || conquian.result(state) || esperaAlHumano(state)) return;
    const bot = state.jugadores.findIndex(
      (_, p) => p !== HUMANO && conquian.validActions(state, p).length > 0,
    );
    if (bot === -1) return;
    const pausa = pausaIA(state, anterior);
    timerIA = setTimeout(() => {
      const actual = get().state;
      const accion = actual && jugadaIA(actual, bot);
      if (accion) aplicar(accion, false);
    }, pausa);
  };

  const aplicar = (accion: ConquianAction, delHumano: boolean) => {
    const { state, seleccion } = get();
    if (!state) return;
    const nuevo = conquian.apply(state, accion);
    const mano = nuevo.jugadores[HUMANO]?.mano ?? [];
    set({
      state: nuevo,
      aviso: null,
      armado: ARMADO_VACIO,
      ultimaJugada: { accion, n: (get().ultimaJugada?.n ?? 0) + 1 },
      // Si jugó la computadora, se conserva lo que el humano tenía seleccionado de su mano.
      seleccion: delHumano
        ? SIN_SELECCION
        : {
            cartas: seleccion.cartas.filter((id) => mano.some((c) => c.id === id)),
            desmoche: null,
          },
    });
    programarIA(state);
  };

  return {
    state: null,
    nombres: [],
    seleccion: SIN_SELECCION,
    ordenMano: leerOrden(),
    ordenManual: [],
    aviso: null,
    ayudas: leer(CLAVE_AYUDAS) !== 'no',
    modo: leerModo(),
    baraja: leer(CLAVE_BARAJA) === 'americana' ? 'americana' : 'espanola',

    cartas: leer(CLAVE_CARTAS) === 'cuarenta' ? 'cuarenta' : 'completa',

    ultimaJugada: null,
    silencio: leer(CLAVE_SILENCIO) === 'si',

    cambiarSilencio(silencio) {
      set({ silencio });
      guardar(CLAVE_SILENCIO, silencio ? 'si' : 'no');
    },

    cambiarCartas(cartas) {
      set({ cartas });
      guardar(CLAVE_CARTAS, cartas);
    },

    cambiarBaraja(baraja) {
      set({ baraja });
      guardar(CLAVE_BARAJA, baraja);
    },
    armado: ARMADO_VACIO,
    verMesa: false,

    cambiarModo(modo) {
      set({ modo, seleccion: SIN_SELECCION, armado: ARMADO_VACIO, aviso: null });
      guardar(CLAVE_MODO, modo);
    },

    armar(pieza) {
      const { state, armado } = get();
      if (!state) return;
      const nuevo = agregarPieza(armado, pieza);
      const accion = jugadaDelArmado(state, HUMANO, nuevo);
      if (accion) {
        aplicar(accion, true);
        return;
      }
      set({
        armado: nuevo,
        aviso:
          piezasDe(nuevo) >= 3 ? 'Esas cartas no forman juego. Regresa alguna a tu mano.' : null,
      });
    },

    desarmar(pieza) {
      set({ armado: quitarPieza(get().armado, pieza), aviso: null });
    },

    reordenarMano(ids) {
      set({ ordenMano: 'manual', ordenManual: ids, aviso: null });
    },

    avisar(texto) {
      set({ aviso: texto });
    },

    ordenarMano(orden) {
      set({ ordenMano: orden, ordenManual: [] });
      guardar(CLAVE_ORDEN, orden);
    },

    cambiarAyudas(activas) {
      set({ ayudas: activas });
      guardar(CLAVE_AYUDAS, activas ? 'si' : 'no');
    },

    nueva(jugadores) {
      cancelarIA();
      const seed = crypto.randomUUID();
      set({
        // Las cartas se fijan al empezar; cambiar la baraja a media partida solo cambia el dibujo.
        state: conquianPara(get().cartas, get().baraja).setup(jugadores, seed),
        nombres: Array.from({ length: jugadores }, (_, i) => (i === HUMANO ? 'Tú' : `Compu ${i}`)),
        seleccion: SIN_SELECCION,
        armado: ARMADO_VACIO,
        aviso: null,
        verMesa: false,
      });
      programarIA();
    },

    salir() {
      cancelarIA();
      set({
        state: null,
        seleccion: SIN_SELECCION,
        armado: ARMADO_VACIO,
        aviso: null,
        verMesa: false,
      });
    },

    cerrarFinal() {
      set({ verMesa: true });
    },

    toggleCarta(cardId) {
      const { seleccion } = get();
      const { cartas } = seleccion;
      set({
        aviso: null,
        seleccion: {
          ...seleccion,
          cartas: cartas.includes(cardId)
            ? cartas.filter((id) => id !== cardId)
            : [...cartas, cardId],
        },
      });
    },

    toggleDesmoche(desmoche) {
      const { seleccion } = get();
      const igual =
        seleccion.desmoche?.juegoId === desmoche.juegoId &&
        seleccion.desmoche.cardId === desmoche.cardId;
      // Solo una carta desmochada a la vez: tocar otra la reemplaza.
      set({ seleccion: { ...seleccion, desmoche: igual ? null : desmoche } });
    },

    limpiarSeleccion() {
      set({ seleccion: SIN_SELECCION });
    },

    jugar(accion) {
      aplicar(accion, true);
    },
  };
});

// Para depurar y para las pruebas en navegador: el estado queda accesible en la consola.
if (import.meta.env.DEV) {
  (globalThis as { __PARTIDA__?: unknown }).__PARTIDA__ = usePartida;
}
