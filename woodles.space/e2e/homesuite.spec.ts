import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** The shell veils a surface until the surface reports what it has loaded. */
async function surfaceReady(page: Page): Promise<void> {
	await expect(page.locator('.surface-veil')).toHaveCount(0);
}

async function create(page: Page, kind: 'Document' | 'Board'): Promise<void> {
	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: new RegExp(kind) }).click();
	await surfaceReady(page);
}

async function createCollection(page: Page, template: RegExp): Promise<void> {
	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Collection/ }).click();
	await page.getByRole('dialog', { name: 'New collection' }).getByRole('button', { name: template }).click();
	await surfaceReady(page);
}

/** The id in `/homesuite?document=<id>` (or board, collection). */
function openId(page: Page): string {
	const params = new URL(page.url()).searchParams;
	return params.get('document') ?? params.get('board') ?? params.get('collection') ?? '';
}

async function backToIndex(page: Page): Promise<void> {
	await page.getByRole('button', { name: '← All things' }).click();
}

test('HomeSuite creates and reopens native documents and boards from one index', async ({ page }) => {
	await page.goto('/');
	await page.locator('a[href="/homesuite"]:visible').first().click();
	await expect(page).toHaveURL(/\/homesuite\/?$/);
	await expect(page.getByRole('heading', { name: /All your things/ })).toBeVisible();

	await create(page, 'Document');
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('src', /\/write\?draft=.*homesuite=1/);
	await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(1);

	await create(page, 'Board');
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('src', /\/whiteboard\?board=.*homesuite=1/);
	await expect(page.getByRole('button', { name: 'Redo' })).toBeVisible();
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	await expect(page.locator('.artifact-row').first()).toContainText('board');

	await page.reload();
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	await page.getByRole('button', { name: /Commands/ }).click();
	await expect(page.getByRole('dialog', { name: 'HomeSuite commands' })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: /Collections/ }).click();
	await expect(page.getByRole('heading', { name: 'A place for your next thing.' })).toBeVisible();
});

test('native edits and shell commands stay attached to the owning surface', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Document');
	const document = page.frameLocator('iframe.native-surface');
	await document.locator('textarea.doc-title').fill('A HomeSuite note');
	const prose = document.getByRole('textbox', { name: 'foreground content' });
	await prose.click();
	await prose.pressSequentially('A thought kept in Write.');
	await expect(page.locator('.artifact-title')).toHaveText('A HomeSuite note');
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(prose).not.toContainText('A thought kept in Write.');
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect(prose).toContainText('A thought kept in Write.');
	await page.getByRole('button', { name: 'HomeSuite index' }).click();
	await expect(page.locator('.artifact-row').first()).toContainText('A HomeSuite note');
	await page.locator('.artifact-row').first().click();
	await surfaceReady(page);
	await expect(document.locator('textarea.doc-title')).toHaveValue('A HomeSuite note');
	await expect(document.getByRole('textbox', { name: 'foreground content' })).toContainText('A thought kept in Write.');

	await create(page, 'Board');
	const board = page.frameLocator('iframe.native-surface');
	await page.getByRole('button', { name: /Commands/ }).click();
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('option', { name: /Add card/ }).click();
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(0);
});

test('a surface stays veiled and inert until it has loaded what it shows', async ({ page }) => {
	await page.goto('/homesuite');
	// Hold Write's scripts back, so its prerendered page sits there unhydrated —
	// the moment a title typed into it used to be thrown away.
	await page.route('**/write/_app/immutable/**', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		await route.continue().catch(() => undefined);
	});
	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Document/ }).click();
	await expect(page.locator('.surface-veil')).toBeVisible();
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('inert', '');

	await surfaceReady(page);
	await expect(page.locator('iframe.native-surface')).not.toHaveAttribute('inert');
	await page.frameLocator('iframe.native-surface').locator('textarea.doc-title').click();
	await page.keyboard.type('Typed once it was ready');
	await expect(page.locator('.artifact-title')).toHaveText('Typed once it was ready');
});

test('edits made just before leaving a board or a Collection are kept', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Board');
	const board = page.frameLocator('iframe.native-surface');
	await page.getByRole('button', { name: /Commands/ }).click();
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('option', { name: /Add card/ }).click();
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(1);
	// Well inside the board's save debounce: the frame goes before its timer fires.
	await backToIndex(page);
	await page.locator('.artifact-row', { hasText: 'Untitled board' }).click();
	await surfaceReady(page);
	await expect(board.getByRole('textbox', { name: 'Card title' })).toHaveCount(1);

	await backToIndex(page);
	await createCollection(page, /Blank/);
	const table = page.frameLocator('iframe.native-surface');
	await table.getByRole('button', { name: '＋ New record' }).click();
	await table.locator('td.primary-cell input').first().fill('Fern');
	await backToIndex(page);
	// The shell asked the frame to flush before reading the index, so the new
	// record is already counted.
	await expect(page.locator('.artifact-row', { hasText: 'Untitled collection' })).toContainText('1 record');
	await page.locator('.artifact-row', { hasText: 'Untitled collection' }).click();
	await surfaceReady(page);
	await expect(table.locator('td.primary-cell input').first()).toHaveValue('Fern');
});

test('walking through a portal takes the shell along, so Trash takes the board on screen', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Board');
	const startingId = openId(page);
	const board = page.frameLocator('iframe.native-surface');
	await board.getByRole('button', { name: 'Add a way through to another board' }).click();
	await board.getByRole('group', { name: /^Way through to/ }).dblclick();

	await expect.poll(() => openId(page)).not.toBe(startingId);
	await expect(page.locator('.artifact-title')).toHaveText('New board');
	await page.getByRole('button', { name: 'Move to Trash' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(1);
	await expect(page.locator('.artifact-row')).toContainText('Untitled board');
	await page.getByRole('navigation', { name: 'HomeSuite views' }).getByRole('button', { name: /Trash/ }).click();
	await expect(page.locator('.trash-row')).toHaveCount(1);
	await expect(page.locator('.trash-row')).toContainText('New board');
});

test('a trashed thing opened by its address says so and can be restored', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Document');
	const address = page.url();
	await page.getByRole('button', { name: 'Move to Trash' }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(0);

	await page.goto(address);
	await surfaceReady(page);
	await expect(page.locator('.trash-badge')).toHaveText('In Trash');
	await page.getByRole('button', { name: 'Restore' }).click();
	await expect(page.locator('.trash-badge')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Move to Trash' })).toBeVisible();
});

test('looking at a connected Collection does not make it the most recent thing', async ({ page }) => {
	await page.goto('/homesuite');
	await createCollection(page, /Bestiary \+ Marginalia/);
	await backToIndex(page);
	await create(page, 'Document');
	await backToIndex(page);
	await expect(page.locator('.artifact-row').first()).toContainText('Untitled document');

	await page.locator('.artifact-row', { hasText: 'Bestiary + Marginalia' }).click();
	await surfaceReady(page);
	// The source pull on open has finished once the status says what it found.
	await expect(page.frameLocator('iframe.native-surface').locator('.source-status')).toContainText('source records');
	await backToIndex(page);
	await expect(page.locator('.artifact-row').first()).toContainText('Untitled document');
});

test('one unreadable Collection is set aside, and making another does not overwrite it', async ({ page }) => {
	await page.goto('/homesuite');
	for (let count = 1; count <= 2; count++) {
		await createCollection(page, /Blank/);
		await backToIndex(page);
		await expect(page.locator('.artifact-row')).toHaveCount(count);
	}
	// One wrong value in one record — a string in a number field — in both the
	// save and its backup, as an older or newer build might leave it.
	await page.evaluate(() => {
		for (const key of ['woodles.data.collections.v1', 'woodles.data.collections.v1.backup']) {
			const saved = localStorage.getItem(key);
			if (!saved) continue;
			const envelope = JSON.parse(saved);
			const collection = envelope.data.collections.at(-1);
			const stamp = new Date().toISOString();
			collection.fields.push({ id: 'field-count', name: 'Count', type: 'number', primary: false, createdAt: stamp });
			collection.views.table.columnOrder.push('field-count');
			collection.views.table.columnWidths['field-count'] = 160;
			collection.records.push({ id: 'record-odd', values: { 'field-count': '3' }, createdAt: stamp, updatedAt: stamp });
			localStorage.setItem(key, JSON.stringify(envelope));
		}
	});
	await page.reload();
	await expect(page.locator('.artifact-row')).toHaveCount(1);
	await expect(page.getByRole('status').filter({ hasText: 'set aside unchanged' })).toBeVisible();

	await createCollection(page, /Blank/);
	await backToIndex(page);
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles.data.collections.v1')!).data.collections.length);
	expect(stored).toBe(3);
});

test('a reference in a document opens its target inside HomeSuite', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Document');
	await page.frameLocator('iframe.native-surface').locator('textarea.doc-title').fill('Where it points');
	await expect(page.locator('.artifact-title')).toHaveText('Where it points');
	const target = openId(page);
	await backToIndex(page);
	await create(page, 'Document');
	const source = openId(page);
	await backToIndex(page);
	// Only once its frame is gone, or its last save would write over this.
	await expect(page.locator('.artifact-row')).toHaveCount(2);
	await page.evaluate(({ source, target }) => {
		const key = `woodles_draft_${source}`;
		const body = JSON.parse(localStorage.getItem(key)!);
		const html = `<p data-anchor="a-001">See <a data-ref-app="write" data-ref-kind="draft" data-ref-id="${target}" href="/write?draft=${target}">where it points</a>.</p>`;
		localStorage.setItem(key, JSON.stringify({ ...body, content: html, layers: { ...(body.layers ?? {}), foreground: { html } } }));
	}, { source, target });

	// The address shape from before HomeSuite joined the manifest still opens,
	// and is rewritten to the one `entityHref` builds.
	await page.goto(`/homesuite?kind=document&id=${source}`);
	await surfaceReady(page);
	await expect(page).toHaveURL(new RegExp(`/homesuite/?\\?document=${source}$`));
	await page.frameLocator('iframe.native-surface').locator('a[data-ref-id]').click({ modifiers: ['ControlOrMeta'] });
	await expect.poll(() => openId(page)).toBe(target);
	await expect(page.locator('.artifact-title')).toHaveText('Where it points');
});

test('Write and Whiteboard honor Trash, and HomeSuite leaves what they reopen alone', async ({ page }) => {
	await page.goto('/write');
	await page.locator('textarea.doc-title').fill('Kept open in Write');
	await expect.poll(() => page.evaluate(() => localStorage.getItem('woodles_active_draft_id'))).not.toBeNull();
	const writeActive = await page.evaluate(() => localStorage.getItem('woodles_active_draft_id'));

	await page.goto('/homesuite');
	await create(page, 'Document');
	const draft = openId(page);
	await page.getByRole('button', { name: 'Move to Trash' }).click();
	await create(page, 'Board');
	const board = openId(page);
	await page.getByRole('button', { name: 'Move to Trash' }).click();
	expect(await page.evaluate(() => localStorage.getItem('woodles_active_draft_id'))).toBe(writeActive);
	expect(await page.evaluate(() => localStorage.getItem('woodles.whiteboard.active.v1'))).toBeNull();

	await page.goto(`/write?draft=${draft}`);
	await expect(page.locator('.trash-notice')).toContainText('in HomeSuite’s Trash');
	await page.locator('.trash-notice').getByRole('button', { name: 'Restore' }).click();
	await expect(page.locator('.trash-notice')).toHaveCount(0);

	await page.goto(`/whiteboard?board=${board}`);
	await expect(page.locator('.trash-bar')).toContainText('in HomeSuite’s Trash');
	await page.locator('.trash-bar').getByRole('button', { name: 'Restore' }).click();
	await expect(page.locator('.trash-bar')).toHaveCount(0);

	// Both restored, beside the draft Write had open all along.
	await page.goto('/homesuite');
	await expect(page.locator('.artifact-row')).toHaveCount(3);
	await expect(page.locator('.trash-row')).toHaveCount(0);
});

test('the template picker and the palette work from the keyboard', async ({ page }) => {
	await page.goto('/homesuite');
	await page.getByRole('button', { name: /New/ }).click();
	await page.getByRole('menuitem', { name: /Collection/ }).click();
	const dialog = page.getByRole('dialog', { name: 'New collection' });
	await expect(dialog.getByRole('button', { name: /Blank/ })).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole('button', { name: /New/ })).toBeFocused();

	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeFocused();
	await page.keyboard.type('new board');
	await expect(page.getByRole('option', { name: /New board/ })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('Enter');
	await surfaceReady(page);
	await expect(page.locator('iframe.native-surface')).toHaveAttribute('src', /\/whiteboard\?board=/);
});

test('Collection edits from the inspector and number cells undo in one step', async ({ page }) => {
	await page.goto('/homesuite');
	await createCollection(page, /Media/);
	const table = page.frameLocator('iframe.native-surface');
	await table.locator('button.field-head', { hasText: 'Notes' }).click();
	await expect(page.getByLabel('Type', { exact: true })).toHaveAttribute('readonly', '');
	const name = page.getByLabel('Field name');
	await name.click();
	await name.press('End');
	await name.pressSequentially(' and asides');
	await expect(table.locator('button.field-head', { hasText: 'Notes and asides' })).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(table.locator('button.field-head', { hasText: 'Notes and asides' })).toHaveCount(0);
	await expect(table.locator('button.field-head', { hasText: 'Notes' })).toBeVisible();

	await table.getByRole('button', { name: '＋ New record' }).click();
	const rating = table.locator('input[type=number]').first();
	await rating.click();
	await rating.pressSequentially('123');
	await expect(rating).toHaveValue('123');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(rating).toHaveValue('');

	await table.locator('td.primary-cell input').first().click();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.getByRole('dialog', { name: 'HomeSuite commands' })).toBeVisible();
});

test('on a phone the inspector starts closed and the title has room', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/homesuite');
	await create(page, 'Document');
	await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);
	const overlap = await page.evaluate(() => {
		const navigation = document.querySelector('.suite-navigation')!.getBoundingClientRect();
		const actions = document.querySelector('.suite-actions')!.getBoundingClientRect();
		return navigation.right - actions.left;
	});
	expect(overlap).toBeLessThanOrEqual(0);
});

test('things are renamed from the shell’s title, as the surface’s own undoable edit', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Document');
	await expect(page).toHaveURL(/\/homesuite\/?\?document=/);
	await page.locator('.artifact-title').click();
	await page.keyboard.type('Named from the shell');
	await page.keyboard.press('Enter');
	await expect(page.frameLocator('iframe.native-surface').locator('textarea.doc-title')).toHaveValue('Named from the shell');
	await expect(page.locator('.artifact-title')).toHaveText('Named from the shell');

	await backToIndex(page);
	await createCollection(page, /Blank/);
	await page.getByRole('button', { name: /Commands/ }).click();
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('option', { name: 'Rename collection' }).first().click();
	await expect(page.getByRole('textbox', { name: 'Rename collection' })).toBeFocused();
	await page.keyboard.type('Reading list');
	await page.keyboard.press('Enter');
	await expect(page.locator('.artifact-title')).toHaveText('Reading list');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('.artifact-title')).toHaveText('Untitled collection');

	await page.locator('.artifact-title').click();
	await page.keyboard.type('Never mind');
	await page.keyboard.press('Escape');
	await expect(page.locator('.artifact-title')).toHaveText('Untitled collection');
});

test('typing in a document does not make the shell re-read every library', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Board');
	await backToIndex(page);
	await create(page, 'Document');
	await page.evaluate(() => {
		const read = Storage.prototype.getItem;
		(window as unknown as { shellReads: number }).shellReads = 0;
		Storage.prototype.getItem = function (key: string) {
			(window as unknown as { shellReads: number }).shellReads += 1;
			return read.call(this, key);
		};
	});
	const prose = page.frameLocator('iframe.native-surface').getByRole('textbox', { name: 'foreground content' });
	await prose.click();
	await prose.pressSequentially('one two three four five six seven eight nine ten');
	await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
	// Was ~90 with one artifact listed: every word re-read every library.
	expect(await page.evaluate(() => (window as unknown as { shellReads: number }).shellReads)).toBeLessThan(5);
});

for (const colorScheme of ['light', 'dark'] as const) {
	test(`HomeSuite meets WCAG AA in the ${colorScheme} scheme, index and open`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/homesuite');
		await createCollection(page, /Media/);
		const table = page.frameLocator('iframe.native-surface');
		await table.getByRole('button', { name: '＋ New record' }).click();
		await table.locator('td.primary-cell input').first().click();
		await expect(page.locator('.selection-pill')).toBeVisible();
		const open = await new AxeBuilder({ page }).exclude('iframe').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
		expect(open.violations, JSON.stringify(open.violations, null, 2)).toEqual([]);

		await backToIndex(page);
		await expect(page.locator('.artifact-row')).toHaveCount(1);
		const index = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
		expect(index.violations, JSON.stringify(index.violations, null, 2)).toEqual([]);
	});
}
