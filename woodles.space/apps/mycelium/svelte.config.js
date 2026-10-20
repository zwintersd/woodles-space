import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ pages: 'dist', assets: 'dist', strict: true }),
    paths: { base: '/mycelium', relative: false },
    alias: { '@shared': '../../shared' },
    prerender: {
      handleHttpError: ({ path, message }) => {
        if (path.startsWith('/mycelium')) throw new Error(message);
      }
    }
  }
};
