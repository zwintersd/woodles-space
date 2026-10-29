import { expect, test, type Locator, type Page } from '@playwright/test';
import type { WhiteboardDocument, WhiteboardItem } from '../apps/whiteboard/src/lib/model';

const boardId = 'board-camera-test';
const key = `woodles.whiteboard.boards.${boardId}`;
const initialCamera = { x: 140, y: 110, zoom: 0.8 };
const browserErrors = new WeakMap<Page, string[]>();
type Kind = WhiteboardItem['type'];

function fixture(kind: Kind): WhiteboardDocument {
	const stamp = new Date().toISOString();
	const base = { id: 'target', x: 80, y: 140, width: 280, height: 180, zIndex: 1, createdAt: stamp, updatedAt: stamp };
	let item: WhiteboardItem;
	switch (kind) {
		case 'card': item = { ...base, type: kind, title: 'Possibilities', body: 'Wonder' }; break;
		case 'slip': item = { ...base, type: kind, height: 48, text: 'Remember' }; break;
		case 'lettering': item = { ...base, type: kind, height: 74, text: 'Wander' }; break;
		case 'frame': item = { ...base, type: kind, title: 'A place', tint: 'peach' }; break;
		case 'stack': item = { ...base, type: kind, title: 'Ideas', cardIds: [] }; break;
		case 'image': item = { ...base, type: kind, name: 'A picture', assetId: 'missing-camera-test-image', aspectRatio: 1.6 }; break;
		case 'portal': item = { ...base, type: kind, title: 'Another board', boardId: 'board-camera-destination' }; break;
		case 'connector': item = { ...base, type: kind, fromId: 'from', toId: 'to', arrow: true }; break;
	}
	const items = kind === 'connector' ? [
		{ ...base, id: 'from', type: 'card' as const, width: 180, height: 130, title: 'From', body: '' },
		{ ...base, id: 'to', type: 'card' as const, x: 500, y: 330, width: 180, height: 130, title: 'To', body: '' },
		item
	] : [item];
	return {
		board: { id: boardId, title: 'Camera test' }, camera: { ...initialCamera }, items,
		home: null, viewpoints: [], journey: { stops: [], loop: false }, labels: [],
		surface: { pattern: 'dots', size: 'regular', depth: 'normal', paper: 'paper' }, updatedAt: stamp
	};
}

async function seed(page: Page, kind: Kind = 'card', amend?: (data: WhiteboardDocument) => void) {
	const data = fixture(kind);
	amend?.(data);
	await page.addInitScript(({ key, data }) => {
		if (localStorage.getItem(key)) return;
		const envelope = (data: unknown, schemaVersion: number) => JSON.stringify({ woodles: 'woodles-persistence', schemaVersion, savedAt: new Date().toISOString(), data });
		localStorage.setItem(key, envelope(data, 8));
		localStorage.setItem('woodles.whiteboard.index.v1', envelope([{ id: data.board.id, title: data.board.title, updatedAt: data.updatedAt, items: data.items.length, frames: 0 }], 1));
		localStorage.setItem('woodles.whiteboard.view.v1', envelope({ restChrome: false, minimapOn: false }, 1));
		const destination = { ...data, board: { id: 'board-camera-destination', title: 'Beyond the portal' }, items: [] };
		localStorage.setItem('woodles.whiteboard.boards.board-camera-destination', envelope(destination, 8));
	}, { key, data });
	await page.goto(`/whiteboard?board=${boardId}`);
	await expect(page.locator('[data-context-item="target"]')).toBeVisible();
}

async function stored(page: Page): Promise<WhiteboardDocument> {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data, key);
}

async function expectCentred(item: Locator) {
	await expect.poll(() => item.evaluate((element) => {
		const object = element.getBoundingClientRect();
		const canvas = element.closest('.whiteboard')!.getBoundingClientRect();
		return Math.hypot(object.x + object.width / 2 - canvas.x - canvas.width / 2, object.y + object.height / 2 - canvas.y - canvas.height / 2);
	})).toBeLessThan(1);
}

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	browserErrors.set(page, errors);
	page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
	expect(browserErrors.get(page) ?? []).toEqual([]);
});

for (const kind of ['card', 'slip', 'lettering', 'frame', 'stack', 'image', 'portal', 'connector'] as const) {
	test(`double left click centres a ${kind} and retains the scale`, async ({ page }) => {
		await seed(page, kind);
		const target = page.locator('[data-context-item="target"]');
		const count = (await stored(page)).items.length;
		await target.dblclick(kind === 'connector' ? {} : { position: { x: 6, y: 28 } });
		await expectCentred(target);
		await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
		await expect.poll(async () => (await stored(page)).camera.x).not.toBe(initialCamera.x);
		expect((await stored(page)).items).toHaveLength(count);
		await expect(page).toHaveURL(new RegExp(`board=${boardId}$`));
		if (kind === 'frame') await expect(page.getByRole('textbox', { name: 'Frame title' })).toHaveCount(0);
	});
}

for (const kind of ['card', 'connector'] as const) {
	test(`double left click centres a locked ${kind === 'card' ? 'rotated card' : 'connector'} without editing it`, async ({ page }) => {
		await seed(page, kind, (data) => {
			const target = data.items.find((item) => item.id === 'target')!;
			target.locked = true;
			if (kind === 'card') target.rotation = 27;
		});
		const target = page.locator('[data-context-item="target"]');
		const original = (await stored(page)).items;
		const box = (await target.boundingBox())!;
		// A locked object deliberately does not receive pointer events; click its
		// actual position to exercise the canvas capture handler through that lock.
		await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
		await expectCentred(target);
		await expect.poll(async () => (await stored(page)).camera.x).not.toBe(initialCamera.x);
		await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
		expect((await stored(page)).items).toEqual(original);
		await expect(target).toHaveClass(/locked/);
		await expect(page).toHaveURL(new RegExp(`board=${boardId}$`));
	});
}

test('centres a slip that inherits its stack lock without unlocking or extracting it', async ({ page }) => {
	await seed(page, 'slip', (data) => {
		const slip = data.items[0];
		if (slip.type !== 'slip') throw new Error('Expected a slip fixture');
		slip.stackId = 'locked-stack';
		slip.x = 1900;
		slip.y = 1700;
		data.items.push({ ...slip, id: 'locked-stack', type: 'stack', x: 80, y: 140, width: 320, height: 300, zIndex: 0, locked: true, title: 'Ideas', cardIds: [slip.id] });
	});
	const target = page.locator('[data-context-item="target"]');
	await expect(target).toHaveClass(/locked/);
	const box = (await target.boundingBox())!;
	await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
	await expectCentred(target);
	await expect.poll(async () => (await stored(page)).camera.x).not.toBe(initialCamera.x);
	await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
	const items = (await stored(page)).items;
	expect(items).toHaveLength(2);
	expect(items).toEqual(expect.arrayContaining([
		expect.objectContaining({ id: 'target', type: 'slip', stackId: 'locked-stack', text: 'Remember', x: 1900, y: 1700 }),
		expect.objectContaining({ id: 'locked-stack', type: 'stack', locked: true, cardIds: ['target'] })
	]));
	await expect(target).toHaveClass(/locked/);
});

test('centres a rotated card', async ({ page }) => {
	await seed(page, 'card', (data) => {
		data.items[0].rotation = 27;
	});
	const target = page.locator('[data-context-item="target"]');
	await target.locator('.card-grip').dblclick();
	await expectCentred(target);
	await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
});

test('centres a card at its rendered position inside a stack', async ({ page }) => {
	await seed(page, 'card', (data) => {
		const card = data.items[0];
		if (card.type !== 'card') throw new Error('Expected a card fixture');
		card.stackId = 'stack';
		card.x = 1900;
		card.y = 1700;
		data.items.push({ ...card, id: 'stack', type: 'stack', x: 80, y: 140, width: 320, height: 300, zIndex: 0, title: 'Ideas', cardIds: [card.id] });
	});
	const target = page.locator('[data-context-item="target"]');
	await target.dblclick({ position: { x: 6, y: 28 } });
	await expectCentred(target);
	await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
	expect((await stored(page)).items).toHaveLength(2);
});

test('double-click keeps text selection and editing in its own field', async ({ page }) => {
	await seed(page);
	const title = page.getByRole('textbox', { name: 'Card title' });
	await title.dblclick({ position: { x: 30, y: 12 } });
	await expect(title).toBeFocused();
	expect(await title.evaluate((element: HTMLInputElement) => element.value.slice(element.selectionStart!, element.selectionEnd!))).toBe('Possibilities');
	await expectCentred(page.locator('[data-context-item="target"]'));
	await page.keyboard.type('Ideas');
	await expect(title).toHaveValue('Ideas');
	await expect(page.getByRole('textbox', { name: 'Card text' })).toHaveValue('Wonder');
	expect((await stored(page)).items).toHaveLength(1);
});

test('centering is saved, survives reload, and can be retraced with camera history', async ({ page }) => {
	await seed(page);
	const target = page.locator('[data-context-item="target"]');
	await target.dblclick({ position: { x: 6, y: 28 } });
	await expectCentred(target);
	await expect(page.getByRole('button', { name: 'Back to the previous view' })).toBeEnabled();
	await page.getByRole('button', { name: 'Back to the previous view' }).click();
	await expect.poll(async () => (await stored(page)).camera).toEqual(initialCamera);
	await page.getByRole('button', { name: 'Forward to the next view' }).click();
	await expectCentred(target);
	await expect.poll(async () => (await stored(page)).camera.x).not.toBe(initialCamera.x);
	await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
	const centred = (await stored(page)).camera;
	await page.reload();
	await expectCentred(target);
	expect((await stored(page)).camera).toEqual(centred);
});

test('controls, non-left clicks, space panning and the line tool retain their gestures', async ({ page }) => {
	await seed(page);
	const target = page.locator('[data-context-item="target"]');
	const world = page.locator('.world');
	const original = await world.getAttribute('style');
	await target.click({ position: { x: 6, y: 28 } });
	await target.getByRole('button', { name: 'Resize card' }).dblclick();
	await expect(world).toHaveAttribute('style', original!);
	// Native browsers emit dblclick for the primary button; exercise the handler's
	// explicit guard too so synthetic right/middle events cannot centre the board.
	await target.dispatchEvent('dblclick', { button: 1 });
	await target.dispatchEvent('dblclick', { button: 2 });
	await expect(world).toHaveAttribute('style', original!);
	const canvas = page.getByRole('main', { name: 'Whiteboard canvas' });
	await canvas.focus();
	await page.keyboard.down('Space');
	await expect(canvas).toHaveClass(/space-panning/);
	await target.dblclick({ position: { x: 6, y: 28 } });
	await page.keyboard.up('Space');
	await expect(world).toHaveAttribute('style', original!);
	await page.getByRole('button', { name: 'Line', exact: true }).click();
	await target.dblclick({ position: { x: 6, y: 28 } });
	await expect(world).toHaveAttribute('style', original!);
	await expect(page.locator('[data-whiteboard-object]')).toHaveCount(1);
});

test('centres a card within a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await seed(page);
	const target = page.locator('[data-context-item="target"]');
	await target.dblclick({ position: { x: 6, y: 28 } });
	await expectCentred(target);
	await expect.poll(async () => (await stored(page)).camera.zoom).toBe(initialCamera.zoom);
	await page.screenshot({ path: 'test-results/boards-camera-narrow.png' });
});

test('centres directly when reduced motion is requested', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await seed(page);
	const target = page.locator('[data-context-item="target"]');
	await target.dblclick({ position: { x: 6, y: 28 } });
	await expectCentred(target);
	const canvas = (await page.getByRole('main', { name: 'Whiteboard canvas' }).boundingBox())!;
	await expect.poll(async () => (await stored(page)).camera).toEqual({ x: canvas.width / 2 - 220 * initialCamera.zoom, y: canvas.height / 2 - 230 * initialCamera.zoom, zoom: initialCamera.zoom });
	await expect(page.getByRole('button', { name: 'Back to the previous view' })).toBeEnabled();
	expect((await stored(page)).items).toHaveLength(1);
});
