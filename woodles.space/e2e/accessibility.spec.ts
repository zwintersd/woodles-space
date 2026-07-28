import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const auditRoutes = ['/', '/write', '/ologypedia', '/marginalia/arcade'];

for (const route of auditRoutes) {
	test(`${route} has no serious or critical automated accessibility violations`, async ({ page }) => {
		await page.goto(route);
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag21a']).analyze();
		const violations = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	});
}

test('the landing launcher is operable from the keyboard', async ({ page }) => {
	await page.goto('/');
	const start = page.getByRole('button', { name: 'Start', exact: true });
	await start.focus();
	await expect(start).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('body')).toHaveClass(/start-open/);
	await page.keyboard.press('Escape');
	await expect(page.locator('body')).not.toHaveClass(/start-open/);
});
