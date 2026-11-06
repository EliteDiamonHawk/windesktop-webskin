import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

const sourceRoot = resolve('src');
const publicRoot = resolve('public');

const expandEnvironmentVariables = (value) =>
  value.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`);

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
  if (isProduction()) return resolve(localAppData(), 'WebSkin', 'themes');
  return resolve(process.cwd(), '../localdata');
};

const outputRoot = resolve(runtimeRoot(), 'common');

function sourceFiles(directory = sourceRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function publicFiles(directory = publicRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? publicFiles(path) : [path];
  });
}

function copyStaticFiles() {
  return {
    name: 'copy-common-static-files',
    buildStart() {
      rmSync(outputRoot, { recursive: true, force: true });
      for (const file of sourceFiles()) this.addWatchFile(file);
      for (const file of publicFiles()) this.addWatchFile(file);
    },
    closeBundle() {
      for (const file of publicFiles()) {
        const destination = resolve(outputRoot, relative(publicRoot, file));
        mkdirSync(resolve(destination, '..'), { recursive: true });
        copyFileSync(file, destination);
      }
    },
  };
}

function resolveTypeScriptModules() {
  return {
    name: 'resolve-typescript-modules',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.') || !source.endsWith('.js')) return null;
      const typescriptSource = resolve(dirname(importer), source.replace(/\.js$/, '.ts'));
      return existsSync(typescriptSource) ? typescriptSource : null;
    },
  };
}

const javascriptInputs = Object.fromEntries(
  sourceFiles()
    .filter((file) => extname(file) === '.ts' && !file.endsWith('.d.ts'))
    .map((file) => [relative(sourceRoot, file).replace(/\.ts$/, ''), file]),
);

export default defineConfig({
  configFile: false,
  plugins: [resolveTypeScriptModules(), copyStaticFiles()],
  build: {
    write: true,
    outDir: outputRoot,
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: javascriptInputs,
      output: {
        preserveModules: true,
        preserveModulesRoot: sourceRoot,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
