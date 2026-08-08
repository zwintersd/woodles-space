import { expect, test } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

// `#` and `@` cross three apps: the shelf names what can be referenced, the
// prose stores it, and the mentions ledger carries it back. Each half can be
// right on its own while the three still fail to meet.

const ENTRY_ID = 'entry-piranesi';

test.beforeEach(async ({ page }) => {
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
		route.fulfill({ status: 200, body: '' })
	);
	await page.route('**/api/sync**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				route.request().method() === 'POST' ? { ok: true, version: 1 } : { blob: null, version: 0 }
			)
		})
	);
	await page.addInitScript(() => {
		const seedOnce = (key: string, value: unknown) => {
			if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
		};
		seedOnce('thinking-about.shelf.v1', {
			version: 1,
			publishedAt: '2026-08-09T00:00:00.000Z',
			entries: [
				{
					id: 'entry-piranesi',
					title: 'Piranesi',
					columnKey: 'reading',
					sectionKey: 'book',
					color: '#3f51b5',
					lastSessionDate: null,
					standing: null
				}
			]
		});
		seedOnce('thinking-about.entries.v1', [
			{
				id: 'entry-piranesi',
				columnKey: 'reading',
				sectionKey: 'book',
				title: 'Piranesi',
				color: '#3f51b5',
				dateStarted: '2026-08-01',
				status: 'active',
				dateClosed: null,
				notes: '',
				sharedWith: null,
				schedule: null,
				standing: null,
				sessions: [],
				createdAt: '2026-08-01T09:00:00.000Z',
				updatedAt: '2026-08-01T09:00:00.000Z'
			}
		]);
	});
});

test('typing # reaches the shelf, and the reference survives into the archive', async ({
	page
}) => {
	await expectNoPageErrors(page, async () => {
		await page.goto('/write');
		await page.getByPlaceholder('untitled letter').fill('On Reading');

		const editor = page.locator('[contenteditable="true"]').first();
		await editor.click();
		await editor.pressSequentially('I have been reading #Pir');

		const picker = page.getByTestId('reference-picker');
		await expect(picker).toBeVisible();
		await expect(picker).toContainText('Piranesi');

		await page.keyboard.press('Enter');
		await expect(picker).toBeHidden();

		// The reference is stored with the words as its own text, so the
		// sentence survives even if the link ever goes cold.
		const stored = await editor.innerHTML();
		expect(stored).toContain(`data-ref-id="${ENTRY_ID}"`);
		expect(stored).toContain('>Piranesi</a>');

		await page.getByRole('button', { name: 'Publish →' }).click();
		await expect(page).toHaveURL(/\/letter$/);

		// And the archive kept it, rather than the sanitize eating it on save.
		const archived = await page.evaluate(
			() =>
				(JSON.parse(localStorage.getItem('woodles_letters') || '[]')[0]?.layers?.foreground
					?.html ?? '') as string
		);
		expect(archived).toContain(`data-ref-id="${ENTRY_ID}"`);
		expect(archived).toContain('>Piranesi</a>');
	});
});

test('what was written about travels back to the board', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await page.goto('/write');
		await page.getByPlaceholder('untitled letter').fill('On Reading');
		const editor = page.locator('[contenteditable="true"]').first();
		await editor.click();
		await editor.pressSequentially('reading #Pir');
		await page.keyboard.press('Enter');
		await page.getByRole('button', { name: 'Publish →' }).click();
		await expect(page).toHaveURL(/\/letter$/);

		await page.goto('/thinking-about');
		await page.getByRole('button', { name: /Piranesi/ }).first().click();

		const written = page.getByTestId('mentions');
		await expect(written).toBeVisible();
		await expect(written).toContainText('On Reading');
	});
});

test('a stray sigil in ordinary prose opens nothing', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await page.goto('/write');
		const editor = page.locator('[contenteditable="true"]').first();
		await editor.click();
		// An email address and a "#1" both sit mid-word or match nothing.
		await editor.pressSequentially('write to z@example.com about the #1 priority');
		await expect(page.getByTestId('reference-picker')).toBeHidden();
	});
});
