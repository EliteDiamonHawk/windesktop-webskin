import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

const sourceRoot = resolve('src');
const outputRoot = resolve('../localdata/common');

function sourceFiles(directory = sourceRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function copyStaticFiles() {
  return {
    name: 'copy-common-static-files',
    buildStart() {
      for (const file of sourceFiles()) this.addWatchFile(file);
    },
    closeBundle() {
      for (const file of sourceFiles()) {
        const destination = resolve(outputRoot, relative(sourceRoot, file));
        mkdirSync(resolve(destination, '..'), { recursive: true });
        copyFileSync(file, destination);
      }
    },
  };
}

const javascriptInputs = Object.fromEntries(
  sourceFiles()
    .filter((file) => extname(file) === '.js')
    .map((file) => [relative(sourceRoot, file).replace(/\.js$/, ''), file]),
);

export default defineConfig({
  configFile: false,
  plugins: [copyStaticFiles()],
  build: {
    write: false,
    outDir: outputRoot,
    emptyOutDir: true,
    rollupOptions: {
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
