// Genera los efectos de sonido del juego como WAV (mono, 16 bits) sintetizándolos.
// Así no dependemos de archivos de terceros. Uso: pnpm --filter @cartas/client sonidos
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRECUENCIA = 22050;
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'sounds');

// Ruido reproducible (para que el script genere siempre los mismos archivos).
let semilla = 12345;
const ruido = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return (semilla / 0x7fffffff) * 2 - 1;
};

/** Crea un buffer de `segundos` y lo llena sumando lo que devuelva `f(t)`. */
function sintetizar(segundos, f) {
  const n = Math.round(segundos * FRECUENCIA);
  const datos = new Float32Array(n);
  for (let i = 0; i < n; i++) datos[i] = f(i / FRECUENCIA, i);
  return datos;
}

/** Golpe de carta: ruido filtrado con caída rápida. */
function golpe(t, { inicio = 0, caida = 45, brillo = 0.6, volumen = 1 } = {}) {
  if (t < inicio) return 0;
  const dt = t - inicio;
  return ruido() * Math.exp(-dt * caida) * volumen * brillo;
}

/** Tono con armónicos suaves y envolvente. */
function tono(t, frec, { inicio = 0, duracion = 0.3, volumen = 0.5 } = {}) {
  const dt = t - inicio;
  if (dt < 0 || dt > duracion) return 0;
  const ataque = Math.min(1, dt / 0.01);
  const caida = Math.exp(-dt * (3 / duracion));
  const onda =
    Math.sin(2 * Math.PI * frec * dt) +
    0.35 * Math.sin(2 * Math.PI * frec * 2 * dt) +
    0.12 * Math.sin(2 * Math.PI * frec * 3 * dt);
  return onda * ataque * caida * volumen;
}

/** Filtro paso alto simple para quitar el "retumbe" del ruido. */
function pasoAlto(datos, fuerza = 0.85) {
  const out = new Float32Array(datos.length);
  let previoIn = 0;
  let previoOut = 0;
  for (let i = 0; i < datos.length; i++) {
    previoOut = fuerza * (previoOut + datos[i] - previoIn);
    previoIn = datos[i];
    out[i] = previoOut;
  }
  return out;
}

function normalizar(datos, pico = 0.8) {
  const max = datos.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  return datos.map((x) => (x / max) * pico);
}

function wav(datos) {
  const buffer = Buffer.alloc(44 + datos.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + datos.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(FRECUENCIA, 24);
  buffer.writeUInt32LE(FRECUENCIA * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(datos.length * 2, 40);
  datos.forEach((x, i) =>
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2),
  );
  return buffer;
}

const DO = 523.25;
const MI = 659.25;
const SOL = 783.99;
const DO2 = 1046.5;

const SONIDOS = {
  // Tocar o pasar una carta.
  carta: () => pasoAlto(sintetizar(0.09, (t) => golpe(t, { caida: 60 }))),
  // Voltear la carta del mazo: dos roces seguidos.
  voltear: () =>
    pasoAlto(
      sintetizar(
        0.16,
        (t) => golpe(t, { caida: 70, volumen: 0.7 }) + golpe(t, { inicio: 0.06, caida: 55 }),
      ),
    ),
  // Bajar un juego: golpe seco con algo de cuerpo.
  bajar: () =>
    sintetizar(
      0.22,
      (t) => 0.6 * golpe(t, { caida: 50 }) + tono(t, 140, { duracion: 0.18, volumen: 0.7 }),
    ),
  // Botar (pagar): carta deslizada y asentada.
  botar: () =>
    pasoAlto(
      sintetizar(
        0.2,
        (t) => golpe(t, { caida: 25, volumen: 0.5 }) + golpe(t, { inicio: 0.1, caida: 70 }),
      ),
    ),
  // Pasar: un soplido suave.
  pasar: () =>
    pasoAlto(
      sintetizar(0.25, (t) => ruido() * Math.sin(Math.PI * (t / 0.25)) * 0.25),
      0.95,
    ),
  // Repartir: una ráfaga de cartas.
  repartir: () =>
    pasoAlto(
      sintetizar(0.75, (t) => {
        let s = 0;
        for (let k = 0; k < 9; k++) s += golpe(t, { inicio: k * 0.075, caida: 75, volumen: 0.8 });
        return s;
      }),
    ),
  // Algo no se pudo: dos tonos graves y cortos.
  error: () =>
    sintetizar(
      0.26,
      (t) =>
        tono(t, 220, { duracion: 0.1, volumen: 0.5 }) +
        tono(t, 185, { inicio: 0.12, duracion: 0.12, volumen: 0.5 }),
    ),
  // Ganaste: arpegio mayor.
  victoria: () =>
    sintetizar(1.4, (t) =>
      [DO, MI, SOL, DO2].reduce(
        (s, f, i) =>
          s + tono(t, f, { inicio: i * 0.12, duracion: i === 3 ? 1 : 0.4, volumen: 0.45 }),
        0,
      ),
    ),
  // Ganó otro o empate: dos notas que bajan.
  derrota: () =>
    sintetizar(
      0.9,
      (t) =>
        tono(t, 392, { duracion: 0.35, volumen: 0.45 }) +
        tono(t, 311.1, { inicio: 0.28, duracion: 0.6, volumen: 0.45 }),
    ),
};

mkdirSync(SALIDA, { recursive: true });
for (const [nombre, crear] of Object.entries(SONIDOS)) {
  const archivo = join(SALIDA, `${nombre}.wav`);
  writeFileSync(archivo, wav(normalizar(crear())));
  console.log('generado', archivo);
}
