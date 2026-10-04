import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const auditRoutes = [
	'/',
	'/homesuite',
	'/write',
	'/letter',
	'/marginalia/arcade',
	'/hygge/motion',
	'/hygge/motion/svg',
	'/companion'
];

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

test('Field Notes has readable, accessible content at desktop and phone widths', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles-landing-scene-v1', 'field-notes'));
	for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
		await page.setViewportSize(viewport);
		await page.goto('/');
		await expect(page.locator('#field-notes-home')).toBeVisible();
		const results = await new AxeBuilder({ page }).analyze();
		const violations = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	}
});

test('the scene chooser stays readable over a dark Field Notes palette', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('woodles-theme', 'amber');
		localStorage.setItem('woodles-landing-scene-v1', 'field-notes');
	});
	await page.goto('/');
	await page.locator('#fn-personalize').click();
	const chooser = page.getByRole('dialog', { name: 'Personalize' });
	await expect(chooser).toHaveCSS('opacity', '1');
	const results = await new AxeBuilder({ page }).include('#pwin').analyze();
	const violations = results.violations.filter(
		(violation) => violation.impact === 'serious' || violation.impact === 'critical'
	);
	expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
