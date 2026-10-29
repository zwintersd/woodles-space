import { expect, test, type Locator, type Page } from '@playwright/test';
import type { StackBehavior, StackItem, WhiteboardDocument } from '../apps/whiteboard/src/lib/model';

const boardId = 'board-columns-test';
const key = `woodles.whiteboard.boards.${boardId}`;
const order = ['card-a', 'slip-long', 'card-b', 'slip-short'];
const browserErrors = new WeakMap<Page, string[]>();

function fixture(behavior: StackBehavior = 'plain'): WhiteboardDocument {
	const stamp = new Date().toISOString();
	const base = { x: 900, y: 1000, width: 250, height: 130, createdAt: stamp, updatedAt: stamp, stackId: 'stack', freePosition: { x: 900, y: 1000 } };
	return {
		board: { id: boardId, title: 'A little room for ideas' }, camera: { x: 65, y: 75, zoom: 0.8 },
		home: null, viewpoints: [], journey: { stops: [], loop: false }, labels: [],
		surface: { pattern: 'dots', size: 'regular', depth: 'normal', paper: 'paper' }, updatedAt: stamp,
		items: [
			{ ...base, id: 'stack', type: 'stack', x: 90, y: 130, width: 480, height: 180, zIndex: 1, title: 'Things to explore', behavior, cardIds: [...order] },
			{ ...base, id: 'card-a', type: 'card', zIndex: 2, title: 'Keep the whole thought', body: 'The card body stays available.', properties: { source: 'https://woodles.space/write?document=source-note' } },
			{ ...base, id: 'slip-long', type: 'slip', zIndex: 3, height: 200, text: 'One small thought\nAnother little thought\nA third possibility\nRoom to wonder\nA longer trail\nStill more to notice\nThe last little line' },
			{ ...base, id: 'card-b', type: 'card', zIndex: 4, title: 'Try this next', body: 'A second complete card.' },
			{ ...base, id: 'slip-short', type: 'slip', zIndex: 5, height: 48, text: 'A tiny reminder' }
		]
	};
}

async function seed(page: Page, behavior: StackBehavior = 'plain', embedded = false) {
	const data = fixture(behavior);
	await page.addInitScript(({ key, data }) => {
		if (localStorage.getItem(key)) return;
		const envelope = (data: unknown, schemaVersion: number) => JSON.stringify({ woodles: 'woodles-persistence', schemaVersion, savedAt: new Date().toISOString(), data });
		localStorage.setItem(key, envelope(data, 8));
		localStorage.setItem('woodles.whiteboard.index.v1', envelope([{ id: data.board.id, title: data.board.title, updatedAt: data.updatedAt, items: data.items.length, frames: 0 }], 1));
		localStorage.setItem('woodles.whiteboard.view.v1', envelope({ restChrome: false, minimapOn: false }, 1));
	}, { key, data });
	await page.goto(`/${embedded ? 'homesuite' : 'whiteboard'}?board=${boardId}`);
	if (embedded) {
		await expect(page.locator('iframe.native-surface')).toBeVisible();
		await expect(page.locator('.surface-veil')).toHaveCount(0);
	} else await expect(page.locator('[data-context-item="stack"]')).toBeVisible();
}

async function stored(page: Page): Promise<WhiteboardDocument> {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data, key);
}

async function savedStack(page: Page): Promise<StackItem> {
	return (await stored(page)).items.find((item): item is StackItem => item.id === 'stack' && item.type === 'stack')!;
}

async function selectStack(stack: Locator) {
	await stack.click({ position: { x: 5, y: 28 } });
	await expect(stack.getByRole('combobox', { name: 'Stack columns', exact: true })).toBeVisible();
}

async function rowLayout(notes: Locator[], columns: number) {
	await expect.poll(async () => {
		const boxes = await Promise.all(notes.map((note) => note.boundingBox()));
		if (boxes.some((box) => !box)) return false;
		for (let index = 0; index < boxes.length; index++) {
			const box = boxes[index]!;
			const rowStart = Math.floor(index / columns) * columns;
			if (Math.abs(box.y - boxes[rowStart]!.y) > 1) return false;
			if (index % columns && box.x <= boxes[index - 1]!.x + boxes[index - 1]!.width) return false;
			if (rowStart >= columns) {
				const previousBottom = Math.max(...boxes.slice(rowStart - columns, rowStart).map((previous) => previous!.y + previous!.height));
				if (box.y <= previousBottom) return false;
			}
		}
		return true;
	}).toBe(true);
}

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	browserErrors.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page) ?? []).toEqual([]); });

test('Stack columns wrap full Cards and growing Slips without overlapping rows', async ({ page }) => {
	await seed(page);
	const stack = page.locator('[data-context-item="stack"]');
	await selectStack(stack);
	const columns = stack.getByRole('combobox', { name: 'Stack columns', exact: true });
	const notes = order.map((id) => page.locator(`[data-context-item="${id}"]`));
	await expect(columns).toHaveValue('');
	await columns.selectOption('2');
	await expect.poll(async () => (await savedStack(page)).columns).toBe(2);
	await rowLayout(notes, 2);
	await expect(notes[0].getByRole('textbox', { name: 'Card text', exact: true })).toBeVisible();
	await expect(notes[0].getByRole('textbox', { name: 'Card text', exact: true })).toHaveValue('The card body stays available.');
	await expect.poll(async () => {
		const first = (await notes[0].boundingBox())!;
		const slip = (await notes[1].boundingBox())!;
		return slip.height > first.height;
	}).toBe(true);
	await columns.selectOption('3');
	await expect.poll(async () => (await savedStack(page)).columns).toBe(3);
	await rowLayout(notes, 3);
	expect((await savedStack(page)).cardIds).toEqual(order);
	expect((await stored(page)).items.find((item) => item.id === 'card-a')?.properties?.source).toContain('document=source-note');
	await page.screenshot({ path: 'test-results/boards-columns-desktop.png' });
});

test('column changes undo, redo and survive reload, while Auto restores gallery layout', async ({ page }) => {
	await seed(page, 'gallery');
	const stack = page.locator('[data-context-item="stack"]');
	const notes = order.map((id) => page.locator(`[data-context-item="${id}"]`));
	await selectStack(stack);
	const columns = stack.getByRole('combobox', { name: 'Stack columns', exact: true });
	await columns.selectOption('2');
	await expect.poll(async () => (await savedStack(page)).columns).toBe(2);
	await rowLayout(notes, 2);
	await page.keyboard.press('Control+z');
	await expect(columns).toHaveValue('');
	await expect.poll(async () => (await savedStack(page)).columns).toBeUndefined();
	await page.keyboard.press('Control+Shift+z');
	await expect.poll(async () => (await savedStack(page)).columns).toBe(2);
	await page.reload();
	await selectStack(stack);
	await expect(columns).toHaveValue('2');
	await rowLayout(notes, 2);
	await columns.selectOption('');
	await expect.poll(async () => (await savedStack(page)).columns).toBeUndefined();
	await rowLayout(notes, 4);
	expect((await savedStack(page)).behavior).toBe('gallery');
	expect((await savedStack(page)).cardIds).toEqual(order);
});

test('column layout respects drag insertion and stays inside a resized Stack on narrow screens', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seed(page, 'checklist');
	const stack = page.locator('[data-context-item="stack"]');
	await selectStack(stack);
	const columns = stack.getByRole('combobox', { name: 'Stack columns', exact: true });
	await columns.selectOption('2');
	const first = (await page.locator('[data-context-item="card-a"]').boundingBox())!;
	const last = (await page.locator('[data-context-item="slip-short"]').boundingBox())!;
	await page.mouse.move(last.x + 3, last.y + 10);
	await page.mouse.down();
	await page.mouse.move(first.x + first.width / 4, first.y + 12, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await savedStack(page)).cardIds).toEqual(['slip-short', 'card-a', 'slip-long', 'card-b']);
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await savedStack(page)).cardIds).toEqual(order);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Fit board in view', exact: true }).click();
	await selectStack(stack);
	await columns.selectOption('3');
	await page.getByRole('button', { name: 'Fit board in view', exact: true }).click();
	await selectStack(stack);
	const handle = stack.getByRole('button', { name: 'Resize stack', exact: true });
	const grip = (await handle.boundingBox())!;
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(grip.x - 300, grip.y, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await savedStack(page)).columns).toBe(3);
	const parent = (await stack.boundingBox())!;
	for (const id of order) {
		const note = (await page.locator(`[data-context-item="${id}"]`).boundingBox())!;
		expect(note.x).toBeGreaterThanOrEqual(parent.x);
		expect(note.x + note.width).toBeLessThanOrEqual(parent.x + parent.width + 1);
	}
	await rowLayout(order.map((id) => page.locator(`[data-context-item="${id}"]`)), 3);
	expect((await stored(page)).items.filter((item) => item.type !== 'stack').every((item) => item.type === 'card' || item.type === 'slip' ? item.stackId === 'stack' : false)).toBe(true);
	await page.screenshot({ path: 'test-results/boards-columns-narrow.png' });
	await columns.selectOption('1');
	const singleGrip = (await handle.boundingBox())!;
	await page.mouse.move(singleGrip.x + singleGrip.width / 2, singleGrip.y + singleGrip.height / 2);
	await page.mouse.down();
	await page.mouse.move(singleGrip.x - 600, singleGrip.y, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await savedStack(page)).width).toBe(180);
	const narrow = (await stack.boundingBox())!;
	const control = (await columns.boundingBox())!;
	expect(control.x).toBeGreaterThanOrEqual(narrow.x);
	expect(control.x + control.width).toBeLessThanOrEqual(narrow.x + narrow.width);
	await expect(stack.locator('.stack-mode')).toBeHidden();
});

test('HomeSuite inspector controls the selected Stack columns through its owning surface', async ({ page }) => {
	await seed(page, 'plain', true);
	const board = page.frameLocator('iframe.native-surface');
	const stack = board.locator('[data-context-item="stack"]');
	await selectStack(stack);
	const inspector = page.getByRole('complementary', { name: 'Inspector', exact: true });
	const columns = inspector.getByRole('combobox', { name: 'Columns', exact: true });
	await expect(columns).toBeVisible();
	await columns.selectOption('2');
	await expect.poll(async () => (await savedStack(page)).columns).toBe(2);
	await rowLayout(order.map((id) => board.locator(`[data-context-item="${id}"]`)), 2);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect.poll(async () => (await savedStack(page)).columns).toBeUndefined();
	await page.getByRole('button', { name: 'Redo', exact: true }).click();
	await expect.poll(async () => (await savedStack(page)).columns).toBe(2);
	await page.reload();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	await selectStack(stack);
	await expect(columns).toHaveValue('2');
	expect((await savedStack(page)).cardIds).toEqual(order);
	expect((await stored(page)).items.find((item) => item.id === 'card-a')?.properties?.source).toContain('document=source-note');
	await page.screenshot({ path: 'test-results/boards-columns-homesuite.png' });
});
