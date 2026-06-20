import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import path from 'path';

// Entry point is supplied by electron-forge's Vite plugin via forge.config.ts build[].entry
// Do NOT set build.lib.entry here — the plugin handles it.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    target: 'node18',
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'electron-log',
        'sharp',
        'exiftool-vendored',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
});
