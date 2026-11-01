import { test, expect, type Page } from '@playwright/test';

/** A fresh board; `view` is merged over the default view preferences. */
async function openBoard(page: Page, view: Record<string, unknown> = {}) {
	await page.addInitScript((view) => {
		if (localStorage.getItem('placement-test-seeded')) return;
		localStorage.setItem('placement-test-seeded', '1');
		localStorage.setItem('woodles.whiteboard.view.v1', JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: new Date().toISOString(), data: { restChrome: false, minimapOn: false, ...view } }));
	}, view);
	await page.setViewportSize({ width: 1100, height: 700 });
	await page.goto('/whiteboard');
	await expect(page.getByRole('button', { name: 'Add slip' })).toBeVisible();
}

async function boxes(page: Page) {
	return page.locator('.board-item').evaluateAll((elements) => elements.map((element) => {
		const rect = element.getBoundingClientRect();
		return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
	}));
}

async function addSlips(page: Page, count: number) {
	for (let index = 0; index < count; index++) {
		await page.getByRole('button', { name: 'Add slip' }).click();
		await expect(page.locator('.board-item')).toHaveCount(index + 1);
		await page.keyboard.press('Escape');
	}
}

test('slips added in a row stack under one another with a small gap', async ({ page }) => {
	await openBoard(page);
	await addSlips(page, 3);
	const [first, second, third] = await boxes(page);
	expect(second.x).toBe(first.x);
	expect(third.x).toBe(first.x);
	expect(second.y - (first.y + first.height)).toBe(10);
	expect(third.y - (second.y + second.height)).toBe(10);
});

test('a slip added after the first was moved goes back to the middle, not under it', async ({ page }) => {
	await openBoard(page);
	await addSlips(page, 1);
	const [first] = await boxes(page);
	await page.mouse.move(first.x + first.width / 2, first.y + 4);
	await page.mouse.down();
	await page.mouse.move(first.x + first.width / 2 + 160, first.y + 80, { steps: 6 });
	await page.mouse.up();
	await page.getByRole('button', { name: 'Add slip' }).click();
	const after = await boxes(page);
	const newest = after[after.length - 1];
	expect(newest.x).toBe(first.x);
	expect(newest.y).toBe(first.y);
});

test('a long run fills the screen, then starts a new column to the right', async ({ page }) => {
	await openBoard(page);
	await addSlips(page, 9);
	const all = await boxes(page);
	const columns = [...new Set(all.map((box) => box.x))];
	expect(columns.length).toBeGreaterThan(1);
	expect(Math.max(...all.map((box) => box.y + box.height))).toBeLessThan(700 - 80);
});

test('flowing across then down, with the roomy gap', async ({ page }) => {
	await openBoard(page, { place: 'flow', gap: 'roomy' });
	await addSlips(page, 4);
	const [a, b, c, d] = await boxes(page);
	expect(b.y).toBe(a.y);
	expect(b.x - (a.x + a.width)).toBe(24);
	expect(c.y).toBe(a.y);
	expect(d.x).toBe(a.x);
	expect(d.y - (a.y + a.height)).toBe(24);
});

test('middle-of-screen mode leaves new things where they always landed', async ({ page }) => {
	await openBoard(page, { place: 'center' });
	await addSlips(page, 2);
	const [first, second] = await boxes(page);
	expect(second).toEqual(first);
});

test('the placing options live in Board style and are remembered', async ({ page }) => {
	await openBoard(page);
	await page.getByRole('button', { name: 'Board appearance' }).click();
	await page.getByText('Placing new things').click();
	await page.getByLabel('Where new things go').selectOption('flow');
	await page.getByLabel('Grid').selectOption('24');
	await expect(page.locator('.surface-grid')).toHaveCount(1);
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles.whiteboard.view.v1')!).data);
	expect(saved).toMatchObject({ place: 'flow', grid: 24 });
});

test('Tidy up lays a scattered selection into even rows', async ({ page }) => {
	await openBoard(page, { place: 'center' });
	for (const [dx, dy] of [[0, 0], [150, 40], [-70, 140]]) {
		await page.getByRole('button', { name: 'Add slip' }).click();
		await page.keyboard.press('Escape');
		const handle = page.locator('.board-item').last();
		const box = (await handle.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + 4);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + dx, box.y + 4 + dy, { steps: 5 });
		await page.mouse.up();
	}
	await page.mouse.click(40, 320);
	await page.keyboard.press('Control+a');
	await page.getByRole('button', { name: 'Arrange' }).click();
	await page.getByText('Align & space').click();
	await page.getByRole('button', { name: 'Tidy up' }).click();
	const tidy = await boxes(page);
	expect(new Set(tidy.map((box) => box.x)).size).toBe(1);
	const ordered = [...tidy].sort((a, b) => a.y - b.y);
	expect(ordered[1].y - (ordered[0].y + ordered[0].height)).toBe(10);
	expect(ordered[2].y - (ordered[1].y + ordered[1].height)).toBe(10);
});
