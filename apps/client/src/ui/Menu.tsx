import { useState } from 'react';
import { juegos } from '../juegos';
import { usePartida } from '../store';
import { EnLineaMenu } from './EnLineaMenu';
import { InterruptorAyudas } from './InterruptorAyudas';
import { SelectorBaraja, SelectorCartas, SelectorModo } from './Opciones';

export function Menu() {
  const nueva = usePartida((s) => s.nueva);
  const lista = juegos.list();
  const [elegido, setElegido] = useState(lista[0]?.id ?? '');
  const juego = juegos.get(elegido);

  return (
    <main className="menu">
      <h1>Cartas</h1>
      <p className="subtitulo">Juegos de baraja española</p>
      <div className="juegos">
        {lista.map((j) => (
          <button
            key={j.id}
            className={j.id === elegido ? 'juego activo' : 'juego'}
            onClick={() => setElegido(j.id)}
          >
            {j.nombre}
          </button>
        ))}
      </div>
      {juego && (
        <>
          <p>Contra la computadora:</p>
          <div className="botones">
            {Array.from({ length: juego.maxPlayers - juego.minPlayers + 1 }, (_, i) => {
              const n = juego.minPlayers + i;
              return (
                <button key={n} onClick={() => nueva(n)}>
                  {n} jugadores
                </button>
              );
            })}
          </div>
          <EnLineaMenu />
        </>
      )}
      <div className="ajustes-menu">
        <p>Cómo quieres jugar:</p>
        <SelectorModo />
        <p>Baraja:</p>
        <SelectorBaraja />
        <p>Cartas:</p>
        <SelectorCartas />
        <InterruptorAyudas />
      </div>
      {import.meta.env.DEV && (
        <button className="secundario" onClick={() => (location.hash = 'lab')}>
          🎬 Laboratorio de animaciones
        </button>
      )}
    </main>
  );
}
