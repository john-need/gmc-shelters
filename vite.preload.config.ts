import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// Entry point is supplied by electron-forge's Vite plugin via forge.config.ts build[].entry
// Do NOT set build.lib.entry here — the plugin handles it.
export default defineConfig({
  build: {
    target: 'node18',
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
});
