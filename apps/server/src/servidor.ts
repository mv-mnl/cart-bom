import { NOMBRE_SALA } from '@cartas/shared';
import {
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
  type Server,
} from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ConquianRoom } from './ConquianRoom';

/** Para el healthcheck de Docker. */
const health = createEndpoint('/health', { method: 'GET' }, async () =>
  Response.json({ ok: true }),
);

/** El servidor con una Room por juego. No escucha todavía: eso lo hace `listen()`. */
export function crearServidor(opciones: { greet?: boolean } = {}): Server {
  return defineServer({
    greet: opciones.greet ?? false,
    transport: new WebSocketTransport(),
    rooms: {
      [NOMBRE_SALA.conquian]: defineRoom(ConquianRoom),
    },
    routes: createRouter({ health }),
  });
}
