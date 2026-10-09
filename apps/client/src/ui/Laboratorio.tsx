import type { ConquianAction, ConquianState } from '@cartas/conquian';
import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forzarMovimientoReducido } from '../anim/cartas';
import { prepararEscena, type Preparacion } from '../anim/escena';
import { sinSonido } from '../audio/sonidos';
import { cancelarIA, conquianPara, enLocal, pausaIA, usePartida } from '../store';
import { ARMADO_VACIO } from './arrastre';
import { ESCENARIOS, siguienteJugada, type Preparado } from './escenarios';
import { SIN_SELECCION } from './opciones';
import { Partida } from './Partida';

const VELOCIDADES = [0.25, 0.5, 1, 2] as const;
/** Antes de repartir otra vez en autojugar. */
const PAUSA_MS = 900;
/** Antes de la primera jugada, para ver cómo quedó la mesa. */
const PAUSA_INICIAL_MS = 700;
/** En autojugar, cuánto se ve el final antes de repartir otra vez. */
const PAUSA_FINAL_MS = 3500;
const HUMANO = 0;

const nombresPara = (n: number) =>
  Array.from({ length: n }, (_, i) => (i === 0 ? 'Tú' : `Compu ${i}`));
const nuevaSemilla = () => Math.random().toString(36).slice(2, 8);
const angosto = () => window.innerWidth < 760;

/** Pone un estado en la mesa sin sonido; `modo` dice si aparece de golpe o repartiéndose. */
function poner(state: ConquianState, modo: Preparacion) {
  prepararEscena(modo);
  sinSonido(() =>
    usePartida.setState({
      ...enLocal(state),
      nombres: nombresPara(state.jugadores.length),
      seleccion: SIN_SELECCION,
      armado: ARMADO_VACIO,
      aviso: null,
      verMesa: false,
    }),
  );
}

/** Aplica una jugada como si viniera de la partida (con su sonido). */
function aplicar(nuevo: ConquianState, accion: ConquianAction) {
  usePartida.setState({
    ...enLocal(nuevo, accion),
    seleccion: SIN_SELECCION,
    armado: ARMADO_VACIO,
    aviso: null,
  });
}

/** Cuadros por segundo reales del navegador. */
function Fps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let cuadros = 0;
    let desde = performance.now();
    let id = requestAnimationFrame(function cuadro(t) {
      cuadros++;
      if (t - desde >= 500) {
        setFps(Math.round((cuadros * 1000) / (t - desde)));
        cuadros = 0;
        desde = t;
      }
      id = requestAnimationFrame(cuadro);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return <span className={fps > 0 && fps < 50 ? 'fps lento' : 'fps'}>{fps} fps</span>;
}

/**
 * Laboratorio de animaciones (solo en desarrollo): pone la mesa en distintos momentos de
 * una partida y reproduce las jugadas una por una, sin tener que jugar.
 * Los escenarios salen de partidas reales jugadas por la IA, así que lo que se ve es
 * exactamente lo que pasa en el juego.
 */
export function Laboratorio() {
  const cartas = usePartida((s) => s.cartas);
  const baraja = usePartida((s) => s.baraja);
  const juego = useMemo(() => conquianPara(cartas, baraja), [cartas, baraja]);

  const [jugadores, setJugadores] = useState(4);
  const [velocidad, setVelocidad] = useState(1);
  const [reducido, setReducido] = useState(false);
  const [semilla, setSemilla] = useState('lab');
  const [actual, setActual] = useState<string | null>(null);
  const [estado, setEstado] = useState('');
  const [auto, setAuto] = useState(false);
  const [abierto, setAbierto] = useState(() => !angosto());

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const velocidadRef = useRef(velocidad);
  velocidadRef.current = velocidad;

  const detener = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelarIA();
  }, []);
  const despues = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms / velocidadRef.current));
  };

  // Cámara lenta: todas las animaciones de GSAP van más lento o más rápido.
  useEffect(() => {
    gsap.globalTimeline.timeScale(velocidad);
    return () => {
      gsap.globalTimeline.timeScale(1);
    };
  }, [velocidad]);

  useEffect(() => {
    forzarMovimientoReducido(reducido ? true : null);
    return () => forzarMovimientoReducido(null);
  }, [reducido]);

  /** Muestra un escenario: pone la mesa y luego sus jugadas, una por una. */
  const reproducir = useCallback(
    (p: Preparado, nombre: string) => {
      detener();
      setAuto(false);
      poner(p.inicio, p.modo);
      let esperado = p.inicio;
      const total = p.pasos.length;
      setEstado(
        total === 0
          ? `${nombre} · semilla ${p.semilla}`
          : `${nombre} · 0/${total} · semilla ${p.semilla}`,
      );
      // Las pausas son las mismas de la computadora en una partida.
      let espera = PAUSA_INICIAL_MS;
      let simulado = p.inicio;
      p.pasos.forEach((accion, i) => {
        timers.current.push(
          setTimeout(() => {
            const ahora = usePartida.getState().local;
            // Si tocaste la mesa, la partida siguió por su lado: el escenario se detiene.
            if (ahora !== esperado || !ahora) {
              detener();
              setEstado(`${nombre} · se detuvo porque jugaste tú`);
              return;
            }
            esperado = juego.apply(ahora, accion);
            aplicar(esperado, accion);
            setEstado(`${nombre} · ${i + 1}/${total} · semilla ${p.semilla}`);
          }, espera / velocidadRef.current),
        );
        const siguiente = juego.apply(simulado, accion);
        espera += pausaIA(siguiente, simulado);
        simulado = siguiente;
      });
    },
    [detener, juego],
  );

  const mostrar = useCallback(
    (id: string, s = semilla, n = jugadores) => {
      const e = ESCENARIOS.find((x) => x.id === id);
      if (!e) return;
      setActual(id);
      const p = e.preparar(juego, n, s, HUMANO);
      if (!p) {
        detener();
        setEstado(`${e.nombre}: no se encontró con esta semilla; prueba otra.`);
        return;
      }
      reproducir(p, e.nombre);
      if (angosto()) setAbierto(false);
    },
    [detener, juego, jugadores, reproducir, semilla],
  );

  // Al entrar, se reparte para que la mesa no esté vacía.
  useEffect(() => {
    mostrar('repartir');
    return () => {
      detener();
      usePartida.getState().salir();
    };
    // Solo al montar.
  }, []);

  // Autojugar: la IA juega en todos los asientos, sin parar, a la velocidad elegida.
  useEffect(() => {
    if (!auto) return;
    detener();
    setActual(null);
    setEstado('Autojugar');
    let vivo = true;
    const paso = () => {
      if (!vivo) return;
      const state = usePartida.getState().local;
      if (!state || juego.result(state)) {
        despues(state ? PAUSA_FINAL_MS : 0, () => {
          poner(juego.setup(jugadores, nuevaSemilla()), 'desdeOrigen');
          despues(PAUSA_MS * 1.5, paso);
        });
        return;
      }
      const accion = siguienteJugada(juego, state);
      if (!accion) return;
      const nuevo = juego.apply(state, accion);
      aplicar(nuevo, accion);
      despues(pausaIA(nuevo, state), paso);
    };
    despues(PAUSA_INICIAL_MS, paso);
    return () => {
      vivo = false;
      detener();
    };
    // `despues` usa refs; no hace falta reiniciar por él.
  }, [auto, juego, jugadores, detener]);

  const salirLab = () => {
    detener();
    usePartida.getState().salir();
    location.hash = '';
  };

  const grupos = useMemo(() => {
    const m = new Map<string, (typeof ESCENARIOS)[number][]>();
    for (const e of ESCENARIOS) m.set(e.grupo, [...(m.get(e.grupo) ?? []), e]);
    return [...m];
  }, []);

  return (
    <Partida onMenu={salirLab}>
      <button
        className="boton-menu boton-lab"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        🎬 {abierto ? 'Ocultar' : 'Laboratorio'}
      </button>
      {abierto && (
        <aside className="panel-lab" aria-label="Laboratorio de animaciones">
          <header>
            <strong>Laboratorio</strong>
            <Fps />
          </header>

          <div className="fila-lab">
            <span>Jugadores</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={jugadores === n}
                onClick={() => {
                  setJugadores(n);
                  if (actual) mostrar(actual, semilla, n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="fila-lab">
            <span>Velocidad</span>
            {VELOCIDADES.map((v) => (
              <button key={v} aria-pressed={velocidad === v} onClick={() => setVelocidad(v)}>
                {v}×
              </button>
            ))}
          </div>
          <label className="fila-lab">
            <input
              type="checkbox"
              checked={reducido}
              onChange={(e) => setReducido(e.target.checked)}
            />
            Movimiento reducido
          </label>
          <div className="fila-lab">
            <span>Semilla</span>
            <input
              className="semilla"
              value={semilla}
              onChange={(e) => setSemilla(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && actual && mostrar(actual)}
            />
            <button
              title="Otra semilla"
              onClick={() => {
                const s = nuevaSemilla();
                setSemilla(s);
                if (actual) mostrar(actual, s);
              }}
            >
              🎲
            </button>
          </div>
          <div className="fila-lab">
            <button
              className="principal"
              disabled={!actual}
              onClick={() => actual && mostrar(actual)}
            >
              ↻ Repetir
            </button>
            <button aria-pressed={auto} onClick={() => setAuto(!auto)}>
              {auto ? '■ Parar' : '▶ Autojugar'}
            </button>
          </div>
          {estado && <p className="estado-lab">{estado}</p>}

          {grupos.map(([grupo, lista]) => (
            <section key={grupo}>
              <h3>{grupo}</h3>
              <div className="escenarios">
                {lista.map((e) => (
                  <button key={e.id} aria-pressed={actual === e.id} onClick={() => mostrar(e.id)}>
                    {e.nombre}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="nota-lab">
            Cambia baraja, modo o sonido en ⚙ Opciones. Tocar la mesa juega de verdad y detiene el
            escenario.
          </p>
        </aside>
      )}
    </Partida>
  );
}
