import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../vitest.setup.ts'],
		// The witch simulations are genuinely slow — several run 4-11 seconds of
		// game time through the engine on a quiet core — and vitest's 5s default
		// leaves the ones near that line passing alone and failing whenever the
		// machine is busy. `pnpm test` runs fifteen packages at once, so on CI they
		// are always busy. Individual `{ timeout: 30_000 }` annotations have been
		// added to these one at a time as each flaked (see #296); this is that same
		// number applied to the suite, so the next slow test doesn't have to fail in
		// CI first to earn one. Tests needing longer still override it locally.
		testTimeout: 30_000
	}
});
