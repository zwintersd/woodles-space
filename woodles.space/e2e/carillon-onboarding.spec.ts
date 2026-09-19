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
		await expectNoPageErrors(page, async () => {
			await startOnboarding(page);
			await page.getByRole('button', { name: 'Save commitments →' }).click();
			await page.getByRole('button', { name: 'Save activities →' }).click();
			await page.getByRole('button', { name: /work/ }).click();
			await page.getByRole('button', { name: 'Save categories →' }).click();
			await page.getByRole('button', { name: 'Save week →' }).click();
			await page.getByRole('button', { name: 'Finish setup →' }).click();

			await expect(page.getByTestId('onboarding-add-first-task')).toBeVisible();
			await page.getByTestId('onboarding-add-first-task').click();

			const composer = page.getByRole('dialog', { name: 'Add a task' });
			await expect(composer).toBeVisible();
			await expect(composer.getByLabel('Task title')).toBeFocused();
		});
	});
});
