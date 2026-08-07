import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The balance report (`pnpm balance`) — a readout, not a test. It prints tables
// and asserts almost nothing, so it is deliberately kept out of the default
// `src/**/*.test.ts` glob: it takes ~40s, and a suite that slow stops being run.
//
// Everything it measures is in world.ts and sim.ts, which the real suite covers.
export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.report.ts'],
		setupFiles: ['../../vitest.setup.ts'],
		testTimeout: 120_000
	}
});
