import { expect, test } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';
import { publishedRoutes } from './support/routes';

test.describe('published routes', () => {
	for (const route of publishedRoutes) {
		test(`${route} loads without browser errors`, async ({ page }) => {
			await expectNoPageErrors(page, async () => {
				const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
				expect(response?.ok(), `${route} returned ${response?.status()}`).toBe(true);
				await expect(page.locator('body')).not.toBeEmpty();
			});
		});
	}
});
