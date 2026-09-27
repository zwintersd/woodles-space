import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			'@woodles/persistence': fileURLToPath(new URL('../../packages/persistence/src/index.ts', import.meta.url)),
			'@shared': fileURLToPath(new URL('../../shared', import.meta.url))
		}
	},
	test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] }
});
