import { expect, test } from '@playwright/test';

test('the desktop still starts with every app unpinned', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => localStorage.setItem('woodles-desk', JSON.stringify({ pins: [] })));
	await page.goto('/');

	await expect(page.locator('#w-clock')).toHaveText(/^\d{2}:\d{2}$/);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.locator('body')).toHaveClass(/start-open/);
	expect(errors).toEqual([]);
});

test('the snowflake is honest about changing the theme', async ({ page }) => {
	await page.goto('/');
	const before = await page.locator('html').getAttribute('data-theme');
	await page.getByRole('button', { name: 'Next theme' }).click();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
	await expect(page.getByRole('button', { name: 'Next wallpaper' })).toHaveCount(0);
});

test('a modified click opens an app in a new tab and leaves the desktop be', async ({ page, context }) => {
	await page.goto('/');
	const opened = context.waitForEvent('page');
	await page.locator('.icon[data-id="piano"]').click({ modifiers: ['ControlOrMeta'] });
	const tab = await opened;
	await tab.waitForLoadState();
	expect(new URL(tab.url()).pathname).toBe('/piano');

	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('#launch')).not.toHaveClass(/go/);
	const recents = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles-recents') ?? '[]'));
	expect(recents[0]).toBe('piano');
});

test('closed menus and windows stay out of the tab order', async ({ page }) => {
	await page.goto('/');
	for (const id of ['#start', '#flyout', '#ctx', '#pwin', '#window']) {
		await expect(page.locator(id)).toBeHidden();
	}
});

test('a window takes focus, keeps it, and gives it back', async ({ page }) => {
	await page.goto('/');
	const start = page.getByRole('button', { name: 'Start', exact: true });
	await start.focus();
	await page.keyboard.press('Enter');
	await page.locator('#pers-btn').focus();
	await page.keyboard.press('Enter');

	const personalize = page.getByRole('dialog', { name: 'Personalize' });
	await expect(personalize).toBeVisible();
	await expect(personalize.getByRole('button', { name: 'Close' })).toBeFocused();

	const stops = await personalize.locator('button, input').count();
	for (let i = 0; i < stops + 2; i++) await page.keyboard.press('Tab');
	expect(await personalize.evaluate((win) => win.contains(document.activeElement))).toBe(true);

	await personalize.getByRole('button', { name: 'midnight theme' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');

	// the button that opened it went away with the start menu, so focus lands on Start
	await page.keyboard.press('Escape');
	await expect(personalize).toBeHidden();
	await expect(start).toBeFocused();
});

test('the context menu takes focus and hands it back to the icon', async ({ page }) => {
	await page.goto('/');
	const icon = page.locator('.icon[data-id="hygge"]');
	await icon.focus();
	await icon.click({ button: 'right' });
	await expect(page.getByRole('button', { name: /open hygge/ })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.locator('#ctx')).toBeHidden();
	await expect(icon).toBeFocused();
});

test('a sticky note grows to fit its words instead of scrolling', async ({ page }) => {
	const text = Array.from({ length: 12 }, (_, i) => `line ${i + 1} of a longer note`).join('\n');
	await page.addInitScript((note) => {
		localStorage.setItem(
			'woodles-widgets',
			JSON.stringify([{ id: 'wsticky', type: 'sticky', x: 400, y: 80, data: { text: note } }])
		);
	}, text);
	await page.goto('/');

	const note = page.locator('.dw-sticky textarea');
	await expect(note).toHaveValue(text);
	await expect
		.poll(() => note.evaluate((ta) => ta.scrollHeight - ta.clientHeight))
		.toBeLessThanOrEqual(1);
	expect(await note.evaluate((ta) => ta.clientHeight)).toBeGreaterThan(96);
});

test('desktop icons describe themselves on hover', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.icon[data-id="planner"]')).toHaveAttribute(
		'title',
		'your day in piles, and a bell that asks what is happening now'
	);
});
