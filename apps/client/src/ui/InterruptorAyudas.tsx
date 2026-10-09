import { ayudasDe, usePartida } from '../store';

/**
 * Interruptor para mostrar u ocultar las sugerencias y explicaciones. Contra la computadora
 * es tu preferencia. En línea son iguales para todos: las cambia el anfitrión entre partidas
 * y los demás solo ven cómo están.
 */
export function InterruptorAyudas({ className }: { className?: string }) {
  const ayudas = usePartida(ayudasDe);
  const enLinea = usePartida((s) => s.enLinea);
  const cambiarAyudas = usePartida((s) => s.cambiarAyudas);
  const sala = enLinea?.sala;
  const puede = !sala || (sala.yo === sala.anfitrion && (!sala.enJuego || sala.terminada));

  const cambiar = () => {
    cambiarAyudas(!ayudas);
    if (sala) {
      enLinea.enviar({
        type: 'configurar',
        cartas: sala.cartas,
        baraja: sala.baraja,
        ayudas: !ayudas,
      });
    }
  };

  return (
    <button
      role="switch"
      aria-checked={ayudas}
      className={`interruptor ${className ?? ''}`}
      disabled={!puede}
      onClick={cambiar}
      title={
        !puede
          ? 'En línea las ayudas son iguales para todos: las cambia el anfitrión entre partidas'
          : ayudas
            ? 'Ocultar sugerencias y explicaciones'
            : 'Mostrar sugerencias y explicaciones'
      }
    >
      <span className="perilla" aria-hidden="true" />
      Ayudas {ayudas ? 'sí' : 'no'}
    </button>
  );
}
