import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Consome o source TS do shared (ESM) — evita interop CJS do dist com rollup.
      '@idle/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true, // ticker do PiP (Fase 4) usa WebSocket sob o mesmo prefixo
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
