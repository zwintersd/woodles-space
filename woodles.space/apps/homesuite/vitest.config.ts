import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	// Compiles `.svelte.ts` rune modules (sync.svelte.ts) for the tests that import them.
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'@woodles/persistence': fileURLToPath(new URL('../../packages/persistence/src/index.ts', import.meta.url)),
			'@shared': fileURLToPath(new URL('../../shared', import.meta.url))
		}
	},
	test: { environment: 'happy-dom', include: ['src/**/*.test.ts'], setupFiles: ['../../vitest.setup.ts'] }
});
