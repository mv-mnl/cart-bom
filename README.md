# Cartas SV

Juegos de cartas tradicionales salvadoreños para jugar en el navegador, contra la computadora (y pronto en línea entre amigos). El primer juego es **Conquián**.

## Qué tiene

- **Conquián** de 2 a 4 jugadores contra la computadora, con las reglas de la variante local: intercambio inicial, cartas que se ofrecen en orden, pagar (botar), desmoche y cierre con la carta 10.
- **Baraja española o americana** (♠♥♦♣), con la baraja completa (48 / 52) o la de 40 (sin 8, 9 ni 10).
- **Tres formas de jugar:** solo botones, solo arrastrando las cartas, o mixto. Con zona de armado para formar juegos arrastrando.
- **Ayudas** que sugieren jugadas, y que se pueden apagar.
- **Animaciones** (reparto, volteo, cartas que viajan, celebración con confeti) y **sonido**, con botón para silenciar. Respeta la opción del sistema de reducir el movimiento.
- Funciona en computadora y en celular.

## Requisitos

- Node.js 22.12 o más nuevo
- pnpm 11

## Cómo correrlo

```bash
pnpm install
pnpm dev
```

Y abre <http://localhost:5173>.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta el cliente en modo desarrollo |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm typecheck` | Revisa los tipos de TypeScript en todo el monorepo |
| `pnpm lint` | ESLint |
| `pnpm format` | Formatea con Prettier |
| `pnpm build` | Compila todo |
| `pnpm --filter @cartas/client sonidos` | Vuelve a generar los efectos de sonido |

Antes de dar por terminado un cambio: `pnpm typecheck && pnpm lint && pnpm test`.

## Estructura

```
packages/
  core/              Baraja, barajeo con semilla, reparto e interfaz común CardGame
  games/conquian/    Reglas de Conquián, validaciones e IA
apps/
  client/            React + PixiJS
    src/table/       La mesa (layout y dibujo con PixiJS)
    src/anim/        Animaciones con GSAP
    src/audio/       Sonido con Howler
    src/ui/          Menú, controles y opciones
    scripts/         Generador de sonidos
```

La lógica de los juegos es TypeScript puro, sin React, PixiJS ni red: cada acción es una función `(estado, acción) => nuevoEstado`. Así la misma lógica sirve para jugar contra la computadora, para las pruebas y, más adelante, para el servidor.

## Tecnologías

TypeScript, pnpm workspaces, React, Vite, PixiJS, GSAP, Howler.js, Zustand y Vitest.

## Lo que sigue

- [ ] Multijugador en línea con Colyseus
- [ ] Docker y despliegue
- [ ] Pantalla de victoria con Rive
- [ ] El juego **Perro**
