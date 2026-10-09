import { useState } from 'react';
import { usePartida } from '../store';
import { AjustesPartida } from './AjustesPartida';

/** Un lugar de la mesa en la sala de espera. */
function Lugar({
  nombre,
  tipo,
  etiquetas = [],
}: {
  nombre: string;
  tipo: 'persona' | 'tu' | 'compu' | 'libre';
  etiquetas?: readonly string[];
}) {
  const inicial = tipo === 'compu' ? '🤖' : tipo === 'libre' ? '' : nombre.charAt(0).toUpperCase();
  return (
    <li className={`lugar ${tipo}`}>
      <span className="avatar" aria-hidden="true">
        {inicial}
      </span>
      <span className="nombre-lugar">{nombre}</span>
      {etiquetas.map((e) => (
        <span key={e} className="etiqueta">
          {e}
        </span>
      ))}
    </li>
  );
}

/** Antes de empezar: el código para compartir, quién ya llegó y el botón de empezar. */
export function SalaEspera() {
  const enLinea = usePartida((s) => s.enLinea);
  const aviso = usePartida((s) => s.aviso);
  const salir = usePartida((s) => s.salir);
  const [compus, setCompus] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const sala = enLinea?.sala;

  if (!enLinea || !sala) {
    return (
      <main className="pantalla-sala">
        <div className="panel-sala">
          <p className="ayuda">Conectando con la sala…</p>
          <button className="secundario" onClick={salir}>
            Cancelar
          </button>
        </div>
      </main>
    );
  }

  const personas = sala.asientos.length;
  const soyAnfitrion = sala.yo === sala.anfitrion;
  const libres = sala.maxJugadores - personas;
  // Las computadoras que se pueden agregar sin pasar del máximo ni quedar por debajo del mínimo.
  const minCompus = Math.max(0, sala.minJugadores - personas);
  const elegidas = Math.min(Math.max(compus, minCompus), libres);
  const vacios = sala.maxJugadores - personas - elegidas;
  const total = personas + elegidas;
  const enlace = `${location.origin}${location.pathname}#sala=${sala.codigo}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <main className="pantalla-sala">
      <div className="panel-sala">
        <header className="cabeza-sala">
          <span className="rotulo-sala">Código de la sala</span>
          <span className="codigo-sala" aria-label={`Código ${sala.codigo.split('').join(' ')}`}>
            {sala.codigo}
          </span>
          <button className="secundario copiar" onClick={copiar}>
            {copiado ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
          </button>
        </header>

        <section className="lugares-sala" aria-label="Jugadores">
          <h2>
            Jugadores{' '}
            <span className="cuenta">
              {total}/{sala.maxJugadores}
            </span>
          </h2>
          <ol className="lugares">
            {sala.asientos.map((a, i) => (
              <Lugar
                key={i}
                nombre={a.nombre}
                tipo={i === sala.yo ? 'tu' : 'persona'}
                etiquetas={[
                  ...(i === sala.yo ? ['Tú'] : []),
                  ...(i === sala.anfitrion ? ['👑 Anfitrión'] : []),
                  ...(a.desconectado ? ['Sin conexión'] : []),
                ]}
              />
            ))}
            {Array.from({ length: elegidas }, (_, i) => (
              <Lugar key={`compu-${i}`} nombre={`Compu ${i + 1}`} tipo="compu" />
            ))}
            {Array.from({ length: vacios }, (_, i) => (
              <Lugar key={`libre-${i}`} nombre="Esperando jugador…" tipo="libre" />
            ))}
          </ol>
        </section>

        <AjustesPartida />

        {soyAnfitrion ? (
          <>
            {libres > 0 && (
              <div className="fila-compus">
                <span>Computadoras</span>
                <div className="segmentos" role="radiogroup" aria-label="Computadoras">
                  {Array.from({ length: libres + 1 }, (_, n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={n === elegidas}
                      className="segmento"
                      disabled={n < minCompus}
                      onClick={() => setCompus(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              className="boton-juego empezar"
              disabled={total < sala.minJugadores}
              onClick={() => enLinea.enviar({ type: 'empezar', compus: elegidas })}
            >
              Empezar partida
            </button>
          </>
        ) : (
          <p className="esperando">
            Esperando a que {sala.asientos[sala.anfitrion]?.nombre ?? 'el anfitrión'} empiece…
          </p>
        )}
        {aviso && <p className="pista">{aviso}</p>}
      </div>
      <button className="secundario" onClick={salir}>
        Salir de la sala
      </button>
    </main>
  );
}
