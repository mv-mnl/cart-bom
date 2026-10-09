/**
 * Levanta el servidor de Colyseus una vez para todas las pruebas, en un puerto libre.
 * El cliente lo encuentra por `VITE_SERVIDOR`, igual que en producción.
 * La computadora juega casi sin pausa para que las pruebas sean rápidas.
 */
export default async function () {
  process.env.PAUSA_COMPU_MS ??= '20';
  const { crearServidor } = await import('./apps/server/src/servidor');
  const servidor = crearServidor();
  const puerto = 2900 + Math.floor(Math.random() * 1000);
  await servidor.listen(puerto);
  process.env.VITE_SERVIDOR = `ws://localhost:${puerto}`;
  return () => servidor.gracefullyShutdown(false);
}
