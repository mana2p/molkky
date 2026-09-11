import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});

