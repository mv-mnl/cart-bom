import { usePartida } from './store';
import { Mesa } from './table/Mesa';
import { Controles } from './ui/Controles';
import { BotonSonido } from './ui/BotonSonido';
import { BotonOpciones } from './ui/Opciones';
import { Menu } from './ui/Menu';

export function App() {
  const enPartida = usePartida((s) => s.state !== null);
  const salir = usePartida((s) => s.salir);
  if (!enPartida) return <Menu />;
  return (
    <div className="partida">
      <Mesa />
      <div className="barra-superior">
        <button className="boton-menu" onClick={salir} aria-label="Volver al menú">
          ☰ Menú
        </button>
        <BotonOpciones />
        <BotonSonido />
      </div>
      <Controles />
    </div>
  );
}
