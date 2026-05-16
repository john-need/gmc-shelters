import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// VitePlugin sets Vite root to the project root, so index.html must live there.
// Aliases use absolute paths so they work regardless of root.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
