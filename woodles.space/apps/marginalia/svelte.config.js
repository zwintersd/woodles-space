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
			base: '/marginalia',
			relative: false
		},
		alias: {
			'@shared': '../../shared',
			'@bestiary': '../bestiary/src/lib'
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				if (!path.startsWith('/marginalia')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
