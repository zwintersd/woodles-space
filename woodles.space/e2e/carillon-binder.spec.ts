import { expect, test, type Page } from '@playwright/test';

// The composer is a modal over the whole instrument, and the only way into it
// from anywhere in Carillon is the binder strip. Both halves of that — the way
// in and the way back out — are DOM and keyboard behaviour, which is exactly
// what the store's unit tests cannot see.

async function seed(page: Page): Promise<void> {
	// Webfonts are noise here; answered empty rather than aborted, the same way
	// the Thinking About round-trip spec does it.
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
		route.fulfill({ status: 200, body: '' })
	);

	await page.addInitScript(() => {
		const seedOnce = (key: string, value: unknown) => {
			if (localStorage.getItem(key) === null) {
				localStorage.setItem(key, JSON.stringify(value));
			}
		};
		// Carillon's first run is a wizard; these tests are about the binder.
		seedOnce('planner.settings.v1', { onboardingComplete: true });
		seedOnce('planner.tasks.v1', []);
	});
}

/** What is actually stored, not what the form is holding. */
function storedTasks(page: Page): Promise<Array<{ title: string }>> {
	return page.evaluate(() => JSON.parse(localStorage.getItem('planner.tasks.v1') || '[]'));
}

const sheet = (page: Page) => page.locator('.ted-sheet');

test.describe('Carillon binder', () => {
	test('new task sits in the strip with the other tabs', async ({ page }) => {
		await seed(page);
		await page.goto('/planner');

		const strip = page.locator('.binder-tabs');
		const add = page.getByTestId('binder-add-task');

		// Inside the strip, not floating beside it — so it shares the strip's
		// fate on small screens and in print.
		await expect(strip.getByTestId('binder-add-task')).toBeVisible();
		await expect(page.locator('.binder-dock > *')).toHaveCount(1);

		// And it lights up while its module is open, the way an open tab does.
		await expect(add).toHaveAttribute('aria-expanded', 'false');
		await add.click();
		await expect(sheet(page)).toHaveClass(/open/);
		await expect(add).toHaveAttribute('aria-expanded', 'true');
	});

	test('escape leaves the new task module without filing anything', async ({ page }) => {
		await seed(page);
		await page.goto('/planner');

		await page.getByTestId('binder-add-task').click();
		await expect(sheet(page)).toHaveClass(/open/);

		// Half-answered, then abandoned: the way out must not leave a task behind.
		await page.getByLabel('Task title').fill('changed my mind');
		await page.keyboard.press('Escape');

		await expect(sheet(page)).not.toHaveClass(/open/);
		expect(await storedTasks(page)).toEqual([]);

		// The same exit without a keyboard.
		await page.getByTestId('binder-add-task').click();
		await page.getByLabel('Task title').fill('changed my mind again');
		await page.getByTestId('ted-discard').click();

		await expect(sheet(page)).not.toHaveClass(/open/);
		expect(await storedTasks(page)).toEqual([]);
	});

	test('add is still what files a task', async ({ page }) => {
		await seed(page);
		await page.goto('/planner');

		await page.getByTestId('binder-add-task').click();
		await page.getByLabel('Task title').fill('water the plants');
		await page.getByRole('button', { name: 'add', exact: true }).click();

		await expect(sheet(page)).not.toHaveClass(/open/);
		expect((await storedTasks(page)).map((task) => task.title)).toEqual(['water the plants']);
	});

	test('a phone keeps the way into the composer', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 780 });
		await seed(page);
		await page.goto('/planner');

		// The panel tabs are a desk surface and stand down here; new task is the
		// only route to the composer, so it stays — with a tappable way out,
		// there being no Escape key to reach for.
		await expect(page.getByTestId('binder-add-task')).toBeVisible();
		await expect(page.locator('.binder-tab:not(.binder-tab-add)').first()).toBeHidden();

		await page.getByTestId('binder-add-task').click();
		await expect(sheet(page)).toHaveClass(/open/);
		await expect(page.getByTestId('ted-discard')).toBeVisible();
	});
});
