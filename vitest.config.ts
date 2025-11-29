import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    alias: {
      // Force Vitest to use client-side Svelte
      svelte: 'svelte',
    },
  },
  resolve: {
    conditions: ['browser', 'default'],
  },
});
