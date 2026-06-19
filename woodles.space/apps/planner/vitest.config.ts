import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// The Svelte plugin compiles `.svelte.ts` rune modules (e.g. store.svelte.ts)
	// so importing them under vitest doesn't throw `$state is not defined`.
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts']
	}
});
