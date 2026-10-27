import { test, expect, type Page } from '@playwright/test';

const boardId = 'board-compose-test';
const key = `woodles.whiteboard.boards.${boardId}`;
async function stored(page: Page) {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).data, key);
}
test.beforeEach(async ({ page }) => {
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

async function select(page: Page, id: string, additive = false) {
	if (!additive) await page.getByRole('main', { name: 'Whiteboard canvas' }).click({ position: { x: 10, y: 200 } });
	await page.locator(`[data-context-item="${id}"]`).click({ position: { x: 5, y: 60 }, modifiers: additive ? ['Shift'] : [] });
}
async function open(page: Page) {
	await page.getByRole('button', { name: '✦ Appearance', exact: true }).click();
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
	await expect(page.getByRole('button', { name: '✦ Appearance' })).toBeFocused();
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
	await expect(page.getByRole('button', { name: '✦ Appearance' })).toBeFocused();
});

test('photo mats and outlines preserve the original asset and image edits', async ({ page }) => {
	await page.locator('input[type=file]').setInputFiles({ name: 'test-photo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#cbdfe3"/><circle cx="200" cy="120" r="70" fill="#a66670"/></svg>') });
	const photo = page.getByRole('group', { name: 'Image: test-photo.svg', exact: true });
	await expect(photo).toBeVisible();
	await photo.click({ button: 'right', position: { x: 5, y: 20 } });
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
