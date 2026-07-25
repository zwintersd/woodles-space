import { defineConfig } from 'vitest/config';

// happy-dom, because the sanitizer and the anchor helpers are DOM work — they
// guard on `typeof DOMParser === 'undefined'` for Node, but the behaviour worth
// testing is what they do when a DOM is actually there.
export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts']
	}
});
