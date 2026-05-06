import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: undefined,
			strict: true
		}),
		paths: {
			base: '/write',
			relative: false
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Cross-app links (anything outside /write) are served by sibling
				// static apps via Vercel rewrites; the prerender crawler can't
				// resolve them, so skip rather than fail the build.
				if (!path.startsWith('/write')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
