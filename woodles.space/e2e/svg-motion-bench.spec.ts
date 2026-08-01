import { expect, test, type Page } from '@playwright/test';

async function loadSample(page: Page, name: RegExp) {
	const sampleSelect = page.getByLabel('Workshop sample');
	const options = sampleSelect.locator('option');
	let value: string | null = null;

	for (let index = 0; index < (await options.count()); index += 1) {
		const option = options.nth(index);
		if (name.test((await option.textContent()) ?? '')) {
			value = await option.getAttribute('value');
			break;
		}
	}

	expect(value, `missing workshop sample matching ${name}`).not.toBeNull();
	await sampleSelect.selectOption(value!);
	await page.getByRole('button', { name: 'Load sample', exact: true }).click();
	await expect(page.locator('#source-path')).not.toHaveText('—');
}

test.describe('Hygge SVG motion bench', () => {
	test('loads unrelated SVG anatomies and keeps controls and recipe JSON synchronized', async ({ page }) => {
		await page.goto('/hygge/motion/svg');

		await expect(page.getByLabel('Workshop sample')).toBeVisible();
		await expect(page.getByLabel('Choose SVG file')).toBeVisible();
		await expect(page.getByLabel('Paste SVG markup')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Load pasted SVG' })).toBeVisible();

		await loadSample(page, /triple corn/i);
		await expect(page.locator('#source-path')).toContainText(/triple-corn\.svg/i);
		await expect(page.locator('#source-hash')).not.toBeEmpty();
		await expect(page.locator('#source-anatomy')).toContainText(/9/);
		await expect(page.getByRole('img', { name: 'SVG recipe preview' })).toBeVisible();

		const partButtons = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ });
		await expect(partButtons).toHaveCount(9);
		await partButtons.first().click();

		const partLabel = page.getByLabel('Selected part label');
		const partGroup = page.getByLabel('Selected part group');
		await expect(partLabel).toBeVisible();
		await expect(partGroup).toBeVisible();

		const currentGroup = await partGroup.inputValue();
		const alternateGroup = await partGroup.locator('option').evaluateAll((options, selected) => {
			const choice = options
				.map((option) => ({ label: option.textContent?.trim() ?? '', value: (option as HTMLOptionElement).value }))
				.find((option) => option.value && option.value !== selected);
			return choice ?? null;
		}, currentGroup);
		expect(alternateGroup).not.toBeNull();
		await partGroup.selectOption(alternateGroup!.value);
		await expect(partGroup).toHaveValue(alternateGroup!.value);

		const groupColor = page.getByLabel(/^Color for /).first();
		await expect(groupColor).toBeVisible();
		await groupColor.fill('#7a5cff');

		await expect(page.getByRole('button', { name: 'Remove selected part' })).toBeVisible();
		await page.getByRole('button', { name: 'Remove selected part' }).click();
		await expect(page.getByRole('button', { name: 'Include selected part' })).toBeVisible();
		await page.getByRole('button', { name: 'Include selected part' }).click();
		await expect(page.getByRole('button', { name: 'Remove selected part' })).toBeVisible();

		const duration = page.getByLabel('Step 1 duration');
		const recipeJson = page.getByTestId('recipe-json');
		const recipeBeforeDuration = await recipeJson.inputValue();
		await duration.fill('0.75');
		await duration.press('Tab');
		await expect.poll(() => recipeJson.inputValue()).not.toBe(recipeBeforeDuration);
		await expect(recipeJson).toHaveValue(/0\.75/);

		const synchronizedJson = await recipeJson.inputValue();
		const editedJson = synchronizedJson.replace('0.75', '1.25');
		expect(editedJson).not.toBe(synchronizedJson);
		await recipeJson.fill(editedJson);
		await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
		await expect(duration).toHaveValue('1.25');

		await loadSample(page, /diamonds?/i);
		await expect(page.locator('#source-path')).toContainText(/diamonds?\.svg/i);
		await expect(page.locator('#source-anatomy')).toContainText(/1/);
		const diamondPart = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ });
		await expect(diamondPart).toHaveCount(1);
		await diamondPart.click();
		await page.getByRole('button', { name: 'Add group', exact: true }).click();
		await page.getByLabel('Selected part group').selectOption('group-2');
		await expect(page.getByLabel('Selected part group')).toHaveValue('group-2');
	});

	test('undoes and resets recipe edits', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		const part = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ }).first();
		await part.click();
		const label = page.getByLabel('Selected part label');
		const originalLabel = await label.inputValue();

		await label.fill('faceted test glyph');
		await label.press('Tab');
		await expect(label).toHaveValue('faceted test glyph');
		await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
		await expect(label).toHaveValue(originalLabel);

		await label.fill('temporary label');
		await label.press('Tab');
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Reset recipe', exact: true }).click();
		await expect(label).toHaveValue(originalLabel);
	});

	test('keeps the triple-corn source backdrop as an explicit inclusion choice', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /triple corn/i);

		const parts = page.getByTestId('part-map').getByRole('button', { name: /^Part \d+:/ });
		await expect(parts).toHaveCount(9);
		await page.getByRole('button', { name: 'Include omitted geometry', exact: true }).click();
		await expect(parts).toHaveCount(10);
		await expect(page.locator('#source-anatomy')).toContainText('10 included');
		await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
		await expect(parts).toHaveCount(9);
	});

	test('exposes the offline render plan and a downloadable recipe', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		const renderCommand = page.locator('#render-command');
		await expect(renderCommand).toHaveValue(/python|manim/i);
		await expect(renderCommand).toHaveValue(/diamond/i);
		await expect(page.getByRole('button', { name: 'Copy render command', exact: true })).toBeEnabled();

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download recipe', exact: true }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.json$/i);
	});

	test('does not autoplay when reduced motion is preferred', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /triple corn/i);

		await expect(page.locator('#playback-status')).toContainText(/reduced motion/i);
		await expect(page.locator('#preview-stage')).toHaveAttribute('data-playing', 'false');
		const preview = page.getByRole('img', { name: 'SVG recipe preview' });
		await expect(preview).toBeVisible();
		expect(
			await preview.evaluate((element) =>
				element.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
			)
		).toBe(true);
		await expect(page.getByRole('button', { name: 'Play preview', exact: true })).toBeVisible();
	});

	test('plays and pauses only through explicit transport controls', async ({ page }) => {
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		const stage = page.locator('#preview-stage');
		await page.getByRole('button', { name: 'Play preview', exact: true }).click();
		await expect(stage).toHaveAttribute('data-playing', 'true');
		await expect(page.locator('#playback-status')).toContainText('playing');
		await expect.poll(() => page.locator('#preview-svg').evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Pause preview', exact: true }).click();
		await expect(page.locator('#playback-status')).toContainText('paused');
		expect(
			await page.locator('#preview-svg').evaluate((svg) =>
				svg.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running')
			)
		).toBe(true);
	});

	test('reconstructs pasted geometry without importing active SVG content', async ({ page }) => {
		let dialogs = 0;
		page.on('dialog', async (dialog) => {
			dialogs += 1;
			await dialog.dismiss();
		});
		await page.goto('/hygge/motion/svg');
		await page.getByLabel('Paste SVG markup').fill(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><path onload="alert(2)" d="M1 1L9 1L5 9Z" /></svg>'
		);
		await page.getByRole('button', { name: 'Load pasted SVG' }).click();

		await expect(page.locator('#source-anatomy')).toContainText('1 drawable');
		await expect(page.locator('#safety-warnings')).toContainText(/ignored 2|removed 1/i);
		await expect(page.locator('#preview-geometry path')).toHaveCount(1);
		expect(dialogs).toBe(0);
	});

	test('fits the complete workbench without horizontal overflow on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/hygge/motion/svg');
		await loadSample(page, /diamonds?/i);

		await expect(page.getByRole('img', { name: 'SVG recipe preview' })).toBeVisible();
		await expect(page.getByTestId('recipe-json')).toBeVisible();
		const widths = await page.evaluate(() => ({
			viewport: window.innerWidth,
			document: document.documentElement.scrollWidth,
			body: document.body.scrollWidth
		}));
		expect(Math.max(widths.document, widths.body)).toBeLessThanOrEqual(widths.viewport + 1);
	});
});
