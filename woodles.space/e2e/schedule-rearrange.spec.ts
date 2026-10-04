import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function seed(page: Page, end = '12:00') {
  await page.goto('/schedules/generator');
  await page.evaluate(end => {
    const S = (window as any).ScheduleStudio;
    const plan = S.sanitizePlan({ id: 'rearrange', learner: 'Sam', days: [{ key: 'monday', end, activities: [
      { kind: 'activity', occurrenceId: 'book', title: 'Book', start: '09:00', duration: 10, steps: [{ id: 'page', title: 'Turn a page' }] },
      { kind: 'choice', occurrenceId: 'pick', title: 'Pick', start: '09:10', duration: 15, options: [{ id: 'a', title: 'Apple' }, { id: 'b', title: 'Banana' }] },
      { kind: 'video', occurrenceId: 'watch', title: 'Watch', start: '09:40', duration: 10, videos: [{ id: 'v', title: 'Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] },
      { kind: 'suggestion', occurrenceId: 'ideas', title: 'Ideas', start: '10:10', duration: 15, candidates: [{ id: 'walk', title: 'Walk', category: 'Movement', duration: 5 }] },
      { kind: 'open-slot', occurrenceId: 'open', start: '10:25', duration: 10 },
      { kind: 'activity', occurrenceId: 'ghost', title: 'Ghost', ghost: true, start: '09:00', duration: 80 }
    ] }] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan] }));
  }, end);
  await page.goto('/schedules/generator?plan=rearrange&day=monday');
}
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0].days[0]);
const card = (page: Page, id: string) => page.locator(`.activity-list [data-item-id="${id}"]`);

async function dragTo(page: Page, id: string, target: string, after = false, cancel = false) {
  const original = await state(page);
  const handle = page.locator(`[data-action="drag-activity"][data-id="${id}"]`);
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  const to = (await card(page, target).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * (after ? .85 : .15), { steps: 12 });
  await expect(page.locator('.drag-floating')).toBeVisible();
  expect(await state(page)).toEqual(original);
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-floating')).toHaveCount(0);
}

test('duplicate deep-copies every item type, pushes only collisions and supports undo/reload', async ({ page }) => {
  await seed(page);
  const original = await state(page);
  for (const id of ['book', 'pick', 'watch', 'ideas', 'open', 'ghost']) {
    const source = original.activities.find((item: any) => item.occurrenceId === id);
    await page.locator(`[data-action="duplicate-activity"][data-id="${id}"]`).click();
    const current = await state(page);
    const copy = current.activities.at(-1);
    expect(copy.occurrenceId).not.toBe(id);
    const { occurrenceId, start, ...content } = source;
    const { occurrenceId: copyId, start: copyStart, ...copiedContent } = copy;
    expect(copiedContent).toEqual(content);
    if (id === 'book') {
      expect(copy.start).toBe('09:10');
      expect(current.activities.find((item: any) => item.occurrenceId === 'pick').start).toBe('09:20');
      expect(current.activities.find((item: any) => item.occurrenceId === 'watch').start).toBe('09:40');
      expect(current.activities.find((item: any) => item.occurrenceId === 'ghost').start).toBe('09:00');
    }
    await page.locator('#undoButton').click();
    expect(await state(page)).toEqual(original);
  }
  await page.screenshot({ path: test.info().outputPath('rearrange-desktop.png'), fullPage: true });
  await page.locator('[data-action="duplicate-activity"][data-id="ideas"]').click();
  await page.reload();
  expect((await state(page)).activities).toHaveLength(7);
});

test('drag previews times without saving, commits pushes, cancels, and keyboard handles reorder', async ({ page }) => {
  await seed(page);
  const original = await state(page);
  await dragTo(page, 'watch', 'book');
  const moved = await state(page);
  expect(moved.activities.find((item: any) => item.occurrenceId === 'watch').start).toBe('09:00');
  expect(moved.activities.find((item: any) => item.occurrenceId === 'book').start).toBe('09:10');
  expect(moved.activities.find((item: any) => item.occurrenceId === 'pick').start).toBe('09:20');
  expect(moved.activities.find((item: any) => item.occurrenceId === 'ideas').start).toBe('10:10');
  await page.locator('#undoButton').click();
  expect(await state(page)).toEqual(original);
  await dragTo(page, 'book', 'ideas', true, true);
  expect(await state(page)).toEqual(original);
  const handle = page.locator('[data-action="drag-activity"][data-id="watch"]');
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).activities.find((item: any) => item.occurrenceId === 'watch').start).toBe('09:10');
  await expect(handle).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('rearrange-mobile.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).include('.activity-list').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('session limits and failed saves preserve original times; full-day duplicates become ghosts', async ({ page }) => {
  await seed(page, '10:35');
  const original = await state(page);
  await page.locator('[data-action="duplicate-activity"][data-id="open"]').click();
  expect((await state(page)).activities.at(-1).ghost).toBe(true);
  await page.locator('#undoButton').click();
  await dragTo(page, 'book', 'open', true);
  expect(await state(page)).toEqual(original);
  await page.evaluate(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'woodles.schedule-planner.v1') throw new DOMException('Full', 'QuotaExceededError'); save.call(this, key, value); };
  });
  await page.locator('[data-action="duplicate-activity"][data-id="book"]').click();
  expect(await state(page)).toEqual(original);
  await expect(page.locator('.activity-card')).toHaveCount(6);
  await page.locator('[data-action="move-activity"][data-id="watch"][data-direction="-1"]').click();
  expect(await state(page)).toEqual(original);
});

test('reduced motion skips the playful settle animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await page.locator('[data-action="move-activity"][data-id="watch"][data-direction="-1"]').click();
  expect(await page.locator('.activity-list').evaluate(list => list.getAnimations({ subtree: true }).length)).toBe(0);
});

test('touch dragging uses the same preview and playful drop; pointer cancellation keeps saved times', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await seed(page);
  await page.evaluate(() => {
    const key = 'woodles.schedule-planner.v1'; const value = JSON.parse(localStorage.getItem(key)!);
    value.plans[0].days[0].activities = value.plans[0].days[0].activities.filter((item: any) => ['book', 'pick'].includes(item.occurrenceId));
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  const original = await state(page);
  await card(page, 'pick').scrollIntoViewIfNeeded();
  const from = (await page.locator('[data-action="drag-activity"][data-id="pick"]').boundingBox())!;
  const target = (await card(page, 'book').boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }] });
  for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 + (target.y + 10 - from.y - from.height / 2) * step / 8 }] });
  await expect(page.locator('.drag-floating')).toBeVisible();
  expect(await state(page)).toEqual(original);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.drag-floating')).toHaveCount(0);
  expect((await state(page)).activities.find((item: any) => item.occurrenceId === 'pick').start).toBe('09:00');
  // Normal motion gets the overshoot keyframes; reduced motion is covered separately.
  expect(await card(page, 'pick').evaluate(node => node.getAnimations().some(animation => (animation.effect as KeyframeEffect).getKeyframes().length === 4))).toBe(true);
  await page.locator('#undoButton').click();
  const again = (await page.locator('[data-action="drag-activity"][data-id="pick"]').boundingBox())!;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: again.x + 10, y: again.y + 10 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: again.x + 10, y: target.y + 10 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await state(page)).toEqual(original);
  const finalHandle = (await page.locator('[data-action="drag-activity"][data-id="pick"]').boundingBox())!;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: finalHandle.x + 10, y: finalHandle.y + 10 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: finalHandle.x + 10, y: target.y + 10 }] });
  await page.keyboard.press('Tab');
  await expect(page.locator('.drag-floating')).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await state(page)).toEqual(original);
  await session.detach();
});

test('editing each item type pushes occupied blocks, keeps ghost times, and undoes the entire edit', async ({ page }) => {
  for (const [id, action, form] of [['book', 'edit-activity', 'activityForm'], ['pick', 'edit-choice', 'choiceForm'], ['watch', 'edit-video', 'videoForm'], ['ideas', 'edit-suggestion', 'suggestionForm'], ['open', 'edit-open-slot', 'slotForm']]) {
    await seed(page);
    const original = await state(page);
    await page.locator(`[data-action="${action}"][data-id="${id}"]`).click();
    await page.locator(`#${form} [name="start"]`).fill('09:05');
    await page.locator(`#${form} button[type="submit"]`).click();
    await expect(page.locator('#activityDialog')).not.toBeVisible();
    const current = await state(page);
    expect(current.activities.find((item: any) => item.occurrenceId === id).start).toBe('09:05');
    expect(current.activities.find((item: any) => item.occurrenceId === 'ghost').start).toBe('09:00');
    const active = current.activities.filter((item: any) => !item.ghost).sort((a: any, b: any) => a.start.localeCompare(b.start));
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    for (let index = 1; index < active.length; index++) expect(minutes(active[index].start)).toBeGreaterThanOrEqual(minutes(active[index - 1].start) + active[index - 1].duration);
    await page.locator('#undoButton').click();
    expect(await state(page)).toEqual(original);
  }
});
