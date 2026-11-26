import { expect, test } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

test.describe('piano groove mode', () => {
	test('wakes on a key, plays every letter, and cycles palettes without errors', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await page.goto('/piano/groove');
			await expect(page.locator('#wake')).not.toHaveClass(/gone/);

			await page.keyboard.press('q');
			await expect(page.locator('#wake')).toHaveClass(/gone/);
			expect(await page.evaluate(() => (window as any).Tone.getTransport().state)).toBe('started');

			for (const letter of 'abcdefghijklmnopqrstuvwxyz') await page.keyboard.press(letter);
			for (let i = 0; i < 6; i++) await page.keyboard.press('Space');
		});
	});

	test('toggles between instant and 16th-note quantize', async ({ page }) => {
		await page.goto('/piano/groove');
		const instant = page.locator('#mode-instant');
		const quantize = page.locator('#mode-quantize');
		await expect(instant).toHaveAttribute('aria-pressed', 'true');
		await quantize.click();
		await expect(quantize).toHaveAttribute('aria-pressed', 'true');
		await expect(instant).toHaveAttribute('aria-pressed', 'false');
	});

	test('piano links to groove mode and back', async ({ page }) => {
		await page.goto('/piano');
		await page.getByRole('link', { name: /groove mode/ }).click();
		await expect(page).toHaveURL(/\/piano\/groove$/);
		await page.getByRole('link', { name: /piano/ }).click();
		await expect(page).toHaveURL(/\/piano$/);
	});
});
