import { Application, extend, useApplication } from '@pixi/react';
import { Container, Graphics, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colocarCarta, moverCarta, olvidarCarta } from '../anim/cartas';
import { animarEscena, sacarDelMazoEn } from '../anim/escena';
import { celebrar } from '../anim/victoria';
import { estiloDe, usePartida, type ModoControl } from '../store';
import { alSoltar, alTocarMesa, reordenar, type Arrastrado } from '../ui/arrastre';
import { resumenFinal } from '../ui/final';
import { sugerencias } from '../ui/opciones';
import { ordenarMano } from '../ui/orden';
import { enTurno, obligado, type Vista } from '../vista';
import {
  layoutMesa,
  zonaEn,
  type Escena as EscenaMesa,
  type Marco,
  type SpriteCarta,
  type Toque,
} from './layout';
import { crearTexturas, texturaDe } from './texturas';

extend({ Container, Graphics, Sprite, Text });

const COLOR_SELECCION = 0xfff0a0;
const COLOR_PISTA = 0xd4ffcc;
/** La carta de la mesa mientras la decide otro jugador. */
const COLOR_APAGADA = 0x8a8a8a;
/** Las muertas, debajo de la carta en juego: más oscuras para que no se confundan. */
const COLOR_MUERTA = 0x6a6a6a;
/** Distancia (px) que hay que mover el dedo para que cuente como arrastre y no como toque. */
const UMBRAL_ARRASTRE = 8;
const NADA: ReadonlySet<string> = new Set();

interface ArrastreActivo {
  readonly sprite: Sprite;
  readonly carta: SpriteCarta;
  readonly toque: Toque;
  /** Orden de dibujo normal, para devolverlo al soltar. */
  readonly zIndex: number;
  readonly inicioX: number;
  readonly inicioY: number;
  movio: boolean;
}

const puedeTocar = (modo: ModoControl) => modo !== 'arrastrar';
const puedeArrastrar = (modo: ModoControl) => modo !== 'botones';

const esMiTurno = ({ view }: Vista) => enTurno(view) === view.yo;

function arrastradoDe(toque: Toque): Arrastrado {
  switch (toque.tipo) {
    case 'mano':
      return { tipo: 'mano', cardId: toque.cardId };
    case 'mesa':
      return { tipo: 'mesa' };
    case 'desmoche':
      return { tipo: 'desmoche', juegoId: toque.juegoId, cardId: toque.cardId };
    case 'armado':
      return { tipo: 'armado', pieza: toque.pieza };
    case 'mazo':
      return { tipo: 'mazo' };
  }
}

/** Toque simple (sin arrastrar), según el modo. */
function tocar(toque: Toque) {
  const { modo, toggleCarta, toggleDesmoche, avisar, desarmar } = usePartida.getState();
  // Tocar una carta de la zona de armado la regresa, en cualquier modo.
  if (toque.tipo === 'armado') return desarmar(toque.pieza);
  // Tocar el mazo cuando te toca voltea la de arriba, en cualquier modo.
  if (toque.tipo === 'mazo') {
    const { vista, jugar } = usePartida.getState();
    const voltear = vista?.acciones.find((a) => a.type === 'voltear');
    if (voltear) jugar(voltear);
    return;
  }
  // Tocar la carta en juego es "no me sirve": pasa al siguiente, en cualquier modo.
  if (toque.tipo === 'mesa') {
    const { vista, jugar } = usePartida.getState();
    const r = vista ? alTocarMesa(vista) : null;
    if (r?.tipo === 'jugar') jugar(r.accion);
    else if (r?.tipo === 'nada' && r.motivo) avisar(r.motivo);
    return;
  }
  if (!puedeTocar(modo)) {
    if (toque.tipo !== 'mano') avisar('Arrastra la carta a donde la quieras poner.');
    return;
  }
  if (toque.tipo === 'mano') toggleCarta(toque.cardId);
  else toggleDesmoche({ juegoId: toque.juegoId, cardId: toque.cardId });
}

/** Se soltó una carta arrastrada en (x, y): juega, arma, reordena o explica por qué no. */
function soltar(escena: EscenaMesa, toque: Toque, x: number, y: number) {
  const { vista, seleccion, jugar, avisar, reordenarMano, armar, desarmar } = usePartida.getState();
  if (!vista) return;
  const r = alSoltar(vista, arrastradoDe(toque), zonaEn(escena, x, y), seleccion);
  switch (r.tipo) {
    case 'jugar':
      return jugar(r.accion);
    case 'armar':
      return armar(r.pieza);
    case 'desarmar':
      return desarmar(r.pieza);
    case 'reordenar': {
      if (toque.tipo !== 'mano') return;
      const enMano = escena.cartas.filter((c) => c.toque?.tipo === 'mano');
      const indice = enMano.filter((c) => c.key !== toque.cardId && c.x < x).length;
      return reordenarMano(
        reordenar(
          enMano.map((c) => c.key),
          toque.cardId,
          indice,
        ),
      );
    }
    case 'nada':
      return avisar(r.motivo);
  }
}

/** Zonas donde sí se puede soltar lo que se está arrastrando (para resaltarlas). */
function zonasValidas(escena: EscenaMesa, toque: Toque): Set<string> {
  const { vista, seleccion } = usePartida.getState();
  const validas = new Set<string>();
  // La carta del mazo se voltea donde la sueltes: no hay un lugar que marcar.
  if (!vista || toque.tipo === 'mazo') return validas;
  for (const zona of escena.zonas) {
    if (zona.clave === 'mano') continue;
    const r = alSoltar(vista, arrastradoDe(toque), zona.destino, seleccion);
    if (r.tipo === 'jugar' || r.tipo === 'armar') validas.add(zona.clave);
  }
  return validas;
}

/**
 * Cartas y juego de la mejor jugada sugerida (ayudas en modo arrastrar). Solo una:
 * si se marcaran varias a la vez, juntarlas todas no formaría ningún juego.
 */
function pistasDe(vista: Vista): Set<string> {
  const pistas = new Set<string>();
  for (const { accion } of sugerencias(vista, 1)) {
    if (!('cardIds' in accion)) continue;
    for (const id of accion.cardIds) pistas.add(id);
    if (accion.desmoche) pistas.add(accion.desmoche.cardId);
    if (accion.type === 'tomar') pistas.add('mesa');
    if ('juegoId' in accion && accion.juegoId) pistas.add(`juego:${accion.juegoId}`);
  }
  return pistas;
}

function dibujarMarco(g: Graphics, m: Marco) {
  const radio = 10;
  if (m.tipo === 'armado-inactivo') {
    g.roundRect(m.x, m.y, m.ancho, m.alto, radio)
      .fill({ color: 0x000000, alpha: 0.08 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.15 });
  } else if (m.tipo === 'armado') {
    g.roundRect(m.x, m.y, m.ancho, m.alto, radio)
      .fill({ color: 0xffffff, alpha: 0.06 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  } else if (m.tipo === 'hueco') {
    g.roundRect(m.x, m.y, m.ancho, m.alto, radio)
      .fill({ color: 0xffffff, alpha: 0.05 })
      .stroke({ width: 2, color: 0xffd54a, alpha: 0.55 });
  } else if (m.tipo === 'destino') {
    g.roundRect(m.x, m.y, m.ancho, m.alto, radio)
      .fill({ color: 0xffd54a, alpha: 0.12 })
      .stroke({ width: 3, color: 0xffd54a, alpha: 0.9 });
  } else {
    g.roundRect(m.x, m.y, m.ancho, m.alto, radio).stroke({
      width: 2,
      color: 0x9cff8f,
      alpha: 0.8,
    });
  }
}

function Escena({ ancho, alto }: { ancho: number; alto: number }) {
  const { app, isInitialised } = useApplication();
  // `resizeTo` solo escucha la ventana; si cambia el contenedor (por ejemplo, crecen los
  // controles de abajo), el canvas también tiene que ajustarse.
  useEffect(() => {
    if (isInitialised) app.resize();
  }, [app, isInitialised, ancho, alto]);
  useEffect(() => {
    // Para la extensión PixiJS DevTools y las pruebas en navegador.
    if (import.meta.env.DEV && isInitialised) {
      (globalThis as { __PIXI_APP__?: unknown }).__PIXI_APP__ = app;
    }
  }, [app, isInitialised]);
  // Se generan una vez, cuando el renderer está listo, y viven lo que dure la aplicación.
  const texturas = useMemo(
    () => (isInitialised ? crearTexturas(app.renderer) : null),
    [app, isInitialised],
  );

  const vista = usePartida((s) => s.vista);
  const nombres = usePartida((s) => s.nombres);
  const seleccion = usePartida((s) => s.seleccion);
  const ordenMano = usePartida((s) => s.ordenMano);
  const ordenManual = usePartida((s) => s.ordenManual);
  const modo = usePartida((s) => s.modo);
  const ayudas = usePartida((s) => s.ayudas);
  const armado = usePartida((s) => s.armado);
  // El dibujo es el de la partida: una de 48 nunca se ve americana, ni al revés.
  const baraja = usePartida(estiloDe);
  const [destacadas, setDestacadas] = useState<ReadonlySet<string>>(NADA);

  const escena = useMemo(() => {
    if (!vista) return null;
    const { view } = vista;
    const mano = ordenarMano(view.mano, ordenMano, view.config.baraja.valores, ordenManual);
    const miTurno = esMiTurno(vista);
    return layoutMesa({ ...view, mano }, ancho, alto, {
      sel: seleccion,
      nombres,
      meta: view.config.cartasPorJugador + 1,
      armado,
      zonaArmado: puedeArrastrar(modo),
      armadoActivo: miTurno,
      pistas: ayudas && modo === 'arrastrar' && miTurno ? pistasDe(vista) : NADA,
      destacadas,
      obligado: obligado(vista),
    });
  }, [
    vista,
    ancho,
    alto,
    seleccion,
    nombres,
    ordenMano,
    ordenManual,
    modo,
    ayudas,
    armado,
    destacadas,
  ]);

  // Animación: cada sprite se registra por su clave; al cambiar la escena, las cartas
  // viajan de donde están a su nuevo lugar (las posiciones no son props de React).
  const sprites = useRef(new Map<string, Sprite>());
  const conocidas = useRef(new Set<string>());
  const registros = useRef(new Map<string, (s: Sprite | null) => void>());
  const registrar = (key: string) => {
    let fn = registros.current.get(key);
    if (!fn) {
      fn = (sprite) => {
        if (sprite) {
          sprites.current.set(key, sprite);
          return;
        }
        // La carta sale de la pantalla: se detiene su animación antes de que se destruya.
        const anterior = sprites.current.get(key);
        if (anterior) olvidarCarta(anterior);
        sprites.current.delete(key);
        registros.current.delete(key);
      };
      registros.current.set(key, fn);
    }
    return fn;
  };

  // Arrastre: se sigue el puntero en todo el escenario y se decide al soltar.
  // La carta se mueve directo en Pixi (sin re-render de React) para que vaya fluida.
  const arrastre = useRef<ArrastreActivo | null>(null);
  const escenaRef = useRef(escena);
  useEffect(() => {
    escenaRef.current = escena;
  }, [escena]);

  useLayoutEffect(() => {
    if (!escena || !texturas) return;
    const a = arrastre.current;
    animarEscena({
      escena,
      sprites: sprites.current,
      conocidas: conocidas.current,
      textura: (clave) => texturas.get(texturaDe(baraja, clave)),
      ignorar: a?.movio ? a.sprite : null,
    });
  }, [escena, texturas, baraja]);

  // Al terminar la partida: letrero y, si ganaste, rayos y confeti. El panel lo pone React.
  const verMesa = usePartida((s) => s.verMesa);
  const resumen = useMemo(
    () => (vista && !verMesa ? resumenFinal(vista.view, nombres) : null),
    [vista, nombres, verMesa],
  );
  const titulo = resumen?.titulo ?? null;
  const tipoFinal = resumen?.tipo ?? null;
  useEffect(() => {
    if (!titulo || !tipoFinal || !isInitialised) return;
    return celebrar(app, ancho, alto, titulo, tipoFinal);
  }, [titulo, tipoFinal, app, isInitialised, ancho, alto]);

  useEffect(() => {
    if (!isInitialised) return;
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    const mover = (e: FederatedPointerEvent) => {
      const a = arrastre.current;
      if (!a || !puedeArrastrar(usePartida.getState().modo)) return;
      const dx = e.global.x - a.inicioX;
      const dy = e.global.y - a.inicioY;
      if (!a.movio) {
        if (Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
        a.movio = true;
        olvidarCarta(a.sprite);
        a.sprite.zIndex = 100_000;
        a.sprite.scale.set(a.carta.escala * 1.1);
        a.sprite.rotation = 0;
        const actual = escenaRef.current;
        if (actual) setDestacadas(zonasValidas(actual, a.toque));
      }
      a.sprite.position.set(a.carta.x + dx, a.carta.y + dy);
    };
    const terminar = (e: FederatedPointerEvent) => {
      const a = arrastre.current;
      if (!a) return;
      arrastre.current = null;
      setDestacadas(NADA);
      const actual = escenaRef.current;
      // La sacaste del mazo: el mazo queda en su lugar y la carta se voltea desde donde la soltaste.
      if (a.movio && a.toque.tipo === 'mazo') {
        colocarCarta(a.sprite, {
          x: a.carta.x,
          y: a.carta.y,
          rotation: a.carta.rotation,
          escala: a.carta.escala,
        });
        a.sprite.zIndex = a.zIndex;
        sacarDelMazoEn({ x: e.global.x, y: e.global.y });
        tocar(a.toque);
        return;
      }
      // Vuelve deslizándose a su lugar; si la jugada vale, el nuevo estado la lleva a donde va.
      if (a.movio) {
        const lugar = actual?.cartas.find((c) => c.key === a.carta.key) ?? a.carta;
        moverCarta(
          a.sprite,
          { x: lugar.x, y: lugar.y, rotation: lugar.rotation, escala: lugar.escala },
          { zIndexFinal: a.zIndex },
        );
      }
      if (!a.movio) tocar(a.toque);
      else if (actual) soltar(actual, a.toque, e.global.x, e.global.y);
    };
    stage.on('pointermove', mover);
    stage.on('pointerup', terminar);
    stage.on('pointerupoutside', terminar);
    return () => {
      stage.off('pointermove', mover);
      stage.off('pointerup', terminar);
      stage.off('pointerupoutside', terminar);
    };
  }, [app, isInitialised]);

  const dibujarMarcos = useCallback(
    (g: Graphics) => {
      g.clear();
      for (const m of escena?.marcos ?? []) dibujarMarco(g, m);
    },
    [escena],
  );

  if (!escena || !texturas) return null;

  const empezar =
    (carta: SpriteCarta, toque: Toque, zIndex: number) => (e: FederatedPointerEvent) => {
      arrastre.current = {
        sprite: e.currentTarget as Sprite,
        carta,
        toque,
        zIndex,
        inicioX: e.global.x,
        inicioY: e.global.y,
        movio: false,
      };
    };
  const cursor = (toque: Toque) => {
    if (!puedeArrastrar(modo)) return 'pointer';
    return toque.tipo === 'mano' && puedeTocar(modo) ? 'pointer' : 'grab';
  };

  return (
    <pixiContainer sortableChildren>
      <pixiGraphics draw={dibujarMarcos} />
      {escena.cartas.map((c, i) => (
        <pixiSprite
          key={c.key}
          ref={registrar(c.key)}
          // El orden de dibujo es explícito: Pixi reutiliza el sprite de una carta que cambia
          // de lugar (de la mesa a un juego) y sin esto podría quedar tapada por las demás.
          zIndex={i + 1}
          texture={texturas.get(texturaDe(baraja, c.textura)) ?? Texture.EMPTY}
          anchor={0.5}
          alpha={c.alpha}
          tint={
            c.seleccionada
              ? COLOR_SELECCION
              : c.pista
                ? COLOR_PISTA
                : c.apagada
                  ? COLOR_APAGADA
                  : c.muerta
                    ? COLOR_MUERTA
                    : 0xffffff
          }
          eventMode={c.toque ? 'static' : 'none'}
          cursor={c.toque ? cursor(c.toque) : 'default'}
          {...(c.toque ? { onPointerDown: empezar(c, c.toque, i + 1) } : {})}
        />
      ))}
      {escena.etiquetas.map((e) => (
        <pixiText
          key={e.key}
          text={e.texto}
          anchor={0.5}
          x={e.x}
          y={e.y}
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: e.tamano,
            fontWeight: '600',
            fill: e.color,
            align: 'center',
          }}
        />
      ))}
    </pixiContainer>
  );
}

/** La mesa ocupa todo su contenedor y se redibuja al cambiar de tamaño. */
export function Mesa() {
  const ref = useRef<HTMLDivElement>(null);
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  // @pixi/react termina init() renderizando los hijos de la primera llamada, que pueden
  // estar viejos; montamos la escena solo después de onInit para que use props frescas.
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setTamano({ ancho: entry.contentRect.width, alto: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="mesa">
      <Application
        resizeTo={ref}
        background={0x0e5c3a}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio, 2)}
        onInit={() => setListo(true)}
      >
        {listo && tamano.ancho > 0 && <Escena ancho={tamano.ancho} alto={tamano.alto} />}
      </Application>
    </div>
  );
}
