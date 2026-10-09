import {
  configPara,
  conquian,
  createConquian,
  jugadaIA,
  type ConquianAction,
  type ConquianState,
  type ConquianView,
} from '@cartas/conquian';
import {
  esBarajaSala,
  esCartasSala,
  igualJSON,
  instantanea,
  type BarajaSala,
  type CartasSala,
  type Instantanea,
  type Sala,
} from '@cartas/shared';

export const MIN_JUGADORES = conquian.minPlayers;
export const MAX_JUGADORES = conquian.maxPlayers;
const LARGO_NOMBRE = 16;

/** Un error que se le puede decir tal cual al jugador. */
export class Rechazo extends Error {}

interface Asiento {
  /** La sesión de quien está sentado; `null` si es de la computadora. */
  readonly id: string | null;
  readonly nombre: string;
  readonly desconectado: boolean;
}

/** Nombre limpio: sin espacios de más, corto y nunca vacío. */
export function limpiarNombre(nombre: unknown, porDefecto: string): string {
  const limpio = typeof nombre === 'string' ? nombre.replace(/\s+/g, ' ').trim() : '';
  return limpio.slice(0, LARGO_NOMBRE) || porDefecto;
}

/**
 * Una sala de Conquián: quién está sentado, la partida y qué ve cada quien. No sabe nada
 * de la red; la Room de Colyseus la usa y manda lo que esta le dice.
 * Los asientos son los números de jugador de la partida, en orden de llegada.
 */
export class SalaConquian {
  private asientos: Asiento[] = [];
  private anfitrion = 0;
  private state: ConquianState | null = null;
  /** El juego con las reglas de la sala (qué cartas se usan y cómo se ven). */
  private juego: ReturnType<typeof createConquian>;

  constructor(
    readonly codigo: string,
    private cartas: CartasSala,
    private baraja: BarajaSala,
  ) {
    this.juego = createConquian(configPara(cartas, baraja));
  }

  get enJuego(): boolean {
    return this.state !== null;
  }

  get terminada(): boolean {
    return this.state !== null && this.juego.result(this.state) !== null;
  }

  /** Personas sentadas (sin contar a la computadora). */
  get personas(): number {
    return this.asientos.filter((a) => a.id !== null).length;
  }

  asientoDe(id: string): number {
    return this.asientos.findIndex((a) => a.id === id);
  }

  private exigirAsiento(id: string): number {
    const asiento = this.asientoDe(id);
    if (asiento === -1) throw new Rechazo('No estás sentado en esta sala.');
    return asiento;
  }

  /** Se sienta en el siguiente lugar libre. Solo antes de empezar. */
  sentar(id: string, nombre: unknown): number {
    if (this.enJuego) throw new Rechazo('La partida ya empezó.');
    if (this.asientos.length >= MAX_JUGADORES) throw new Rechazo('La sala está llena.');
    const asiento = this.asientos.length;
    this.asientos.push({
      id,
      nombre: limpiarNombre(nombre, `Jugador ${asiento + 1}`),
      desconectado: false,
    });
    return asiento;
  }

  /**
   * Se fue para siempre. Antes de empezar se libera su asiento; con la partida andando,
   * lo sigue jugando la computadora. Si era el anfitrión, pasa a la siguiente persona.
   */
  quitar(id: string): void {
    const asiento = this.asientoDe(id);
    if (asiento === -1) return;
    if (!this.enJuego) {
      this.asientos.splice(asiento, 1);
      if (this.anfitrion > asiento) this.anfitrion--;
    } else {
      const a = this.asientos[asiento];
      if (a) this.asientos[asiento] = { id: null, nombre: a.nombre, desconectado: false };
    }
    if (this.asientos[this.anfitrion]?.id == null) {
      this.anfitrion = Math.max(
        0,
        this.asientos.findIndex((a) => a.id !== null),
      );
    }
  }

  /** Se le cayó la conexión: su asiento lo espera un rato. */
  marcarConexion(id: string, conectado: boolean): void {
    const asiento = this.asientoDe(id);
    const a = this.asientos[asiento];
    if (a) this.asientos[asiento] = { ...a, desconectado: !conectado };
  }

  /** El anfitrión empieza; `compus` asientos más los juega la computadora. */
  empezar(id: string, compus: unknown, seed: string): void {
    this.exigirAnfitrion(id, 'Solo quien creó la sala puede empezar.');
    if (this.enJuego) throw new Rechazo('La partida ya empezó.');
    if (typeof compus !== 'number' || !Number.isInteger(compus) || compus < 0) {
      throw new Rechazo('Número de computadoras inválido.');
    }
    const total = this.asientos.length + compus;
    if (total < MIN_JUGADORES || total > MAX_JUGADORES) {
      throw new Rechazo(`Se juega de ${MIN_JUGADORES} a ${MAX_JUGADORES}.`);
    }
    for (let i = 0; i < compus; i++) {
      this.asientos.push({ id: null, nombre: `Compu ${i + 1}`, desconectado: false });
    }
    this.repartir(seed);
  }

  /**
   * El anfitrión cambia con qué se juega: antes de empezar o al terminar una partida.
   * La partida en curso nunca cambia; lo nuevo vale desde el siguiente reparto.
   */
  configurar(id: string, cartas: unknown, baraja: unknown): void {
    this.exigirAnfitrion(id, 'Solo quien creó la sala cambia el juego.');
    if (this.enJuego && !this.terminada) {
      throw new Rechazo('El juego se cambia entre partidas.');
    }
    if (!esCartasSala(cartas) || !esBarajaSala(baraja)) throw new Rechazo('Juego inválido.');
    this.cartas = cartas;
    this.baraja = baraja;
    this.juego = createConquian(configPara(cartas, baraja));
  }

  /** Otra partida con los mismos asientos, cuando terminó la anterior. La empieza el anfitrión. */
  revancha(id: string, seed: string): void {
    this.exigirAnfitrion(id, 'Solo quien creó la sala empieza la revancha.');
    if (!this.terminada) throw new Rechazo('La partida no ha terminado.');
    this.repartir(seed);
  }

  private exigirAnfitrion(id: string, motivo: string): void {
    if (this.exigirAsiento(id) !== this.anfitrion) throw new Rechazo(motivo);
  }

  private repartir(seed: string): void {
    this.state = this.juego.setup(this.asientos.length, seed);
  }

  /**
   * Una jugada de una persona. Solo se acepta si está tal cual entre sus jugadas válidas;
   * se aplica la del servidor, no el objeto que mandó el cliente.
   */
  jugar(id: string, accion: unknown): ConquianAction {
    const asiento = this.exigirAsiento(id);
    if (!this.state) throw new Rechazo('La partida no ha empezado.');
    const valida = this.juego.validActions(this.state, asiento).find((a) => igualJSON(a, accion));
    if (!valida) throw new Rechazo('Esa jugada no se puede hacer ahora.');
    this.state = this.juego.apply(this.state, valida);
    return valida;
  }

  /** La siguiente jugada de la computadora, si a alguno de sus asientos le toca. */
  jugadaCompu(): ConquianAction | null {
    const state = this.state;
    if (!state || this.juego.result(state)) return null;
    for (let p = 0; p < this.asientos.length; p++) {
      if (this.asientos[p]?.id !== null) continue;
      const accion = jugadaIA(state, p);
      if (accion) return accion;
    }
    return null;
  }

  aplicarCompu(accion: ConquianAction): void {
    if (!this.state) return;
    if (this.asientos[accion.player]?.id !== null) return;
    this.state = this.juego.apply(this.state, accion);
  }

  /** La sala como la ve quien está en el asiento de `id`. */
  sala(id: string): Sala {
    return {
      codigo: this.codigo,
      asientos: this.asientos.map((a) => ({
        nombre: a.nombre,
        compu: a.id === null,
        desconectado: a.desconectado,
      })),
      anfitrion: this.anfitrion,
      yo: this.asientoDe(id),
      enJuego: this.enJuego,
      terminada: this.terminada,
      cartas: this.cartas,
      baraja: this.baraja,
      minJugadores: MIN_JUGADORES,
      maxJugadores: MAX_JUGADORES,
    };
  }

  /** Lo que ve de la partida quien está en el asiento de `id`; nunca lo de los demás. */
  vista(
    id: string,
    jugada: ConquianAction | null,
  ): Instantanea<ConquianView, ConquianAction> | null {
    const asiento = this.asientoDe(id);
    if (!this.state || asiento === -1) return null;
    return instantanea(this.juego, this.state, asiento, jugada);
  }
}
