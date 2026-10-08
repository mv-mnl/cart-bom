import { useLayoutEffect, useMemo, useRef } from 'react';
import { entradaPanel } from '../anim/victoria';
import { HUMANO, usePartida } from '../store';
import { resumenFinal } from './final';

/** Panel al terminar la partida: quién ganó, cuánto bajó cada quien y qué hacer ahora. */
export function PantallaFinal() {
  const state = usePartida((s) => s.state);
  const nombres = usePartida((s) => s.nombres);
  const verMesa = usePartida((s) => s.verMesa);
  const { nueva, salir, cerrarFinal } = usePartida.getState();
  const resumen = useMemo(
    () => (state ? resumenFinal(state, nombres, HUMANO) : null),
    [state, nombres],
  );
  const panel = useRef<HTMLDivElement>(null);
  const visible = resumen !== null && !verMesa;

  useLayoutEffect(() => {
    const el = panel.current;
    if (!visible || !el) return;
    const tl = entradaPanel(el, Array.from(el.querySelectorAll<HTMLElement>('.fila-final')));
    return () => {
      tl.kill();
    };
  }, [visible]);

  if (!visible || !state) return null;
  const { tipo, detalle, meta, filas } = resumen;

  return (
    <div className="pantalla-final" role="dialog" aria-modal="true" aria-label={resumen.titulo}>
      <div ref={panel} className={`panel-final ${tipo}`}>
        <p className="detalle-final">{detalle}</p>
        <ol className="tabla-final">
          {filas.map((f) => (
            <li
              key={f.nombre}
              className={`fila-final${f.gano ? ' gano' : ''}${f.esHumano ? ' tu' : ''}`}
            >
              <span className="nombre-final">
                {f.gano && <span aria-label="Ganador">👑 </span>}
                {f.nombre}
              </span>
              <span className="barra-final" aria-hidden="true">
                {Array.from({ length: meta }, (_, i) => (
                  <span key={i} className={i < f.bajadas ? 'llena' : ''} />
                ))}
              </span>
              <span className="cuenta-final">
                {f.bajadas}/{meta}
              </span>
            </li>
          ))}
        </ol>
        <div className="acciones-final">
          <button className="boton-juego" onClick={() => nueva(state.jugadores.length)}>
            {tipo === 'ganaste' ? 'Otra partida' : 'Revancha'}
          </button>
          <div className="fila">
            <button className="secundario" onClick={cerrarFinal}>
              Ver la mesa
            </button>
            <button className="secundario" onClick={salir}>
              Menú
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
