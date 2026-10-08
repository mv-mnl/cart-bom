import { usePartida } from '../store';

/** Silenciar o activar el sonido. Se guarda en el navegador. */
export function BotonSonido() {
  const silencio = usePartida((s) => s.silencio);
  const cambiarSilencio = usePartida((s) => s.cambiarSilencio);
  return (
    <button
      className="boton-menu"
      aria-pressed={silencio}
      aria-label={silencio ? 'Activar sonido' : 'Silenciar'}
      title={silencio ? 'Activar sonido' : 'Silenciar'}
      onClick={() => cambiarSilencio(!silencio)}
    >
      {silencio ? '🔇' : '🔊'}
    </button>
  );
}
