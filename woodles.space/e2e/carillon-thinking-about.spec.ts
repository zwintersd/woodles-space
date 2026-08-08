import { expect, test, type Page } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

// The round trip between the two apps runs over URLs, so it is exactly the
// thing unit tests on either side cannot prove: each app can be right about
// what it builds and what it parses while the two still fail to meet.

const ENTRY_ID = 'entry-piranesi';

const entry = {
	id: ENTRY_ID,
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
	sessions: [],
	createdAt: '2026-08-01T09:00:00.000Z',
	updatedAt: '2026-08-01T09:00:00.000Z'
};

/** Both apps are one origin, so one init script seeds the pair. */
async function seed(page: Page, options: { tasks?: unknown[] } = {}): Promise<void> {
	// Third-party webfonts are noise for a test about navigation between two
	// apps, and failing to fetch one registers as a page error that has nothing
	// to do with the round trip. Answered with an empty 200 rather than
	// aborted — an abort is itself a failed request, and logs the same way —
	// so `expectNoPageErrors` stays pointed at errors these apps caused.
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
		route.fulfill({ status: 200, body: '' })
	);

	// Written only when absent. `addInitScript` runs on every navigation, so
	// seeding unconditionally would reset the board on each reload and hide
	// exactly the persistence these tests are checking.
	await page.addInitScript(
		([entryValue, tasks]) => {
			const seedOnce = (key: string, value: unknown) => {
				if (localStorage.getItem(key) === null) {
					localStorage.setItem(key, JSON.stringify(value));
				}
			};
			seedOnce('thinking-about.entries.v1', [entryValue]);
			// Carillon's first run is a six-step wizard; these tests are about the
			// link between the apps, not about setup.
			seedOnce('planner.settings.v1', { onboardingComplete: true });
			seedOnce('planner.tasks.v1', tasks);
		},
		[entry, options.tasks ?? []] as const
	);
}

test.describe('Carillon ↔ Thinking About', () => {
	test('an entry can be taken from the board to the day and back', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await seed(page);

			// Opening the entry is what publishes the shelf — the ledger is derived
			// on save, so a board that has never been touched has nothing to offer.
			await page.goto('/thinking-about');
			await page.getByRole('button', { name: /Piranesi/ }).first().click();

			await page.getByTestId('find-time').click();

			// Landed in Carillon, holding the reference.
			await expect(page).toHaveURL(/\/planner/);
			await expect(page.getByTestId('shelf-arrival')).toBeVisible();
			await expect(page.getByText('Nothing scheduled for this yet.')).toBeVisible();

			// The reference is taken out of the address bar once it is handled.
			expect(new URL(page.url()).searchParams.get('thinking-about-entry')).toBeNull();

			await page.getByRole('button', { name: 'find it a time' }).click();

			// The composer opens pre-filled and already linked.
			await expect(page.getByTestId('task-editor')).toBeVisible();
			await expect(page.getByLabel('Task title')).toHaveValue('Piranesi');
			const link = page.getByTestId('shelf-link');
			await expect(link).toContainText('Piranesi');

			// And the link points back at the entry it came from.
			await expect(link.getByRole('link')).toHaveAttribute(
				'href',
				`/thinking-about?entry=${ENTRY_ID}`
			);
		});
	});

	test('arriving with something already scheduled shows it rather than a blank form', async ({
		page
	}) => {
		await expectNoPageErrors(page, async () => {
			await seed(page, {
				tasks: [
					{
						id: 'task-1',
						title: 'read a chapter',
						status: 'open',
						targetDate: '2026-08-13',
						thinkingAboutEntryId: ENTRY_ID,
						createdAt: '2026-08-09T09:00:00.000Z',
						updatedAt: '2026-08-09T09:00:00.000Z'
					}
				]
			});

			await page.goto(`/planner?thinking-about-entry=${ENTRY_ID}`);

			const arrival = page.getByTestId('shelf-arrival');
			await expect(arrival).toBeVisible();
			await expect(arrival).toContainText("It's already on the plan.");
			await expect(arrival).toContainText('read a chapter');
			await expect(arrival).toContainText('2026-08-13');

			// Composing is offered, not assumed. The sheet element is always in the
			// DOM (its layers are hidden by CSS, never unmounted), so the honest
			// check is that its fields aren't there to type into.
			await expect(page.getByLabel('Task title')).toBeHidden();
			await expect(page.getByRole('button', { name: 'add another time' })).toBeVisible();
		});
	});

	test('a link back into Thinking About opens that entry', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await seed(page);

			await page.goto(`/thinking-about?entry=${ENTRY_ID}`);

			await expect(page.getByLabel('title')).toHaveValue('Piranesi');
			expect(new URL(page.url()).searchParams.get('entry')).toBeNull();
		});
	});

	test('what Carillon scheduled comes back to the board', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await seed(page);

			// Go the way a person would: from the board, which is also what
			// publishes the shelf Carillon needs to name the thing.
			await page.goto('/thinking-about');
			await page.getByRole('button', { name: /Piranesi/ }).first().click();
			await page.getByTestId('find-time').click();

			await page.getByRole('button', { name: 'find it a time' }).click();
			await page.getByLabel('when').fill('2026-08-13');
			await page.getByRole('button', { name: 'add', exact: true }).click();

			// And the board knows about it, without Thinking About being told
			// anything about blocks, domains, or day piles.
			await page.goto('/thinking-about');
			await page.getByRole('button', { name: /Piranesi/ }).first().click();

			const scheduled = page.getByTestId('commitments');
			await expect(scheduled).toBeVisible();
			await expect(scheduled).toContainText('2026-08-13');
			await expect(scheduled).toContainText('Piranesi');
			await expect(page.getByTestId('find-time')).toContainText('find another time');
		});
	});

	test('a sitting accepted in Carillon lands on the board, dated the day it happened', async ({
		page
	}) => {
		await expectNoPageErrors(page, async () => {
			await seed(page);

			// What Carillon writes when someone accepts the offer. Seeded rather
			// than driven through the observation UI, because the risk this test
			// exists for is the boundary — that Thinking About reads the key
			// Carillon writes, in the shape it writes — not the clock.
			await page.addInitScript(() => {
				if (localStorage.getItem('planner.sessions.v1') !== null) return;
				localStorage.setItem(
					'planner.sessions.v1',
					JSON.stringify({
						version: 1,
						publishedAt: '2026-08-09T00:00:00.000Z',
						// Deliberately not today: a session logged in Thinking About
						// always means now, so a backdated one is the whole point.
						sittings: [
							{
								id: 'session-entry-piranesi-2026-08-02',
								entryId: 'entry-piranesi',
								date: '2026-08-02'
							}
						]
					})
				);
			});

			await page.goto('/thinking-about');
			await page.getByRole('button', { name: /Piranesi/ }).first().click();

			await expect(page.getByLabel('session date')).toHaveValue('2026-08-02');

			// And a reload does not log it twice.
			await page.reload();
			await page.getByRole('button', { name: /Piranesi/ }).first().click();
			await expect(page.getByLabel('session date')).toHaveCount(1);
		});
	});

	test('a reference to something no longer on the shelf still shows the plan', async ({
		page
	}) => {
		await expectNoPageErrors(page, async () => {
			// No Thinking About entry at all — archived, deleted, or simply not
			// synced to this device. The link goes cold; the task survives it.
			await seed(page, {
				tasks: [
					{
						id: 'task-1',
						title: 'read a chapter',
						status: 'open',
						targetDate: '2026-08-13',
						thinkingAboutEntryId: 'long-gone',
						createdAt: '2026-08-09T09:00:00.000Z',
						updatedAt: '2026-08-09T09:00:00.000Z'
					}
				]
			});

			await page.goto('/planner?thinking-about-entry=long-gone');

			const arrival = page.getByTestId('shelf-arrival');
			await expect(arrival).toBeVisible();
			await expect(arrival).toContainText('read a chapter');
			await expect(arrival).toContainText("isn't on the shelf any more");
		});
	});
});
