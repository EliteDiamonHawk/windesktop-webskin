import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:8000';

const expandEnvironmentVariables = (value: string) =>
  value.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? `%${name}%`);

const isProduction = () => {
  const environment = (process.env.WEBSKIN_ENV ?? 'development').toLowerCase();
  const flag = (process.env.WEBSKIN_PRODUCTION ?? '').toLowerCase();
  return ['production', 'prod', 'release'].includes(environment)
    || ['1', 'true', 'yes'].includes(flag);
};

const localAppData = () => process.env.LOCALAPPDATA
  ?? resolve(process.env.USERPROFILE ?? homedir(), 'AppData', 'Local');

const runtimeRoot = () => {
  const explicitRoot = process.env.WEBSKIN_THEMES_ROOT;
  if (explicitRoot?.trim()) return resolve(expandEnvironmentVariables(explicitRoot));
  if (isProduction()) return resolve(localAppData(), 'WinDesktop WebSkin', 'themes');
  return resolve(process.cwd(), '../localdata');
};

export default defineConfig({
  build: {
    outDir: resolve(runtimeRoot(), 'dashboard'),
    emptyOutDir: true,
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
