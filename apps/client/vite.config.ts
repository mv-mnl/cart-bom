import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Un solo `.env` en la raíz del monorepo para el cliente y el servidor.
  envDir: '../..',
  build: {
    // PixiJS sola pesa ~700 kB (205 kB comprimida) y no se puede partir más.
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        // Las librerías grandes en archivos aparte: cambian poco, así el navegador las
        // guarda en caché entre versiones del juego y descarga en paralelo.
        codeSplitting: {
          groups: [
            { name: 'pixi', test: /node_modules[\\/](pixi\.js|@pixi)/, priority: 3 },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 2,
            },
            { name: 'libs', test: /node_modules/, priority: 1 },
          ],
        },
      },
    },
  },
});
