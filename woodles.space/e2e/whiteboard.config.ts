import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '.', testMatch: 'boards-compose.spec.ts', workers: 1,
	use: { baseURL: 'http://127.0.0.1:5199', viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure' },
	webServer: {
		command: 'pnpm --filter whiteboard dev --host 127.0.0.1 --port 5199 --strictPort',
		url: 'http://127.0.0.1:5199/whiteboard', reuseExistingServer: !process.env.CI, timeout: 30000
	}
});
