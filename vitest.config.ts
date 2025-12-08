import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

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
      '@': path.resolve(__dirname, './src'),
    },
  },
  resolve: {
    conditions: ['browser', 'default'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
