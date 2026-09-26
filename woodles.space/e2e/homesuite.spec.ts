import { expect, test } from '@playwright/test';

test('HomeSuite creates and reopens native documents and boards from one index', async ({ page }) => {
	await page.goto('/');
	await page.locator('a[href="/homesuite"]:visible').first().click();
	await expect(page).toHaveURL(/\/homesuite\/?$/);
	await expect(page.getByRole('heading', { name: /All your things/ })).toBeVisible();

	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Document/ }).click();
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('src', /\/write\?draft=.*homesuite=1/);
	await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(1);

	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Board/ }).click();
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('src', /\/whiteboard\?board=.*homesuite=1/);
	await expect(page.getByRole('button', { name: 'Redo' })).toBeVisible();
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	await expect(page.locator('.artifact-row').first()).toContainText('board');

	await page.reload();
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	await page.getByRole('button', { name: /Commands/ }).click();
	await expect(page.getByRole('dialog', { name: 'HomeSuite commands' })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: /Collections/ }).click();
	await expect(page.getByRole('heading', { name: 'Collections are coming next.' })).toBeVisible();
});

test('native edits and shell commands stay attached to the owning surface', async ({ page }) => {
	await page.goto('/homesuite');
	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Document/ }).click();
	const document = page.frameLocator('iframe.native-surface');
	await document.locator('textarea.doc-title').fill('A HomeSuite note');
	const prose = document.getByRole('textbox', { name: 'foreground content' });
	await prose.click();
	await prose.pressSequentially('A thought kept in Write.');
	await expect(page.locator('.artifact-title')).toHaveText('A HomeSuite note');
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(prose).not.toContainText('A thought kept in Write.');
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(prose).toContainText('A thought kept in Write.');
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row').first()).toContainText('A HomeSuite note');
	await page.locator('.artifact-row').first().click();
	await expect(document.locator('textarea.doc-title')).toHaveValue('A HomeSuite note');
	await expect(document.getByRole('textbox', { name: 'foreground content' })).toContainText('A thought kept in Write.');

	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Board/ }).click();
	const board = page.frameLocator('iframe.native-surface');
	await page.getByRole('button', { name: /Commands/ }).click();
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('button', { name: /Add card/ }).click();
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(0);
});
