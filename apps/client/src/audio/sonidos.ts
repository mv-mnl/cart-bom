import type { ConquianView } from '@cartas/conquian';
import { Howl, Howler } from 'howler';
import { usePartida } from '../store';
import { resultado as resultadoDe } from '../vista';

const NOMBRES = [
  'carta',
  'voltear',
  'bajar',
  'botar',
  'pasar',
  'repartir',
  'error',
  'victoria',
  'derrota',
] as const;
export type Sonido = (typeof NOMBRES)[number];

const VOLUMEN: Partial<Record<Sonido, number>> = { pasar: 0.5, carta: 0.7, error: 0.6 };

/** Registro de sonidos: se cargan una sola vez. */
const sonidos = new Map<Sonido, Howl>(
  NOMBRES.map((n) => [
    n,
    new Howl({ src: [`/assets/sounds/${n}.wav`], volume: VOLUMEN[n] ?? 0.9, preload: true }),
  ]),
);

// Los navegadores no dejan sonar nada antes de que la persona interactúe con la página.
let desbloqueado = false;
const desbloquear = () => {
  desbloqueado = true;
  window.removeEventListener('pointerdown', desbloquear);
  window.removeEventListener('keydown', desbloquear);
};
window.addEventListener('pointerdown', desbloquear);
window.addEventListener('keydown', desbloquear);

let callado = false;
/** Hace un cambio de estado sin que suene nada (para el laboratorio de animaciones). */
export function sinSonido(cambio: () => void): void {
  callado = true;
  try {
    cambio();
  } finally {
    callado = false;
  }
}

export function sonar(nombre: Sonido, retrasoMs = 0): void {
  if (!desbloqueado || callado) return;
  const tocar = () => sonidos.get(nombre)?.play();
  if (retrasoMs > 0) setTimeout(tocar, retrasoMs);
  else tocar();
}

/** Qué sonido corresponde a pasar de una vista a la siguiente con la última jugada. */
function sonidosDe(
  antes: ConquianView | null,
  despues: ConquianView | null,
  accion: string | null,
): Sonido[] {
  if (!despues) return [];
  if (!antes) return ['repartir'];
  const lista: Sonido[] = [];
  if (accion === 'botar') lista.push('botar');
  else if (accion === 'tomar' || accion === 'bajar' || accion === 'agregar') lista.push('bajar');
  else if (accion === 'pasarCarta') lista.push('carta');
  else if (accion === 'pasar') lista.push('pasar');

  const resultado = resultadoDe(despues);
  if (resultado && !resultadoDe(antes)) {
    lista.push(
      resultado.type === 'ganador' && resultado.ganadores.includes(despues.yo)
        ? 'victoria'
        : 'derrota',
    );
    return lista;
  }
  // Se volteó una carta nueva del mazo.
  const { fase } = despues;
  if (
    fase.type === 'oferta' &&
    fase.origen === 'mazo' &&
    (antes.fase.type !== 'oferta' || antes.fase.carta.id !== fase.carta.id)
  ) {
    lista.push('voltear');
  }
  return lista;
}

/** Escucha la partida y toca los sonidos. Se llama una vez al iniciar la app. */
export function iniciarSonidos(): void {
  Howler.mute(usePartida.getState().silencio);
  usePartida.subscribe((s, previo) => {
    if (s.silencio !== previo.silencio) Howler.mute(s.silencio);
    if (s.aviso && s.aviso !== previo.aviso) sonar('error');
    if (s.vista !== previo.vista) {
      // Sin jugada es una mesa nueva (se repartió): no se compara con la anterior.
      const jugada = s.vista?.jugada ?? null;
      const antes = jugada && previo.vista ? previo.vista.view : null;
      sonidosDe(antes, s.vista?.view ?? null, jugada?.type ?? null).forEach((n, i) =>
        sonar(n, i * 180),
      );
    }
    // Poner una carta en la zona de armado.
    if (s.armado !== previo.armado && s.vista === previo.vista) sonar('carta');
  });
}
