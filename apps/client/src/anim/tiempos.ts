/**
 * Tiempos de las animaciones que también necesita saber la cola de jugadas
 * (para que la computadora no juegue algo que todavía no se ve). Sin dependencias.
 */

/** Separación entre cartas del reparto (s, a velocidad normal; a 0.5 son 0.14 s reales). */
export const PASO_REPARTO = 0.07;
/** El reparto va a la mitad de velocidad para que se aprecie carta por carta. */
export const VELOCIDAD_REPARTO = 0.5;

/** Las cartas del intercambio cruzan la mesa más despacio que una jugada normal. */
export const VELOCIDAD_INTERCAMBIO = 0.6;
/** Cuánto se queda levantada la carta que te pasaron, ya de cara, para que la veas (s). */
export const LUCIR_INTERCAMBIO = 0.35;
/** Lo que tarda la carta del último en elegir en llegar a su lugar (s, a velocidad normal). */
export const TRAMO_PASADA = 0.35;
/** Con todas las cartas en su lugar, la pausa antes de que crucen (s, a velocidad normal). */
export const ESPERA_PASADA = 0.3;
/** Desde que termina el intercambio hasta que las cartas empiezan a cruzar (s, reales). */
export const ANTES_DEL_CRUCE = (TRAMO_PASADA + ESPERA_PASADA) / VELOCIDAD_INTERCAMBIO;
/**
 * Cuánto tarda el intercambio en verse completo (s): la llegada de la última carta y la
 * pausa, y luego viaje, volteo, la pausa para lucirla y el aterrizaje.
 * La primera carta del mazo y la siguiente jugada de la computadora esperan esto.
 */
export const DURACION_INTERCAMBIO = ANTES_DEL_CRUCE + 2.2;
