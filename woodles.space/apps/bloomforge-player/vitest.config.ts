import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The store is a `.svelte.ts` module that builds `$state` at import time, so
// the Svelte plugin has to compile it before the store tests can construct one
// — same reason planner and spores carry their own config.
export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../vitest.setup.ts']
	}
});
