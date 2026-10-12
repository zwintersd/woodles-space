import { addScheduleItem, openActivitySection } from './support/schedule-planner';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function addResult(page: Page, title: string, amount: number) {
  await page.locator('[data-action="add-outcome-tier"]').click();
  const row = page.locator('.outcome-editor').last();
  await row.locator('[data-outcome-field="title"]').fill(title);
  await row.locator('[data-outcome-field="amount"]').fill(String(amount));
}

test('first/then rewards count only the best result and let the learner move on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [S.sanitizePlan({ id: 'rewards-test', learner: 'Sam', name: 'Potty', days: [] })], activities: [], images: [] }));
  });
  await page.goto('/schedules/generator?plan=rewards-test&day=monday');
  await addScheduleItem(page, 'activity');
  await page.locator('#activityForm input[name="title"]').fill('Sit on toilet');
  await openActivitySection(page, 'rewards');
  await addResult(page, 'Voided solid', 5);
  await addResult(page, 'Sat on toilet', 1);
  await addResult(page, 'Voided liquid', 3);
  await page.locator('[data-action="add-outcome-tier"]').click();
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('#activityError')).toContainText('Name each reward result');
  await page.locator('[data-action="remove-outcome-tier"][data-outcome-index="3"]').click();
  await page.locator('#activityForm input[name="outcomeUnit"]').fill('');
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('#activityError')).toContainText('Name the reward');
  await page.locator('#activityForm input[name="outcomeUnit"]').fill('M&M');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#activityDialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#activityForm button[type="submit"]').click();

  const ladder = page.locator('.activity-card .outcome-ladder li');
  await expect(ladder).toHaveText([/Sat on toilet\s*1/, /Voided liquid\s*3/, /Voided solid\s*5/]);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.activity-card .first-then')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });

  // The library copy carries the rewards to a second trip.
  await addScheduleItem(page, 'activity');
  await page.locator('[data-action="activity-tab"][data-mode="library"]').click();
  await page.locator('[data-action="add-library-activity"]').click();
  await expect(page.locator('.activity-card .first-then')).toHaveCount(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!));
  expect(saved.activities[0].outcomes.tiers.map((tier: any) => tier.amount)).toEqual([1, 3, 5]);
  expect(saved.plans[0].days[0].activities.map((item: any) => item.outcomes.unit)).toEqual(['M&M', 'M&M']);

  await page.goto('/schedules/view?plan=rewards-test&day=monday');
  const first = page.locator('.step').first();
  const total = page.locator('#rewardTotal');
  await expect(total).toHaveText(/^0\D*M&M today/);
  await expect(first.locator('[data-done]')).toHaveCount(0);
  await first.getByRole('button', { name: 'Voided liquid, 3 M&M' }).click();
  await expect(total).toHaveText(/^3\D*M&M today/);
  await expect(first).toHaveClass(/is-done/);
  await expect(first.locator('.outcome-earned')).toHaveText(/You earned 3/);
  await expect(page.getByRole('button', { name: 'Voided liquid, 3 M&M' }).first()).toBeFocused();
  // Best result only: a better result replaces the earlier one.
  await first.getByRole('button', { name: 'Voided solid, 5 M&M' }).click();
  await expect(total).toHaveText(/^5\D*M&M today/);
  await expect(first.getByRole('button', { name: 'Voided liquid, 3 M&M' })).toHaveAttribute('aria-pressed', 'false');
  const second = page.locator('.step').nth(1);
  await second.getByRole('button', { name: 'Sat on toilet, 1 M&M' }).click();
  await expect(total).toHaveText(/^6\D*M&M today/);
  await page.reload();
  await expect(total).toHaveText(/^6\D*M&M today/);
  await expect(page.locator('.step').first().getByRole('button', { name: 'Voided solid, 5 M&M' })).toHaveAttribute('aria-pressed', 'true');
  // Tapping the chosen result again takes it back.
  await page.locator('.step').nth(1).getByRole('button', { name: 'Sat on toilet, 1 M&M' }).click();
  await expect(total).toHaveText(/^5\D*M&M today/);
  await expect(page.locator('.step').nth(1)).not.toHaveClass(/is-done/);
  await page.locator('.step').nth(1).getByRole('button', { name: 'Not this time, move on' }).click();
  await expect(page.locator('.step').nth(1)).toHaveClass(/is-done/);
  await expect(total).toHaveText(/^5\D*M&M today/);
  const axe = await new AxeBuilder({ page }).include('#timeline').include('.hero').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('schedule-rewards-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: /Clear/ }).click();
  await expect(total).toHaveText(/^0\D*M&M today/);
  await expect(page.locator('.step.is-done')).toHaveCount(0);

  // A result whose tier the maker removes stops counting; removing every tier restores the plain check.
  await page.goto('/schedules/view?plan=rewards-test&day=monday');
  await page.locator('.step').first().getByRole('button', { name: 'Voided solid, 5 M&M' }).click();
  await page.goto('/schedules/generator?plan=rewards-test&day=monday');
  await page.locator('[data-action="edit-activity"]').first().click();
  for (let i = 0; i < 3; i++) await page.locator('[data-action="remove-outcome-tier"]').first().click();
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('.activity-card .first-then')).toHaveCount(1);
  await page.goto('/schedules/view?plan=rewards-test&day=monday');
  await expect(page.locator('.step').first().locator('[data-done]')).toHaveCount(1);
  await expect(total).toHaveText(/^0\D*M&M today/);
  expect(errors).toEqual([]);
});
