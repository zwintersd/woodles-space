import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ pages: 'dist', assets: 'dist', fallback: undefined, strict: true }),
		paths: { base: '/data', relative: false },
		alias: { '@shared': '../../shared' },
		prerender: { handleHttpError: ({ path, message }) => { if (path.startsWith('/data')) throw new Error(message); } }
	}
};

export default config;
