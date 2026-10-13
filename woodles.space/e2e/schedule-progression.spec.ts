import { openScheduleTools } from './support/schedule-planner';
import { expect, test } from '@playwright/test';

test('advance when done moves Now/Next by finishing items instead of the clock', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // A Monday, before the session starts: the clock alone would say "Not started yet".
  await page.clock.setFixedTime(new Date('2026-10-12T08:00:00'));
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    const plan = S.sanitizePlan({ id: 'progress-test', learner: 'Sam', name: 'Morning', days: [{ key: 'monday', start: '09:00', end: '12:00', activities: [
      { kind: 'activity', occurrenceId: 'read', title: 'Read', start: '09:00', duration: 15 },
      { kind: 'activity', occurrenceId: 'toilet', title: 'Sit on toilet', start: '09:15', duration: 10, outcomes: { unit: 'M&M', tiers: [{ id: 'sat', title: 'Sat on toilet', amount: 1 }] } },
      { kind: 'activity', occurrenceId: 'snack', title: 'Snack', start: '09:30', duration: 15 }
    ] }] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [], images: [] }));
  });
  await page.goto('/schedules/view?plan=progress-test&day=monday');
  await expect(page.locator('#nowText')).toHaveText('Not started yet');

  await page.goto('/schedules/generator?plan=progress-test&day=monday');
  await openScheduleTools(page, 'plan');
  await expect(page.locator('#planProgression')).toHaveValue('clock');
  await page.locator('#planProgression').selectOption('done');
  await page.reload();
  await openScheduleTools(page, 'plan');
  await expect(page.locator('#planProgression')).toHaveValue('done');
  await page.setViewportSize({ width: 390, height: 844 });
  const tools = (await page.locator('.plan-tools .tool-options').boundingBox())!;
  expect(tools.x).toBeGreaterThanOrEqual(0);
  expect(tools.x + tools.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto('/schedules/view?plan=progress-test&day=monday');
  const steps = page.locator('#timeline .step');
  await expect(page.locator('#nowText')).toHaveText('Read');
  await expect(page.locator('#nextText')).toHaveText('Sit on toilet');
  await expect(steps.nth(0)).toHaveClass(/is-now/);
  await steps.nth(0).locator('[data-done]').click();
  await expect(page.locator('#nowText')).toHaveText('Sit on toilet');
  await expect(steps.nth(1)).toHaveClass(/is-now/);
  // Not this time moves on without earning anything.
  await steps.nth(1).getByRole('button', { name: 'Not this time, move on' }).click();
  await expect(page.locator('#nowText')).toHaveText('Snack');
  await expect(page.locator('#nextText')).toHaveText('All done!');
  await expect(steps.nth(2)).toHaveClass(/is-now/);
  // Unchecking an earlier item makes it the first unfinished one again.
  await steps.nth(0).locator('[data-done]').click();
  await expect(page.locator('#nowText')).toHaveText('Read');
  await page.reload();
  await expect(page.locator('#nowText')).toHaveText('Read');
  await steps.nth(0).locator('[data-done]').click();
  await steps.nth(2).locator('[data-done]').click();
  await expect(page.locator('#nowText')).toHaveText('All done!');
  await expect(steps.last()).toHaveClass(/is-now/);
  await page.getByRole('button', { name: /Clear/ }).click();
  await expect(page.locator('#nowText')).toHaveText('Read');

  // Copies, exports and imports keep the setting; switching back restores the clock.
  const exported = await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    return S.sanitizePlan(JSON.parse(JSON.stringify(S.readWorkspace().plans[0]))).progression;
  });
  expect(exported).toBe('done');
  await page.goto('/schedules/generator?plan=progress-test&day=monday');
  await openScheduleTools(page, 'plan');
  await page.locator('#planProgression').selectOption('clock');
  await page.goto('/schedules/view?plan=progress-test&day=monday');
  await expect(page.locator('#nowText')).toHaveText('Not started yet');
  expect(errors).toEqual([]);
});
