import { crearServidor } from './servidor';

const PUERTO = Number(process.env.PORT ?? 2567);

await crearServidor().listen(PUERTO);
console.log(`Servidor de cartas en el puerto ${PUERTO}`);
