import { expect, test } from '@playwright/test';

test('Write keeps a letter in the archive and the reader renders it', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles_sync_passphrase', 'integration-pass'));

	// Third-party webfonts can't load in every environment, and a failed one
	// registers as a page error unrelated to this flow.
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
		route.fulfill({ status: 200, body: '' })
	);

	// Echoes is private now: the archive rides /api/sync under Write's own app
	// key, so the letter is pushed there rather than to the public read path.
	// One route for both methods — `push` POSTs to `/api/sync` with no query
	// string while `pull` GETs it with one, so a pattern carrying `?app=write`
	// silently misses the write half and the publish flow waits on a real
	// request that never resolves.
	let pushedBody: Record<string, unknown> | null = null;
	await page.route('**/api/sync**', (route) => {
		if (route.request().method() === 'POST') {
			pushedBody = route.request().postDataJSON();
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, version: 1 })
			});
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ blob: null, version: 0 })
		});
	});

	await page.goto('/write');
	await page.getByPlaceholder('untitled letter').fill('A Letter Across Apps');
	const editor = page.locator('[contenteditable="true"]').first();
	await editor.fill('The reader can see what the writer kept.');
	await page.getByRole('button', { name: 'Publish →' }).click();

	await expect(page).toHaveURL(/\/letter$/);
	await expect(page.getByRole('heading', { name: 'A Letter Across Apps' })).toBeVisible();
	await expect(page.getByText('The reader can see what the writer kept.')).toBeVisible();

	// There is no per-letter opt-in any more — keeping a letter is one act.
	expect(pushedBody).toMatchObject({ app: 'write' });
	const body = pushedBody as unknown as { blob: { letters: Array<{ title: string }> } };
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
