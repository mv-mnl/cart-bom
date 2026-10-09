import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta: cliente y servidor de verdad en un navegador.
 * Usan puertos propios para no chocar con un `pnpm dev` que esté abierto.
 */
const PUERTO_SERVIDOR = 2577;
const PUERTO_CLIENTE = 5180;
/**
 * Con `E2E_URL` se prueba un despliegue ya levantado (por ejemplo, Docker en :8080): no se
 * arranca nada y solo corren las pruebas que usan la interfaz, sin el store de desarrollo.
 */
const externo = process.env.E2E_URL;

export default defineConfig({
  testDir: 'e2e',
  ...(externo ? { testMatch: 'produccion.spec.ts' } : {}),
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: externo ?? `http://localhost:${PUERTO_CLIENTE}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: externo
    ? []
    : [
        {
          command: 'pnpm --filter @cartas/server start',
          url: `http://localhost:${PUERTO_SERVIDOR}/health`,
          env: { PORT: String(PUERTO_SERVIDOR), PAUSA_COMPU_MS: '150' },
          reuseExistingServer: false,
        },
        {
          command: `pnpm --filter @cartas/client exec vite --port ${PUERTO_CLIENTE} --strictPort`,
          url: `http://localhost:${PUERTO_CLIENTE}`,
          env: { VITE_SERVIDOR: `ws://localhost:${PUERTO_SERVIDOR}` },
          reuseExistingServer: false,
        },
      ],
});
