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

const landingThemes = [
	'cream', 'dawn', 'dusk', 'terracotta', 'midnight', 'forest', 'paper', 'inkwell',
	'typewriter', 'blossom', 'sugar', 'fog', 'glacier', 'signal', 'amber'
];

for (const theme of landingThemes) {
	test(`the ${theme} Desktop look is readable, with Personalize open`, async ({ page }) => {
		await page.addInitScript((id) => localStorage.setItem('woodles-theme', id), theme);
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		await page.getByRole('button', { name: 'Start', exact: true }).click();
		await page.locator('#pers-btn').click();
		await expect(page.getByRole('dialog', { name: 'Personalize' })).toHaveCSS('opacity', '1');
		// the icons arrive one after another; audit the desk once the last has landed
		await expect(page.locator('.icons .icon').last()).toHaveCSS('opacity', '1');
		// axe can't see through backdrop-filter, so glass and glow are measured
		// against the pane's own surface; paper and flat are exact
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
		const violations = results.violations.filter(
			(violation) => violation.impact === 'serious' || violation.impact === 'critical'
		);
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	});
}

test('a desk with one of every widget is readable and labelled', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await page.locator('#pers-btn').click();
	await page.locator('#p-widgets').click();
	const picker = page.getByRole('dialog', { name: 'Widgets' });
	const items = picker.locator('#wtype-list button:not([disabled])');
	const count = await items.count();
	for (let i = 0; i < count; i++) await items.nth(i).click();
	await picker.getByRole('button', { name: 'Close' }).click();
	await expect(page.locator('body > .dwidget')).toHaveCount(count);
	await expect(page.locator('body > .dwidget').last()).toHaveCSS('opacity', '1');
	await expect(page.locator('#wwin')).toHaveCSS('opacity', '0');
	await expect(page.locator('.icons .icon').last()).toHaveCSS('opacity', '1');
	const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
	const violations = results.violations.filter(
		(violation) => violation.impact === 'serious' || violation.impact === 'critical'
	);
	expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
