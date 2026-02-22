import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        '**/node_modules/**',
        'src/tests/**',
        '**/*.config.*',
        '**/*.d.ts',
        'src/lib/shims/**',
      ],
    },
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
