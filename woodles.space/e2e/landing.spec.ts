import { expect, test } from '@playwright/test';

test('the desktop still starts with every app unpinned', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => localStorage.setItem('woodles-desk', JSON.stringify({ pins: [] })));
	await page.goto('/');

	await expect(page.locator('#w-clock')).toHaveText(/^\d{2}:\d{2}$/);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.locator('body')).toHaveClass(/start-open/);
	expect(errors).toEqual([]);
});

test('the snowflake is honest about changing the theme', async ({ page }) => {
	await page.goto('/');
	const before = await page.locator('html').getAttribute('data-theme');
	await page.getByRole('button', { name: 'Next theme' }).click();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
	await expect(page.getByRole('button', { name: 'Next wallpaper' })).toHaveCount(0);
});

test('a modified click opens an app in a new tab and leaves the desktop be', async ({ page, context }) => {
	await page.goto('/');
	const opened = context.waitForEvent('page');
	await page.locator('.icon[data-id="piano"]').click({ modifiers: ['ControlOrMeta'] });
	const tab = await opened;
	await tab.waitForLoadState();
	expect(new URL(tab.url()).pathname).toBe('/piano');

	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('#launch')).not.toHaveClass(/go/);
	const recents = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles-recents') ?? '[]'));
	expect(recents[0]).toBe('piano');
});

test('closed menus and windows stay out of the tab order', async ({ page }) => {
	await page.goto('/');
	for (const id of ['#start', '#flyout', '#ctx', '#pwin', '#window']) {
		await expect(page.locator(id)).toBeHidden();
	}
});

test('a window takes focus, keeps it, and gives it back', async ({ page }) => {
	await page.goto('/');
	const start = page.getByRole('button', { name: 'Start', exact: true });
	await start.focus();
	await page.keyboard.press('Enter');
	await page.locator('#pers-btn').focus();
	await page.keyboard.press('Enter');

	const personalize = page.getByRole('dialog', { name: 'Personalize' });
	await expect(personalize).toBeVisible();
	await expect(personalize.getByRole('button', { name: 'Close' })).toBeFocused();

	const stops = await personalize.locator('button, input').count();
	for (let i = 0; i < stops + 2; i++) await page.keyboard.press('Tab');
	expect(await personalize.evaluate((win) => win.contains(document.activeElement))).toBe(true);

	await personalize.getByRole('button', { name: 'midnight theme' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');

	// the button that opened it went away with the start menu, so focus lands on Start
	await page.keyboard.press('Escape');
	await expect(personalize).toBeHidden();
	await expect(start).toBeFocused();
});

test('the context menu takes focus and hands it back to the icon', async ({ page }) => {
	await page.goto('/');
	const icon = page.locator('.icon[data-id="hygge"]');
	await icon.focus();
	await icon.click({ button: 'right' });
	await expect(page.getByRole('button', { name: /open hygge/ })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.locator('#ctx')).toBeHidden();
	await expect(icon).toBeFocused();
});

test('a sticky note grows to fit its words instead of scrolling', async ({ page }) => {
	const text = Array.from({ length: 12 }, (_, i) => `line ${i + 1} of a longer note`).join('\n');
	await page.addInitScript((note) => {
		localStorage.setItem(
			'woodles-widgets',
			JSON.stringify([{ id: 'wsticky', type: 'sticky', x: 400, y: 80, data: { text: note } }])
		);
	}, text);
	await page.goto('/');

	const note = page.locator('.dw-sticky textarea');
	await expect(note).toHaveValue(text);
	await expect
		.poll(() => note.evaluate((ta) => ta.scrollHeight - ta.clientHeight))
		.toBeLessThanOrEqual(1);
	expect(await note.evaluate((ta) => ta.clientHeight)).toBeGreaterThan(96);
});

test('desktop icons describe themselves on hover', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.icon[data-id="planner"]')).toHaveAttribute(
		'title',
		'your day in piles, and a bell that asks what is happening now'
	);
});

test('the default desktop is banded, and a moved icon takes its band label with it', async ({ page }) => {
	await page.goto('/');
	const labels = page.locator('.band-label');
	await expect(labels).toHaveText(['write', 'tend', 'read', 'play']);

	const left = (selector: string) => page.locator(selector).evaluate((el) => (el as HTMLElement).offsetLeft);
	expect(await left('.icon[data-id="homesuite"]')).toBe(await left('.band-label:text-is("write")'));
	expect(await left('.icon[data-id="planner"]')).toBe(await left('.band-label:text-is("tend")'));
	expect(await left('.icon[data-id="hygge"]')).toBe(await left('.band-label:text-is("play")'));

	const hygge = page.locator('.icon[data-id="hygge"]');
	const box = (await hygge.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 500, box.y + 300, { steps: 8 });
	await page.mouse.up();
	await expect(page.locator('.band-label:text-is("play")')).toBeHidden();
	await expect(page.locator('.band-label:text-is("tend")')).toBeVisible();
});

test('the homesuite widget lists what HomeSuite last showed, each a way back in', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('woodles-widgets', JSON.stringify([{ id: 'hs', type: 'homesuite', x: 500, y: 80, data: {} }]));
		localStorage.setItem('homesuite.recent.v1', JSON.stringify({
			version: 1,
			publishedAt: new Date().toISOString(),
			counts: { document: 2, board: 1, collection: 1 },
			recent: [
				{ kind: 'document', id: 'doc 1', title: 'letter to the moth', updatedAt: new Date().toISOString() },
				{ kind: 'collection', id: 'c1', title: 'Bestiary + Marginalia', updatedAt: '2026-09-01T10:00:00Z', recordCount: 42 }
			]
		}));
	});
	await page.goto('/');
	const widget = page.locator('.dw-homesuite');
	await expect(widget.locator('.hs-counts')).toHaveText('2 documents · 1 board · 1 collection');
	await expect(widget.getByRole('link', { name: /letter to the moth/ })).toHaveAttribute('href', '/homesuite?document=doc%201');
	await expect(widget.getByRole('link', { name: /Bestiary \+ Marginalia/ })).toContainText('42 records');
	await expect(widget.getByRole('link', { name: /open homesuite/ })).toHaveAttribute('href', '/homesuite');
});

test('the homesuite widget waits kindly for a first visit, then follows HomeSuite', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('woodles-widgets', JSON.stringify([{ id: 'hs', type: 'homesuite', x: 500, y: 80, data: {} }]));
	});
	await page.goto('/');
	const widget = page.locator('.dw-homesuite');
	await expect(widget).toContainText('open homesuite once');

	// HomeSuite republishing from another tab reaches this one as a storage event
	await page.evaluate(() => {
		const value = JSON.stringify({
			version: 1, publishedAt: new Date().toISOString(), counts: { document: 0, board: 1, collection: 0 },
			recent: [{ kind: 'board', id: 'b1', title: 'world map', updatedAt: new Date().toISOString() }]
		});
		localStorage.setItem('homesuite.recent.v1', value);
		dispatchEvent(new StorageEvent('storage', { key: 'homesuite.recent.v1', newValue: value }));
	});
	await expect(widget.getByRole('link', { name: /world map/ })).toHaveAttribute('href', '/homesuite?board=b1');
});

test('the tray flyout is a calendar, not a fourth clock', async ({ page }) => {
	await page.goto('/');
	await page.locator('.tray-clock').click();
	const flyout = page.locator('#flyout');
	await expect(flyout.locator('.mo-today')).toHaveText(String(new Date().getDate()));
	await expect(flyout.locator('#fly-moon')).toContainText('% lit');
	await expect(flyout).not.toContainText(await page.locator('#w-note').innerText());
});

test('with no theme chosen, the desktop follows a dark system; a choice then sticks', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dusk');
	expect(await page.evaluate(() => localStorage.getItem('woodles-theme'))).toBeNull();

	await page.getByRole('button', { name: 'Next theme' }).click();
	await page.emulateMedia({ colorScheme: 'light' });
	await page.reload();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'cream');
});

test('what’s new: a dot for a returning visitor, gone once the changelog is opened', async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.setItem('woodles-changelog-seen', '2000-01-01');
			sessionStorage.setItem('seeded', '1');
		}
	});
	await page.goto('/');
	const tray = page.getByRole('link', { name: /What's new/ });
	await expect(tray).toHaveClass(/unseen/);
	await tray.click();
	await expect(page).toHaveURL(/\/changelog$/);
	await page.goto('/');
	await expect(page.getByRole('link', { name: /What's new/ })).not.toHaveClass(/unseen/);
});

test('a first visit starts caught up on what’s new', async ({ page }) => {
	await page.goto('/');
	await expect.poll(() => page.evaluate(() => localStorage.getItem('woodles-changelog-seen'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	await expect(page.getByRole('link', { name: /What's new/ })).not.toHaveClass(/unseen/);
});

test('the today widget reads Carillon’s plan and the Thinking About shelf', async ({ page }) => {
	await page.addInitScript(() => {
		const d = new Date();
		const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		localStorage.setItem('woodles-widgets', JSON.stringify([{ id: 't', type: 'today', x: 500, y: 80, data: {} }]));
		localStorage.setItem('planner.commitments.v1', JSON.stringify({ version: 1, publishedAt: '', commitments: [
			{ entryId: 'e1', taskId: 't1', title: 'read two chapters', date: today, time: '19:00', blockTitle: null, status: 'open' },
			{ entryId: 'e2', taskId: 't2', title: 'finish the level', date: today, time: '08:30', blockTitle: null, status: 'done' },
			{ entryId: 'e3', taskId: 't3', title: 'another day', date: '1999-01-01', time: null, blockTitle: null, status: 'open' }
		] }));
		localStorage.setItem('thinking-about.shelf.v1', JSON.stringify({ version: 1, publishedAt: '', entries: [
			{ id: 'e1', title: 'The Left Hand of Darkness', columnKey: 'read', sectionKey: 'now', color: '#9b77a6', lastSessionDate: '2026-09-27' },
			{ id: 'e4', title: 'Outer Wilds', columnKey: 'play', sectionKey: 'now', color: 'not a colour', lastSessionDate: null,
				standing: { weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '21:00', endTime: '22:00' } }
		] }));
	});
	await page.goto('/');
	const plan = page.locator('.dw-today .td-plan .td-item');
	await expect(plan).toHaveCount(3);
	await expect(plan.nth(0)).toContainText('finish the level');
	await expect(plan.nth(0)).toHaveClass(/td-done/);
	await expect(plan.nth(1)).toHaveAttribute('href', '/planner?thinking-about-entry=e1');
	await expect(plan.nth(2)).toContainText('21:00Outer Wilds');
	const shelf = page.locator('.dw-today .td-shelf .td-item');
	await expect(shelf.first()).toHaveAttribute('href', '/thinking-about?entry=e1');
	await expect(shelf).toHaveCount(2);
});

test('the today widget is honest on a device that has neither', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles-widgets', JSON.stringify([{ id: 't', type: 'today', x: 500, y: 80, data: {} }])));
	await page.goto('/');
	await expect(page.locator('.dw-today')).toContainText("carillon hasn't planned anything");
});

test('taskbar icons carry no “running” dot', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles-recents', JSON.stringify(['hygge'])));
	await page.goto('/');
	await expect(page.locator('.tb-app.recent')).toHaveCount(0);
});

test('a widget comes back on screen when the window shrinks, and home when it grows', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('woodles-widgets', JSON.stringify([{ id: 's', type: 'sticky', x: 1100, y: 500, data: { text: 'hi' } }])));
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto('/');
	const note = page.locator('.dw-sticky');
	const home = await note.evaluate((el) => el.style.left);
	await page.setViewportSize({ width: 800, height: 600 });
	await expect.poll(async () => (await note.boundingBox())!.x + (await note.boundingBox())!.width).toBeLessThanOrEqual(800);
	await page.setViewportSize({ width: 1280, height: 720 });
	await expect.poll(() => note.evaluate((el) => el.style.left)).toBe(home);
});
