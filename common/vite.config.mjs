import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

const sourceRoot = resolve('src');
const publicRoot = resolve('public');
const outputRoot = resolve('../localdata/common');

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
