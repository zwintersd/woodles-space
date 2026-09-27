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
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('button', { name: /Add card/ }).click();
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
	await page.getByRole('dialog', { name: 'HomeSuite commands' }).getByRole('button', { name: /Add card/ }).click();
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
	await page.locator('.artifact-row', { hasText: 'Untitled collection' }).click();
	await surfaceReady(page);
	await expect(table.locator('td.primary-cell input').first()).toHaveValue('Fern');
});

test('walking through a portal takes the shell along, so Trash takes the board on screen', async ({ page }) => {
	await page.goto('/homesuite');
	await create(page, 'Board');
	const startingId = new URL(page.url()).searchParams.get('id');
	const board = page.frameLocator('iframe.native-surface');
	await board.getByRole('button', { name: 'Add a way through to another board' }).click();
	await board.getByRole('group', { name: /^Way through to/ }).dblclick();

	await expect.poll(() => new URL(page.url()).searchParams.get('id')).not.toBe(startingId);
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
