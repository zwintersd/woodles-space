import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:${process.env.E2E_PORT || 4173}`;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	webServer: {
		command: 'node e2e/support/site-server.mjs',
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 15_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
