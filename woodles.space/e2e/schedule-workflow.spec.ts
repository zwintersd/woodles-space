import { expect, test, type Page } from '@playwright/test';
import { addScheduleItem, openScheduleTools } from './support/schedule-planner';

async function openPlan(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    const plan = S.sanitizePlan({ id: 'workflow', learner: 'Sam', name: 'Weekly plan', days: [{ key: 'monday', start: '09:00', end: '12:00', activities: [
      { kind: 'activity', occurrenceId: 'book', title: 'Read a book', start: '09:10', duration: 10, icon: '📖' },
      { kind: 'activity', occurrenceId: 'snack', title: 'Make a snack', start: '09:40', duration: 25, icon: '🍎' },
      { kind: 'open-slot', occurrenceId: 'open', start: '10:30', duration: 15 }
    ] }] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [], images: [] }));
  });
  await page.goto('/schedules/generator?plan=workflow&day=monday');
}

async function monday(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0].days[0]);
}

test('compact planner puts editing first and all item editors remain reachable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPlan(page);
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const list = await page.locator('.activity-list').boundingBox();
    expect(list!.y + 60).toBeLessThan(viewport.height);
    await expect(page.locator('[data-action="add-item"]')).toBeInViewport();
    await expect(page.locator('.visual-card')).not.toBeVisible();
    await expect(page.locator('[data-action="clear-day"]')).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`planner-${viewport.width}.png`), fullPage: true });
  }
  await page.locator('[data-action="add-item"]').click();
  await expect(page.locator('#addItemDialog [data-action="add-library"]')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action="add-item"]')).toBeFocused();
  for (const [kind, form] of [['choice', 'choiceForm'], ['video', 'videoForm'], ['suggestion', 'suggestionForm'], ['open-slot', 'slotForm']] as const) {
    await addScheduleItem(page, kind);
    await expect(page.locator(`#${form}`)).toBeVisible();
    await page.locator(`#${form}`).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('#addItemDialog')).not.toBeVisible();
  }
  await addScheduleItem(page, 'activity');
  await page.locator('#activityForm input[name="title"]').fill('Play blocks');
  await page.locator('#activityForm button[type="submit"]').click();
  await addScheduleItem(page, 'library');
  await page.locator('#contentLibraryDialog [data-action="library-add"]').click();
  await expect(page.locator('.activity-card').filter({ hasText: 'Play blocks' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Close library', exact: true }).click();
  await page.locator('.preview-disclosure > summary').click();
  await expect(page.locator('.visual-card')).toBeVisible();
  await page.getByRole('link', { name: 'Use schedule', exact: false }).click();
  await expect(page.locator('#timeline')).toBeVisible();
  await expect(page.locator('#greeting')).toHaveText('Hi Sam!');
  expect(errors).toEqual([]);
});

test('moves use gaps before pushing and hidden days retain their schedule across reloads', async ({ page }) => {
  await openPlan(page);
  const original = await monday(page);
  await page.locator('[data-action="move-activity"][data-id="snack"][data-direction="-1"]').click();
  await expect(page.locator('[data-action="move-activity"][data-id="snack"][data-direction="1"]')).toBeFocused();
  const moved = await monday(page);
  expect(moved.activities.map((item: any) => [item.occurrenceId, item.start])).toEqual([
    ['book', '09:35'], ['snack', '09:10'], ['open', '10:30']
  ]);
  await page.reload();
  await expect(page.locator('.activity-card').first()).toContainText('Make a snack');
  await openScheduleTools(page, 'day');
  await page.locator('[data-action="hide-day"]').click();
  expect((await monday(page)).removed).toBe(true);
  expect((await monday(page)).activities).toEqual(moved.activities);
  await page.reload();
  await page.goto('/schedules/view?plan=workflow&day=monday');
  await expect(page.locator('#intro')).not.toContainText('Monday');
  await page.goto('/schedules/generator?plan=workflow&day=tuesday');
  await page.locator('[data-action="restore-day"][data-day="monday"]').click();
  expect(await monday(page)).toEqual(moved);
  // Hiding every day must leave a reachable restoration path, including on mobile.
  for (let i = 0; i < 7; i++) {
    await openScheduleTools(page, 'day');
    await page.locator('[data-action="hide-day"]').click();
  }
  await expect(page.getByRole('heading', { name: 'All days are hidden' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await openScheduleTools(page, 'plan');
  const backup = page.waitForEvent('download');
  await page.locator('[data-action="export-plan"]').click();
  const exportPath = await (await backup).path();
  expect(exportPath).toBeTruthy();
  await page.locator('[data-action="restore-day"][data-day="monday"]').click();
  expect(await monday(page)).toEqual(moved);
});

test('print settings stay per day and planning controls are excluded from output', async ({ page }) => {
  await openPlan(page);
  await page.locator('[data-action="open-print-setup"]').click();
  await expect(page.locator('#printSpacingField')).not.toBeVisible();
  await page.getByLabel('Print layout', { exact: true }).selectOption('cards');
  await expect(page.locator('#printSpacingField')).toBeVisible();
  await page.getByLabel('Printed card spacing', { exact: true }).selectOption('laminate');
  await page.getByLabel('Show times on print').uncheck();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  expect(await monday(page)).toMatchObject({ printLayout: 'cards', printSpacing: 'laminate', printTimes: false });
  await page.locator('[data-action="select-day"][data-day="tuesday"]').click();
  await page.locator('[data-action="open-print-setup"]').click();
  await expect(page.getByLabel('Print layout', { exact: true })).toHaveValue('timeline');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-action="select-day"][data-day="monday"]').click();
  await page.locator('[data-action="open-print-setup"]').click();
  await page.evaluate(() => { (window as any).__printed = false; window.print = () => { (window as any).__printed = true; }; });
  await page.getByRole('button', { name: 'Open print preview' }).click();
  expect(await page.evaluate(() => (window as any).__printed)).toBe(true);
  await expect(page.locator('#printDialog')).not.toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.activity-card').first()).toBeVisible();
  await expect(page.locator('.open-slot-card')).toBeVisible();
  await expect(page.locator('.activity-time').first()).not.toBeVisible();
  await expect(page.locator('[data-action="add-item"]')).not.toBeVisible();
  await expect(page.locator('.day-tools')).not.toBeVisible();
});
