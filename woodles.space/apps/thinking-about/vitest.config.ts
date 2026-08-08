import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// The Svelte plugin compiles `.svelte.ts` rune modules (commitments.svelte.ts)
	// so importing them under vitest doesn't throw `$state is not defined` —
	// the same reason planner and spores carry their own config.
	plugins: [sveltekit()],
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts']
	}
});
