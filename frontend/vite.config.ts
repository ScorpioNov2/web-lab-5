/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

// https://analogjs.org/docs/packages/platform/overview
export default defineConfig(() => ({
	build: {
		target: ['es2020'],
	},
	resolve: {
		mainFields: ['module'],
	},
	server: {
		port: 4200,
	},
	plugins: [
		analog({
			// Server-side rendering is on; `npm run build` produces dist/analog (Nitro server + client).
			ssr: true,
			// By default Analog prerenders "/" into a static index.html, and Nitro serves static files
			// BEFORE the middleware: the auth rules would be skipped for that URL. Every page here
			// depends on who is signed in, so nothing is prerendered ([] switches the default off).
			prerender: { routes: [] },
		}),
	],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['src/test-setup.ts'],
		include: ['src/**/*.spec.ts'],
		reporters: ['default'],
	},
}));
