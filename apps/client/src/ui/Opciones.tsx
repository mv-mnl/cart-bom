import { useEffect, useRef, useState } from 'react';
import { usePartida, type CartasPartida, type ModoControl } from '../store';
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

/** Elegir cómo se ven las cartas. */
export function SelectorBaraja() {
  const baraja = usePartida((s) => s.baraja);
  const cambiarBaraja = usePartida((s) => s.cambiarBaraja);
  return (
    <div className="segmentos" role="radiogroup" aria-label="Baraja">
      {BARAJAS.map(([b, texto]) => (
        <button
          key={b}
          role="radio"
          aria-checked={b === baraja}
          className="segmento"
          onClick={() => cambiarBaraja(b)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Elegir con qué cartas se juega (se aplica al empezar la siguiente partida). */
export function SelectorCartas() {
  const cartas = usePartida((s) => s.cartas);
  const baraja = usePartida((s) => s.baraja);
  const cambiarCartas = usePartida((s) => s.cambiarCartas);
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
          aria-checked={c === cartas}
          className="segmento"
          onClick={() => cambiarCartas(c)}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Botón "Opciones" de la mesa: abre un panel con el modo y las ayudas. */
export function BotonOpciones() {
  const [abierto, setAbierto] = useState(false);
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
          <SelectorBaraja />
          <InterruptorAyudas />
        </div>
      )}
    </div>
  );
}
