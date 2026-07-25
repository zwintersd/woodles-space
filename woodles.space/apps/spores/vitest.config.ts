import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The Svelte plugin is required, not optional: garden.svelte.ts builds a
// `$state` store at import time, and without the plugin compiling it vitest
// throws `$state is not defined`. Same sharp edge as planner's — see
// apps/planner/KNOWN_ISSUES.md.
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
