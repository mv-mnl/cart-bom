import { afterEach, describe, expect, it } from 'vitest';
import { ayudasDe, usePartida } from '../store';
import { crearSala, nombresDe, unirseSala } from './enLinea';

/** Espera a que el store cumpla `cumple` (los mensajes llegan por la red). */
async function hasta(cumple: () => boolean, ms = 4000) {
  const limite = Date.now() + ms;
  while (!cumple()) {
    if (Date.now() > limite) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const estado = () => usePartida.getState();

afterEach(() => estado().salir());

describe('en línea contra el servidor real', () => {
  it('crea una sala, empieza con la computadora y juega por el servidor', async () => {
    await crearSala('Ana');
    await hasta(() => estado().enLinea?.sala != null);
    const sala = estado().enLinea?.sala;
    expect(sala?.codigo).toMatch(/^[A-Z]{5}$/);
    expect(sala?.asientos.map((a) => a.nombre)).toEqual(['Ana']);

    estado().enLinea?.enviar({ type: 'empezar', compus: 1 });
    await hasta(() => estado().vista !== null);
    expect(estado().nombres).toEqual(['Tú', 'Compu 1']);
    // El cliente en línea nunca tiene la partida completa.
    expect(estado().local).toBeNull();

    const pasar = estado().vista?.acciones.find((a) => a.type === 'pasarCarta');
    if (!pasar) throw new Error('sin jugada');
    estado().jugar(pasar);
    await hasta(() => estado().vista?.jugada?.player === 0);
    // La jugada de la computadora llega por el servidor y pasa por la cola.
    await hasta(() => estado().vista?.jugada?.player === 1);
  });

  it('las ayudas son las de la sala: el anfitrión las cambia y valen para todos', async () => {
    usePartida.setState({ ayudas: true });
    await crearSala('Ana');
    await hasta(() => estado().enLinea?.sala != null);
    expect(ayudasDe(estado())).toBe(true);
    const sala = estado().enLinea?.sala;
    if (!sala) throw new Error('sin sala');
    estado().enLinea?.enviar({
      type: 'configurar',
      cartas: sala.cartas,
      baraja: sala.baraja,
      ayudas: false,
    });
    await hasta(() => estado().enLinea?.sala?.ayudas === false);
    // Aunque tu preferencia diga que sí, en la sala manda la de la sala.
    expect(estado().ayudas).toBe(true);
    expect(ayudasDe(estado())).toBe(false);
  });

  it('una jugada que el servidor rechaza se explica', async () => {
    await crearSala('Ana');
    await hasta(() => estado().enLinea?.sala != null);
    estado().enLinea?.enviar({ type: 'empezar', compus: 0 });
    await hasta(() => estado().aviso !== null);
    expect(estado().aviso).toBe('Se juega de 2 a 4.');
  });

  it('con un código que no existe, avisa en el menú', async () => {
    await unirseSala('zzzzz', 'Beto');
    expect(estado().enLinea).toBeNull();
    expect(estado().errorRed).toBe('No se encontró esa sala o la partida ya empezó.');
  });

  it('salir cierra la sala', async () => {
    await crearSala('Ana');
    await hasta(() => estado().enLinea?.sala != null);
    estado().salir();
    expect(estado().enLinea).toBeNull();
    expect(estado().vista).toBeNull();
  });
});

describe('nombresDe', () => {
  it('tú eres "Tú"; marca a quien no tiene conexión y a quien juega la computadora', () => {
    const asiento = (nombre: string, compu = false, desconectado = false) => ({
      nombre,
      compu,
      desconectado,
    });
    expect(
      nombresDe({
        codigo: 'ABCDE',
        asientos: [
          asiento('Ana'),
          asiento('Beto', false, true),
          asiento('Caro', true),
          asiento('Compu 1', true),
        ],
        anfitrion: 0,
        yo: 0,
        enJuego: true,
        terminada: false,
        cartas: 'completa',
        baraja: 'espanola',
        ayudas: true,
        minJugadores: 2,
        maxJugadores: 4,
      }),
    ).toEqual(['Tú', 'Beto (sin conexión)', 'Caro (compu)', 'Compu 1']);
  });
});
