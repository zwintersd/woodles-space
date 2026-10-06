import { expect, test, type Page } from '@playwright/test';
import { expectNoPageErrors } from './support/fixtures';

const obligationPlaceholder = 'e.g. standup, clinic, school pickup';

async function startOnboarding(page: Page): Promise<void> {
	await page.goto('/planner');
	await page.getByTestId('onboarding-continue').click();
	await page.getByLabel('day starts at').fill('08:00');
	await page.getByLabel('day ends at').fill('23:00');
	await page.getByRole('button', { name: 'Save hours →' }).click();
}

async function openRoutineRefresh(page: Page): Promise<void> {
	await page.getByRole('button', { name: /Open sync panel/ }).click();
	await page.getByRole('button', { name: /routines and daily activities/ }).click();
	await page.getByRole('button', { name: 'refresh selected', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'refresh setup' })).toBeVisible();
}

async function seedRoutineRefresh(page: Page): Promise<void> {
	await page.addInitScript(() => {
		// Seed once so subsequent reloads verify the app's writes.
		if (localStorage.getItem('carillon-refresh-fixture')) return;
		localStorage.setItem('carillon-refresh-fixture', '1');
		localStorage.setItem('planner.settings.v1', JSON.stringify({
			onboardingComplete: true, onboardingStep: 5, fixedPaletteMode: 'night'
		}));
		localStorage.setItem('planner.routines.v1', JSON.stringify([{
			id: 'lights', name: 'lights', cue: 'first bathroom trip after 6:00am',
			createdAt: '2026-10-01T12:00:00Z',
			steps: ['star lights', 'silver lamp', 'gold lamp', 'TV'].map((label, i) => ({ id: `light-${i}`, label }))
		}]));
	});
	await page.goto('/planner');
}

test.describe('Carillon onboarding', () => {
	test('routine refresh stays readable at night and contains keyboard focus', async ({ page }, testInfo) => {
		await expectNoPageErrors(page, async () => {
			await seedRoutineRefresh(page);
			await openRoutineRefresh(page);
			const dialog = page.getByRole('dialog', { name: 'refresh setup' });
			await expect(dialog).toBeFocused();
			await expect(page.locator('.carillon-shell')).toHaveJSProperty('inert', true);
			await expect(dialog.locator('.step-eyebrow')).toContainText('Refresh setup');
			await expect(dialog.locator('.step-progress')).toHaveCount(0);
			await dialog.locator('summary').filter({ hasText: 'lights · 4 steps' }).click();

			const presentation = await dialog.evaluate(el => {
				const luminance = (color: string) => {
					const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(c => {
						const s = c / 255;
						return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
					});
					return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
				};
				const card = el.querySelector('.routines-card')!;
				const bg = luminance(getComputedStyle(card).backgroundColor);
				const contrasts = Array.from(card.querySelectorAll('h2, summary, li, label')).map(node => {
					const fg = luminance(getComputedStyle(node).color);
					return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05);
				});
				const list = card.querySelector('ol')!;
				return { contrasts, listIndent: parseFloat(getComputedStyle(list).paddingInlineStart) };
			});
			for (const contrast of presentation.contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
			expect(presentation.listIndent).toBeGreaterThanOrEqual(24);
			await page.screenshot({ path: testInfo.outputPath('routines-refresh-desktop.png'), animations: 'disabled' });

			const save = dialog.getByRole('button', { name: 'Save routines →' });
			await save.focus();
			await page.keyboard.press('Tab');
			await expect(dialog.locator('summary').first()).toBeFocused();
			await page.keyboard.press('Shift+Tab');
			await expect(save).toBeFocused();
			await dialog.getByLabel('Steps, one per line').focus();
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'sync', exact: true })).toBeFocused();
			await expect(page.locator('.carillon-shell')).toHaveJSProperty('inert', false);

			await page.setViewportSize({ width: 390, height: 844 });
			await openRoutineRefresh(page);
			await dialog.locator('summary').filter({ hasText: 'lights · 4 steps' }).click();
			await page.screenshot({ path: testInfo.outputPath('routines-refresh-mobile.png'), animations: 'disabled' });
			await dialog.locator('.daily-activities > summary').click();
			await expect(dialog.getByLabel('Starts at', { exact: true })).toBeVisible();
			await expect(dialog.locator('.step-body')).toHaveJSProperty('scrollWidth', await dialog.locator('.step-body').evaluate(el => el.clientWidth));
			await dialog.getByLabel('Ends at', { exact: true }).scrollIntoViewIfNeeded();
			await page.screenshot({ path: testInfo.outputPath('daily-activities-refresh-mobile.png'), animations: 'disabled' });
			await page.keyboard.press('Escape');
		});
	});

	test('Save routines keeps an incomplete draft open and persists complete drafts', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await seedRoutineRefresh(page);
			await openRoutineRefresh(page);
			const dialog = page.getByRole('dialog', { name: 'refresh setup' });
			await dialog.getByLabel('Routine name', { exact: true }).fill('Start work');
			await dialog.getByRole('button', { name: 'Save routines →' }).click();
			await expect(dialog).toBeVisible();
			await expect(dialog.getByLabel('Steps, one per line')).toBeFocused();
			await expect(dialog.getByRole('status')).toHaveText('Add a routine name and at least one step.');
			await dialog.getByLabel('Steps, one per line').fill('Open notes\n\nChoose a task');
			await dialog.locator('.daily-activities > summary').click();
			await dialog.getByLabel('Activity name', { exact: true }).fill('Morning walk');
			await dialog.getByLabel('Starts at', { exact: true }).fill('08:00');
			await dialog.getByLabel('Ends at', { exact: true }).fill('07:00');
			await dialog.locator('.daily-activities > summary').click();
			await dialog.getByRole('button', { name: 'Save routines →' }).click();
			await expect(dialog).toBeVisible();
			await expect(dialog.getByLabel('Ends at', { exact: true })).toBeFocused();
			await expect(dialog.getByLabel('Ends at', { exact: true })).toHaveJSProperty('validationMessage', 'Choose an end time after the start time.');
			await dialog.getByLabel('Ends at', { exact: true }).fill('08:20');
			await dialog.getByRole('button', { name: 'Save routines →' }).click();
			await expect(dialog).toHaveCount(0);
			await page.reload();
			await openRoutineRefresh(page);
			await expect(dialog.locator('summary').filter({ hasText: 'Start work · 2 steps' })).toBeVisible();
			await expect(dialog.locator('summary').filter({ hasText: 'Start work · 2 steps' })).toHaveCount(1);
			await dialog.locator('.daily-activities > summary').click();
			await expect(dialog.getByText('Morning walk', { exact: true })).toBeVisible();
			const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.settings.v1')!));
			expect(saved.onboardingComplete).toBe(true);
			expect(saved.onboardingStep).toBe(5);
		});
	});

	test('resumes the saved question after a reload', async ({ page }) => {
		await expectNoPageErrors(page, async () => {
			await startOnboarding(page);
			await expect(page.getByPlaceholder(obligationPlaceholder)).toBeVisible();

			await page.reload();

			await expect(page.getByPlaceholder(obligationPlaceholder)).toBeVisible();
			await expect(page.getByRole('button', { name: 'Save commitments →' })).toBeVisible();
		});
	});

	test('opens the first-task composer after completing setup', async ({ page }) => {
		test.setTimeout(60_000);
		await expectNoPageErrors(page, async () => {
			await startOnboarding(page);
			await page.getByRole('button', { name: 'Save commitments →' }).click();
			await page.getByLabel('Routine name', { exact: true }).fill('Start a project');
			await page.getByLabel('Cue', { exact: true }).fill('After breakfast');
			await page.getByLabel('Steps, one per line').fill('Open notes\nChoose a task');
			await page.getByRole('button', { name: '+ Add routine', exact: true }).click();
			await expect(page.getByText('Start a project · 2 steps')).toBeVisible();
			await page.getByRole('button', { name: 'Save routines →' }).click();
			await page.getByRole('button', { name: /work/ }).click();
			await page.getByRole('button', { name: 'Save categories →' }).click();
			await page.getByRole('button', { name: '+ New day pile', exact: true }).click();
			await page.getByLabel('Pile name', { exact: true }).fill('My flexible day');
			await page.getByRole('button', { name: '+ Add activity', exact: true }).click();
			await page.getByLabel('Activity 1', { exact: true }).fill('Project time');
			await page.getByRole('combobox', { name: 'Routine', exact: true }).selectOption({ label: 'Start a project' });
			await page.getByRole('button', { name: 'Save pile', exact: true }).click();
			await page.locator('.weekday-tile').first().click();
			await page.getByRole('button', { name: 'No pile', exact: true }).click();
			await page.locator('.weekday-tile').last().click();
			await page.getByRole('button', { name: 'Save week →' }).click();
			await page.getByLabel('Observation interval').selectOption('30');
			await page.getByLabel('Enable bells').uncheck();
			await page.getByLabel('Quiet hours start').fill('21:00');
			await page.getByRole('button', { name: 'Finish setup →' }).click();

			await expect(page.getByTestId('onboarding-add-first-task')).toBeVisible();
			await page.reload();
			await expect(page.getByLabel('Observation interval')).toHaveValue('30');
			await expect(page.getByLabel('Enable bells')).not.toBeChecked();
			await expect(page.getByLabel('Quiet hours start')).toHaveValue('21:00');
			await page.getByRole('button', { name: '← back', exact: true }).click();
			await expect(page.locator('.weekday-tile').first()).toContainText('My flexible day');
			await expect(page.locator('.weekday-tile').last()).toContainText('No pile');
			await page.getByRole('radio').filter({ hasText: 'My flexible day' }).click();
			await page.getByRole('button', { name: 'Edit selected pile' }).click();
			await expect(page.getByLabel('Timing')).toHaveValue('true');
			await expect(page.getByRole('combobox', { name: 'Routine', exact: true }).locator('option:checked')).toHaveText('Start a project');
			await page.getByRole('button', { name: 'Cancel edit' }).click();
			await page.getByRole('button', { name: 'Save week →' }).click();
			await page.getByRole('button', { name: 'Finish setup →' }).click();
			await page.getByTestId('onboarding-add-first-task').click();

			const composer = page.getByRole('dialog', { name: 'Add a task' });
			await expect(composer).toBeVisible();
			await expect(composer.getByLabel('Task title')).toBeFocused();
		});
	});
});

 test('setup controls fit a narrow screen', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await startOnboarding(page);
	await page.getByRole('button', { name: 'Save commitments →' }).click();
	await expect(page.getByLabel('Routine name', { exact: true })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('routines-mobile.png'), fullPage: true, animations: 'disabled' });
	await page.getByRole('button', { name: 'Save routines →' }).click();
	await page.getByRole('button', { name: /work/ }).click();
	await page.getByRole('button', { name: 'Save categories →' }).click();
	await page.getByRole('button', { name: '+ New day pile', exact: true }).click();
	await page.getByRole('button', { name: '+ Add activity', exact: true }).click();
	await expect(page.getByLabel('Activity 1', { exact: true })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('pile-mobile.png'), fullPage: true, animations: 'disabled' });
	await expect(page.locator('.step-body')).toHaveJSProperty('scrollWidth', await page.locator('.step-body').evaluate(el => el.clientWidth));
	await page.getByRole('button', { name: 'Cancel edit' }).click();
	await page.getByRole('button', { name: 'Save week →' }).click();
	await page.screenshot({ path: testInfo.outputPath('reminders-mobile.png'), fullPage: true, animations: 'disabled' });
	await expect(page.locator('.step-body')).toHaveJSProperty('scrollWidth', await page.locator('.step-body').evaluate(el => el.clientWidth));
 });
