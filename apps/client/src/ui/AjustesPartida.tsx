import { usePartida, type CartasPartida } from '../store';
import type { EstiloBaraja } from './baraja';
import { SegmentosBaraja, SegmentosCartas } from './Opciones';

/**
 * Con qué se juega la próxima partida: baraja y cartas. Se cambia solo entre partidas.
 * Contra la computadora es tu preferencia; en línea lo elige el anfitrión y los demás lo ven.
 */
export function AjustesPartida() {
  const enLinea = usePartida((s) => s.enLinea);
  const misCartas = usePartida((s) => s.cartas);
  const miBaraja = usePartida((s) => s.baraja);
  const { cambiarCartas, cambiarBaraja } = usePartida.getState();
  const sala = enLinea?.sala;

  const puede = !sala || sala.yo === sala.anfitrion;
  const cartas = sala?.cartas ?? misCartas;
  const baraja = sala?.baraja ?? miBaraja;
  const cambiar = (c: CartasPartida, b: EstiloBaraja) => {
    // Lo que elige el anfitrión también queda como su preferencia para la próxima sala.
    cambiarCartas(c);
    cambiarBaraja(b);
    enLinea?.enviar({ type: 'configurar', cartas: c, baraja: b });
  };

  return (
    <div className="ajustes-partida">
      <span className="rotulo">Baraja</span>
      <SegmentosBaraja valor={baraja} cambiar={(b) => cambiar(cartas, b)} desactivado={!puede} />
      <span className="rotulo">Cartas</span>
      <SegmentosCartas
        valor={cartas}
        baraja={baraja}
        cambiar={(c) => cambiar(c, baraja)}
        desactivado={!puede}
      />
      {sala && !puede && (
        <p className="nota-opciones">
          Lo elige {sala.asientos[sala.anfitrion]?.nombre ?? 'el anfitrión'}.
        </p>
      )}
    </div>
  );
}
