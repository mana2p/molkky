import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Molkky/', // GitHub Pages用
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
