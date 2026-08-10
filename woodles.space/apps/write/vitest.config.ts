import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			// Mirrors svelte.config.js's kit.alias, which only reaches the
			// SvelteKit build/dev pipeline — a test importing from @shared
			// needs its own copy of the same mapping.
			'@shared': fileURLToPath(new URL('../../shared', import.meta.url))
		}
	},
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../vitest.setup.ts']
	}
});
