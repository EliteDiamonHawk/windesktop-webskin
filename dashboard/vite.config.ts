import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:8000';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        root: resolve(process.cwd(), 'index.html'),
        dashboard: resolve(process.cwd(), 'dashboard/index.html'),
      },
    },
  },
  server: {
    port: 4321,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
      '/common': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/themes': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
