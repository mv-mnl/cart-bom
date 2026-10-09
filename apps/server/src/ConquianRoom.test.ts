import type { ConquianAction, ConquianView } from '@cartas/conquian';
import type { MensajeServidor } from '@cartas/shared';
import { Client, type Room } from '@colyseus/sdk';
import type { Server } from '@colyseus/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type Mensaje = MensajeServidor<ConquianView, ConquianAction>;
type Estado = Extract<Mensaje, { type: 'estado' }>;
type SalaMsg = Extract<Mensaje, { type: 'sala' }>;

const PUERTO = 2600 + Math.floor(Math.random() * 300);
let servidor: Server;

beforeAll(async () => {
  // La computadora juega casi sin pausa, para que sea rápido.
  vi.stubEnv('PAUSA_COMPU_MS', '20');
  const { crearServidor } = await import('./servidor');
  servidor = crearServidor();
  await servidor.listen(PUERTO);
});

afterAll(async () => {
  await servidor.gracefullyShutdown(false);
  vi.unstubAllEnvs();
});

/** Un jugador conectado que guarda todo lo que le llega. */
async function conectar(entrar: (c: Client) => Promise<Room>) {
  const recibidos: Mensaje[] = [];
  const esperas: { cumple: (m: Mensaje) => boolean; listo: (m: Mensaje) => void }[] = [];
  const room = await entrar(new Client(`ws://localhost:${PUERTO}`));
  room.onMessage('*', (_tipo, payload: Mensaje) => {
    recibidos.push(payload);
    for (const e of [...esperas]) {
      if (!e.cumple(payload)) continue;
      esperas.splice(esperas.indexOf(e), 1);
      e.listo(payload);
    }
  });
  /** El último mensaje que cumple `cumple`, o el siguiente que llegue. */
  function esperar<M extends Mensaje>(cumple: (m: Mensaje) => m is M): Promise<M>;
  function esperar(cumple: (m: Mensaje) => boolean): Promise<Mensaje>;
  function esperar(cumple: (m: Mensaje) => boolean) {
    const ya = [...recibidos].reverse().find(cumple);
    if (ya) return Promise.resolve(ya);
    return new Promise<Mensaje>((listo, falla) => {
      esperas.push({ cumple, listo });
      setTimeout(() => falla(new Error('no llegó el mensaje')), 3000);
    });
  }
  return { room, recibidos, esperar };
}

const esSala =
  (cumple: (s: SalaMsg) => boolean = () => true) =>
  (m: Mensaje): m is SalaMsg =>
    m.type === 'sala' && cumple(m);
const esEstado =
  (cumple: (s: Estado) => boolean = () => true) =>
  (m: Mensaje): m is Estado =>
    m.type === 'estado' && cumple(m);

const crear = (nombre: string) => (c: Client) =>
  c.create('conquian', { nombre, cartas: 'cuarenta', baraja: 'espanola' });
const unirse = (codigo: string, nombre: string) => (c: Client) => c.joinById(codigo, { nombre });

describe('ConquianRoom', () => {
  it('responde /health', async () => {
    const r = await fetch(`http://localhost:${PUERTO}/health`);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('dos personas se juntan con el código, empiezan y cada una ve solo lo suyo', async () => {
    const ana = await conectar(crear('Ana'));
    const codigo = ana.room.roomId;
    expect(codigo).toMatch(/^[A-Z]{5}$/);
    const beto = await conectar(unirse(codigo, 'Beto'));

    const sala = await ana.esperar(esSala((s) => s.asientos.length === 2));
    expect(sala.asientos.map((a) => a.nombre)).toEqual(['Ana', 'Beto']);
    expect(sala).toMatchObject({ codigo, yo: 0, anfitrion: 0, enJuego: false });

    // Beto no puede empezar.
    beto.room.send('empezar', { type: 'empezar', compus: 0 });
    expect(await beto.esperar((m) => m.type === 'rechazada')).toMatchObject({
      motivo: 'Solo quien creó la sala puede empezar.',
    });

    ana.room.send('empezar', { type: 'empezar', compus: 0 });
    const deAna = await ana.esperar(esEstado());
    const deBeto = await beto.esperar(esEstado());
    expect(deAna.view.yo).toBe(0);
    expect(deBeto.view.yo).toBe(1);
    expect(deAna.view.mano).toHaveLength(9);
    const texto = JSON.stringify(beto.recibidos);
    for (const carta of deAna.view.mano) expect(texto).not.toContain(`"${carta.id}"`);

    // Ya empezada, nadie más entra.
    await expect(conectar(unirse(codigo, 'Caro'))).rejects.toThrow();

    // Una jugada válida le llega a los dos; la carta que pasó Ana no la ve Beto.
    const pasar = deAna.acciones.find((a) => a.type === 'pasarCarta');
    if (pasar?.type !== 'pasarCarta') throw new Error('sin jugada');
    ana.room.send('jugar', { type: 'jugar', accion: pasar });
    const visto = await beto.esperar(esEstado((e) => e.jugada !== null));
    expect(visto.jugada).toEqual({ type: 'pasarCarta', player: 0 });
    expect(JSON.stringify(visto)).not.toContain(`"${pasar.cardId}"`);

    // Jugar a nombre de otro se rechaza.
    const deBetoAhora = await beto.esperar(esEstado());
    const ajena = deBetoAhora.acciones[0];
    ana.room.send('jugar', { type: 'jugar', accion: ajena });
    expect(await ana.esperar((m) => m.type === 'rechazada')).toBeTruthy();

    await ana.room.leave();
    await beto.room.leave();
  });

  it('contra la computadora: los asientos que faltan los juega el servidor', async () => {
    const ana = await conectar(crear('Ana'));
    await ana.esperar(esSala());
    ana.room.send('empezar', { type: 'empezar', compus: 1 });
    const sala = await ana.esperar(esSala((s) => s.enJuego));
    expect(sala.asientos.map((a) => a.compu)).toEqual([false, true]);
    // La computadora elige su carta del intercambio sin que nadie haga nada.
    const visto = await ana.esperar(esEstado((e) => e.jugada?.player === 1));
    expect(visto.jugada?.type).toBe('pasarCarta');
    await ana.room.leave();
  });

  it('si alguien se va a media partida, su asiento lo toma la computadora', async () => {
    const ana = await conectar(crear('Ana'));
    const beto = await conectar(unirse(ana.room.roomId, 'Beto'));
    await ana.esperar(esSala((s) => s.asientos.length === 2));
    ana.room.send('empezar', { type: 'empezar', compus: 0 });
    await ana.esperar(esEstado());
    await beto.room.leave();
    const sala = await ana.esperar(esSala((s) => s.asientos[1]?.compu === true));
    expect(sala.asientos[1]?.nombre).toBe('Beto');
    // Y juega por él.
    expect(await ana.esperar(esEstado((e) => e.jugada?.player === 1))).toBeTruthy();
    await ana.room.leave();
  });

  it('si se cae la conexión a media partida, vuelve a su asiento', async () => {
    const ana = await conectar(crear('Ana'));
    const beto = await conectar(unirse(ana.room.roomId, 'Beto'));
    beto.room.reconnection.enabled = false;
    await ana.esperar(esSala((s) => s.asientos.length === 2));
    ana.room.send('empezar', { type: 'empezar', compus: 0 });
    await beto.esperar(esEstado());

    // Se corta sin despedirse (como al perder la señal).
    beto.room.connection.close(4999, 'se cayó');
    await ana.esperar(esSala((s) => s.asientos[1]?.desconectado === true));
    // Vuelve con su token (como al recargar la página): el asiento sigue siendo suyo.
    const token = beto.room.reconnectionToken;
    const beto2 = await conectar((c) => c.reconnect(token));
    const vuelta = await ana.esperar(
      esSala((s) => s.asientos[1]?.desconectado === false && s.asientos[1]?.compu === false),
    );
    expect(vuelta.asientos[1]?.nombre).toBe('Beto');
    expect((await beto2.esperar(esEstado())).view.yo).toBe(1);

    await ana.room.leave();
    await beto2.room.leave();
  });
});
