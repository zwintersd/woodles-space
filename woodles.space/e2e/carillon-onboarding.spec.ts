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

test.describe('Carillon onboarding', () => {
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
