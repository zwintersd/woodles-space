import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function newFolder(page: Page, name: string): Promise<string> {
	await page.getByRole('button', { name: '＋ New folder', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'New folder', exact: true });
	await expect(dialog.getByLabel('Folder name')).toBeFocused();
	await dialog.getByLabel('Folder name').fill(name);
	await dialog.getByRole('button', { name: 'Create folder', exact: true }).click();
	await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
	return new URL(page.url()).searchParams.get('folder')!;
}

async function newFile(page: Page, kind: 'Document' | 'Board' | 'Collection', title: string): Promise<void> {
	await page.getByRole('button', { name: '＋ New', exact: true }).click();
	await page.getByRole('menuitem', { name: kind, exact: true }).click();
	if (kind === 'Collection') await page.getByRole('dialog', { name: 'New collection' }).getByRole('button', { name: /^Blank / }).click();
	await expect(page.locator('iframe.native-surface')).toBeVisible();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	await page.locator('.artifact-title').click();
	const rename = page.getByRole('textbox', { name: `Rename ${kind.toLowerCase()}` });
	await rename.fill(title); await rename.press('Enter');
	await expect(page.locator('.artifact-title')).toHaveText(title);
	await page.locator('.back-link').click();
	await expect(page.locator('iframe.native-surface')).toHaveCount(0);
}

async function allFiles(page: Page): Promise<void> {
	await page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: 'All files', exact: true }).click();
	await expect(page).toHaveURL(/\/homesuite\/?$/);
}

async function fileMove(page: Page, title: string, destination: string): Promise<void> {
	await page.getByRole('button', { name: `Actions for ${title}`, exact: true }).click();
	await page.getByRole('menuitem', { name: 'Move to folder…', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Move to folder', exact: true });
	await dialog.getByRole('button', { name: destination, exact: true }).click();
	await dialog.getByRole('button', { name: 'Move here', exact: true }).click();
	await expect(dialog).toHaveCount(0);
}

async function folderAction(page: Page, name: string, action: string): Promise<void> {
	await page.getByRole('button', { name: `Folder actions for ${name}`, exact: true }).click();
	await page.getByRole('menuitem', { name: new RegExp(`^${action}`) }).click();
}

test('bulk organizes mixed native files and persists their identity, content, and placement', async ({ page }) => {
	await page.goto('/homesuite');
	await newFile(page, 'Document', 'Project notes');
	await newFile(page, 'Board', 'Project map');
	await newFile(page, 'Collection', 'Project tasks');
	const sourceBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
		.filter((key) => /^(woodles_draft|woodles\.whiteboard|woodles\.data)/.test(key)).map((key) => [key, localStorage.getItem(key)])));
	const project = await newFolder(page, 'Project');
	await allFiles(page);
	await page.getByRole('checkbox', { name: 'Select all visible files', exact: true }).check();
	await expect(page.locator('.file-selection-bar')).toContainText('3 selected');
	await page.getByRole('button', { name: 'Move to folder…', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Move to folder', exact: true });
	await dialog.getByRole('button', { name: 'Project', exact: true }).click();
	await dialog.getByRole('button', { name: 'Move here' }).click();
	const sourceAfter = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
		.filter((key) => /^(woodles_draft|woodles\.whiteboard|woodles\.data)/.test(key)).map((key) => [key, localStorage.getItem(key)])));
	expect(sourceAfter).toEqual(sourceBefore);
	await page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: 'Project', exact: true }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(3);
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`folder=${project}`));
	await expect(page.locator('.artifact-row')).toHaveCount(3);
	await page.getByRole('button', { name: /Documents/ }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(1);
	await page.getByLabel('Find a thing').fill('missing');
	await expect(page.getByRole('heading', { name: 'Nothing by that name yet.' })).toBeVisible();
	await allFiles(page);
	await page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: /Unfiled/ }).click();
	await expect(page.locator('.artifact-row')).toHaveCount(0);
	await allFiles(page);
	await expect(page.locator('.artifact-row')).toHaveCount(3);
});

test('creates in nested folders, renames and moves folders, and removes them without removing files', async ({ page }) => {
	await page.goto('/homesuite');
	const parent = await newFolder(page, 'Project');
	const child = await newFolder(page, 'Research');
	await newFile(page, 'Document', 'Kept note');
	await expect(page).toHaveURL(new RegExp(`folder=${child}`));
	await expect(page.getByRole('navigation', { name: 'Folder breadcrumbs' }).getByRole('button')).toHaveText(['All files', 'Project', 'Research']);
	await folderAction(page, 'Research', 'Rename folder…');
	const rename = page.getByRole('dialog', { name: 'Rename folder', exact: true });
	await rename.getByLabel('Folder name').fill('References');
	await rename.getByRole('button', { name: 'Save name' }).click();
	await expect(page.getByRole('heading', { name: 'References', exact: true })).toBeVisible();
	await folderAction(page, 'Project', 'Move folder…');
	const move = page.getByRole('dialog', { name: 'Move folder', exact: true });
	await expect(move.getByRole('button', { name: 'Project / References', exact: true })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await folderAction(page, 'References', 'Remove folder…');
	await page.getByRole('dialog', { name: 'Remove folder', exact: true }).getByRole('button', { name: 'Remove folder', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`folder=${parent}`));
	await expect(page.locator('.artifact-row')).toContainText('Kept note');
	await allFiles(page);
	const archive = await newFolder(page, 'Archive');
	await folderAction(page, 'Project', 'Move folder…');
	const destination = page.getByRole('dialog', { name: 'Move folder', exact: true });
	await destination.getByRole('button', { name: 'Archive', exact: true }).click();
	await destination.getByRole('button', { name: 'Move here' }).click();
	await page.reload();
	await expect(page).toHaveURL(new RegExp(`folder=${archive}`));
	await expect(page.locator('.child-folders')).toContainText('Project');
	await folderAction(page, 'Archive', 'Remove folder…');
	await page.getByRole('dialog', { name: 'Remove folder', exact: true }).getByRole('button', { name: 'Remove folder', exact: true }).click();
	await expect(page.locator('.child-folders')).toContainText('Project');
	await fileMove(page, 'Kept note', 'Unfiled');
	await page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: /Unfiled/ }).click();
	await expect(page.locator('.artifact-row')).toContainText('Kept note');
});

test('keeps folder placement through Trash and restore and supports moving the open file', async ({ page }) => {
	await page.goto('/homesuite');
	const folder = await newFolder(page, 'Writing');
	await newFile(page, 'Document', 'A thought');
	await page.locator('.artifact-row-open').click();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	const prose = page.frameLocator('iframe.native-surface').getByRole('textbox', { name: 'foreground content' });
	await prose.fill('Keep this content through organization.');
	await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`folder=${folder}`));
	await page.getByRole('button', { name: /^Trash/ }).click();
	await page.getByRole('button', { name: 'Restore', exact: true }).click();
	await page.getByRole('button', { name: 'Workspace', exact: true }).click();
	await expect(page.locator('.artifact-row')).toContainText('A thought');
	await page.locator('.artifact-row-open').click();
	await expect(page.locator('.surface-veil')).toHaveCount(0);
	await expect(prose).toContainText('Keep this content through organization.');
	await page.getByRole('button', { name: 'Actions for document', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Move to folder…', exact: true }).click();
	const move = page.getByRole('dialog', { name: 'Move to folder', exact: true });
	await move.getByRole('button', { name: 'Unfiled', exact: true }).click();
	await move.getByRole('button', { name: 'Move here' }).click();
	await page.locator('.back-link').click();
	await expect(page.locator('.artifact-row')).toHaveCount(0);
	await page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: /Unfiled/ }).click();
	await expect(page.locator('.artifact-row')).toContainText('A thought');
});

test('updates folder organization across tabs without overwriting sibling folders', async ({ page, context }) => {
	await page.goto('/homesuite');
	await newFolder(page, 'First');
	const second = await context.newPage();
	await second.goto('/homesuite');
	await newFolder(second, 'Second');
	await expect(page.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: 'Second', exact: true })).toBeVisible();
	await folderAction(page, 'First', 'Rename folder…');
	const rename = page.getByRole('dialog', { name: 'Rename folder', exact: true });
	await rename.getByLabel('Folder name').fill('Renamed');
	await rename.getByRole('button', { name: 'Save name' }).click();
	await expect(second.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: 'Renamed', exact: true })).toBeVisible();
	await second.reload();
	await expect(second.getByRole('navigation', { name: 'Folder navigation' }).getByRole('button', { name: 'Second', exact: true })).toBeVisible();
});

test('a short phone keeps move actions visible with many folders and a filtered selection', async ({ page }) => {
	await page.goto('/homesuite');
	await newFile(page, 'Document', 'Selected note');
	await page.evaluate(() => localStorage.setItem('woodles.homesuite.folders.v1', JSON.stringify({
		woodles: 'woodles-persistence', schemaVersion: 1, savedAt: new Date().toISOString(),
		data: { folders: Array.from({ length: 30 }, (_, index) => ({ id: `folder-${index}`, name: `Folder ${String(index).padStart(2, '0')}`, parentId: null })), placements: [] }
	})));
	await page.setViewportSize({ width: 390, height: 500 });
	await page.reload();
	await page.getByRole('checkbox', { name: 'Select Selected note', exact: true }).check();
	await page.getByLabel('Find a thing').fill('no matching file');
	await expect(page.locator('.artifact-row')).toHaveCount(0);
	await page.getByRole('button', { name: 'Move to folder…', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Move to folder', exact: true });
	const move = dialog.getByRole('button', { name: 'Move here', exact: true });
	const box = (await move.boundingBox())!;
	expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(500);
	expect(await dialog.locator('.folder-dialog-body').evaluate((body) => body.scrollHeight > body.clientHeight)).toBe(true);
	await dialog.getByLabel('Find a folder').fill('Folder 29');
	await dialog.getByRole('button', { name: 'Folder 29', exact: true }).click();
	await page.screenshot({ path: 'test-results/homesuite-folder-short-phone.png', fullPage: true });
	await move.click();
	await page.getByLabel('Find a thing').fill('');
	await expect(page.locator('.artifact-row')).toContainText('Folder 29');
});

for (const colorScheme of ['light', 'dark'] as const) {
	test(`folders and dialogs are accessible at wide and phone widths in ${colorScheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/homesuite');
		await newFolder(page, 'Creative projects');
		await newFolder(page, 'Ideas and research');
		await newFile(page, 'Document', 'Sketchbook notes');
		await allFiles(page);
		for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
			await page.setViewportSize(viewport);
			await page.screenshot({ path: `test-results/homesuite-folders-${colorScheme}-${viewport.width}.png`, fullPage: true });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
			const index = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(index.violations, JSON.stringify(index.violations, null, 2)).toEqual([]);
			await page.getByRole('button', { name: 'Actions for Sketchbook notes', exact: true }).click();
			await page.getByRole('menuitem', { name: 'Move to folder…', exact: true }).click();
			const move = page.getByRole('dialog', { name: 'Move to folder', exact: true });
			await expect(move.getByLabel('Find a folder')).toBeFocused();
			await page.screenshot({ path: `test-results/homesuite-folder-dialog-${colorScheme}-${viewport.width}.png`, fullPage: true });
			const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
			expect(dialog.violations, JSON.stringify(dialog.violations, null, 2)).toEqual([]);
			await page.keyboard.press('Escape');
		}
	});
}
