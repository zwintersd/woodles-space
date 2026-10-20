import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

// Write's own right-click menu for its prose. Each edit has to land in the
// layer, survive the sanitize on reload, and stay one step of the browser's
// undo — the three places a formatting change can quietly go wrong.

test.beforeEach(async ({ page }) => {
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
	await page.route('**/api/sync**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(route.request().method() === 'POST' ? { ok: true, version: 1 } : { blob: null, version: 0 })
		})
	);
});

const foreground = (page: Page) => page.getByRole('textbox', { name: 'foreground content' });
const formatMenu = (page: Page) => page.getByRole('menu', { name: 'format text' });

async function write(page: Page, ...paragraphs: string[]) {
	await page.goto('/write');
	await foreground(page).click();
	for (const [index, paragraph] of paragraphs.entries()) {
		if (index > 0) await page.keyboard.press('Enter');
		await page.keyboard.type(paragraph);
	}
}

async function wordPoint(page: Page, word: string) {
	const point = await foreground(page).evaluate((el, word) => {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const index = node.textContent!.indexOf(word);
			if (index < 0) continue;
			const range = document.createRange();
			range.setStart(node, index);
			range.setEnd(node, index + word.length);
			const rect = range.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return null;
	}, word);
	expect(point, `"${word}" is on the page`).not.toBeNull();
	return point!;
}

async function rightClickWord(page: Page, word: string) {
	const point = await wordPoint(page, word);
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await expect(formatMenu(page)).toBeVisible();
}

async function reloadSaved(page: Page) {
	await expect(page.locator('.save-status')).toHaveText('saved');
	await page.reload();
	await expect(foreground(page)).not.toBeEmpty();
}

test('right-clicking a word selects it, formats it, and the format survives a reload', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await write(page, 'The peonies opened overnight.');
		await rightClickWord(page, 'peonies');
		expect(await page.evaluate(() => getSelection()?.toString())).toBe('peonies');
		await expect(formatMenu(page)).toContainText('“peonies”');

		await formatMenu(page).getByRole('menuitemcheckbox', { name: 'bold' }).click();
		await expect(formatMenu(page)).toBeHidden();
		expect(await foreground(page).innerHTML()).toContain('<b>peonies</b>');

		await reloadSaved(page);
		expect(await foreground(page).innerHTML()).toContain('<b>peonies</b>');

		// Bold reads as on, so bold again takes it off rather than nesting another.
		await rightClickWord(page, 'peonies');
		await expect(formatMenu(page).getByRole('menuitemcheckbox', { name: 'bold' })).toHaveAttribute('aria-checked', 'true');
		await formatMenu(page).getByRole('menuitemcheckbox', { name: 'bold' }).click();
		expect(await foreground(page).innerHTML()).toBe('The peonies opened overnight.');
	});
});

test('highlight is one undo step', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await write(page, 'The peonies opened overnight.');
		await rightClickWord(page, 'overnight');
		await formatMenu(page).getByRole('menuitemcheckbox', { name: 'highlight' }).click();
		expect(await foreground(page).innerHTML()).toContain('<mark>overnight</mark>');

		await page.keyboard.press('ControlOrMeta+z');
		expect(await foreground(page).innerHTML()).toBe('The peonies opened overnight.');
	});
});

test('lists sit beside paragraphs instead of inside them, from the menu and the toolbar', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await write(page, 'One.', 'Two.', 'Three.');
		await rightClickWord(page, 'Two');
		await formatMenu(page).getByRole('menuitemradio', { name: 'bulleted list' }).click();

		const point = await wordPoint(page, 'Three');
		await page.mouse.click(point.x, point.y);
		await page.getByTitle('Bullet list').click();

		const html = await foreground(page).innerHTML();
		expect(html).toMatch(/<ul[^>]*><li[^>]*>Two\.<\/li><li[^>]*>Three\.<\/li><\/ul>/);
		expect(html).not.toContain('<p><ul');

		await rightClickWord(page, 'Two');
		await expect(formatMenu(page).getByRole('menuitemradio', { name: 'bulleted list' })).toHaveAttribute('aria-checked', 'true');
		await formatMenu(page).getByRole('menuitemradio', { name: 'heading', exact: true }).click();
		expect(await foreground(page).innerHTML()).toMatch(/<h1[^>]*>Two\.<\/h1><ul[^>]*><li[^>]*>Three\.<\/li><\/ul>/);

		// Chrome's own list command left the list inside a <p>, which reloads
		// as two empty paragraphs around it.
		await reloadSaved(page);
		expect(await foreground(page).innerHTML()).not.toContain('<p></p>');
	});
});

test('links: a bare address gets https, and a link can be edited and removed', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await write(page, 'Notes from the garden.');
		await rightClickWord(page, 'garden');
		await formatMenu(page).getByRole('menuitem', { name: 'link…' }).click();
		const linkField = page.getByRole('dialog', { name: 'link' });
		const field = linkField.getByLabel('link to');
		await field.fill('two words');
		await page.keyboard.press('Enter');
		await expect(linkField).toContainText('a web or email address');

		await field.fill('example.com');
		await page.keyboard.press('Enter');
		await expect(linkField).toBeHidden();
		expect(await foreground(page).innerHTML()).toContain('<a href="https://example.com">garden</a>');

		await rightClickWord(page, 'garden');
		await formatMenu(page).getByRole('menuitem', { name: 'edit link…' }).click();
		await expect(linkField.getByLabel('edit link')).toHaveValue('https://example.com');
		await linkField.getByLabel('edit link').fill('https://woodles.space');
		await page.keyboard.press('Enter');
		expect(await foreground(page).innerHTML()).toContain('<a href="https://woodles.space">garden</a>');

		await rightClickWord(page, 'garden');
		await formatMenu(page).getByRole('menuitem', { name: 'remove link' }).click();
		expect(await foreground(page).innerHTML()).toBe('Notes from the garden.');
	});
});

test('shift and right-click leaves the browser its own menu, for spelling', async ({ page }) => {
	await write(page, 'A mispeled word.');
	const point = await wordPoint(page, 'mispeled');
	await page.keyboard.down('Shift');
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await page.keyboard.up('Shift');
	await expect(formatMenu(page)).toHaveCount(0);
});

test('the keyboard opens it at the caret, walks it, and Escape gives the selection back', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await write(page, 'A quiet line.');
		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+F10');
		await expect(formatMenu(page)).toBeVisible();
		await expect(formatMenu(page).getByRole('menuitemcheckbox', { name: 'bold' })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(formatMenu(page)).toBeHidden();
		await expect(foreground(page)).toBeFocused();
		expect(await page.evaluate(() => getSelection()?.toString())).toBe('e.');

		await page.keyboard.press('Shift+F10');
		await page.keyboard.press('ArrowDown');
		await expect(formatMenu(page).getByRole('menuitemradio', { name: 'text' })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(formatMenu(page).getByRole('menuitemradio', { name: 'heading', exact: true })).toBeFocused();
		await page.keyboard.press('Enter');
		expect(await foreground(page).innerHTML()).toMatch(/^<h1[^>]*>A quiet line\.<\/h1>$/);
	});
});

test('paste as plain text drops the formatting it was copied with', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await expectNoPageErrors(page, async () => {
		await write(page, 'Bold words here.');
		await rightClickWord(page, 'Bold');
		await formatMenu(page).getByRole('menuitemcheckbox', { name: 'bold' }).click();
		await rightClickWord(page, 'Bold');
		await formatMenu(page).getByRole('menuitem', { name: /^copy/ }).click();

		await page.keyboard.press('End');
		await page.keyboard.type(' ');
		await page.keyboard.press('Shift+F10');
		await formatMenu(page).getByRole('menuitem', { name: /^paste as plain text/ }).click();
		await expect.poll(() => foreground(page).innerHTML()).toBe('<b>Bold</b> words here. Bold');
	});
});

test('the menu and its link field have no serious or critical accessibility violations', async ({ page }) => {
	const audit = async () => {
		const results = await new AxeBuilder({ page }).include('[data-testid="format-menu"]').withTags(['wcag2a', 'wcag21a']).analyze();
		const violations = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
	};
	await write(page, 'Notes from the garden.');
	await rightClickWord(page, 'garden');
	await audit();
	await formatMenu(page).getByRole('menuitem', { name: 'link…' }).click();
	await expect(page.getByRole('dialog', { name: 'link' })).toBeVisible();
	await audit();
});

test('a right-click in the blank page after the writing does not grab the last word', async ({ page }) => {
	await write(page, 'The last word');
	const box = (await foreground(page).boundingBox())!;
	await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40, { button: 'right' });
	await expect(formatMenu(page)).toBeVisible();
	expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(true);
	await expect(formatMenu(page)).toContainText('at the caret');
});
