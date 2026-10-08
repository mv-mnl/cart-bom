import { conquian } from '@cartas/conquian';
import { createRegistry } from '@cartas/core';

/** Juegos disponibles en el menú. Agregar uno es registrarlo aquí. */
export const juegos = createRegistry();
juegos.register(conquian);
