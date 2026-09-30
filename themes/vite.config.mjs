import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

const themeRoot = resolve('dev');
const outputRoot = resolve('../localdata/themes/dev');

function sourceFiles(directory = themeRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function copyThemeStaticFiles() {
  return {
    name: 'copy-theme-static-files',
    buildStart() {
      for (const file of sourceFiles()) this.addWatchFile(file);
    },
    closeBundle() {
      for (const file of sourceFiles()) {
        const destination = resolve(outputRoot, relative(themeRoot, file));
        mkdirSync(resolve(destination, '..'), { recursive: true });
        copyFileSync(file, destination);
      }
      for (const generatedFile of ['index.js', 'index.css']) {
        rmSync(resolve(outputRoot, generatedFile), { force: true });
      }
    },
  };
}

export default defineConfig({
  root: themeRoot,
  base: '/themes/dev/',
  configFile: false,
  plugins: [copyThemeStaticFiles()],
  build: {
    write: false,
    outDir: outputRoot,
    emptyOutDir: true,
    rollupOptions: {
      external: (source) => source.startsWith('/common/'),
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
