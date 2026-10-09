import {
  VALORES_40,
  barajar,
  createDeck,
  createRng,
  repartir,
  type Card,
  type CardGame,
  type Valor,
} from '@cartas/core';
import { ordenarJuego, tipoDeJuego } from './juegos';
import type {
  ConquianAction,
  ConquianConfig,
  ConquianState,
  ConquianView,
  Desmoche,
  FaseView,
  Juego,
  Jugador,
} from './types';

export const CONFIG_DEFAULT: ConquianConfig = { cartasPorJugador: 9, baraja: {} };

// ---------- utilidades ----------

const valoresDe = (state: ConquianState): readonly Valor[] =>
  state.config.baraja.valores ?? VALORES_40;

const bajadas = (jugador: Jugador): number =>
  jugador.juegos.reduce((n, j) => n + j.cartas.length, 0);

/** Jugadores en orden hacia la derecha empezando en `desde`. */
const ronda = (desde: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (desde + i) % n);

function jugadorDe(state: ConquianState, player: number): Jugador {
  const jugador = state.jugadores[player];
  if (!jugador) throw new Error(`jugador inválido: ${player}`);
  return jugador;
}

function conJugador(state: ConquianState, player: number, jugador: Jugador): ConquianState {
  return { ...state, jugadores: state.jugadores.map((j, i) => (i === player ? jugador : j)) };
}

/** Saca de la mano las cartas pedidas. Falla si alguna no está o se repite. */
function sacarDeMano(
  mano: readonly Card[],
  ids: readonly string[],
): { sacadas: Card[]; resto: Card[] } {
  if (new Set(ids).size !== ids.length) throw new Error('cartas repetidas en la acción');
  const sacadas = ids.map((id) => {
    const carta = mano.find((c) => c.id === id);
    if (!carta) throw new Error(`la carta ${id} no está en la mano`);
    return carta;
  });
  return { sacadas, resto: mano.filter((c) => !ids.includes(c.id)) };
}

/** Jugador que debe actuar ahora (fuera del intercambio). */
function enTurno(state: ConquianState): number | null {
  const { fase } = state;
  if (fase.type === 'oferta') return fase.cola[0] ?? null;
  if (fase.type === 'botar' || fase.type === 'voltear') return fase.jugador;
  return null;
}

function exigirTurno(state: ConquianState, player: number): void {
  if (enTurno(state) !== player) throw new Error(`no es el turno del jugador ${player}`);
}

/** Gana quien se queda sin mano con todas sus cartas bajadas (la 10 llega de la mesa). */
function revisarGanador(state: ConquianState, player: number): ConquianState {
  const jugador = jugadorDe(state, player);
  if (jugador.mano.length === 0 && bajadas(jugador) > state.config.cartasPorJugador) {
    return {
      ...state,
      fase: { type: 'terminado', resultado: { type: 'ganador', ganadores: [player] } },
    };
  }
  return state;
}

/** El turno va hacia la derecha: le toca voltear a `jugador`. Sin mazo, es empate. */
function tocaVoltear(state: ConquianState, jugador: number): ConquianState {
  if (state.mazo.length === 0) {
    return { ...state, fase: { type: 'terminado', resultado: { type: 'empate' } } };
  }
  return { ...state, fase: { type: 'voltear', jugador } };
}

/** Voltea la de arriba del mazo: se le ofrece primero a él y, si nadie la quiere, voltea el siguiente. */
function voltear(state: ConquianState, player: number): ConquianState {
  if (state.fase.type !== 'voltear') throw new Error('no es momento de voltear');
  exigirTurno(state, player);
  const n = state.jugadores.length;
  const [carta, ...resto] = state.mazo;
  if (!carta) throw new Error('no hay mazo');
  return {
    ...state,
    mazo: resto,
    fase: {
      type: 'oferta',
      carta,
      origen: 'mazo',
      de: player,
      cola: ronda(player, n),
      voltea: (player + 1) % n,
    },
  };
}

/** Pone en la mesa un juego nuevo con las cartas dadas (ya validadas como juego). */
function nuevoJuego(state: ConquianState, player: number, cartas: readonly Card[], mano: Card[]) {
  const valores = valoresDe(state);
  const tipo = tipoDeJuego(cartas, valores);
  if (!tipo) throw new Error('esas cartas no forman un juego');
  const jugador = jugadorDe(state, player);
  const juego = {
    id: `j${state.siguienteJuego}`,
    tipo,
    cartas: ordenarJuego(cartas, tipo, valores),
  };
  return {
    ...conJugador(state, player, { mano, juegos: [...jugador.juegos, juego] }),
    siguienteJuego: state.siguienteJuego + 1,
  };
}

/** Agrega cartas a un juego propio ya bajado. */
function extenderJuego(
  state: ConquianState,
  player: number,
  juegoId: string,
  cartas: readonly Card[],
  mano: Card[],
): ConquianState {
  const valores = valoresDe(state);
  const jugador = jugadorDe(state, player);
  const juego = jugador.juegos.find((j) => j.id === juegoId);
  if (!juego) throw new Error(`el juego ${juegoId} no es del jugador ${player}`);
  const todas = [...juego.cartas, ...cartas];
  const tipo = tipoDeJuego(todas, valores);
  if (!tipo) throw new Error('esas cartas no encajan en el juego');
  const extendido = { ...juego, tipo, cartas: ordenarJuego(todas, tipo, valores) };
  return conJugador(state, player, {
    mano,
    juegos: jugador.juegos.map((j) => (j.id === juegoId ? extendido : j)),
  });
}

/** Solo se desmocha un poker (cuarta), para que el juego quede con mínimo 3 cartas. */
export function sePuedeDesmochar(juego: Juego): boolean {
  return juego.tipo === 'tercia' && juego.cartas.length === 4;
}

/** Saca la carta del poker propio; devuelve el estado sin ella y la carta. */
function desmochar(
  state: ConquianState,
  player: number,
  desmoche: Desmoche,
): { state: ConquianState; carta: Card } {
  const jugador = jugadorDe(state, player);
  const juego = jugador.juegos.find((j) => j.id === desmoche.juegoId);
  if (!juego) throw new Error(`el juego ${desmoche.juegoId} no es del jugador ${player}`);
  if (!sePuedeDesmochar(juego)) throw new Error('solo se puede desmochar un poker');
  const carta = juego.cartas.find((c) => c.id === desmoche.cardId);
  if (!carta) throw new Error(`la carta ${desmoche.cardId} no está en ese juego`);
  const restante = { ...juego, cartas: juego.cartas.filter((c) => c.id !== carta.id) };
  return {
    state: conJugador(state, player, {
      ...jugador,
      juegos: jugador.juegos.map((j) => (j.id === juego.id ? restante : j)),
    }),
    carta,
  };
}

interface Jugada {
  readonly cardIds: readonly string[];
  readonly juegoId?: string | undefined;
  readonly desmoche?: Desmoche | undefined;
  /** La carta de la mesa, si se está tomando. */
  readonly ofrecida?: Card | undefined;
}

/** Baja cartas (de la mano, la mesa y/o un desmoche) en un juego nuevo o en uno propio. */
function jugar(state: ConquianState, player: number, jugada: Jugada): ConquianState {
  const { sacadas, resto } = sacarDeMano(jugadorDe(state, player).mano, jugada.cardIds);
  const cartas = jugada.ofrecida ? [jugada.ofrecida, ...sacadas] : [...sacadas];
  let tras = state;
  if (jugada.desmoche) {
    if (jugada.desmoche.juegoId === jugada.juegoId) {
      throw new Error('no se puede desmochar y agregar al mismo juego');
    }
    const d = desmochar(tras, player, jugada.desmoche);
    tras = d.state;
    cartas.push(d.carta);
  }
  if (cartas.length === 0) throw new Error('no hay cartas para bajar');
  return jugada.juegoId === undefined
    ? nuevoJuego(tras, player, cartas, resto)
    : extenderJuego(tras, player, jugada.juegoId, cartas, resto);
}

// ---------- acciones ----------

function pasarCarta(state: ConquianState, player: number, cardId: string): ConquianState {
  const { fase } = state;
  if (fase.type !== 'intercambio') throw new Error('no es momento de pasar carta');
  if (fase.elegidas[player] !== null) throw new Error('ya elegiste la carta para pasar');
  sacarDeMano(jugadorDe(state, player).mano, [cardId]);
  const elegidas = fase.elegidas.map((e, i) => (i === player ? cardId : e));
  if (elegidas.some((e) => e === null)) {
    return { ...state, fase: { ...fase, elegidas } };
  }
  // Todos eligieron: cada uno le pasa su carta al de la derecha.
  const n = state.jugadores.length;
  const jugadores = state.jugadores.map((jugador, i) => {
    const izquierda = (i - 1 + n) % n;
    const recibida = state.jugadores[izquierda]?.mano.find((c) => c.id === elegidas[izquierda]);
    if (!recibida) throw new Error('intercambio inconsistente');
    return { ...jugador, mano: [...jugador.mano.filter((c) => c.id !== elegidas[i]), recibida] };
  });
  return tocaVoltear({ ...state, jugadores }, 0);
}

function pasar(state: ConquianState, player: number): ConquianState {
  const { fase } = state;
  if (fase.type !== 'oferta') throw new Error('no hay carta ofrecida');
  exigirTurno(state, player);
  if (obligadoATomar(state, player)) {
    throw new Error('la carta entra en un juego tuyo: tienes que tomarla');
  }
  const cola = fase.cola.slice(1);
  if (cola.length > 0) return { ...state, fase: { ...fase, cola } };
  // Nadie la quiso: queda muerta y sigue el turno.
  return tocaVoltear({ ...state, muertas: [...state.muertas, fase.carta] }, fase.voltea);
}

function tomar(state: ConquianState, player: number, jugada: Jugada): ConquianState {
  const { fase } = state;
  if (fase.type !== 'oferta') throw new Error('no hay carta ofrecida');
  exigirTurno(state, player);
  const tras = jugar(state, player, { ...jugada, ofrecida: fase.carta });
  const ganado = revisarGanador(tras, player);
  if (ganado.fase.type === 'terminado') return ganado;
  return { ...tras, fase: { type: 'botar', jugador: player } };
}

function bajarOAgregar(state: ConquianState, player: number, jugada: Jugada): ConquianState {
  exigirTurno(state, player);
  return revisarGanador(jugar(state, player, jugada), player);
}

function botar(state: ConquianState, player: number, cardId: string): ConquianState {
  if (state.fase.type !== 'botar') throw new Error('no es momento de botar');
  exigirTurno(state, player);
  const jugador = jugadorDe(state, player);
  const { sacadas, resto } = sacarDeMano(jugador.mano, [cardId]);
  const [carta] = sacadas;
  if (!carta) throw new Error('carta inválida');
  const n = state.jugadores.length;
  return {
    ...conJugador(state, player, { ...jugador, mano: resto }),
    // Quien usó la carta "paga": la botada se ofrece a los demás en orden y,
    // si nadie la quiere, voltea el de su derecha, como si él la hubiera sacado.
    fase: {
      type: 'oferta',
      carta,
      origen: 'botada',
      de: player,
      cola: ronda(player + 1, n).slice(0, n - 1),
      voltea: (player + 1) % n,
    },
  };
}

function apply(state: ConquianState, action: ConquianAction): ConquianState {
  if (state.fase.type === 'terminado') throw new Error('la partida ya terminó');
  jugadorDe(state, action.player);
  switch (action.type) {
    case 'pasarCarta':
      return pasarCarta(state, action.player, action.cardId);
    case 'voltear':
      return voltear(state, action.player);
    case 'pasar':
      return pasar(state, action.player);
    case 'tomar':
      return tomar(state, action.player, action);
    case 'bajar':
      return bajarOAgregar(state, action.player, { ...action, juegoId: undefined });
    case 'agregar':
      return bajarOAgregar(state, action.player, action);
    case 'botar':
      return botar(state, action.player, action.cardId);
  }
}

// ---------- acciones válidas ----------

function* subconjuntos<T>(items: readonly T[], minimo: number): Generator<T[]> {
  const total = 1 << items.length;
  for (let mask = 0; mask < total; mask++) {
    const sub = items.filter((_, i) => mask & (1 << i));
    if (sub.length >= minimo) yield sub;
  }
}

const ids = (cartas: readonly Card[]) => cartas.map((c) => c.id);

/** Tomar la carta de la mesa para agregarla a un juego propio ya bajado. */
const entraEnSuJuego = (a: ConquianAction) => a.type === 'tomar' && a.juegoId !== undefined;

/** La carta de la mesa entra en un juego que `player` ya bajó: no la puede dejar pasar. */
export function obligadoATomar(state: ConquianState, player: number): boolean {
  return state.fase.type === 'oferta' && validActions(state, player).some(entraEnSuJuego);
}

function validActions(state: ConquianState, player: number): ConquianAction[] {
  const { fase } = state;
  const jugador = state.jugadores[player];
  if (!jugador) return [];

  if (fase.type === 'intercambio') {
    if (fase.elegidas[player] !== null) return [];
    return jugador.mano.map((c) => ({ type: 'pasarCarta', player, cardId: c.id }));
  }
  if (enTurno(state) !== player) return [];
  if (fase.type === 'voltear') return [{ type: 'voltear', player }];

  const valores = valoresDe(state);
  const acciones: ConquianAction[] = [];

  // Cada combinación de: carta de la mesa (si hay oferta), un desmoche (o ninguno)
  // y cartas de la mano; puesta en un juego nuevo o en uno propio.
  // Bajar y agregar sin la mesa se puede tanto en la oferta como antes de botar.
  const desmoches = [
    null,
    ...jugador.juegos
      .filter(sePuedeDesmochar)
      .flatMap((j) => j.cartas.map((carta) => ({ juegoId: j.id, cardId: carta.id, carta }))),
  ];
  const usosMesa = fase.type === 'oferta' ? [null, fase.carta] : [null];
  for (const mesa of usosMesa) {
    for (const d of desmoches) {
      const extra = [...(mesa ? [mesa] : []), ...(d ? [d.carta] : [])];
      for (const sub of subconjuntos(jugador.mano, 0)) {
        const nuevas = [...extra, ...sub];
        if (nuevas.length === 0) continue;
        const base = {
          player,
          cardIds: ids(sub),
          ...(d ? { desmoche: { juegoId: d.juegoId, cardId: d.cardId } } : {}),
        };
        if (nuevas.length >= 3 && tipoDeJuego(nuevas, valores)) {
          acciones.push(mesa ? { type: 'tomar', ...base } : { type: 'bajar', ...base });
        }
        for (const juego of jugador.juegos) {
          if (juego.id === d?.juegoId) continue;
          if (tipoDeJuego([...juego.cartas, ...nuevas], valores)) {
            acciones.push(
              mesa
                ? { type: 'tomar', juegoId: juego.id, ...base }
                : { type: 'agregar', juegoId: juego.id, ...base },
            );
          }
        }
      }
    }
  }

  if (fase.type === 'botar') {
    for (const c of jugador.mano) acciones.push({ type: 'botar', player, cardId: c.id });
    return acciones;
  }

  if (fase.type !== 'oferta') return acciones;
  // Si la carta entra en un juego que ya bajó, está obligado a tomarla.
  if (!acciones.some(entraEnSuJuego)) acciones.push({ type: 'pasar', player });
  return acciones;
}

// ---------- setup, vista y resultado ----------

function setup(config: ConquianConfig, players: number, seed: string): ConquianState {
  if (!Number.isInteger(players) || players < 2 || players > 4) {
    throw new Error(`Conquián es de 2 a 4 jugadores, no ${players}`);
  }
  const deck = barajar(createDeck(config.baraja), createRng(seed));
  if (deck.length <= players * config.cartasPorJugador) {
    throw new Error('no alcanzan las cartas para repartir y dejar mazo');
  }
  const { manos, mazo } = repartir(deck, players, config.cartasPorJugador);
  return {
    config,
    jugadores: manos.map((mano) => ({ mano, juegos: [] })),
    mazo,
    muertas: [],
    fase: { type: 'intercambio', elegidas: manos.map(() => null) },
    siguienteJuego: 1,
  };
}

function faseView(state: ConquianState, player: number): FaseView {
  const { fase } = state;
  switch (fase.type) {
    case 'intercambio':
      return {
        type: 'intercambio',
        miCarta: fase.elegidas[player] ?? null,
        listos: fase.elegidas.map((e) => e !== null),
      };
    case 'oferta':
      return {
        type: 'oferta',
        carta: fase.carta,
        origen: fase.origen,
        de: fase.de,
        turno: fase.cola[0] ?? -1,
      };
    case 'voltear':
    case 'botar':
    case 'terminado':
      return fase;
  }
}

function view(state: ConquianState, player: number): ConquianView {
  return {
    config: state.config,
    yo: player,
    mano: jugadorDe(state, player).mano,
    jugadores: state.jugadores.map((j) => ({ cartasEnMano: j.mano.length, juegos: j.juegos })),
    mazo: state.mazo.length,
    muertas: state.muertas,
    fase: faseView(state, player),
  };
}

export function createConquian(
  config: ConquianConfig = CONFIG_DEFAULT,
): CardGame<ConquianState, ConquianAction, ConquianView> {
  return {
    id: 'conquian',
    nombre: 'Conquián',
    minPlayers: 2,
    maxPlayers: 4,
    setup: (players, seed) => setup(config, players, seed),
    validActions,
    apply,
    view,
    result: (state) => (state.fase.type === 'terminado' ? state.fase.resultado : null),
  };
}

export const conquian = createConquian();
