import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Un solo `.env` en la raíz del monorepo para el cliente y el servidor.
  envDir: '../..',
});
