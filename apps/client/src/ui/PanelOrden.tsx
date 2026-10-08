import { usePartida, HUMANO } from '../store';
import type { OrdenMano } from './orden';

const BOTONES: readonly [OrdenMano, string][] = [
  ['numero', 'Número'],
  ['palo', 'Palo'],
];

/** Panel para ordenar la mano, con botones gruesos tipo juego. */
export function PanelOrden() {
  const ordenMano = usePartida((s) => s.ordenMano);
  const ordenarMano = usePartida((s) => s.ordenarMano);
  // Cartas bajadas en la mesa contra las que hacen falta para ganar (9 + la 10 de la mesa).
  const bajadas = usePartida(
    (s) => s.state?.jugadores[HUMANO]?.juegos.reduce((n, j) => n + j.cartas.length, 0) ?? 0,
  );
  const meta = usePartida((s) => (s.state?.config.cartasPorJugador ?? 9) + 1);

  return (
    <section className="panel-orden" aria-label="Ordenar mano">
      <header>
        <span className="titulo">Ordenar mano</span>
        <span className="contador" title="Cartas que tienes bajadas en la mesa">
          En mesa {bajadas}/{meta}
        </span>
      </header>
      <div className="fila">
        {BOTONES.map(([orden, texto]) => (
          <button
            key={orden}
            className="boton-juego"
            aria-pressed={orden === ordenMano}
            onClick={() => ordenarMano(orden)}
          >
            {texto}
          </button>
        ))}
      </div>
    </section>
  );
}
