import { lazy, Suspense, useEffect, useState } from 'react';
import { usePartida } from './store';
import { Menu } from './ui/Menu';
import { Partida } from './ui/Partida';

// El laboratorio de animaciones es una herramienta de desarrollo: no entra en el build final.
const Laboratorio = import.meta.env.DEV
  ? lazy(() => import('./ui/Laboratorio').then((m) => ({ default: m.Laboratorio })))
  : null;

function useHash(): string {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(location.hash);
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return hash;
}

export function App() {
  const enPartida = usePartida((s) => s.vista !== null);
  const salir = usePartida((s) => s.salir);
  const hash = useHash();
  if (Laboratorio && hash === '#lab') {
    return (
      <Suspense fallback={null}>
        <Laboratorio />
      </Suspense>
    );
  }
  if (!enPartida) return <Menu />;
  return <Partida onMenu={salir} />;
}
