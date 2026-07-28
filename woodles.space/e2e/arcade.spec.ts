import { expect, test } from '@playwright/test';

test('the Marginalia cabinet opens, starts, and visibly changes game state', async ({ page }) => {
	await page.goto('/marginalia/arcade');
	const card = page.locator('[data-game-id="stack-2048"]');
	await expect(card).toBeVisible();
	await card.getByRole('button', { name: 'play →' }).click();

	const game = page.getByRole('region', { name: '2048 game' });
	await expect(game).toBeVisible();
	await game.getByRole('button', { name: 'new game' }).click();
	const turns = game.locator('.score-box').filter({ hasText: 'turns' });
	await expect(turns).toContainText('0');

	for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
		await page.keyboard.press(key);
		if ((await turns.textContent())?.match(/[1-9]/)) break;
	}
	await expect(turns).not.toContainText(/^\s*turns\s*0\s*$/);
});
