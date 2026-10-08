import { VALORES_40, VALORES_52 } from '@cartas/core';
import { createConquian } from '@cartas/conquian';
import { describe, expect, it } from 'vitest';
import { ESCENARIOS } from './escenarios';

const juegos = {
  '52 cartas': createConquian({ cartasPorJugador: 9, baraja: { valores: VALORES_52 } }),
  '40 cartas': createConquian({ cartasPorJugador: 9, baraja: { valores: VALORES_40 } }),
};

describe('escenarios del laboratorio', () => {
  for (const [baraja, juego] of Object.entries(juegos)) {
    for (const jugadores of [2, 3, 4]) {
      for (const e of ESCENARIOS) {
        it(`${e.id} con ${jugadores} jugadores y ${baraja}: se encuentra y sus pasos son válidos`, () => {
          const p = e.preparar(juego, jugadores, 'lab', 0);
          expect(p, e.id).not.toBeNull();
          if (!p) return;
          // apply lanza error si alguna jugada no es válida en su momento.
          let s = p.inicio;
          for (const a of p.pasos) s = juego.apply(s, a);
          if (e.id !== 'repartir') expect(p.pasos.length).toBeGreaterThan(0);
        });
      }
    }
  }
});
