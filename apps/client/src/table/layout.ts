import { sePuedeDesmochar, type ConquianView, type Juego } from '@cartas/conquian';
import type { Card } from '@cartas/core';
import { ARMADO_VACIO, type Armado, type Destino, type Pieza } from '../ui/arrastre';
import type { Seleccion } from '../ui/opciones';
import { VELOCIDAD_INTERCAMBIO } from '../anim/tiempos';
import { CARTA_H, CARTA_W, DORSO, claveTextura } from './texturas';

export type Toque =
  | { readonly tipo: 'mano'; readonly cardId: string }
  /** La carta que te ofrecen: se arrastra a tu mano o a un juego tuyo. */
  | { readonly tipo: 'mesa' }
  /** Carta de un poker propio: se selecciona o se arrastra para desmocharla. */
  | { readonly tipo: 'desmoche'; readonly juegoId: string; readonly cardId: string }
  /** Carta puesta en la zona de armado: se arrastra fuera para regresarla. */
  | { readonly tipo: 'armado'; readonly pieza: Pieza };

/** Una carta en pantalla. `key` es el id de la carta cuando se conoce, para animarla después. */
export interface SpriteCarta {
  readonly key: string;
  readonly textura: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly escala: number;
  readonly seleccionada: boolean;
  /** Las ayudas la marcan como parte de una jugada posible. */
  readonly pista: boolean;
  readonly alpha: number;
  readonly toque: Toque | null;
  /** Si la carta aparece de nuevo en pantalla, de dónde llega (para animarla). */
  readonly origen?: Origen;
  /** Velocidad de sus movimientos (1 normal); el intercambio va más despacio. */
  readonly velocidad?: number;
  /** Es la carta que este jugador eligió para pasar, esperando en su lugar. */
  readonly pasadaDe?: number;
}

/**
 * De dónde llega una carta nueva: el mazo, el centro, el asiento de un jugador o el lugar
 * donde un jugador dejó la carta que pasa a su derecha (`pasada`).
 */
export interface Origen {
  readonly desde: 'mazo' | 'centro' | { readonly jugador: number } | { readonly pasada: number };
  /** Llega boca abajo y se voltea en el camino (la carta que sale del mazo). */
  readonly voltear?: boolean;
  /** Turno en el reparto, para que las cartas salgan una tras otra. */
  readonly orden?: number;
}

export interface Punto {
  readonly x: number;
  readonly y: number;
}

/** Puntos de referencia de la mesa, para resolver los orígenes. */
export interface Anclas {
  readonly mazo: Punto;
  readonly centro: Punto;
  readonly jugadores: readonly Punto[];
  /** Donde cada jugador deja, durante el intercambio, la carta que va a pasar. */
  readonly pasadas: readonly LugarPasada[];
}

/** El lugar de una carta pasada: dónde, con qué inclinación y de qué tamaño. */
export interface LugarPasada extends Punto {
  readonly rotation: number;
  readonly escala: number;
}

export interface Etiqueta {
  readonly key: string;
  readonly texto: string;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly tamano: number;
}

/** Rectángulo de la pantalla donde se puede soltar una carta arrastrada. */
export interface Zona {
  /** Identifica la zona para resaltarla ('centro', 'muertas', 'armado', 'mano', 'juego:j1'). */
  readonly clave: string;
  readonly destino: Destino;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

/** Recuadro que se dibuja: la zona de armado, o un lugar resaltado. */
export interface Marco {
  readonly clave: string;
  /** `hueco`: el lugar donde va la carta que pasas en el intercambio. */
  readonly tipo: 'armado' | 'armado-inactivo' | 'destino' | 'pista' | 'hueco';
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface Escena {
  readonly cartas: readonly SpriteCarta[];
  readonly etiquetas: readonly Etiqueta[];
  /** En orden de prioridad: la primera que contenga el punto gana. */
  readonly zonas: readonly Zona[];
  readonly marcos: readonly Marco[];
  readonly anclas: Anclas;
}

export interface OpcionesLayout {
  readonly sel: Seleccion;
  readonly nombres: readonly string[];
  /** Cartas bajadas que hacen falta para ganar (para el contador "Mesa n/meta"). */
  readonly meta?: number;
  readonly armado?: Armado;
  /** Mostrar la zona de armado (modos con arrastre). Está siempre, para que nada salte de lugar. */
  readonly zonaArmado?: boolean;
  /** Si es tu turno y se puede usar; si no, se dibuja apagada. */
  readonly armadoActivo?: boolean;
  /** Cartas ('mesa' para la de la mesa) y juegos ('juego:id') que las ayudas marcan. */
  readonly pistas?: ReadonlySet<string>;
  /** Zonas (por clave) donde se puede soltar lo que se está arrastrando. */
  readonly destacadas?: ReadonlySet<string>;
}

const VACIO: ReadonlySet<string> = new Set();

/** A qué zona cae un punto, o `null`. */
export function zonaEn(escena: Escena, x: number, y: number): Destino | null {
  const zona = escena.zonas.find(
    (z) => x >= z.x && x <= z.x + z.ancho && y >= z.y && y <= z.y + z.alto,
  );
  return zona?.destino ?? null;
}

interface Asiento {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

const DORADO = 0xffd54a;
const BLANCO = 0xf2f2f2;
const GRIS = 0xbfd8c8;

/** Quién tiene que actuar ahora, según la vista. */
export function enTurno(view: ConquianView): number | null {
  if (view.fase.type === 'oferta') return view.fase.turno;
  if (view.fase.type === 'botar') return view.fase.jugador;
  return null;
}

/**
 * Calcula dónde va cada carta. Función pura: misma vista y tamaño, misma escena.
 * El jugador local siempre está abajo; los demás siguen el orden de turno hacia la derecha.
 */
export function layoutMesa(
  view: ConquianView,
  ancho: number,
  alto: number,
  opciones: OpcionesLayout,
): Escena {
  const {
    sel,
    nombres,
    meta = 10,
    armado = ARMADO_VACIO,
    zonaArmado = false,
    armadoActivo = false,
  } = opciones;
  const pistas = opciones.pistas ?? VACIO;
  const destacadas = opciones.destacadas ?? VACIO;
  const n = view.jugadores.length;
  const w = Math.max(38, Math.min(92, ancho / 11, alto / 8.4));
  const h = w * (CARTA_H / CARTA_W);
  const escala = w / CARTA_W;
  const escalaRival = escala * 0.62;
  const hRival = h * 0.62;

  const cartas: SpriteCarta[] = [];
  const etiquetas: Etiqueta[] = [];
  const zonas: Zona[] = [];
  const marcos: Marco[] = [];
  const turno = enTurno(view);

  // En pantallas angostas los botones de Menú y Opciones ocupan la parte de arriba.
  const margenSup = ancho < 600 ? 40 : 0;
  const asientos: Record<'abajo' | 'derecha' | 'arriba' | 'izquierda', Asiento> = {
    abajo: { x: ancho / 2, y: alto - h * 0.62, rotation: 0 },
    derecha: { x: ancho - hRival * 0.62, y: alto * 0.42, rotation: -Math.PI / 2 },
    arriba: { x: ancho / 2, y: margenSup + hRival * 0.62, rotation: Math.PI },
    izquierda: { x: hRival * 0.62, y: alto * 0.42, rotation: Math.PI / 2 },
  };
  const orden: Record<number, (keyof typeof asientos)[]> = {
    2: ['abajo', 'arriba'],
    3: ['abajo', 'derecha', 'izquierda'],
    4: ['abajo', 'derecha', 'arriba', 'izquierda'],
  };

  /** Pasa coordenadas locales del asiento (x a lo largo, y negativo = hacia el centro) a pantalla. */
  const punto = (a: Asiento, lx: number, ly: number) => ({
    x: a.x + lx * Math.cos(a.rotation) - ly * Math.sin(a.rotation),
    y: a.y + lx * Math.sin(a.rotation) + ly * Math.cos(a.rotation),
  });

  const cwDe = (esc: number) => CARTA_W * esc;
  const anchoJuego = (juego: Juego, esc: number) =>
    cwDe(esc) * (1 + 0.36 * (juego.cartas.length - 1));

  /** Un juego, siempre derecho para que se lea, con su borde izquierdo en x0. */
  // Dueño de los juegos que se están poniendo (lo fija el ciclo de jugadores): los juegos
  // nuevos de un rival llegan desde su asiento.
  let duenoActual = 0;
  const ponerJuego = (juego: Juego, x0: number, y: number, esc: number, propios: boolean) => {
    const cw = cwDe(esc);
    const poker = propios && sePuedeDesmochar(juego);
    if (propios) {
      const margen = cw * 0.25;
      const hj = CARTA_H * esc;
      const rect = {
        x: x0 - margen,
        y: y - hj / 2 - margen,
        ancho: anchoJuego(juego, esc) + margen * 2,
        alto: hj + margen * 2,
      };
      zonas.push({
        clave: `juego:${juego.id}`,
        destino: { tipo: 'juego', juegoId: juego.id },
        ...rect,
      });
      if (pistas.has(`juego:${juego.id}`))
        marcos.push({ clave: `pista:${juego.id}`, tipo: 'pista', ...rect });
    }
    // La carta que está en la zona de armado (desmoche) no se dibuja en su poker.
    const visibles = propios
      ? juego.cartas.filter((c) => c.id !== armado.desmoche?.cardId)
      : juego.cartas;
    visibles.forEach((carta, ci) => {
      const seleccionada = propios && sel.desmoche?.cardId === carta.id;
      cartas.push({
        key: carta.id,
        textura: claveTextura(carta.id),
        x: x0 + cw / 2 + ci * cw * 0.36,
        y: seleccionada ? y - CARTA_H * esc * 0.18 : y,
        rotation: 0,
        escala: esc,
        seleccionada,
        pista: pistas.has(carta.id),
        alpha: 1,
        toque: poker ? { tipo: 'desmoche', juegoId: juego.id, cardId: carta.id } : null,
        ...(propios ? {} : { origen: { desde: { jugador: duenoActual } } }),
      });
    });
  };

  /** Juegos en una fila centrada en cx (los tuyos y los del rival de arriba). */
  const filaJuegos = (
    juegos: readonly Juego[],
    cx: number,
    y: number,
    esc: number,
    propios: boolean,
  ) => {
    const hueco = cwDe(esc) * 0.55;
    const total =
      juegos.reduce((s, j) => s + anchoJuego(j, esc), 0) + hueco * Math.max(0, juegos.length - 1);
    let x = cx - total / 2;
    for (const juego of juegos) {
      ponerJuego(juego, x, y, esc, propios);
      x += anchoJuego(juego, esc) + hueco;
    }
  };

  /**
   * Tus juegos a los dos lados de la zona de armado: primero a la izquierda (pegados a la
   * zona) y, si ya no caben, a la derecha.
   */
  const juegosALosLados = (
    juegos: readonly Juego[],
    bordeIzq: number,
    bordeDer: number,
    y: number,
    esc: number,
  ) => {
    const hueco = cwDe(esc) * 0.45;
    const margen = w * 0.3;
    const izquierda: Juego[] = [];
    const derecha: Juego[] = [];
    let usado = 0;
    for (const juego of juegos) {
      const ancho = anchoJuego(juego, esc) + hueco;
      if (derecha.length === 0 && usado + ancho <= bordeIzq - margen) {
        izquierda.push(juego);
        usado += ancho;
      } else {
        derecha.push(juego);
      }
    }
    // Izquierda: de la zona hacia afuera, para que el primero quede junto a la zona.
    let x = bordeIzq - hueco;
    for (const juego of izquierda) {
      x -= anchoJuego(juego, esc);
      ponerJuego(juego, x, y, esc, true);
      x -= hueco;
    }
    x = bordeDer + hueco;
    for (const juego of derecha) {
      ponerJuego(juego, x, y, esc, true);
      x += anchoJuego(juego, esc) + hueco;
    }
  };

  /** Juegos de un rival de costado: uno por renglón, encimados para que se vea la esquina. */
  const columnaJuegos = (
    juegos: readonly Juego[],
    borde: number,
    lado: 'izq' | 'der',
    yCentro: number,
    esc: number,
  ) => {
    const paso = CARTA_H * esc * 0.5;
    const y0 = yCentro - (paso * (juegos.length - 1)) / 2;
    juegos.forEach((juego, i) => {
      const x0 = lado === 'izq' ? borde : borde - anchoJuego(juego, esc);
      ponerJuego(juego, x0, y0 + i * paso, esc, false);
    });
  };

  const tamanoNombre = Math.max(12, w * 0.2);
  // Zonas: arriba (rival de enfrente) y abajo (tú); el centro queda entre las dos.
  let limiteArriba = h * 0.15;
  const limiteAbajo = alto - h * 2.25;

  const asientosDe = orden[n] ?? [];
  const anclasJugadores: Punto[] = [];
  const rotaciones: number[] = [];
  // Mientras dura el intercambio, las cartas nuevas de la mano vienen del reparto;
  // después, la única que llega es la que pasó el de la izquierda, desde donde la dejó.
  const repartiendo = view.fase.type === 'intercambio';
  /** Quiénes ya eligieron la carta que pasan: se dibuja frente a ellos, boca abajo. */
  const yaPasaron = view.fase.type === 'intercambio' ? view.fase.listos : [];
  const miPasada = view.fase.type === 'intercambio' ? view.fase.miCarta : null;
  const izquierdaDe = (p: number) => (p - 1 + n) % n;
  /** Tu zona de armado, si se dibuja: tu lugar del intercambio va junto a ella. */
  // En un objeto porque se llena dentro del ciclo de jugadores (TypeScript no sigue esa asignación).
  const tuArmado: { rect: { x: number; y: number; ancho: number; alto: number } | null } = {
    rect: null,
  };
  view.jugadores.forEach((jugador, p) => {
    const rel = (p - view.yo + n) % n;
    const lugar = asientosDe[rel] ?? 'arriba';
    const a = asientos[lugar];
    duenoActual = p;
    anclasJugadores[p] = { x: a.x, y: a.y };
    rotaciones[p] = a.rotation;

    if (rel === 0) {
      // Las cartas que están en la zona de armado no se dibujan en la mano.
      // La que elegiste para pasar ya no está en la mano: espera frente a ti.
      const mano = view.mano.filter((c) => !armado.cartas.includes(c.id) && c.id !== miPasada);
      const paso = Math.min(w * 1.04, (ancho * 0.92 - w) / Math.max(1, mano.length - 1));
      const inicio = (-paso * (mano.length - 1)) / 2;
      mano.forEach((carta, i) => {
        const seleccionada = sel.cartas.includes(carta.id);
        cartas.push({
          key: carta.id,
          textura: claveTextura(carta.id),
          ...punto(a, inicio + i * paso, seleccionada ? -h * 0.22 : 0),
          rotation: 0,
          escala,
          seleccionada,
          pista: pistas.has(carta.id),
          alpha: 1,
          toque: { tipo: 'mano', cardId: carta.id },
          origen: repartiendo
            ? { desde: 'mazo', orden: i * n }
            : { desde: { pasada: izquierdaDe(view.yo) } },
        });
      });
      const escM = escala * 0.82;
      const yJuegos = alto - h * 1.82;
      if (!zonaArmado) {
        filaJuegos(jugador.juegos, ancho / 2, yJuegos, escM, true);
        return;
      }
      // Con zona de armado: la zona justo encima del centro de tu mano (el arrastre más
      // corto) y tus juegos a los lados, pegados a ella.
      const cw = cwDe(escM);
      const hM = CARTA_H * escM;
      const pad = cw * 0.18;
      const anchoZona = Math.max(cw * 2.44 + pad * 2, w * 2.6);
      const zona = {
        x: ancho / 2 - anchoZona / 2,
        y: yJuegos - hM / 2 - pad,
        ancho: anchoZona,
        alto: hM + pad * 2,
      };
      tuArmado.rect = zona;
      juegosALosLados(jugador.juegos, zona.x, zona.x + zona.ancho, yJuegos, escM);
      zonas.push({ clave: 'armado', destino: { tipo: 'armado' }, ...zona });
      marcos.push({ clave: 'armado', tipo: armadoActivo ? 'armado' : 'armado-inactivo', ...zona });
      const piezas: [Card, Pieza][] = [];
      if (armado.mesa && view.fase.type === 'oferta')
        piezas.push([view.fase.carta, { tipo: 'mesa' }]);
      const d = armado.desmoche;
      const desmochada =
        d && jugador.juegos.find((j) => j.id === d.juegoId)?.cartas.find((c) => c.id === d.cardId);
      if (d && desmochada) piezas.push([desmochada, { tipo: 'desmoche', ...d }]);
      for (const id of armado.cartas) {
        const carta = view.mano.find((c) => c.id === id);
        if (carta) piezas.push([carta, { tipo: 'mano', cardId: id }]);
      }
      if (piezas.length === 0) {
        etiquetas.push({
          key: 'armado-vacio',
          texto: armadoActivo ? 'Arrastra aquí\npara armar un juego' : 'Zona de armado',
          x: zona.x + zona.ancho / 2,
          y: yJuegos,
          color: GRIS,
          tamano: Math.max(11, w * 0.16),
        });
      }
      const pasoArmado = Math.min(
        cw * 0.5,
        (anchoZona - pad * 2 - cw) / Math.max(1, piezas.length - 1),
      );
      piezas.forEach(([carta, pieza], i) => {
        cartas.push({
          key: carta.id,
          textura: claveTextura(carta.id),
          x: zona.x + pad + cw / 2 + i * pasoArmado,
          y: yJuegos,
          rotation: 0,
          escala: escM,
          seleccionada: false,
          pista: false,
          alpha: 1,
          toque: { tipo: 'armado', pieza },
        });
      });
      return;
    }

    // Si ya eligió la que pasa, esa espera frente a él y su mano tiene una menos.
    const enMano = jugador.cartasEnMano - (yaPasaron[p] ? 1 : 0);
    const paso = CARTA_W * escalaRival * 0.28;
    const inicio = (-paso * (enMano - 1)) / 2;
    for (let i = 0; i < enMano; i++) {
      // Después del intercambio, la última de su mano es la que le pasaron: con su propia
      // clave, para que se vea llegar (aunque su mano siga teniendo las mismas cartas).
      const recibida = !repartiendo && i === enMano - 1;
      cartas.push({
        key: recibida ? `recibida-${p}` : `oculta-${p}-${i}`,
        textura: DORSO,
        ...punto(a, inicio + i * paso, 0),
        rotation: a.rotation,
        escala: escalaRival,
        seleccionada: false,
        pista: false,
        alpha: 1,
        toque: null,
        origen: repartiendo
          ? { desde: 'mazo', orden: i * n + rel }
          : recibida
            ? { desde: { pasada: izquierdaDe(p) } }
            : { desde: { jugador: p } },
      });
    }

    // Nombre y, debajo, cuántas tiene en la mano y cuántas lleva bajadas.
    const bajadas = jugador.juegos.reduce((n, j) => n + j.cartas.length, 0);
    const color = turno === p ? DORADO : BLANCO;
    const tamanoDatos = tamanoNombre * 0.8;
    const ponerNombre = (x: number, y: number) => {
      etiquetas.push({
        key: `nombre-${p}`,
        texto: nombres[p] ?? `Jugador ${p}`,
        x,
        y,
        color,
        tamano: tamanoNombre,
      });
      etiquetas.push({
        key: `datos-${p}`,
        texto: `Mano ${jugador.cartasEnMano} · Mesa ${bajadas}/${meta}`,
        x,
        y: y + tamanoNombre * 1.1,
        color: turno === p ? DORADO : GRIS,
        tamano: tamanoDatos,
      });
    };
    const altoNombre = tamanoNombre * 2.2;

    if (lugar === 'arriba') {
      ponerNombre(a.x, margenSup + hRival * 1.3);
      const yJuegos = margenSup + hRival * 1.3 + altoNombre + hRival / 2;
      filaJuegos(jugador.juegos, ancho / 2, yJuegos, escalaRival, false);
      limiteArriba =
        jugador.juegos.length > 0 ? yJuegos + hRival / 2 : margenSup + hRival * 1.3 + altoNombre;
    } else {
      // De costado: nombre y datos arriba de su mano; sus juegos en columna hacia el centro.
      const largoMano = paso * Math.max(0, jugador.cartasEnMano - 1) + cwDe(escalaRival);
      const margen = tamanoNombre * 4.6;
      // Arriba de lo más alto: su mano o la columna de sus juegos (que crece con los juegos).
      const pasoColumna = CARTA_H * escalaRival * 0.5;
      const topeColumna =
        jugador.juegos.length > 0
          ? a.y - (pasoColumna * (jugador.juegos.length - 1)) / 2 - hRival / 2
          : Infinity;
      ponerNombre(
        Math.min(Math.max(a.x, margen), ancho - margen),
        Math.min(a.y - largoMano / 2, topeColumna) - altoNombre,
      );
      const borde = lugar === 'izquierda' ? hRival * 1.3 : ancho - hRival * 1.3;
      columnaJuegos(jugador.juegos, borde, lugar === 'izquierda' ? 'izq' : 'der', a.y, escalaRival);
    }
  });

  // Centro: mazo, carta ofrecida y muertas, entre la zona de arriba y la tuya.
  const cx = ancho / 2;
  const cy = Math.max(
    (limiteArriba + h * 0.8 + limiteAbajo - h * 0.75) / 2,
    limiteArriba + h * 0.8,
  );
  if (view.mazo > 0) {
    cartas.push({
      key: 'mazo',
      textura: DORSO,
      x: cx - w * 1.5,
      y: cy,
      rotation: 0,
      escala,
      seleccionada: false,
      pista: false,
      alpha: 1,
      toque: null,
    });
  }
  etiquetas.push({
    key: 'mazo-n',
    texto: `Mazo ${view.mazo}`,
    x: cx - w * 1.5,
    y: cy + h * 0.66,
    color: BLANCO,
    tamano: Math.max(12, w * 0.19),
  });

  const muerta = view.muertas.at(-1);
  if (muerta) {
    cartas.push({
      key: muerta.id,
      textura: claveTextura(muerta.id),
      x: cx + w * 1.5,
      y: cy,
      rotation: 0,
      escala,
      seleccionada: false,
      pista: false,
      alpha: 0.55,
      toque: null,
      origen: { desde: 'centro' },
    });
  }
  etiquetas.push({
    key: 'muertas-n',
    texto: `Muertas ${view.muertas.length}`,
    x: cx + w * 1.5,
    y: cy + h * 0.66,
    color: BLANCO,
    tamano: Math.max(12, w * 0.19),
  });

  if (view.fase.type === 'oferta') {
    const paraMi = view.fase.turno === view.yo;
    // Si está en la zona de armado, ya se dibujó ahí.
    if (!armado.mesa) {
      cartas.push({
        key: view.fase.carta.id,
        textura: claveTextura(view.fase.carta.id),
        x: cx,
        y: cy,
        rotation: 0,
        escala: escala * 1.08,
        seleccionada: false,
        pista: paraMi && pistas.has('mesa'),
        alpha: 1,
        toque: paraMi ? { tipo: 'mesa' } : null,
        // Del mazo llega volteándose; si la botaron, desde quien la botó (el anterior en turno).
        origen:
          view.fase.origen === 'mazo'
            ? { desde: 'mazo', voltear: true }
            : { desde: { jugador: (view.fase.turno - 1 + n) % n } },
      });
    }
    etiquetas.push({
      key: 'oferta-para',
      texto: paraMi ? '¿Te sirve?' : `Para ${nombres[view.fase.turno] ?? ''}`,
      x: cx,
      y: cy - h * 0.72,
      color: paraMi ? DORADO : BLANCO,
      tamano: Math.max(13, w * 0.22),
    });
  }

  // Zonas para soltar: los juegos propios y la zona de armado ya se agregaron;
  // luego las muertas, el centro y tu mano.
  zonas.push({
    clave: 'muertas',
    destino: { tipo: 'muertas' },
    x: cx + w * 0.75,
    y: cy - h * 0.8,
    ancho: w * 1.65,
    alto: h * 1.6,
  });
  zonas.push({
    clave: 'centro',
    destino: { tipo: 'centro' },
    x: cx - w * 2.4,
    y: cy - h * 0.8,
    ancho: w * 3.15,
    alto: h * 1.6,
  });
  zonas.push({
    clave: 'mano',
    destino: { tipo: 'mano' },
    x: 0,
    y: alto - h * 1.3,
    ancho,
    alto: h * 1.3,
  });

  // Mientras se arrastra, se marcan los lugares donde sí se puede soltar.
  for (const z of zonas) {
    if (destacadas.has(z.clave)) {
      marcos.push({
        clave: `destino:${z.clave}`,
        tipo: 'destino',
        x: z.x,
        y: z.y,
        ancho: z.ancho,
        alto: z.alto,
      });
    }
  }

  // Intercambio: el lugar de cada carta pasada, entre su dueño y el centro, cargado hacia
  // el de la derecha (a quien se la pasa) e inclinada hacia él.
  const pasadas = lugaresDePasada({
    asientos: anclasJugadores,
    rotaciones,
    centro: { x: cx, y: cy },
    ancho,
    alto,
    margenSup,
    w,
    escala: escala * 0.8,
    yo: view.yo,
    armado: tuArmado.rect,
    // Lo que hay en el centro (mazo, carta ofrecida, muertas y sus letreros): no se tapa.
    pila: { x0: cx - w * 2.1, x1: cx + w * 2.1, y0: cy - h * 0.85, y1: cy + h * 0.8 },
  });
  const ponerPasada = (p: number, key: string) => {
    const lugar = pasadas[p];
    if (!lugar) return;
    cartas.push({
      key,
      textura: DORSO,
      ...lugar,
      pasadaDe: p,
      seleccionada: false,
      pista: false,
      alpha: 1,
      toque: null,
      origen: { desde: { jugador: p } },
      velocidad: VELOCIDAD_INTERCAMBIO,
    });
  };
  // La tuya conserva su id: sale de tu mano hasta su lugar. Las de los rivales salen de su asiento.
  if (miPasada) ponerPasada(view.yo, miPasada);
  const miLugar = pasadas[view.yo];
  if (view.fase.type === 'intercambio' && miLugar) {
    const der = (view.yo + 1) % n;
    const anchoH = w * 0.8 * 1.25;
    const altoH = h * 0.8 * 1.25;
    if (!miPasada) {
      // Mientras no eliges: el hueco marcado, que también es donde se suelta (primero en la
      // lista, para que gane si toca la zona de armado).
      const rect = {
        x: miLugar.x - anchoH / 2,
        y: miLugar.y - altoH / 2,
        ancho: anchoH,
        alto: altoH,
      };
      marcos.push({ clave: 'hueco-pasada', tipo: 'hueco', ...rect });
      const margen = w * 0.3;
      zonas.unshift({
        clave: 'pasada',
        destino: { tipo: 'pasada' },
        x: rect.x - margen,
        y: rect.y - margen,
        ancho: rect.ancho + margen * 2,
        alto: rect.alto + margen * 2,
      });
    }
    // Debajo de la carta; si ahí está la zona de armado (pantallas angostas), arriba.
    const tamanoPara = Math.max(11, w * 0.16);
    const separa = Math.max(10, w * 0.14);
    const abajo = miLugar.y + altoH / 2 + separa;
    const zonaAbajo = tuArmado.rect;
    const chocaAbajo =
      zonaAbajo !== null &&
      abajo + tamanoPara / 2 > zonaAbajo.y &&
      abajo - tamanoPara / 2 < zonaAbajo.y + zonaAbajo.alto &&
      miLugar.x + w > zonaAbajo.x &&
      miLugar.x - w < zonaAbajo.x + zonaAbajo.ancho;
    etiquetas.push({
      key: 'pasada-para',
      texto: `Para ${nombres[der] ?? ''}`,
      x: miLugar.x,
      y: chocaAbajo ? miLugar.y - altoH / 2 - separa : abajo,
      color: GRIS,
      tamano: tamanoPara,
    });
  }
  yaPasaron.forEach((listo, p) => {
    if (listo && p !== view.yo) ponerPasada(p, `pasada-${p}`);
  });

  const anclas: Anclas = {
    mazo: { x: cx - w * 1.5, y: cy },
    centro: { x: cx, y: cy },
    jugadores: anclasJugadores,
    pasadas,
  };
  return { cartas, etiquetas, zonas, marcos, anclas };
}

interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** Qué tan lejos del centro, hacia su dueño, queda cada carta del intercambio (0 a 1). */
const PASADA_AL_DUENO = 0.55;
/** Qué tanto se corre hacia el jugador de la derecha (fracción del espacio de ese lado). */
const PASADA_A_LA_DERECHA = 0.3;
/** Inclinación hacia el de la derecha (radianes), igual para todos. */
const PASADA_INCLINACION = 0.25;

/**
 * Dónde espera la carta que cada jugador pasa: todas con la misma regla, como un molinete
 * alrededor del centro. Cada una queda frente a su dueño, a la misma proporción entre el
 * centro y su asiento, corrida hacia la derecha del dueño (el que la recibe) e inclinada
 * igual. Ninguna tapa el centro, y la tuya no se encima con tu zona de armado (ahí también
 * se suelta al arrastrar).
 */
function lugaresDePasada(o: {
  readonly asientos: readonly Punto[];
  readonly rotaciones: readonly number[];
  readonly centro: Punto;
  readonly ancho: number;
  readonly alto: number;
  readonly margenSup: number;
  readonly w: number;
  readonly escala: number;
  readonly yo: number;
  readonly armado: { x: number; y: number; ancho: number; alto: number } | null;
  readonly pila: Rect;
}): LugarPasada[] {
  const { centro, w } = o;
  const separacion = w * 0.2;
  return o.asientos.map((asiento, p) => {
    // Hacia el dueño (desde el centro) y, girando 90°, hacia su derecha: abajo→derecha,
    // derecha→arriba, arriba→izquierda, izquierda→abajo.
    const fx = asiento.x - centro.x;
    const fy = asiento.y - centro.y;
    const largo = Math.hypot(fx, fy) || 1;
    const lx = fy / largo;
    const ly = -fx / largo;
    // El espacio que hay hacia ese lado, hasta el borde de la mesa.
    const espacio =
      Math.abs(lx) > Math.abs(ly)
        ? o.ancho / 2
        : ly < 0
          ? centro.y - o.margenSup
          : o.alto - centro.y;
    let x = centro.x + fx * PASADA_AL_DUENO + lx * espacio * PASADA_A_LA_DERECHA;
    let y = centro.y + fy * PASADA_AL_DUENO + ly * espacio * PASADA_A_LA_DERECHA;

    // Medio tamaño de la carta, ya girada como la mano de su dueño.
    const rotation = (o.rotaciones[p] ?? 0) + PASADA_INCLINACION;
    const deLado = Math.abs(Math.sin(rotation)) > 0.7;
    // (un 10 % más por la inclinación).
    const mw = ((deLado ? CARTA_H : CARTA_W) * o.escala * 1.1) / 2;
    const mh = ((deLado ? CARTA_W : CARTA_H) * o.escala * 1.1) / 2;
    const choca = (r: Rect) => x + mw > r.x0 && x - mw < r.x1 && y + mh > r.y0 && y - mh < r.y1;
    // Si toca el centro, se aparta hacia su lado (el de quien la recibe).
    const apartar = (r: Rect) => {
      if (!choca(r)) return;
      if (Math.abs(lx) > Math.abs(ly)) x = lx > 0 ? r.x1 + mw + separacion : r.x0 - mw - separacion;
      else y = ly > 0 ? r.y1 + mh + separacion : r.y0 - mh - separacion;
    };
    apartar(o.pila);
    if (p === o.yo && o.armado) {
      const a = o.armado;
      apartar({ x0: a.x, x1: a.x + a.ancho, y0: a.y, y1: a.y + a.alto });
    }
    return { x, y, rotation, escala: o.escala };
  });
}
