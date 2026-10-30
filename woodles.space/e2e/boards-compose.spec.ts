import { test, expect, type Page } from '@playwright/test';

const boardId = 'board-compose-test';
const key = `woodles.whiteboard.boards.${boardId}`;
const browserErrors = new WeakMap<Page, string[]>();
async function stored(page: Page) {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data, key);
}
test.beforeEach(async ({ page }) => {
	const errors: string[] = []; browserErrors.set(page, errors); page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(({ key, boardId }) => {
		if (localStorage.getItem(key)) return;
		const stamp = new Date().toISOString();
		const base = { width: 250, height: 150, createdAt: stamp, updatedAt: stamp };
		const data = {
			board: { id: boardId, title: 'The little things' }, camera: { x: 130, y: 130, zoom: 1 },
			home: null, viewpoints: [], journey: { stops: [], loop: false }, labels: [], surface: { pattern: 'dots', size: 'regular', depth: 'normal', paper: 'paper' }, updatedAt: stamp,
			items: [
				{ ...base, id: 'card-a', type: 'card', x: 40, y: 100, zIndex: 1, title: 'A pocket of possibilities', body: 'Keep the small, lovely things.', properties: { source: 'https://woodles.space/write?document=original' } },
				{ ...base, id: 'card-b', type: 'card', x: 390, y: 150, zIndex: 2, title: 'Something to try', body: 'A little room to play.' },
				{ ...base, width: 170, height: 48, id: 'slip-a', type: 'slip', x: 400, y: 380, zIndex: 3, text: 'Save this thought for later' },
				{ ...base, id: 'connection', type: 'connector', x: 0, y: 0, zIndex: 4, fromId: 'card-a', toId: 'card-b', arrow: true }
			]
		};
		localStorage.setItem(key, JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 8, savedAt: stamp, data }));
		localStorage.setItem('woodles.whiteboard.index.v1', JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: stamp, data: [{ id: boardId, title: data.board.title, updatedAt: stamp, items: 3, frames: 0 }] }));
		localStorage.setItem('woodles.whiteboard.view.v1', JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: stamp, data: { restChrome: false, minimapOn: false } }));
	}, { key, boardId });
	await page.goto(`/whiteboard?board=${boardId}`);
	await expect(page.getByRole('textbox', { name: 'Card title' }).first()).toHaveValue('A pocket of possibilities');
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page) ?? []).toEqual([]); });

async function select(page: Page, id: string, additive = false) {
	if (!additive) await page.getByRole('main', { name: 'Whiteboard canvas' }).click({ position: { x: 10, y: 200 } });
	await page.locator(`[data-context-item="${id}"]`).click({ position: { x: 5, y: 60 }, modifiers: additive ? ['Shift'] : [] });
}
async function open(page: Page) {
	await page.getByRole('button', { name: 'Appearance', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Selection appearance' })).toBeVisible();
}

test('preview cancels without saving, Apply makes one undo step and persists', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await select(page, 'card-a'); await open(page);
	await page.getByRole('button', { name: 'Use #edc9cf for fill', exact: true }).click();
	await expect(page.locator('[data-context-item="card-a"]')).toHaveCSS('background-color', 'rgb(237, 201, 207)');
	expect((await stored(page)).items[0].appearance).toBeUndefined();
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Appearance' })).toBeFocused();
	await expect(page.locator('[data-context-item="card-a"]')).not.toHaveCSS('background-color', 'rgb(237, 201, 207)');
	await open(page);
	await page.getByRole('button', { name: 'Use #edc9cf for fill', exact: true }).click();
	await page.getByText('More details', { exact: true }).click();
	await page.getByRole('combobox', { name: 'Outline weight' }).selectOption('4');
	await page.getByRole('combobox', { name: 'Outline style' }).selectOption('dashed');
	await page.getByRole('combobox', { name: 'Corner treatment' }).selectOption('square');
	await page.getByRole('combobox', { name: 'Shadow', exact: true }).selectOption('lifted');
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items[0].appearance?.fill).toBe('#edc9cf');
	await page.keyboard.press('Control+z');
	await expect(page.locator('[data-context-item="card-a"]')).not.toHaveCSS('background-color', 'rgb(237, 201, 207)');
	await page.keyboard.press('Control+Shift+z');
	await expect(page.locator('[data-context-item="card-a"]')).toHaveCSS('background-color', 'rgb(237, 201, 207)');
	await expect.poll(async () => (await stored(page)).items[0].appearance?.outlineStyle).toBe('dashed');
	await page.reload();
	await expect(page.locator('[data-context-item="card-a"]')).toHaveCSS('border-width', '4px');
	expect((await stored(page)).items[0].properties.source).toContain('document=original');
	await expect(page.locator('.connector-path')).toHaveCount(1);
	expect(errors).toEqual([]);
});

test('styles multiple objects, copies looks and keeps saved swatches after reload', async ({ page }) => {
	await select(page, 'card-a'); await select(page, 'card-b', true); await open(page);
	await page.getByRole('button', { name: 'Use #d6e2c9 for fill', exact: true }).click();
	await page.getByRole('button', { name: '+ Save colour', exact: true }).click();
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.slice(0, 2).map((item: any) => item.appearance?.fill)).toEqual(['#d6e2c9', '#d6e2c9']);
	await select(page, 'card-a'); await open(page);
	await page.getByRole('button', { name: 'Copy look', exact: true }).click();
	await page.keyboard.press('Escape');
	await select(page, 'card-b'); await open(page);
	await page.getByRole('button', { name: 'Original', exact: true }).click();
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await open(page);
	await page.getByRole('button', { name: 'Paste look', exact: true }).click();
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items[1].appearance?.fill).toBe('#d6e2c9');
	await page.reload(); await select(page, 'card-a'); await open(page);
	await expect(page.getByRole('button', { name: 'Use saved #d6e2c9 for fill', exact: true })).toBeVisible();
	await page.getByText('More details', { exact: true }).click();
	await page.screenshot({ path: 'test-results/boards-compose-desktop.png' });
});

test('narrow tray stays within the screen, owns scrolling and restores keyboard focus', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Fit board in view' }).click();
	await select(page, 'card-a'); await open(page);
	await page.getByText('More details', { exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Selection appearance' });
	const box = (await dialog.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
	expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(844);
	const transform = await page.locator('.world').getAttribute('style');
	await dialog.hover(); await page.mouse.wheel(0, 400);
	await expect(page.locator('.world')).toHaveAttribute('style', transform!);
	await page.screenshot({ path: 'test-results/boards-compose-narrow.png' });
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Appearance' })).toBeFocused();
});

test('photo mats and outlines preserve the original asset and image edits', async ({ page }) => {
	await page.locator('input[type=file]').setInputFiles({ name: 'test-photo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#cbdfe3"/><circle cx="200" cy="120" r="70" fill="#a66670"/></svg>') });
	const photo = page.getByRole('group', { name: 'Image: test-photo.svg', exact: true });
	await expect(photo).toBeVisible();
	await photo.click({ button: 'right', position: { x: 5, y: 20 } });
	await page.getByRole('menuitem', { name: 'Edit image', exact: true }).click();
	const editor = page.getByRole('dialog', { name: 'Edit image' });
	await editor.getByRole('button', { name: 'ellipse', exact: true }).click();
	await editor.getByRole('spinbutton', { name: 'Rotation degrees' }).fill('90');
	await editor.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.edits?.rotation).toBe(90);
	const original = (await stored(page)).items.find((item: any) => item.type === 'image');
	await open(page);
	await expect(page.getByLabel('Text colour', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Use #edc9cf for fill', exact: true }).click();
	await expect(photo).toHaveCSS('border-color', 'rgb(237, 201, 207)');
	await page.getByText('More details', { exact: true }).click();
	await page.getByLabel('Outline weight', { exact: true }).selectOption('4');
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.appearance?.outlineWidth).toBe(4);
	await page.reload();
	const restored = (await stored(page)).items.find((item: any) => item.type === 'image');
	expect(restored.assetId).toBe(original.assetId); expect(restored.edits).toEqual(original.edits);
	await expect(photo.locator('image')).toHaveAttribute('href', /^blob:/);
	await expect(photo).toHaveCSS('outline-width', '4px');
});

test('HomeSuite exposes appearance in its context menu and opens the tray', async ({ page }) => {
	await page.route('**/compose-shell', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
	await page.goto('/compose-shell');
	await page.evaluate((boardId) => {
		document.body.replaceChildren();
		const iframe = document.createElement('iframe');
		iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
		iframe.src = `/whiteboard?board=${boardId}&homesuite=1`;
		(window as any).__boardMessages = [];
		window.addEventListener('message', (event) => { if (event.data?.channel === 'woodles.homesuite.v1') (window as any).__boardMessages.push(event.data); });
		document.body.append(iframe);
	}, boardId);
	const frame = page.frameLocator('iframe');
	await frame.locator('[data-context-item="card-a"]').click({ button: 'right', position: { x: 5, y: 60 } });
	await expect.poll(async () => page.evaluate(() => (window as any).__boardMessages.some((message: any) => message.type === 'context-menu' && message.target.actions.some((action: any) => action.id === 'appearance')))).toBe(true);
	await page.evaluate(() => {
		const message = (window as any).__boardMessages.findLast((message: any) => message.type === 'context-menu');
		document.querySelector('iframe')!.contentWindow!.postMessage({ channel: 'woodles.homesuite.v1', source: 'shell', type: 'action', action: 'context-command', requestId: message.requestId, commandId: 'appearance' }, window.location.origin);
	});
	await expect(frame.getByRole('dialog', { name: 'Selection appearance' })).toBeVisible();
	await frame.getByRole('button', { name: 'Use #dbd2ed for fill', exact: true }).click();
	await frame.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items[0].appearance?.fill).toBe('#dbd2ed');
});

async function arrange(page: Page) {
	await page.getByRole('button', { name: 'Arrange', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Arrange selection' })).toBeVisible();
}

test('standalone lettering previews typography, grows to its words, searches and survives reload', async ({ page }) => {
	await page.getByRole('button', { name: 'Add lettering', exact: true }).click();
	const text = page.getByRole('textbox', { name: 'Lettering text', exact: true });
	await expect(text).toBeFocused(); await text.fill('Small wonders\nA page of possibilities'); await text.press('Escape');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.text).toContain('Small wonders');
	const original = (await stored(page)).items.find((item: any) => item.type === 'lettering');
	await open(page);
	await page.getByLabel('Lettering font', { exact: true }).selectOption('hand');
	await page.getByLabel('Lettering size', { exact: true }).fill('48');
	await page.getByLabel('Text alignment', { exact: true }).selectOption('center');
	await page.getByLabel('Line spacing', { exact: true }).selectOption('1.6');
	await page.getByLabel('Lettering backing', { exact: true }).selectOption('strip');
	await expect(text).toHaveCSS('font-size', '48px');
	expect((await stored(page)).items.find((item: any) => item.type === 'lettering').height).toBe(original.height);
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.appearance?.fontSize).toBe(48);
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.height).toBeGreaterThan(original.height);
	await page.keyboard.press('Control+z'); await expect(text).toHaveCSS('font-size', '32px');
	await page.keyboard.press('Control+Shift+z'); await expect(text).toHaveCSS('font-size', '48px');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.appearance?.backing).toBe('strip');
	await page.reload(); await expect(text).toHaveValue('Small wonders\nA page of possibilities');
	await expect(text).toHaveCSS('font-size', '48px');
	await page.getByRole('button', { name: 'Find', exact: true }).click();
	await page.getByRole('textbox', { name: 'Find on this board' }).fill('Small wonders');
	await expect(page.locator('.finder-result')).toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(page.locator('.finder')).toHaveCount(0);
	await page.screenshot({ path: 'test-results/boards-compose-lettering.png' });
});

test('groups move together, duplicate with internal connections, lock and recover from Layers', async ({ page }) => {
	await select(page, 'card-a'); await select(page, 'card-b', true); await arrange(page);
	await page.getByRole('button', { name: 'Group', exact: true }).click(); await page.keyboard.press('Escape');
	await expect.poll(async () => (await stored(page)).items[0].groupId).toBeTruthy();
	await select(page, 'card-a');
	await expect(page.locator('.board-item.selected')).toHaveCount(2);
	const box = (await page.locator('[data-context-item="card-a"]').boundingBox())!;
	const oldConnection = await page.locator('.connector-path').getAttribute('d');
	await page.mouse.move(box.x + 5, box.y + 65); await page.mouse.down(); await page.mouse.move(box.x + 50, box.y + 120, { steps: 5 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items.slice(0, 2).map((item: any) => item.x)).toEqual([85, 435]);
	await expect(page.locator('.connector-path')).not.toHaveAttribute('d', oldConnection!);
	await page.keyboard.press('Shift+ArrowRight');
	await expect.poll(async () => (await stored(page)).items.slice(0, 2).map((item: any) => item.x)).toEqual([95, 445]);
	await page.keyboard.press('Control+d');
	await expect.poll(async () => (await stored(page)).items.length).toBe(7);
	await expect(page.locator('.connector-path')).toHaveCount(2);
	const copied = (await stored(page)).items.filter((item: any) => item.type === 'card' && !['card-a', 'card-b'].includes(item.id));
	expect(copied[0].groupId).toBe(copied[1].groupId);
	expect(copied[0].groupId).not.toBe((await stored(page)).items[0].groupId);
	await arrange(page); await page.getByRole('button', { name: 'Lock', exact: true }).click(); await page.keyboard.press('Escape');
	await page.keyboard.press('Delete');
	await expect.poll(async () => (await stored(page)).items.filter((item: any) => copied.some((copy: any) => copy.id === item.id)).every((item: any) => item.locked)).toBe(true);
	expect((await stored(page)).items).toHaveLength(7);
	await page.reload(); await page.getByRole('button', { name: 'Layers', exact: true }).click();
	await page.getByRole('button', { name: 'Unlock A pocket of possibilities', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.filter((item: any) => copied.some((copy: any) => copy.id === item.id)).every((item: any) => !item.locked)).toBe(true);
	await page.screenshot({ path: 'test-results/boards-compose-layers.png' });
});

test('layer order survives selecting a buried object and undo restores the previous order', async ({ page }) => {
	await select(page, 'card-a'); await arrange(page);
	await page.getByRole('button', { name: 'To front', exact: true }).click(); await page.keyboard.press('Escape');
	await expect(page.locator('[data-whiteboard-object]').last()).toHaveAttribute('data-context-item', 'card-a');
	await select(page, 'card-b');
	await expect(page.locator('[data-whiteboard-object]').last()).toHaveAttribute('data-context-item', 'card-a');
	await page.keyboard.press('Control+z');
	await expect(page.locator('[data-whiteboard-object]').last()).toHaveAttribute('data-context-item', 'slip-a');
	await page.keyboard.press('Control+Shift+z');
	await expect(page.locator('[data-whiteboard-object]').last()).toHaveAttribute('data-context-item', 'card-a');
	await expect.poll(async () => (await stored(page)).items[0].layer).toBe(2);
	await page.reload();
	await expect(page.locator('[data-whiteboard-object]').last()).toHaveAttribute('data-context-item', 'card-a');
});

test('rotation handle supports pointer and keyboard changes, rotated resizing and reload', async ({ page }) => {
	await select(page, 'card-a'); await arrange(page);
	await page.getByRole('spinbutton', { name: 'Object rotation', exact: true }).fill('30'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
	const handle = page.getByRole('button', { name: 'Rotate object', exact: true });
	await handle.focus(); await handle.press('ArrowRight');
	await expect.poll(async () => (await stored(page)).items[0].rotation).toBe(31);
	const handleBox = (await handle.boundingBox())!; const card = (await page.locator('[data-context-item="card-a"]').boundingBox())!;
	const cx = card.x + card.width / 2; const cy = card.y + card.height / 2; const hx = handleBox.x + handleBox.width / 2; const hy = handleBox.y + handleBox.height / 2;
	const radius = Math.hypot(hx - cx, hy - cy); const targetAngle = Math.atan2(hy - cy, hx - cx) + 14 * Math.PI / 180;
	await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(cx + radius * Math.cos(targetAngle), cy + radius * Math.sin(targetAngle), { steps: 5 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items[0].rotation).toBe(45);
	const before = (await stored(page)).items[0];
	const resizeBox = (await page.locator('[data-context-item="card-a"]').getByRole('button', { name: 'Resize card', exact: true }).boundingBox())!;
	const rx = resizeBox.x + resizeBox.width / 2; const ry = resizeBox.y + resizeBox.height / 2;
	const angle = Math.PI / 4; const dx = 80 * Math.cos(angle) - 40 * Math.sin(angle); const dy = 80 * Math.sin(angle) + 40 * Math.cos(angle);
	await page.mouse.move(rx, ry); await page.mouse.down(); await page.mouse.move(rx + dx, ry + dy, { steps: 5 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items[0].width).toBeCloseTo(before.width + 80, 0);
	const after = (await stored(page)).items[0];
	const anchor = (b: any) => ({ x: b.x + b.width / 2 - b.width / 2 * Math.cos(angle) + b.height / 2 * Math.sin(angle), y: b.y + b.height / 2 - b.width / 2 * Math.sin(angle) - b.height / 2 * Math.cos(angle) });
	expect(anchor(after).x).toBeCloseTo(anchor(before).x, 0); expect(anchor(after).y).toBeCloseTo(anchor(before).y, 0);
	await page.reload();
	await expect(page.locator('[data-context-item="card-a"]')).toHaveAttribute('style', /rotate\(45deg\)/);
	await expect(page.locator('.connector-path')).toHaveCount(1);
	await page.screenshot({ path: 'test-results/boards-compose-rotation.png' });
});

test('paper treatments preview without saving and persist on cards and Slips', async ({ page }) => {
	await select(page, 'card-a'); await open(page);
	await page.getByLabel('Paper material', { exact: true }).selectOption('index');
	await expect(page.locator('[data-context-item="card-a"]')).toHaveAttribute('data-material', 'index');
	expect((await stored(page)).items[0].appearance).toBeUndefined();
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items[0].appearance?.material).toBe('index');
	await page.locator('[data-context-item="slip-a"]').getByRole('textbox', { name: 'Slip text' }).click(); await page.keyboard.press('Escape'); await open(page);
	await page.getByLabel('Paper material', { exact: true }).selectOption('torn');
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items[2].appearance?.material).toBe('torn');
	await page.reload();
	await expect(page.locator('[data-context-item="card-a"]')).toHaveAttribute('data-material', 'index');
	await expect(page.locator('[data-context-item="slip-a"] .material-edge')).toBeVisible();
	await page.screenshot({ path: 'test-results/boards-compose-paper.png' });
});

test('alignment and spacing use the selection, guides snap a drag and the preference persists', async ({ page }) => {
	await select(page, 'card-a'); await select(page, 'card-b', true); await arrange(page);
	await page.getByText('Align & space', { exact: true }).click();
	await page.getByRole('button', { name: 'Align top', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.slice(0, 2).map((item: any) => item.y)).toEqual([100, 100]);
	await page.getByRole('checkbox', { name: 'Snap to alignment guides', exact: true }).check();
	await page.keyboard.press('Escape');
	await select(page, 'card-a');
	const card = (await page.locator('[data-context-item="card-a"]').boundingBox())!;
	await page.mouse.move(card.x + 5, card.y + 65); await page.mouse.down(); await page.mouse.move(card.x + 102, card.y + 65, { steps: 5 });
	await expect(page.locator('.alignment-guide')).not.toHaveCount(0);
	await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items[0].x).toBe(140);
	await expect(page.locator('.alignment-guide')).toHaveCount(0);
	await page.reload(); await select(page, 'card-a'); await arrange(page);
	await expect(page.getByRole('checkbox', { name: 'Snap to alignment guides', exact: true })).toBeChecked();
});

test('photo captions leave original image edits intact and arrangement works on a narrow screen', async ({ page }) => {
	await page.locator('input[type=file]').setInputFiles({ name: 'caption-photo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#cbdfe3"/><circle cx="200" cy="120" r="70" fill="#a66670"/></svg>') });
	const photo = page.getByRole('group', { name: 'Image: caption-photo.svg', exact: true });
	await expect(photo).toBeVisible(); await arrange(page);
	await page.getByRole('textbox', { name: 'Photo caption', exact: true }).fill('A small lovely thing');
	await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.caption).toBe('A small lovely thing');
	const assetId = (await stored(page)).items.find((item: any) => item.type === 'image').assetId;
	await expect(photo.getByText('A small lovely thing', { exact: true })).toBeVisible();
	await page.reload(); await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Layers', exact: true }).click();
	await page.getByRole('button', { name: 'Find caption-photo.svg', exact: true }).click();
	await page.getByRole('button', { name: 'Close layers', exact: true }).click();
	await arrange(page);
	const panel = page.getByRole('dialog', { name: 'Arrange selection' }); const box = (await panel.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
	expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(844);
	await expect(page.getByRole('textbox', { name: 'Photo caption', exact: true })).toHaveValue('A small lovely thing');
	expect((await stored(page)).items.find((item: any) => item.type === 'image').assetId).toBe(assetId);
	await page.screenshot({ path: 'test-results/boards-compose-arrange-narrow.png' });
	await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Arrange', exact: true })).toBeFocused();
});

test('rotated lettering keeps its corner and measured geometry when its words grow', async ({ page }) => {
	await page.getByRole('button', { name: 'Add lettering', exact: true }).click();
	const text = page.getByRole('textbox', { name: 'Lettering text', exact: true });
	await text.fill('A little room'); await text.press('Escape'); await arrange(page);
	await page.getByRole('spinbutton', { name: 'Object rotation', exact: true }).fill('30'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.rotation).toBe(30);
	const before = (await stored(page)).items.find((item: any) => item.type === 'lettering');
	await text.fill('A little room\nfor a larger thought\nand a few more words'); await text.press('Escape');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'lettering')?.height).toBeGreaterThan(before.height);
	const after = (await stored(page)).items.find((item: any) => item.type === 'lettering');
	const angle = Math.PI / 6;
	const anchor = (b: any) => ({ x: b.x + b.width / 2 - b.width / 2 * Math.cos(angle) + b.height / 2 * Math.sin(angle), y: b.y + b.height / 2 - b.width / 2 * Math.sin(angle) - b.height / 2 * Math.cos(angle) });
	expect(anchor(after).x).toBeCloseTo(anchor(before).x, 0); expect(anchor(after).y).toBeCloseTo(anchor(before).y, 0);
	const actualHeight = await text.locator('..').evaluate((element) => (element as HTMLElement).offsetHeight);
	expect(after.height).toBe(actualHeight);
	await page.reload(); await expect(text).toHaveValue('A little room\nfor a larger thought\nand a few more words');
});

test('deleting a grouped photo and undoing restores the original image through reload', async ({ page }) => {
	await page.locator('input[type=file]').setInputFiles({ name: 'undo-photo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#d6e2c9"/></svg>') });
	const photo = page.getByRole('group', { name: 'Image: undo-photo.svg', exact: true });
	await expect(photo).toBeVisible();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.assetId).toBeTruthy();
	await page.getByRole('button', { name: 'Add lettering', exact: true }).click();
	await page.getByRole('textbox', { name: 'Lettering text', exact: true }).fill('A keeper'); await page.keyboard.press('Escape');
	const original = (await stored(page)).items.find((item: any) => item.type === 'image');
	await page.keyboard.press('Control+a'); await page.keyboard.press('Control+g');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.groupId).toBeTruthy();
	await page.keyboard.press('Delete');
	await expect.poll(async () => (await stored(page)).items.length).toBe(0);
	await page.keyboard.press('Control+z');
	await expect(photo.locator('image')).toHaveAttribute('href', /^blob:/);
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.type === 'image')?.assetId).toBe(original.assetId);
	await page.reload();
	await expect(photo.locator('image')).toHaveAttribute('href', /^blob:/);
	await expect(photo.locator('.missing-image')).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Lettering text', exact: true })).toHaveValue('A keeper');
});

test('right-click selected card, Slip and lettering text opens the Woodles menu and preserves the range', async ({ page }) => {
	await page.getByRole('button', { name: 'Add lettering', exact: true }).click();
	await page.getByRole('textbox', { name: 'Lettering text', exact: true }).fill('Selected lettering');
	await page.evaluate(() => window.addEventListener('contextmenu', (event) => { (window as any).__contextPrevented = event.defaultPrevented; }));
	for (const label of ['Card text', 'Slip text', 'Lettering text']) {
		const field = page.getByRole('textbox', { name: label, exact: true }).first();
		await field.evaluate((node) => { const field = node as HTMLTextAreaElement; field.focus(); field.setSelectionRange(0, 4); });
		await field.click({ button: 'right', position: { x: 12, y: 14 } });
		await expect(page.getByRole('menu')).toBeVisible();
		expect(await page.evaluate(() => (window as any).__contextPrevented)).toBe(true);
		await expect(page.getByRole('menuitem', { name: 'Appearance', exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(field).toBeFocused();
		expect(await field.evaluate((node) => { const field = node as HTMLTextAreaElement; return [field.selectionStart, field.selectionEnd]; })).toEqual([0, 4]);
	}
	await page.getByRole('textbox', { name: 'Lettering text', exact: true }).press('Shift+F10');
	await expect(page.getByRole('menuitem', { name: 'Arrange', exact: true })).toBeFocused();
	await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Selection appearance' })).toBeVisible();
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await page.getByRole('textbox', { name: 'Lettering text', exact: true }).click({ button: 'right', position: { x: 12, y: 14 } });
	await page.screenshot({ path: 'test-results/boards-text-context-menu.png' });
});

test('HomeSuite routes selected text right-clicks to its menu instead of the browser', async ({ page }) => {
	await page.route('**/text-context-shell', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
	await page.goto('/text-context-shell');
	await page.evaluate((boardId) => {
		const iframe = document.createElement('iframe'); iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0'; iframe.src = `/whiteboard?board=${boardId}&homesuite=1`;
		(window as any).__boardMessages = [];
		window.addEventListener('message', (event) => { if (event.data?.channel === 'woodles.homesuite.v1') (window as any).__boardMessages.push(event.data); });
		document.body.append(iframe);
	}, boardId);
	const frame = page.frameLocator('iframe'); const field = frame.getByRole('textbox', { name: 'Card text', exact: true }).first();
	await expect(field).toBeVisible();
	await field.evaluate((node) => { const field = node as HTMLTextAreaElement; field.focus(); field.setSelectionRange(0, 4); window.addEventListener('contextmenu', (event) => { (window as any).__contextPrevented = event.defaultPrevented; }); });
	await field.click({ button: 'right', position: { x: 12, y: 14 } });
	await expect.poll(async () => page.evaluate(() => (window as any).__boardMessages.some((message: any) => message.type === 'context-menu' && message.target.actions.some((action: any) => action.id === 'appearance')))).toBe(true);
	expect(await field.evaluate(() => (window as any).__contextPrevented)).toBe(true);
	await page.evaluate(() => { const message = (window as any).__boardMessages.findLast((message: any) => message.type === 'context-menu'); document.querySelector('iframe')!.contentWindow!.postMessage({ channel: 'woodles.homesuite.v1', source: 'shell', type: 'action', action: 'context-dismiss', requestId: message.requestId }, window.location.origin); });
	await expect(field).toBeFocused();
	expect(await field.evaluate((node) => { const field = node as HTMLTextAreaElement; return [field.selectionStart, field.selectionEnd]; })).toEqual([0, 4]);
});

test('SVG selection controls stay outside a clipped stack and dock when it fills the view', async ({ page }) => {
	await page.getByRole('button', { name: 'Add stack', exact: true }).click();
	await page.getByRole('textbox', { name: 'Stack title', exact: true }).press('Escape');
	const stack = page.locator('.board-item.stack'); const toolbar = page.getByRole('toolbar', { name: 'Selection tools', exact: true });
	await expect(toolbar.getByRole('button', { name: 'Appearance', exact: true }).locator('svg')).toBeVisible();
	await expect(toolbar.getByRole('button', { name: 'Arrange', exact: true }).locator('svg')).toBeVisible();
	expect(await toolbar.innerText()).toBe('');
	const initial = (await stack.boundingBox())!;
	await page.mouse.move(initial.x + 5, initial.y + 65); await page.mouse.down(); await page.mouse.move(25, 85, { steps: 5 }); await page.mouse.up();
	await expect(toolbar).not.toHaveClass(/interacting/);
	await expect(toolbar).toHaveCSS('opacity', '1');
	const selected = (await stack.boundingBox())!; const controls = (await toolbar.boundingBox())!;
	const overlap = controls.x < selected.x + selected.width && controls.x + controls.width > selected.x && controls.y < selected.y + selected.height && controls.y + controls.height > selected.y;
	expect(overlap).toBe(false);
	expect(controls.width).toBeLessThanOrEqual(100);
	await page.screenshot({ path: 'test-results/boards-selection-controls-clipped-stack.png' });
	await arrange(page); await page.getByRole('button', { name: 'To front', exact: true }).click(); await page.keyboard.press('Escape');
	const resize = (await stack.getByRole('button', { name: 'Resize stack', exact: true }).boundingBox())!;
	await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2); await page.mouse.down(); await page.mouse.move(1500, 1100, { steps: 5 }); await page.mouse.up();
	await expect(toolbar).toHaveAttribute('data-placement', 'dock');
	const docked = (await toolbar.boundingBox())!; const chrome = (await page.locator('.top-deck').boundingBox())!;
	expect(docked.y).toBeGreaterThan(chrome.y + chrome.height);
	expect(docked.y + docked.height).toBeLessThanOrEqual(800);
	await page.screenshot({ path: 'test-results/boards-selection-controls-docked.png' });
});

test('icon controls fit narrow screens and support keyboard navigation and activation', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Fit board in view', exact: true }).click();
	await select(page, 'card-a');
	const toolbar = page.getByRole('toolbar', { name: 'Selection tools', exact: true });
	const box = (await toolbar.boundingBox())!; const chrome = (await page.locator('.top-deck').boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(378);
	expect(box.y).toBeGreaterThanOrEqual(chrome.y + chrome.height + 8); expect(box.y + box.height).toBeLessThanOrEqual(744);
	await toolbar.getByRole('button', { name: 'Appearance', exact: true }).focus();
	await page.keyboard.press('ArrowRight'); await expect(toolbar.getByRole('button', { name: 'Arrange', exact: true })).toBeFocused();
	await page.keyboard.press('Space'); await expect(page.getByRole('dialog', { name: 'Arrange selection' })).toBeVisible();
	await page.keyboard.press('Escape'); await expect(toolbar.getByRole('button', { name: 'Arrange', exact: true })).toBeFocused();
	await page.screenshot({ path: 'test-results/boards-selection-controls-narrow.png' });
});

async function addSlipStack(page: Page) {
	await page.getByRole('button', { name: 'Add stack', exact: true }).click();
	await page.getByRole('textbox', { name: 'Stack title', exact: true }).fill('Slip pocket');
	await page.keyboard.press('Escape');
	return page.getByRole('group', { name: 'Stack: Slip pocket', exact: true });
}
async function recordSlipLandings(page: Page) {
	await page.evaluate(() => {
		(window as any).__slipLandings = 0;
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			if (this.matches('.slip')) (window as any).__slipLandings++;
			return animate.call(this, keyframes, options);
		};
	});
}

test('Slips pop neatly into Stacks, follow them, undo placement and drag back out', async ({ page }) => {
	const stack = await addSlipStack(page); await recordSlipLandings(page);
	const stackId = (await stack.getAttribute('data-context-item'))!;
	const slip = page.locator('[data-context-item="slip-a"]');
	const from = (await slip.boundingBox())!; const target = (await stack.boundingBox())!;
	await page.mouse.move(from.x + 3, from.y + 10); await page.mouse.down(); await page.mouse.move(target.x + target.width / 2, target.y + 100, { steps: 6 });
	await expect(stack).toHaveClass(/drop-target/); await expect(page.locator('.stack-insert-marker')).toHaveCount(1);
	await page.mouse.up();
	await expect.poll(async () => page.evaluate(() => (window as any).__slipLandings)).toBeGreaterThan(0);
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBe(stackId);
	const placed = (await slip.boundingBox())!; const container = (await stack.boundingBox())!;
	expect(placed.x).toBeCloseTo(container.x + 14, 0); expect(placed.width).toBeCloseTo(container.width - 28, 0);
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBeUndefined();
	await page.keyboard.press('Control+Shift+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBe(stackId);
	const beforeMove = (await stack.boundingBox())!;
	await page.mouse.move(beforeMove.x + 4, beforeMove.y + 65); await page.mouse.down(); await page.mouse.move(beforeMove.x + 104, beforeMove.y + 115, { steps: 5 }); await page.mouse.up();
	await expect.poll(async () => { const note = (await slip.boundingBox())!; const owner = (await stack.boundingBox())!; return Math.round(note.x - owner.x); }).toBe(14);
	const note = (await slip.boundingBox())!;
	await page.mouse.move(note.x + 3, note.y + 10); await page.mouse.down(); await page.mouse.move(200, 650, { steps: 6 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBeUndefined();
	expect((await slip.boundingBox())!.width).toBeCloseTo(170, 0);
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBe(stackId);
	await page.reload(); await expect(slip).toHaveClass(/in-stack/);
	await expect(slip.getByRole('textbox', { name: 'Slip text', exact: true })).toHaveValue('Save this thought for later');
	await page.screenshot({ path: 'test-results/boards-slip-in-stack.png' });
});

test('Cards and Slips share an order, and converting a stacked Slip keeps its slot', async ({ page }) => {
	const stack = await addSlipStack(page); const stackId = (await stack.getAttribute('data-context-item'))!;
	for (const [id, offset] of [['card-a', 80], ['slip-a', 260]] as const) {
		const note = (await page.locator(`[data-context-item="${id}"]`).boundingBox())!; const target = (await stack.boundingBox())!;
		await page.mouse.move(note.x + 3, note.y + 10); await page.mouse.down(); await page.mouse.move(target.x + 80, target.y + offset, { steps: 6 }); await page.mouse.up();
		await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === id)?.stackId).toBe(stackId);
	}
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === stackId)?.cardIds).toEqual(['card-a', 'slip-a']);
	const slip = page.locator('[data-context-item="slip-a"]'); const from = (await slip.boundingBox())!; const target = (await stack.boundingBox())!;
	await page.mouse.move(from.x + 3, from.y + 10); await page.mouse.down(); await page.mouse.move(target.x + 80, target.y + 70, { steps: 6 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === stackId)?.cardIds).toEqual(['slip-a', 'card-a']);
	await slip.getByRole('textbox', { name: 'Slip text', exact: true }).click({ button: 'right', position: { x: 12, y: 14 } });
	await page.getByRole('menuitem', { name: 'Turn into…', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Card', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.type).toBe('card');
	expect((await stored(page)).items.find((item: any) => item.id === 'slip-a').stackId).toBe(stackId);
	expect((await stored(page)).items.find((item: any) => item.id === stackId).cardIds).toEqual(['slip-a', 'card-a']);
	await page.keyboard.press('Control+z');
	await expect(page.locator('[data-context-item="slip-a"]')).toHaveClass(/slip/);
});

test('Slip placement stays neat on narrow screens and reduced motion skips the pop', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' }); const stack = await addSlipStack(page); await recordSlipLandings(page);
	const stackId = (await stack.getAttribute('data-context-item'))!;
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Fit board in view', exact: true }).click();
	const slip = page.locator('[data-context-item="slip-a"]');
	await expect(slip).toBeInViewport();
	// Hover waits for the fitted layout and a real, unobstructed drag surface.
	await slip.hover({ position: { x: 1.5, y: 5 } });
	const target = (await stack.boundingBox())!;
	await page.mouse.down(); await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 6 }); await page.mouse.up();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.stackId).toBe(stackId);
	expect(await page.evaluate(() => (window as any).__slipLandings)).toBe(0);
	const noteWidth = await slip.evaluate((node) => (node as HTMLElement).offsetWidth); const stackWidth = await stack.evaluate((node) => (node as HTMLElement).offsetWidth);
	expect(noteWidth).toBe(stackWidth - 28);
	await page.screenshot({ path: 'test-results/boards-slip-stack-narrow.png' });
});

test('a card creates a document with its words and retains the document after undo', async ({ page }) => {
	const card = page.locator('[data-context-item="card-b"]');
	await card.click({ button: 'right', position: { x: 5, y: 60 } });
	await page.getByRole('menuitem', { name: 'Spawn…', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Document', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'card-b')?.artifacts?.[0]?.kind).toBe('draft');
	const after = (await stored(page)).items.find((item: any) => item.id === 'card-b');
	const ref = after.artifacts[0];
	expect(ref).toMatchObject({ app: 'write', kind: 'draft' });
	const id = ref.id;
	expect(id).toBeTruthy();
	const draft = await page.evaluate((id) => JSON.parse(localStorage.getItem(`woodles_draft_${id}`)!), id);
	expect(draft.title).toBe('Something to try');
	expect(draft.layers.foreground.html).toContain('A little room to play.');
	const index = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles_drafts_index')!));
	expect(index.some((entry: any) => entry.id === id)).toBe(true);
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'card-b')?.artifacts?.length ?? 0).toBe(0);
	expect(await page.evaluate((id) => localStorage.getItem(`woodles_draft_${id}`), id)).not.toBeNull();
	await page.keyboard.press('Control+Shift+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'card-b')?.artifacts?.[0]).toEqual(ref);
	await page.reload();
	expect((await stored(page)).items.find((item: any) => item.id === 'card-b')).toMatchObject({ type: 'card', title: 'Something to try', body: 'A little room to play.', artifacts: [ref] });
	expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('woodles_drafts_index')!).filter((entry: any) => entry.id === id).length, id)).toBe(1);
	await card.click({ button: 'right', position: { x: 5, y: 60 } });
	await page.getByRole('menuitem', { name: 'Edit details', exact: true }).click();
	const link = page.getByRole('link', { name: 'Open document ↗' });
	await expect(link).toHaveAttribute('href', `/write?draft=${id}`);
	await page.context().route('**/write?draft=*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Write destination</title>' }));
	const popupPromise = page.waitForEvent('popup');
	await link.click();
	const popup = await popupPromise;
	await expect(popup).toHaveURL(new RegExp(`/write\\?draft=${id}$`));
	await popup.close();
});

test('a slip creates a collection containing its words and retains the collection after undo', async ({ page }) => {
	const slip = page.locator('[data-context-item="slip-a"]');
	await slip.getByRole('textbox', { name: 'Slip text', exact: true }).click({ button: 'right', position: { x: 12, y: 14 } });
	await page.getByRole('menuitem', { name: 'Spawn…', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Collection', exact: true }).click();
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.artifacts?.[0]?.kind).toBe('collection');
	const after = (await stored(page)).items.find((item: any) => item.id === 'slip-a');
	const ref = after.artifacts[0];
	expect(ref).toMatchObject({ app: 'data', kind: 'collection' });
	const id = ref.id;
	expect(id).toBeTruthy();
	const collection = await page.evaluate((id) => JSON.parse(localStorage.getItem('woodles.data.collections.v1')!).data.collections.find((entry: any) => entry.id === id), id);
	expect(collection).toBeTruthy();
	expect(collection.records.some((record: any) => Object.values(record.values).some((value) => String(value).includes('Save this thought for later')))).toBe(true);
	await page.getByRole('main', { name: 'Whiteboard canvas' }).click({ position: { x: 10, y: 200 } });
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.artifacts?.length ?? 0).toBe(0);
	expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('woodles.data.collections.v1')!).data.collections.some((entry: any) => entry.id === id), id)).toBe(true);
	await page.keyboard.press('Control+Shift+z');
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'slip-a')?.artifacts?.[0]).toEqual(ref);
	await page.reload();
	expect((await stored(page)).items.find((item: any) => item.id === 'slip-a')).toMatchObject({ type: 'slip', text: 'Save this thought for later', artifacts: [ref] });
	expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('woodles.data.collections.v1')!).data.collections.filter((entry: any) => entry.id === id).length, id)).toBe(1);
});

test('HomeSuite receives Turn into actions and creates through the selected board item', async ({ page }) => {
	await page.route('**/spawn-shell', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
	await page.goto('/spawn-shell');
	await page.evaluate((boardId) => {
		const iframe = document.createElement('iframe');
		iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
		iframe.src = `/whiteboard?board=${boardId}&homesuite=1`;
		(window as any).__boardMessages = [];
		window.addEventListener('message', (event) => { if (event.data?.channel === 'woodles.homesuite.v1') (window as any).__boardMessages.push(event.data); });
		document.body.append(iframe);
	}, boardId);
	const frame = page.frameLocator('iframe');
	await frame.locator('[data-context-item="card-b"]').click({ button: 'right', position: { x: 5, y: 60 } });
	await expect.poll(async () => page.evaluate(() => (window as any).__boardMessages.some((message: any) => message.type === 'context-menu' && message.target.actions.some((action: any) => action.id === 'spawn-document' && action.submenu === 'Spawn…') && message.target.actions.some((action: any) => action.id === 'spawn-collection' && action.submenu === 'Spawn…')))).toBe(true);
	await page.evaluate(() => {
		const message = (window as any).__boardMessages.findLast((entry: any) => entry.type === 'context-menu');
		document.querySelector('iframe')!.contentWindow!.postMessage({ channel: 'woodles.homesuite.v1', source: 'shell', type: 'action', action: 'context-command', requestId: message.requestId, commandId: 'spawn-document' }, window.location.origin);
	});
	await expect.poll(async () => (await stored(page)).items.find((item: any) => item.id === 'card-b')?.artifacts?.[0]).toMatchObject({ app: 'write', kind: 'draft' });
	const ref = (await stored(page)).items.find((item: any) => item.id === 'card-b').artifacts[0];
	expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`woodles_draft_${id}`)!).title, ref.id)).toBe('Something to try');
});


test('Turn into submenu fits the screen at a narrow width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Fit board in view', exact: true }).click();
	await page.locator('[data-context-item="card-b"]').click({ button: 'right', position: { x: 5, y: 60 } });
	await page.getByRole('menuitem', { name: 'Spawn…', exact: true }).click();
	const documentAction = page.getByRole('menuitem', { name: 'Document', exact: true });
	const collectionAction = page.getByRole('menuitem', { name: 'Collection', exact: true });
	await expect(documentAction).toBeInViewport();
	await expect(collectionAction).toBeInViewport();
	const box = (await collectionAction.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test('board looks render, persist and leave objects interactive on desktop and narrow screens', async ({ page }) => {
	await page.getByRole('button', { name: 'Board appearance', exact: true }).click();
	const panel = page.locator('.view-card');
	await panel.getByRole('button', { name: 'Garden journal' }).click();
	await expect(page.locator('.surface-material')).toHaveClass(/material-linen/);
	await expect(page.locator('.surface-atmosphere')).toHaveClass(/atmosphere-sunlight/);
	await expect(page.locator('.surface-edge')).toHaveClass(/edge-frame/);
	await expect(page.locator('.surface-weave')).toHaveCSS('mask-image', /radial-gradient/);
	await expect.poll(async () => (await stored(page)).surface.material).toBe('linen');
	await page.screenshot({ path: 'test-results/board-garden-desktop.png' });
	await page.reload();
	await expect(page.locator('.surface-material')).toHaveClass(/material-linen/);
	await expect(page.locator('.surface-edge')).toHaveClass(/edge-frame/);
	await page.getByRole('textbox', { name: 'Card title' }).first().fill('Still editable');
	await expect.poll(async () => (await stored(page)).items[0].title).toBe('Still editable');
	await page.setViewportSize({ width: 390, height: 844 });
	const dock = (await page.locator('.tool-dock').boundingBox())!;
	const controls = (await page.locator('.camera-controls').boundingBox())!;
	expect(dock.x + dock.width).toBeLessThanOrEqual(controls.x);
	await page.getByRole('button', { name: 'Board appearance', exact: true }).click();
	await panel.getByRole('button', { name: 'Stargazer' }).click();
	await expect(page.locator('.surface-edge')).toHaveClass(/edge-corners/);
	await expect(page.locator('.surface-atmosphere')).toHaveClass(/atmosphere-twilight/);
	await expect.poll(async () => (await stored(page)).surface.pattern).toBe('stars');
	await panel.getByRole('button', { name: 'plain', exact: true }).click();
	await expect(panel.getByRole('button', { name: 'strong', exact: true })).toBeDisabled();
	await panel.getByRole('button', { name: 'rainbow', exact: true }).click();
	await expect(panel.getByRole('button', { name: 'strong', exact: true })).toBeEnabled();
	await page.screenshot({ path: 'test-results/board-appearance-narrow.png' });
});


test('pattern colors and decorations are saved and can be undone', async ({ page }) => {
	await page.getByRole('button', { name: 'Board appearance', exact: true }).click();
	const panel = page.locator('.view-card');
	await panel.getByLabel('Pattern color').fill('#123456');
	await expect.poll(async () => (await stored(page)).surface.patternColor).toBe('#123456');
	await expect(page.locator('.surface-weave')).toHaveCSS('background-image', /18, 52, 86/);
	if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Board appearance', exact: true }).click();
	await panel.getByText('Add a decoration', { exact: true }).click();
	await panel.getByRole('button', { name: '✦ Star' }).click();
	await expect.poll(async () => (await stored(page)).items.some((item: any) => item.type === 'lettering' && item.text === '✦')).toBe(true);
	await page.keyboard.press('Control+z');
	await expect.poll(async () => (await stored(page)).items.some((item: any) => item.type === 'lettering' && item.text === '✦')).toBe(false);
	await page.keyboard.press('Control+Shift+z');
	await expect.poll(async () => (await stored(page)).items.some((item: any) => item.type === 'lettering' && item.text === '✦')).toBe(true);
	await page.reload();
	await expect(page.locator('[aria-label="Lettering: ✦"]')).toBeVisible();
	await expect(page.locator('.surface-weave')).toHaveCSS('background-image', /18, 52, 86/);
});
