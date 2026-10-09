import { useEffect, useRef, useState } from 'react';
import { estiloDe, usePartida, type CartasPartida, type ModoControl } from '../store';
import type { EstiloBaraja } from './baraja';
import { InterruptorAyudas } from './InterruptorAyudas';

const MODOS: readonly [ModoControl, string, string][] = [
  ['botones', 'Botones', 'Tocas las cartas y usas los botones.'],
  ['arrastrar', 'Arrastrar', 'Todo se hace arrastrando las cartas.'],
  ['mixto', 'Mixto', 'Puedes tocar, usar botones o arrastrar.'],
];

/** Elegir cómo se juega: solo botones, solo arrastrar o mixto. */
export function SelectorModo() {
  const modo = usePartida((s) => s.modo);
  const cambiarModo = usePartida((s) => s.cambiarModo);
  const descripcion = MODOS.find(([m]) => m === modo)?.[2];
  return (
    <div className="selector-modo">
      <div className="segmentos" role="radiogroup" aria-label="Modo de juego">
        {MODOS.map(([m, texto]) => (
          <button
            key={m}
            role="radio"
            aria-checked={m === modo}
            className="segmento"
            onClick={() => cambiarModo(m)}
          >
            {texto}
          </button>
        ))}
      </div>
      <p className="descripcion">{descripcion}</p>
    </div>
  );
}

const BARAJAS: readonly [EstiloBaraja, string][] = [
  ['espanola', 'Española'],
  ['americana', 'Americana ♠♥'],
];

export const nombreBaraja = (baraja: EstiloBaraja) =>
  baraja === 'americana' ? 'Americana' : 'Española';

/** Segmentos para elegir la baraja. `desactivado`: se ve lo elegido pero no se cambia. */
export function SegmentosBaraja({
  valor,
  cambiar,
  desactivado = false,
}: {
  valor: EstiloBaraja;
  cambiar: (baraja: EstiloBaraja) => void;
  desactivado?: boolean;
}) {
  return (
    <div className="segmentos" role="radiogroup" aria-label="Baraja">
      {BARAJAS.map(([b, texto]) => (
        <button
          key={b}
          role="radio"
          aria-checked={b === valor}
          className="segmento"
          disabled={desactivado}
          onClick={() => cambiar(b)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Segmentos para elegir con qué cartas se juega; la completa depende de la baraja. */
export function SegmentosCartas({
  valor,
  baraja,
  cambiar,
  desactivado = false,
}: {
  valor: CartasPartida;
  baraja: EstiloBaraja;
  cambiar: (cartas: CartasPartida) => void;
  desactivado?: boolean;
}) {
  const opciones: readonly [CartasPartida, string][] = [
    ['completa', baraja === 'americana' ? 'Completa (52)' : 'Completa (48)'],
    ['cuarenta', 'Sin 8, 9 y 10 (40)'],
  ];
  return (
    <div className="segmentos" role="radiogroup" aria-label="Cartas">
      {opciones.map(([c, texto]) => (
        <button
          key={c}
          role="radio"
          aria-checked={c === valor}
          className="segmento"
          disabled={desactivado}
          onClick={() => cambiar(c)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** La baraja de la próxima partida contra la computadora (preferencia del menú). */
export function SelectorBaraja() {
  const baraja = usePartida((s) => s.baraja);
  const cambiarBaraja = usePartida((s) => s.cambiarBaraja);
  return <SegmentosBaraja valor={baraja} cambiar={cambiarBaraja} />;
}

/** Con qué cartas se juega la próxima partida contra la computadora. */
export function SelectorCartas() {
  const cartas = usePartida((s) => s.cartas);
  const baraja = usePartida((s) => s.baraja);
  const cambiarCartas = usePartida((s) => s.cambiarCartas);
  return <SegmentosCartas valor={cartas} baraja={baraja} cambiar={cambiarCartas} />;
}

/** Botón "Opciones" de la mesa: abre un panel con el modo y las ayudas. */
export function BotonOpciones() {
  const [abierto, setAbierto] = useState(false);
  const estilo = usePartida(estiloDe);
  const ref = useRef<HTMLDivElement>(null);

  // Se cierra al tocar fuera del panel.
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', cerrar);
    return () => document.removeEventListener('pointerdown', cerrar);
  }, [abierto]);

  return (
    <div className="opciones-juego" ref={ref}>
      <button className="boton-menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        ⚙ Opciones
      </button>
      {abierto && (
        <div className="panel-opciones" role="dialog" aria-label="Opciones">
          <span className="rotulo">Modo de juego</span>
          <SelectorModo />
          <span className="rotulo">Baraja</span>
          <p className="nota-opciones">
            {nombreBaraja(estilo)}, la de esta partida. Se cambia al terminar.
          </p>
          <InterruptorAyudas />
        </div>
      )}
    </div>
  );
}
