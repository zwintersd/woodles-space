import { expect, test, type Page } from '@playwright/test';
import { openScheduleTools } from './support/schedule-planner';

async function seedPlan(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8h0AAAAASUVORK5CYII=';
    const plan = S.sanitizePlan({ id: 'recovery', learner: 'Sam', name: 'Recovery', days: [
      { key: 'monday', activities: [
        { kind: 'activity', occurrenceId: 'book', title: 'Read a book', start: '09:10', duration: 10, imageAssetId: 'photo', steps: [{ id: 'wash', title: 'Wash hands', symbolAssetId: 'sprite', symbolName: 'hands' }] },
        { kind: 'open-slot', occurrenceId: 'open', start: '09:40', duration: 20 }
      ] },
      { key: 'tuesday', start: '13:00', end: '14:00', printLayout: 'cards', printTimes: false, printSpacing: 'laminate', activities: [
        { kind: 'activity', occurrenceId: 'walk', title: 'Go for a walk', start: '13:10', duration: 15, imageAssetId: 'tuesday-photo' }
      ] }
    ] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [], images: ['photo', 'sprite', 'tuesday-photo'].map(id => ({ id, data: pixel })) }));
  });
  await page.goto('/schedules/generator?plan=recovery&day=monday');
}

async function state(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!));
}

test('undo restores exact days, nested visuals and prior copy settings in reverse order', async ({ page }) => {
  await seedPlan(page);
  page.on('dialog', dialog => dialog.accept());
  const original = await state(page);
  await page.locator('[data-action="move-activity"][data-id="book"][data-direction="1"]').click();
  const moved = (await state(page)).plans[0].days[0];
  await page.locator('[data-action="remove-activity"][data-id="book"]').click();
  expect((await state(page)).images.map((image: any) => image.id)).toEqual(['photo', 'sprite', 'tuesday-photo']);
  await openScheduleTools(page, 'day');
  await page.locator('[data-action="clear-day"]').click();
  await expect(page.locator('.activity-card')).toHaveCount(0);
  await page.locator('#undoButton').click();
  await expect(page.locator('.open-slot-card')).toHaveCount(1);
  await page.locator('#undoButton').click();
  expect((await state(page)).plans[0].days[0]).toEqual(moved);
  await expect(page.locator('.activity-card [src^="data:image/png"]')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  await expect(page.locator('#undoButton')).toBeDisabled();
  await openScheduleTools(page, 'day');
  await page.locator('#copyDestination').selectOption('tuesday');
  await page.locator('[data-action="copy-day"]').click();
  expect((await state(page)).plans[0].days[1].start).toBe('09:00');
  await page.locator('#undoButton').click();
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  await expect(page.locator('#dayTitle')).toHaveText('Tuesday');
  await page.reload();
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  await expect(page.locator('#undoButton')).toBeDisabled();
});

test('plan Trash and its pictures survive reload, restore and export; deletion also supports Undo', async ({ page }) => {
  await seedPlan(page);
  const original = await state(page);
  await openScheduleTools(page, 'plan');
  await page.getByRole('button', { name: 'Move plan to Trash', exact: true }).click();
  expect((await state(page)).plans).toHaveLength(0);
  expect((await state(page)).deletedPlans[0].days).toEqual(original.plans[0].days);
  await page.locator('#undoButton').click();
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  await page.locator('[data-action="back-library"]').click();
  await page.getByRole('button', { name: 'Move Sam plan to Trash', exact: true }).click();
  await page.reload();
  await expect(page.locator('#undoButton')).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.plan-trash > summary').click();
  await page.screenshot({ path: test.info().outputPath('plan-trash-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await state(page)).images).toEqual(original.images);
  const learner = await page.context().newPage();
  await learner.goto('/schedules/view?plan=recovery&day=monday');
  await expect(learner.locator('#timeline')).not.toBeVisible();
  await page.getByRole('button', { name: 'Restore Sam plan', exact: true }).click();
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  expect((await state(page)).deletedPlans).toHaveLength(0);
  await expect(page.locator('.activity-card [src^="data:image/png"]')).toHaveCount(2);
  await expect(learner.locator('#timeline')).toBeVisible();
  await openScheduleTools(page, 'plan');
  const download = page.waitForEvent('download');
  await page.locator('[data-action="export-plan"]').click();
  await page.locator('#importFile').setInputFiles((await (await download).path())!);
  const imported = await state(page);
  expect(imported.plans).toHaveLength(2);
  const ids = imported.plans[1].days.flatMap((day: any) => day.activities.flatMap((item: any) => [item.imageAssetId, ...(item.steps || []).map((step: any) => step.symbolAssetId)])).filter(Boolean);
  expect(ids).toHaveLength(3);
  expect(ids.every((id: string) => imported.images.some((image: any) => image.id === id))).toBe(true);
});

test('a later edit invalidates stale undo without losing the edited content or native text undo', async ({ page }) => {
  await seedPlan(page);
  await page.locator('[data-action="remove-activity"][data-id="book"]').click();
  await page.locator('[data-action="edit-open-slot"]').click();
  await page.locator('#slotForm input[name="duration"]').fill('25');
  await page.locator('#slotForm button[type="submit"]').click();
  await expect(page.locator('#undoButton')).toBeDisabled();
  expect((await state(page)).plans[0].days[0].activities).toHaveLength(1);
  expect((await state(page)).plans[0].days[0].activities[0].duration).toBe(25);
  await openScheduleTools(page, 'day');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-action="clear-day"]').click();
  await expect(page.locator('#undoButton')).toBeEnabled();
  await page.locator('#planTitle').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.activity-card')).toHaveCount(0);
  await expect(page.locator('#undoButton')).toBeEnabled();
});

test('failed saves roll back removal, Trash and Undo without reporting success', async ({ page }) => {
  await seedPlan(page);
  const original = await state(page);
  await page.evaluate(() => {
    const save = Storage.prototype.setItem;
    (window as any).__allowSave = true;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'woodles.schedule-planner.v1' && !(window as any).__allowSave) throw new DOMException('Full', 'QuotaExceededError');
      return save.call(this, key, value);
    };
  });
  await page.evaluate(() => { (window as any).__allowSave = false; });
  await page.locator('[data-action="remove-activity"][data-id="book"]').click();
  expect(await state(page)).toEqual(original);
  await expect(page.locator('.activity-card')).toHaveCount(2);
  await expect(page.locator('#undoButton')).toBeDisabled();
  await expect(page.locator('#saveStatus')).toHaveText('Could not save');
  await openScheduleTools(page, 'plan');
  await page.locator('[data-action="delete-current-plan"]').click();
  expect(await state(page)).toEqual(original);
  await expect(page.locator('#planTitle')).toHaveValue('Recovery');
  await page.evaluate(() => { (window as any).__allowSave = true; });
  await page.locator('[data-action="remove-activity"][data-id="book"]').click();
  const removed = await state(page);
  await page.evaluate(() => { (window as any).__allowSave = false; });
  await page.locator('#undoButton').click();
  expect(await state(page)).toEqual(removed);
  await expect(page.locator('.activity-card')).toHaveCount(1);
  await expect(page.locator('#undoButton')).toBeEnabled();
  await page.evaluate(() => { (window as any).__allowSave = true; });
  await page.locator('#undoButton').click();
  expect((await state(page)).plans[0].days).toEqual(original.plans[0].days);
  expect((await state(page)).images).toEqual(original.images);
});
