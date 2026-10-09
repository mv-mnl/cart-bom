import { configPara } from '@cartas/conquian';
import { describe, expect, it } from 'vitest';
import { Rechazo, SalaConquian, limpiarNombre } from './sala';

const nueva = () => new SalaConquian('ABCDE', configPara('cuarenta', 'espanola'));

/** Sala de dos personas (`ana` es la anfitriona) ya repartida. */
function enJuego(compus = 0) {
  const sala = nueva();
  sala.sentar('ana', 'Ana');
  sala.sentar('beto', 'Beto');
  sala.empezar('ana', compus, 'semilla');
  return sala;
}

const pasarCarta = (sala: SalaConquian, id: string) => {
  const accion = sala.vista(id, null)?.acciones.find((a) => a.type === 'pasarCarta');
  if (!accion) throw new Error('sin jugada');
  return accion;
};

describe('sala de espera', () => {
  it('sienta en orden de llegada; quien crea es el anfitrión', () => {
    const sala = nueva();
    expect(sala.sentar('ana', 'Ana')).toBe(0);
    expect(sala.sentar('beto', 'Beto')).toBe(1);
    const vista = sala.sala('beto');
    expect(vista.yo).toBe(1);
    expect(vista.anfitrion).toBe(0);
    expect(vista.asientos.map((a) => a.nombre)).toEqual(['Ana', 'Beto']);
    expect(vista.enJuego).toBe(false);
  });

  it('no caben más de 4', () => {
    const sala = nueva();
    for (const id of ['a', 'b', 'c', 'd']) sala.sentar(id, id);
    expect(() => sala.sentar('e', 'e')).toThrow(Rechazo);
  });

  it('si se va el anfitrión, pasa a la siguiente persona', () => {
    const sala = nueva();
    sala.sentar('ana', 'Ana');
    sala.sentar('beto', 'Beto');
    sala.quitar('ana');
    expect(sala.sala('beto')).toMatchObject({ yo: 0, anfitrion: 0 });
    expect(sala.sala('beto').asientos.map((a) => a.nombre)).toEqual(['Beto']);
  });

  it('solo el anfitrión empieza, y con 2 a 4 jugadores', () => {
    const sala = nueva();
    sala.sentar('ana', 'Ana');
    sala.sentar('beto', 'Beto');
    expect(() => sala.empezar('beto', 0, 's')).toThrow('Solo quien creó');
    expect(() => sala.empezar('ana', 3, 's')).toThrow('Se juega de 2 a 4');
    expect(() => sala.empezar('ana', -1, 's')).toThrow(Rechazo);
    expect(() => sala.empezar('ana', '1', 's')).toThrow(Rechazo);
    sala.empezar('ana', 1, 's');
    expect(sala.sala('ana').asientos.map((a) => a.compu)).toEqual([false, false, true]);
  });

  it('una persona sola puede jugar contra la computadora', () => {
    const sala = nueva();
    sala.sentar('ana', 'Ana');
    expect(() => sala.empezar('ana', 0, 's')).toThrow(Rechazo);
    sala.empezar('ana', 1, 's');
    expect(sala.enJuego).toBe(true);
  });

  it('ya empezada no entra nadie', () => {
    expect(() => enJuego().sentar('caro', 'Caro')).toThrow('ya empezó');
  });

  it('limpia los nombres', () => {
    expect(limpiarNombre('  Ana   María  ', 'X')).toBe('Ana María');
    expect(limpiarNombre('', 'Jugador 1')).toBe('Jugador 1');
    expect(limpiarNombre(42, 'Jugador 1')).toBe('Jugador 1');
    expect(limpiarNombre('x'.repeat(40), 'X')).toHaveLength(16);
  });
});

describe('partida', () => {
  it('reparte con las cartas de la sala', () => {
    const vista = enJuego().vista('ana', null);
    expect(vista?.view.config.baraja.valores).toEqual(
      configPara('cuarenta', 'espanola').baraja.valores,
    );
    expect(vista?.view.mano).toHaveLength(9);
  });

  it('cada quien ve solo su mano', () => {
    const sala = enJuego();
    const deAna = sala.vista('ana', null);
    const deBeto = sala.vista('beto', null);
    expect(deAna?.view.yo).toBe(0);
    expect(deBeto?.view.yo).toBe(1);
    const texto = JSON.stringify(deBeto);
    for (const carta of deAna?.view.mano ?? []) expect(texto).not.toContain(`"${carta.id}"`);
  });

  it('acepta una jugada válida de quien la hace', () => {
    const sala = enJuego();
    const accion = pasarCarta(sala, 'ana');
    // Llega por la red: es otro objeto, con las claves en otro orden.
    const copia: unknown = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(accion).reverse())),
    );
    expect(sala.jugar('ana', copia)).toEqual(accion);
    expect(sala.vista('ana', null)?.view.fase).toMatchObject({ miCarta: accion.cardId });
  });

  it('rechaza jugar a nombre de otro', () => {
    const sala = enJuego();
    const deBeto = pasarCarta(sala, 'beto');
    expect(() => sala.jugar('ana', deBeto)).toThrow(Rechazo);
  });

  it('rechaza jugadas inválidas o mal formadas sin cambiar nada', () => {
    const sala = enJuego();
    const antes = sala.vista('ana', null);
    for (const basura of [
      null,
      'botar',
      { type: 'botar', player: 0, cardId: 'oros-1' },
      { type: 'pasarCarta', player: 0, cardId: 'no-existe' },
      { type: 'pasarCarta', player: 0, cardId: { toString: 1 } },
    ]) {
      expect(() => sala.jugar('ana', basura)).toThrow(Rechazo);
    }
    expect(sala.vista('ana', null)).toEqual(antes);
  });

  it('rechaza jugadas de quien no está sentado', () => {
    expect(() => enJuego().jugar('intruso', {})).toThrow('No estás sentado');
  });

  it('la computadora juega en sus asientos y nunca en los de personas', () => {
    const sala = enJuego(1);
    const accion = sala.jugadaCompu();
    expect(accion?.player).toBe(2);
    if (accion) sala.aplicarCompu(accion);
    expect(sala.vista('ana', null)?.view.fase).toMatchObject({ listos: [false, false, true] });
    expect(sala.jugadaCompu()).toBeNull();
  });

  it('si alguien se va a media partida, su asiento lo juega la computadora', () => {
    const sala = enJuego();
    sala.quitar('beto');
    expect(sala.sala('ana').asientos[1]).toMatchObject({ nombre: 'Beto', compu: true });
    expect(sala.jugadaCompu()?.player).toBe(1);
  });

  it('marca a quien se desconectó mientras se le espera', () => {
    const sala = enJuego();
    sala.marcarConexion('beto', false);
    expect(sala.sala('ana').asientos[1]?.desconectado).toBe(true);
    sala.marcarConexion('beto', true);
    expect(sala.sala('ana').asientos[1]?.desconectado).toBe(false);
  });

  it('revancha solo al terminar, con los mismos asientos', () => {
    const sala = enJuego(2);
    expect(() => sala.revancha('ana', 'otra')).toThrow('no ha terminado');
    // Beto se va (lo juega la computadora) y Ana pasa siempre que puede.
    sala.quitar('beto');
    for (let i = 0; i < 2000 && !sala.terminada; i++) {
      const deAna = sala.vista('ana', null)?.acciones ?? [];
      const accion =
        sala.jugadaCompu() ?? deAna.find((a) => a.type === 'pasar') ?? deAna[0] ?? null;
      if (!accion) break;
      if (accion.player === 0) sala.jugar('ana', accion);
      else sala.aplicarCompu(accion);
    }
    expect(sala.terminada).toBe(true);
    sala.revancha('ana', 'otra');
    expect(sala.terminada).toBe(false);
    expect(sala.sala('ana').asientos).toHaveLength(4);
  });
});
