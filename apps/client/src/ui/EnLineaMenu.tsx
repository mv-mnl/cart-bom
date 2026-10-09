import { useState } from 'react';
import { crearSala, unirseSala } from '../red/enLinea';
import { usePartida } from '../store';

const CLAVE_NOMBRE = 'cartas.nombre';

function leerNombre(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? '';
  } catch {
    return '';
  }
}

function guardarNombre(nombre: string) {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre);
  } catch {
    // Solo se pierde recordarlo.
  }
}

/** Código que viene en el enlace para unirse (`#sala=ABCDE`). */
const codigoDelEnlace = () => /^#sala=([A-Za-z]+)$/.exec(location.hash)?.[1]?.toUpperCase() ?? '';

/** Crear una sala o unirse con un código, en el menú. */
export function EnLineaMenu() {
  const errorRed = usePartida((s) => s.errorRed);
  const [nombre, setNombre] = useState(leerNombre);
  const [codigo, setCodigo] = useState(codigoDelEnlace);
  const [conectando, setConectando] = useState(false);

  const conectar = async (entrar: (nombre: string) => Promise<void>) => {
    guardarNombre(nombre.trim());
    setConectando(true);
    await entrar(nombre.trim());
    setConectando(false);
  };

  return (
    <section className="en-linea" aria-label="Jugar en línea">
      <p>En línea con amigos:</p>
      <input
        className="campo"
        placeholder="Tu nombre"
        maxLength={16}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <div className="botones">
        <button disabled={conectando} onClick={() => conectar(crearSala)}>
          Crear sala
        </button>
      </div>
      <form
        className="unirse"
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.trim()) void conectar((n) => unirseSala(codigo, n));
        }}
      >
        <input
          className="campo codigo"
          placeholder="Código"
          maxLength={5}
          autoCapitalize="characters"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        />
        <button className="secundario" disabled={conectando || !codigo.trim()}>
          Unirse
        </button>
      </form>
      {conectando && <p className="ayuda">Conectando…</p>}
      {errorRed && <p className="pista">{errorRed}</p>}
    </section>
  );
}
