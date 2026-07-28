import { expect, test } from '@playwright/test';
import { fulfillPublicApi, publishedCreature } from './support/fixtures';

test('a gallery card can be shared, adopted, and consumed by Marginalia', async ({ context, page }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.route('**/api/public**', fulfillPublicApi);

	await page.goto('/bestiary');
	await expect(page.getByRole('heading', { name: 'the gallery' })).toBeVisible();
	await page.getByRole('button').filter({ has: page.getByAltText(publishedCreature.name, { exact: true }) }).click();

	await page.getByRole('button', { name: '⎘ copy link' }).click();
	await expect(page.getByRole('button', { name: '✓ copied' })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		`http://127.0.0.1:4173/bestiary?card=${publishedCreature.id}`
	);

	await page.getByRole('button', { name: '＋ adopt this card' }).click();
	await expect(page.getByPlaceholder('name this creature')).toHaveValue(publishedCreature.name);
	await expect(page.getByText('after a card by Z')).toBeVisible();

	await expect
		.poll(() =>
			page.evaluate(async (name) => {
				const db = await new Promise<IDBDatabase>((resolve, reject) => {
					const request = indexedDB.open('bestiary', 1);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				return await new Promise<boolean>((resolve) => {
					const request = db.transaction('kv').objectStore('kv').get('bestiary.creatures.v1');
					request.onsuccess = () => resolve((request.result || []).some((creature: { name: string }) => creature.name === name));
					request.onerror = () => resolve(false);
				});
			}, publishedCreature.name)
		)
		.toBe(true);

	await page.goto('/marginalia/arcade');
	await expect(page.getByRole('combobox', { name: 'choose companion' })).toContainText(publishedCreature.name);
});
