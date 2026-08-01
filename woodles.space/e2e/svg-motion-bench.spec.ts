import { expect, test, type Page } from '@playwright/test';

async function loadSample(page: Page, name: RegExp) {
	const sampleSelect = page.getByLabel('Example picture');
	const options = sampleSelect.locator('option');
	let value: string | null = null;

	for (let index = 0; index < (await options.count()); index += 1) {
		const option = options.nth(index);
		if (name.test((await option.textContent()) ?? '')) {
			value = await option.getAttribute('value');
			break;
		}
	}

	expect(value, `missing example picture matching ${name}`).not.toBeNull();
	await sampleSelect.selectOption(value!);
	await page.getByRole('button', { name: 'Open example', exact: true }).click();
	await expect(page.locator('#source-status')).toContainText(/is ready/i);
}

async function openUnderTheHood(page: Page) {
	const details = page.getByTestId('under-the-hood');
	if ((await details.getAttribute('open')) === null) await details.locator('summary').first().click();
	await expect(details).toHaveAttribute('open', '');
}

async function openStep(page: Page, index: number) {
	const details = page.getByTestId('timeline-list').locator('.step-details').nth(index);
	if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
	await expect(details).toHaveAttribute('open', '');
	return details;
}

test.describe('Hygge picture motion studio', () => {
	test('starts with a plain-language flow and keeps technical machinery optional', async ({ page }) => {
		await page.goto('/hygge/motion/svg');

		await expect(page.getByRole('heading', { name: 'make your picture move.' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'bring in a picture' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'build the movement' })).toBeVisible();
		await expect(page.getByLabel('Example picture')).toBeVisible();
		await expect(page.getByLabel('Choose an SVG picture')).toBeAttached();
		await expect(page.getByText('Choose a picture', { exact: true })).toBeVisible();

		const pasteDrawing = page.getByTestId('paste-drawing');
		await expect(pasteDrawing).not.toHaveAttribute('open', '');
		await expect(page.getByLabel('Paste an SVG')).toBeHidden();
		await pasteDrawing.locator('summary').click();
		await expect(page.getByLabel('Paste an SVG')).toBeVisible();

		const advanced = page.getByTestId('under-the-hood');
		await expect(advanced).not.toHaveAttribute('open', '');
		await expect(page.getByTestId('recipe-json')).toBeHidden();
		await expect(page.getByText('Manim handoff')).toBeHidden();
		const friendlyText = await page.locator('body').innerText();
		expect(friendlyText).not.toMatch(/checkpoint|stagger ratio|radians/i);

		await openUnderTheHood(page);
		await expect(page.getByTestId('recipe-json')).toBeVisible();
		await expect(page.getByText('Manim handoff')).toBeVisible();
	});

	test('renames and recolors pieces while stable recipe IDs stay intact', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /triple corn/i);

		await expect(page.locator('#source-path')).toContainText(/triple-corn\.svg/i);
		await expect(page.locator('#source-hash')).not.toBeEmpty();
		await expect(page.getByRole('group', { name: 'Animated picture preview' })).toBeVisible();

		const partButtons = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ });
		await expect(partButtons).toHaveCount(9);
		await expect(page.locator('#selected-panel')).toBeHidden();
		await partButtons.first().click();
		await expect(page.locator('#selected-panel')).toBeVisible();

		const pieceName = page.getByLabel('Piece name');
		await pieceName.fill('sunny leaf');
		await pieceName.press('Tab');
		await expect(page.getByTestId('part-map').getByRole('button', { name: /sunny leaf/i })).toBeVisible();

		const familyName = page.getByLabel('Name for leaves color family');
		await familyName.fill('green leaves');
		await familyName.press('Tab');
		await expect(page.getByLabel('Name for green leaves color family')).toHaveValue('green leaves');

		const familyColor = page.getByLabel('Color for green leaves');
		await familyColor.fill('#7a5cff');
		await expect(familyColor).toHaveValue('#7a5cff');

		const firstStep = await openStep(page, 0);
		const targets = firstStep.getByLabel('Step 1 pieces').locator('option');
		await expect(targets.filter({ hasText: 'the green leaves family' })).toHaveCount(1);
		await expect(targets.filter({ hasText: 'just sunny leaf' })).toHaveCount(1);

		const length = firstStep.getByLabel('Step 1 length in seconds');
		await length.fill('0.75');
		await length.press('Tab');

		await page.getByRole('button', { name: 'Hide this piece' }).click();
		await expect(page.getByRole('button', { name: 'Bring this piece back' })).toBeVisible();
		await page.getByRole('button', { name: 'Bring this piece back' }).click();
		await expect(page.getByRole('button', { name: 'Hide this piece' })).toBeVisible();

		await openUnderTheHood(page);
		const recipeJson = page.getByTestId('recipe-json');
		const recipe = JSON.parse(await recipeJson.inputValue());
		expect(recipe.parts.find((part: { id: string }) => part.id === 'leaf-a')).toMatchObject({
			id: 'leaf-a',
			label: 'sunny leaf',
			group: 'leaves'
		});
		expect(recipe.groups.find((group: { id: string }) => group.id === 'leaves')).toMatchObject({
			id: 'leaves',
			label: 'green leaves',
			color: '#7a5cff'
		});
		expect(recipe.timeline[0].duration).toBe(0.75);

		const editedJson = (await recipeJson.inputValue()).replace('"duration": 0.75', '"duration": 1.25');
		await recipeJson.fill(editedJson);
		await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
		await expect(page.getByLabel('Step 1 length in seconds')).toHaveValue('1.25');
	});

	test('uses friendly motion names while preserving exact verbs and angle units', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		await page.getByLabel('What should happen next?').selectOption({ label: 'move, turn, or resize' });
		await page.getByRole('button', { name: 'Add this motion' }).click();
		const lastStep = page.getByTestId('timeline-list').locator('.step-details').last();
		await expect(lastStep).toHaveAttribute('open', '');
		await expect(lastStep.locator('summary')).toContainText('Move, turn, or resize');

		await lastStep.getByLabel(/turn in degrees/i).fill('90');
		await lastStep.getByLabel(/turn in degrees/i).press('Tab');
		let recipe = JSON.parse(await page.getByTestId('recipe-json').inputValue());
		expect(recipe.timeline.at(-1)).toMatchObject({ verb: 'transform', mode: 'together' });
		expect(recipe.timeline.at(-1).rotate).toBeCloseTo(Math.PI / 2, 6);

		await lastStep.getByLabel('Step 9 movement').selectOption({ label: 'spread the pieces outward' });
		await page.getByTestId('timeline-list').locator('.step-details').last().getByLabel(/extra turn per piece in degrees/i).fill('30');
		await page.getByTestId('timeline-list').locator('.step-details').last().getByLabel(/extra turn per piece in degrees/i).press('Tab');
		recipe = JSON.parse(await page.getByTestId('recipe-json').inputValue());
		expect(recipe.timeline.at(-1)).toMatchObject({ verb: 'transform', mode: 'radial' });
		expect(recipe.timeline.at(-1).rotationStep).toBeCloseTo(Math.PI / 6, 6);

		const visibleText = await page.locator('body').innerText();
		expect(visibleText).not.toMatch(/rotate · radians|transform mode|stagger ratio/i);
	});

	test('undoes and starts over from visible save controls', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		await page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ }).first().click();
		const label = page.getByLabel('Piece name');
		const originalLabel = await label.inputValue();

		await label.fill('faceted test glyph');
		await label.press('Tab');
		await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
		await expect(label).toHaveValue(originalLabel);

		await label.fill('temporary label');
		await label.press('Tab');
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Start over with original picture', exact: true }).click();
		await expect(label).toHaveValue(originalLabel);
		await expect(page.locator('#save-status')).toContainText('original');
	});

	test('keeps the triple-corn backdrop as an explicit piece choice', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /triple corn/i);

		const parts = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ });
		await expect(parts).toHaveCount(9);
		await expect(page.locator('#omitted-note')).toContainText('1 extra piece');
		await page.getByRole('button', { name: 'Add another piece', exact: true }).click();
		await expect(parts).toHaveCount(10);
		await expect(page.locator('#omitted-note')).toContainText('Every piece');
		await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
		await expect(parts).toHaveCount(9);
	});

	test('downloads friendly draft files and reveals the exact render handoff on demand', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		const motionDownload = page.waitForEvent('download');
		await page.getByRole('button', { name: 'download motion', exact: true }).click();
		expect((await motionDownload).suggestedFilename()).toMatch(/\.json$/i);

		const drawingDownload = page.waitForEvent('download');
		await page.getByRole('button', { name: 'download drawing', exact: true }).click();
		expect((await drawingDownload).suggestedFilename()).toMatch(/\.svg$/i);

		await expect(page.locator('#render-command')).toBeHidden();
		await openUnderTheHood(page);
		await expect(page.locator('#render-command')).toHaveValue(/python|manim/i);
		await expect(page.locator('#render-command')).toHaveValue(/diamond/i);
		await expect(page.getByRole('button', { name: 'Copy render command', exact: true })).toBeEnabled();
	});

	test('does not autoplay when reduced motion is preferred', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /triple corn/i);

		await expect(page.locator('#playback-status')).toContainText(/motion reduced/i);
		await expect(page.locator('#preview-stage')).toHaveAttribute('data-playing', 'false');
		const preview = page.getByRole('group', { name: 'Animated picture preview' });
		await expect(preview).toBeVisible();
		expect(
			await preview.evaluate((element) =>
				element.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
			)
		).toBe(true);
		await expect(page.getByRole('button', { name: 'Play motion', exact: true })).toBeVisible();
	});

	test('plays and pauses only through explicit transport controls', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		const stage = page.locator('#preview-stage');
		await page.getByRole('button', { name: 'Play motion', exact: true }).click();
		await expect(stage).toHaveAttribute('data-playing', 'true');
		await expect(page.locator('#playback-status')).toContainText('playing');
		await expect.poll(() => page.locator('#preview-svg').evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
		await expect(page.locator('#playback-status')).toContainText('paused');
		expect(
			await page.locator('#preview-svg').evaluate((svg) =>
				svg.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
			)
		).toBe(true);
	});

	test('reconstructs pasted shapes without importing active SVG content', async ({ page }) => {
		let dialogs = 0;
		page.on('dialog', async (dialog) => {
			dialogs += 1;
			await dialog.dismiss();
		});
		await page.goto('/hygge/motion/svg');
		await page.getByTestId('paste-drawing').locator('summary').click();
		await page.getByLabel('Paste an SVG').fill(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><path onload="alert(2)" d="M1 1L9 1L5 9Z" /></svg>'
		);
		await page.getByRole('button', { name: 'Open pasted picture' }).click();

		await expect(page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ })).toHaveCount(1);
		await expect(page.locator('#preview-geometry path')).toHaveCount(1);
		await openUnderTheHood(page);
		const audit = page.getByTestId('safety-audit');
		await expect(audit).not.toHaveAttribute('open', '');
		await expect(page.locator('#safety-warnings')).toBeHidden();
		await audit.locator('summary').click();
		await expect(page.locator('#safety-warnings')).toContainText(/ignored 2|removed 1/i);
		expect(dialogs).toBe(0);
	});

	test('fits the friendly flow and expanded technical drawer on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		await expect(page.getByRole('group', { name: 'Animated picture preview' })).toBeVisible();
		await expect(page.getByTestId('recipe-json')).toBeHidden();
		const widthsBefore = await page.evaluate(() => ({
			viewport: window.innerWidth,
			document: document.documentElement.scrollWidth,
			body: document.body.scrollWidth
		}));
		expect(Math.max(widthsBefore.document, widthsBefore.body)).toBeLessThanOrEqual(widthsBefore.viewport + 1);

		await openUnderTheHood(page);
		await expect(page.getByTestId('recipe-json')).toBeVisible();
		const widthsAfter = await page.evaluate(() => ({
			viewport: window.innerWidth,
			document: document.documentElement.scrollWidth,
			body: document.body.scrollWidth
		}));
		expect(Math.max(widthsAfter.document, widthsAfter.body)).toBeLessThanOrEqual(widthsAfter.viewport + 1);
	});
});
