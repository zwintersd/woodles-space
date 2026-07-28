import { expect, test } from '@playwright/test';

test('Write publishes an opted-in letter to Echoes and the reader renders it', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles_sync_passphrase', 'integration-pass'));

	let publishedBody: Record<string, unknown> | null = null;
	await page.route('**/api/sync?app=write', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ blob: null, version: 0 })
		})
	);
	await page.route('**/api/public', async (route) => {
		if (route.request().method() === 'POST') {
			publishedBody = route.request().postDataJSON();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, version: 1, publishedAt: '2026-07-22T12:00:00.000Z' })
			});
			return;
		}
		await route.fallback();
	});

	await page.goto('/write');
	await page.getByPlaceholder('untitled letter').fill('A Letter Across Apps');
	const editor = page.locator('[contenteditable="true"]').first();
	await editor.fill('The reader can see what the writer published.');
	await page.getByLabel('public').check();
	await page.getByRole('button', { name: 'Publish →' }).click();

	await expect(page).toHaveURL(/\/letter$/);
	await expect(page.getByRole('heading', { name: 'A Letter Across Apps' })).toBeVisible();
	await expect(page.getByText('The reader can see what the writer published.')).toBeVisible();

	expect(publishedBody).toMatchObject({ app: 'echoes', slug: 'letters' });
	const body = publishedBody as unknown as { blob: { letters: Array<{ title: string }> } };
	expect(body.blob.letters).toEqual([
		expect.objectContaining({ title: 'A Letter Across Apps' })
	]);
});

test('Echoes migrates the legacy letter slot and keeps it after reload', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.removeItem('woodles_letters');
		localStorage.setItem(
			'woodles_published',
			JSON.stringify({
				id: 'legacy-letter',
				title: 'A Migrated Echo',
				theme: 'cream',
				motif: 'none',
				font: 'editorial',
				issue: 1,
				publishedAt: '2026-07-22T12:00:00.000Z',
				layers: { foreground: { html: '<p>Still here after the move.</p>', updatedAt: '2026-07-22T12:00:00.000Z' } },
				annotations: { pocketNotes: [], marginNotes: [] },
				content: '<p>Still here after the move.</p>',
				replyTo: null
			})
		);
	});

	await page.goto('/letter');
	await expect(page.getByRole('heading', { name: 'A Migrated Echo' })).toBeVisible();
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('woodles_letters') || '[]'))).toHaveLength(1);

	await page.reload();
	await expect(page.getByRole('heading', { name: 'A Migrated Echo' })).toBeVisible();
});
