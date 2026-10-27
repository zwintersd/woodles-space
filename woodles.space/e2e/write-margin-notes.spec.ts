import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

// A margin note is matched to its paragraph by `data-anchor`. Load used to
// strip those ids and re-stamp them in document order, while a paragraph added
// mid-session takes the next free number — so after a paragraph went in above
// an annotated one, a reload moved the note onto the newcomer.

test.beforeEach(async ({ page }) => {
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) =>
		route.fulfill({ status: 200, body: '' })
	);
	await page.route('**/api/sync**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				route.request().method() === 'POST' ? { ok: true, version: 1 } : { blob: null, version: 0 }
			)
		})
	);
});

function editorOf(page: Page): Locator {
	return page.locator('[contenteditable="true"]').first();
}

async function selectParagraph(page: Page, text: string): Promise<void> {
	await page.evaluate((text) => {
		const editor = document.querySelector('[contenteditable="true"]')!;
		const block = Array.from(editor.querySelectorAll('[data-anchor]')).find(
			(el) => el.textContent === text
		)!;
		const range = document.createRange();
		range.selectNodeContents(block);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
	}, text);
}

async function caretAt(page: Page, edge: 'start' | 'end', text: string): Promise<void> {
	await page.evaluate(([edge, text]) => {
		const editor = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
		const block = Array.from(editor.querySelectorAll('[data-anchor]')).find(
			(el) => el.textContent === text
		)!;
		editor.focus();
		const range = document.createRange();
		range.selectNodeContents(block);
		range.collapse(edge === 'start');
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
	}, [edge, text] as const);
}

async function removeParagraph(page: Page, text: string): Promise<void> {
	await page.evaluate((text) => {
		const editor = document.querySelector('[contenteditable="true"]')!;
		Array.from(editor.querySelectorAll('[data-anchor]'))
			.find((el) => el.textContent === text)!
			.remove();
		editor.dispatchEvent(new Event('input', { bubbles: true }));
	}, text);
}

/** The one visible margin note sits beside this paragraph, by id and by position. */
async function expectNoteBeside(page: Page, text: string): Promise<void> {
	const ref = page.locator('.margin-anchor-ref');
	await expect(ref).toHaveCount(1);
	const anchorId = (await ref.textContent())!.trim();
	const block = editorOf(page).locator(`[data-anchor="${anchorId}"]`);
	await expect(block).toHaveText(text);

	await expect
		.poll(async () => {
			const group = await page.locator('.margin-group').boundingBox();
			const target = await block.boundingBox();
			return group && target ? Math.abs(group.y - target.y) : Infinity;
		})
		.toBeLessThan(4);
}

/** Wait out the save debounce, so a reload reads what's on the page. */
async function waitForSave(page: Page, contains: string[], lacks: string[] = []): Promise<void> {
	await page.waitForFunction(
		([contains, lacks]) => {
			const id = localStorage.getItem('woodles_active_draft_id');
			const raw = id ? localStorage.getItem('woodles_draft_' + id) : null;
			return !!raw && contains.every((s) => raw.includes(s)) && !lacks.some((s) => raw.includes(s));
		},
		[contains, lacks]
	);
	await expect(page.locator('.save-status')).toHaveText('saved');
}

async function writeThreeAndAnnotateThird(page: Page): Promise<void> {
	await page.goto('/write');
	const editor = editorOf(page);
	await editor.click();
	await editor.pressSequentially('Intro line.');
	await page.keyboard.press('Enter');
	await editor.pressSequentially('Second paragraph.');
	await page.keyboard.press('Enter');
	await editor.pressSequentially('Third paragraph.');

	await selectParagraph(page, 'Third paragraph.');
	await page.getByRole('button', { name: '+ note' }).click();
	await page.keyboard.type('about the third');
	await expectNoteBeside(page, 'Third paragraph.');
}

test('a margin note stays on its paragraph after one is inserted above it and the page reloads', async ({
	page
}) => {
	await expectNoPageErrors(page, async () => {
		await writeThreeAndAnnotateThird(page);

		await caretAt(page, 'end', 'Second paragraph.');
		await page.keyboard.press('Enter');
		await editorOf(page).pressSequentially('Inserted later.');
		await expectNoteBeside(page, 'Third paragraph.');
		await waitForSave(page, ['Inserted later.', 'about the third']);

		await page.reload();
		await expect(editorOf(page)).toContainText('Inserted later.');
		await expectNoteBeside(page, 'Third paragraph.');
		await expect(page.locator('.margin-body')).toHaveText('about the third');

		// And the published letter carries the same ids as its notes.
		await page.getByRole('button', { name: 'Publish →' }).click();
		await expect(page).toHaveURL(/\/letter$/);
		const published = await page.evaluate(() => {
			const letter = JSON.parse(localStorage.getItem('woodles_letters') || '[]')[0];
			const root = document.createElement('div');
			root.innerHTML = letter.layers.foreground.html;
			const anchorId = letter.annotations.marginNotes[0].anchorId;
			return root.querySelector(`[data-anchor="${anchorId}"]`)?.textContent;
		});
		expect(published).toBe('Third paragraph.');
	});
});

test('Enter at the start of an annotated paragraph opens a line above it, not under its note', async ({
	page
}) => {
	await expectNoPageErrors(page, async () => {
		await writeThreeAndAnnotateThird(page);

		// Chromium splits by cloning the paragraph, id included, and puts the clone first.
		await caretAt(page, 'start', 'Third paragraph.');
		await page.keyboard.press('Enter');
		await page.keyboard.press('ArrowUp');
		await editorOf(page).pressSequentially('Above.');
		await expectNoteBeside(page, 'Third paragraph.');
		await waitForSave(page, ['Above.']);

		await page.reload();
		await expectNoteBeside(page, 'Third paragraph.');
	});
});

test('a margin note stays on its paragraph after the one above it is deleted', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await writeThreeAndAnnotateThird(page);

		await removeParagraph(page, 'Second paragraph.');
		await expectNoteBeside(page, 'Third paragraph.');
		await waitForSave(page, ['about the third'], ['Second paragraph.']);

		await page.reload();
		await expect(editorOf(page)).toContainText('Third paragraph.');
		await expectNoteBeside(page, 'Third paragraph.');
	});
});

test('a new paragraph does not inherit the note of one that was deleted', async ({ page }) => {
	await expectNoPageErrors(page, async () => {
		await writeThreeAndAnnotateThird(page);

		// Take the annotated paragraph out, then write a new ending in its place.
		await removeParagraph(page, 'Third paragraph.');
		await expect(page.locator('.margin-anchor-ref')).toHaveCount(0);
		await caretAt(page, 'end', 'Second paragraph.');
		await page.keyboard.press('Enter');
		await editorOf(page).pressSequentially('A new ending.');
		await expect(page.locator('.margin-anchor-ref')).toHaveCount(0);
		await waitForSave(page, ['A new ending.']);

		await page.reload();
		await expect(editorOf(page)).toContainText('A new ending.');
		await expect(page.locator('.margin-anchor-ref')).toHaveCount(0);
	});
});
