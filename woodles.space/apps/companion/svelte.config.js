import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ pages: 'dist', assets: 'dist', fallback: undefined, strict: true }),
		paths: { base: '/companion', relative: false },
		alias: { '@shared': '../../shared', '@extension': './extension' },
		prerender: {
			handleHttpError: ({ path, message }) => {
				if (!path.startsWith('/companion')) return;
				throw new Error(message);
			}
		}
	}
};

export default config;
