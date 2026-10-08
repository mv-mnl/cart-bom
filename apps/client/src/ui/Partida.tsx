import { conquian } from '@cartas/conquian';
import type { ReactNode } from 'react';
import { usePartida } from '../store';
import { Mesa } from '../table/Mesa';
import { BotonSonido } from './BotonSonido';
import { Controles } from './Controles';
import { BotonOpciones } from './Opciones';
import { PantallaFinal } from './PantallaFinal';

/** La pantalla de juego: mesa, barra de arriba, controles y pantalla final. */
export function Partida({ onMenu, children }: { onMenu: () => void; children?: ReactNode }) {
  // Mientras se ve la pantalla final, los controles de jugada se ocultan (sin mover la mesa).
  const conFinal = usePartida(
    (s) => s.state !== null && conquian.result(s.state) !== null && !s.verMesa,
  );
  return (
    <div className={conFinal ? 'partida con-final' : 'partida'}>
      <Mesa />
      <div className="barra-superior">
        <button className="boton-menu" onClick={onMenu} aria-label="Volver al menú">
          ☰ Menú
        </button>
        <BotonOpciones />
        <BotonSonido />
      </div>
      <Controles />
      <PantallaFinal />
      {children}
    </div>
  );
}
