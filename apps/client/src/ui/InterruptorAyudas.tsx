import { usePartida } from '../store';

/** Interruptor para mostrar u ocultar las sugerencias y explicaciones. */
export function InterruptorAyudas({ className }: { className?: string }) {
  const ayudas = usePartida((s) => s.ayudas);
  const cambiarAyudas = usePartida((s) => s.cambiarAyudas);
  return (
    <button
      role="switch"
      aria-checked={ayudas}
      className={`interruptor ${className ?? ''}`}
      onClick={() => cambiarAyudas(!ayudas)}
      title={ayudas ? 'Ocultar sugerencias y explicaciones' : 'Mostrar sugerencias y explicaciones'}
    >
      <span className="perilla" aria-hidden="true" />
      Ayudas {ayudas ? 'sí' : 'no'}
    </button>
  );
}
