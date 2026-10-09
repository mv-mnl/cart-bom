import { useLayoutEffect, useMemo, useRef } from 'react';
import { entradaPanel } from '../anim/victoria';
import { usePartida } from '../store';
import { AjustesPartida } from './AjustesPartida';
import { resumenFinal } from './final';

/** Panel al terminar la partida: quién ganó, cuánto bajó cada quien y qué hacer ahora. */
export function PantallaFinal() {
  const vista = usePartida((s) => s.vista);
  const nombres = usePartida((s) => s.nombres);
  const verMesa = usePartida((s) => s.verMesa);
  const sala = usePartida((s) => s.enLinea?.sala ?? null);
  // En línea, la revancha (y el juego con que se hace) los decide el anfitrión.
  const decide = !sala || sala.yo === sala.anfitrion;
  const { nueva, salir, cerrarFinal } = usePartida.getState();
  const resumen = useMemo(
    () => (vista ? resumenFinal(vista.view, nombres) : null),
    [vista, nombres],
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

  if (!visible || !vista) return null;
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
        <details className="ajustes-final">
          <summary>Juego de la próxima partida</summary>
          <AjustesPartida />
        </details>
        <div className="acciones-final">
          {decide ? (
            <button className="boton-juego" onClick={() => nueva(vista.view.jugadores.length)}>
              {tipo === 'ganaste' ? 'Otra partida' : 'Revancha'}
            </button>
          ) : (
            <p className="esperando">
              Esperando a que {sala?.asientos[sala.anfitrion]?.nombre ?? 'el anfitrión'} empiece la
              revancha…
            </p>
          )}
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
