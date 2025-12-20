// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
	// Static site generation (default) - no SSR
	// TensorFlow.js runs client-side only via client:load directive
	output: 'static',
	integrations: [svelte()],
	vite: {
		plugins: [tailwindcss()],
		define: {
			// TensorFlow.js packages check for Node.js globals during module init
			'global': 'globalThis',
		},
		resolve: {
			alias: {
				// @tensorflow-models/coco-ssd imports node-fetch for its HTTP client
				// In the browser, we redirect to native fetch API
				'node-fetch': path.resolve(__dirname, 'src/lib/shims/node-fetch-browser.ts'),
				// TypeScript path alias support for Vite
				'@': path.resolve(__dirname, 'src'),
			},
		},
		optimizeDeps: {
			include: ['@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgl', '@tensorflow-models/coco-ssd', '@tensorflow-models/mobilenet'],
			esbuildOptions: {
				target: 'esnext',
			},
		},
		build: {
			target: 'esnext',
		},
	},
});
