import { expect, test, type Page } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

// Something the companion handed over, arriving on the board. The unit suites
// prove each half; this proves they meet in a browser: the held deep link
// (the page's mount runs before the take that creates the entry), the live
// take from another tab, and a deleted arrival staying deleted.

const QUEUE_KEY = 'woodles.handoff.thinking-about.v1';
const ENTRY_ID = 'c-e2e-1';

const arrival = {
	id: ENTRY_ID,
	target: 'thinking-about',
	title: 'A good essay',
	body: 'why I kept it',
	format: 'text',
	tags: [],
	source: { app: 'companion', label: 'A good essay', href: 'https://example.com/essay' },
	createdAt: '2026-10-04T12:00:00.000Z'
};

/** The queue as `@woodles/persistence` writes it. */
function queue(items: unknown[]) {
	return { woodles: 'woodles-persistence', schemaVersion: 1, savedAt: '2026-10-04T12:00:00.000Z', data: { items } };
}

async function quietFonts(page: Page): Promise<void> {
	// Third-party webfonts are noise here; an empty 200 keeps a failed fetch
	// from reading as an error this feature caused.
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
}

/** Seeded once — `addInitScript` runs on every navigation, and a drained queue must stay drained. */
async function seedQueueOnce(page: Page): Promise<void> {
	await page.addInitScript(
		([key, value]) => {
			if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
		},
		[QUEUE_KEY, queue([arrival])] as const
	);
}

function chips(page: Page) {
	return page.locator('.chip-title', { hasText: 'A good essay' });
}

async function waiting(page: Page): Promise<number> {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.data.items.length ?? 0, QUEUE_KEY);
}

test.describe('companion → Thinking About', () => {
	test('“open it” lands on the arrival, which is filed once', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await quietFonts(page);
			await seedQueueOnce(page);

			await page.goto(`/thinking-about?entry=${ENTRY_ID}`);

			const detail = page.getByRole('dialog');
			await expect(detail.getByLabel('title')).toHaveValue('A good essay');
			await expect(detail.getByText('Reading · Articles')).toBeVisible();
			await expect(detail.getByLabel('notes')).toHaveValue('why I kept it\n\nhttps://example.com/essay');
			await expect(page.getByRole('status').filter({ hasText: 'handed over' })).toHaveText(
				/1 handed over from elsewhere, in Reading · Articles\./
			);
			expect(new URL(page.url()).searchParams.get('entry')).toBeNull();

			await page.reload();
			await expect(chips(page)).toHaveCount(1);
			expect(await waiting(page)).toBe(0);
			await expect(page.getByRole('status').filter({ hasText: 'handed over' })).toHaveCount(0);
		});
	});

	test('an open board takes an arrival from another tab without a reload', async ({ page, context }) => {
		await expectNoPageErrors(page, async () => {
			await quietFonts(page);
			await page.goto('/thinking-about');
			await expect(chips(page)).toHaveCount(0);

			// The companion's frame writes the queue from another document; the
			// board hears it as a storage event.
			const other = await context.newPage();
			await quietFonts(other);
			await other.goto('/thinking-about');
			await other.evaluate(
				([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
				[QUEUE_KEY, queue([{ ...arrival, id: 'c-e2e-live' }])] as const
			);
			await other.close();

			await expect(chips(page)).toHaveCount(1);
			await expect(page.getByRole('status').filter({ hasText: 'handed over' })).toBeVisible();
			await page.getByRole('button', { name: 'dismiss' }).click();
			await expect(page.getByRole('status').filter({ hasText: 'handed over' })).toHaveCount(0);
		});
	});

	test('a deleted arrival stays deleted when the same thing comes back', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await quietFonts(page);
			await seedQueueOnce(page);
			await page.goto('/thinking-about');
			await expect(chips(page)).toHaveCount(1);

			await chips(page).click();
			const detail = page.getByRole('dialog');
			await detail.getByRole('button', { name: 'delete' }).click();
			await detail.getByRole('button', { name: 'delete' }).click();
			await expect(chips(page)).toHaveCount(0);

			// A redelivered capture, or the queue restored from its backup.
			await page.evaluate(
				([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
				[QUEUE_KEY, queue([arrival])] as const
			);
			await page.reload();
			await expect(page.getByRole('heading', { name: 'Thinking About' })).toBeVisible();
			await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.data.items.length === 0, QUEUE_KEY);
			await expect(chips(page)).toHaveCount(0);
		});
	});
});
