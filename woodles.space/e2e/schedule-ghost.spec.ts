import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { addScheduleItem } from './support/schedule-planner';

async function seed(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    const plan = S.sanitizePlan({ id: 'ghost-plan', learner: 'Sam', days: [{ key: 'monday', activities: [
      { kind: 'activity', occurrenceId: 'book', title: 'Book', start: '09:00', duration: 15, steps: [{ id: 'page', title: 'Turn a page' }] },
      { kind: 'choice', occurrenceId: 'pick', title: 'Pick', start: '09:15', duration: 15, options: [{ id: 'a', title: 'Apple' }, { id: 'b', title: 'Banana' }] },
      { kind: 'video', occurrenceId: 'watch', title: 'Watch', start: '09:30', duration: 15, videos: [{ id: 'v', title: 'Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] },
      { kind: 'suggestion', occurrenceId: 'ideas', title: 'Ideas', start: '09:45', duration: 15, candidates: [{ id: 'walk', title: 'Walk', category: 'Movement', duration: 5 }] },
      { kind: 'open-slot', occurrenceId: 'open', start: '10:00', duration: 15 }
    ] }] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan] }));
  });
  await page.goto('/schedules/generator?plan=ghost-plan&day=monday');
}
const items = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0].days[0].activities);

test('ghosts free time, preserve edits, reject conflicting restore and stay out of learner/print', async ({ page, context }) => {
  await seed(page);
  const learner = await context.newPage();
  await learner.goto('/schedules/view?plan=ghost-plan&day=monday');
  await page.locator('[data-action="toggle-ghost"][data-id="book"]').click();
  await expect(page.locator('.is-ghost')).toContainText('Book');
  await expect(learner.locator('#timeline')).not.toContainText('Book');
  await addScheduleItem(page, 'activity');
  await page.locator('#activityForm [name="title"]').fill('Replacement');
  await page.locator('#activityForm button[type="submit"]').click();
  expect((await items(page)).at(-1).start).toBe('09:00');
  await page.locator('[data-action="toggle-ghost"][data-id="book"]').click();
  await expect(page.locator('.toast')).toContainText('Cannot restore yet');
  expect((await items(page))[0].ghost).toBe(true);
  await page.locator('[data-action="edit-activity"][data-id="book"]').click();
  await expect(page.locator('[name="ghost"]')).toBeChecked();
  await page.locator('#activityForm [name="start"]').fill('09:15');
  await page.locator('#activityForm button[type="submit"]').click();
  expect((await items(page))[0].ghost).toBe(true);
  await page.reload();
  expect((await items(page))[0].steps[0].title).toBe('Turn a page');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.is-ghost')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.locator('[data-action="edit-activity"][data-id="book"]').click();
  await page.locator('#activityForm [name="start"]').fill('10:15');
  await page.locator('[name="ghost"]').uncheck();
  await page.locator('#activityForm button[type="submit"]').click();
  await expect(page.locator('.is-ghost')).toHaveCount(0);
  await expect(learner.locator('#timeline')).toContainText('Book');
});

test('all item editors retain ghost state; toggles undo and failed saves roll back', async ({ page }) => {
  await seed(page);
  for (const id of ['book', 'pick', 'watch', 'ideas', 'open']) await page.locator(`[data-action="toggle-ghost"][data-id="${id}"]`).click();
  await expect(page.locator('.time-summary')).toContainText('0 scheduled minutes');
  for (const [id, action, form] of [['book', 'edit-activity', 'activityForm'], ['pick', 'edit-choice', 'choiceForm'], ['watch', 'edit-video', 'videoForm'], ['ideas', 'edit-suggestion', 'suggestionForm'], ['open', 'edit-open-slot', 'slotForm']]) {
    await page.locator(`[data-action="${action}"][data-id="${id}"]`).click();
    await expect(page.locator(`#${form} [name="ghost"]`)).toBeChecked();
    await page.locator(`#${form} [name="start"]`).fill('09:00');
    await page.locator(`#${form} button[type="submit"]`).click();
    await expect(page.locator('#activityDialog')).not.toBeVisible();
  }
  await page.reload();
  expect((await items(page)).every((item: any) => item.ghost && item.start === '09:00')).toBe(true);
  await page.locator('[data-action="toggle-ghost"][data-id="book"]').click();
  await page.locator('#undoButton').click();
  expect((await items(page))[0].ghost).toBe(true);
  await page.evaluate(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'woodles.schedule-planner.v1') throw new DOMException('Full', 'QuotaExceededError'); save.call(this, key, value); };
  });
  await page.locator('[data-action="toggle-ghost"][data-id="book"]').click();
  await expect(page.locator('.is-ghost')).toHaveCount(5);
  expect((await items(page))[0].ghost).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('ghost-mobile.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).include('.activity-list').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
});
