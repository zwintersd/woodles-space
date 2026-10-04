import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function localPlan(page: Page, id: string) {
  await page.goto('/schedules/generator');
  await page.evaluate(id => {
    const S = (window as any).ScheduleStudio;
    const plan = S.sanitizePlan({ id, learner: 'Robin', name: 'Afternoon plan', days: [
      { key: 'monday', start: '15:00', end: '18:00', activities: [
        { kind: 'activity', occurrenceId: 'read', title: 'Read together', start: '15:00', duration: 15, icon: '📚' },
        { kind: 'activity', occurrenceId: 'ghost', title: 'PRIVATE GHOST', start: '15:00', duration: 30, ghost: true }
      ] },
      { key: 'tuesday', removed: true, activities: [{ kind: 'activity', occurrenceId: 'private', title: 'PRIVATE HIDDEN DAY', start: '09:00', duration: 20 }] }
    ] });
    plan.days.forEach((day: any) => { if (day.key !== 'monday') day.removed = true; });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [{ title: 'PRIVATE LIBRARY', duration: 15 }], images: [], suggestionPools: [], customSymbols: [] }));
  }, id);
  await page.goto('/schedules/generator?plan=' + id + '&day=monday');
}
async function openPublishing(page: Page) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const login = page.locator('[data-publish-form="login"]');
  await expect(page.locator('.publishing-dialog')).toBeVisible();
  await expect(page.locator('.publish-message')).not.toHaveText('Working…');
  if (await login.isVisible()) {
    await login.getByLabel('Publisher passphrase').fill('fixture-publisher-passphrase');
    await login.getByRole('button', { name: 'Unlock publishing', exact: true }).click();
  }
  await expect(page.locator('[data-publish-form="publish"]')).toBeVisible();
}
async function publish(page: Page) {
  await openPublishing(page);
  const form = page.locator('[data-publish-form="publish"]');
  await form.getByLabel('Learner password', { exact: true }).fill('learner-pass');
  await form.getByRole('button', { name: 'Publish learner link', exact: true }).click();
  await expect(page.locator('.publish-status')).toContainText('Live · password protected');
  return page.getByLabel('Learner link', { exact: true }).inputValue();
}
async function unlock(page: Page, password = 'learner-pass') {
  await page.getByLabel('Learner password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Open my schedule', exact: true }).click();
  await expect(page.locator('#timeline')).toBeVisible();
}

test('review, protected publish, deliberate republish and learner lock across devices', async ({ page, browser }) => {
  const errors: string[] = [], uploads: any[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/schedules') && request.method() === 'POST' && request.postDataJSON().action === 'publish') uploads.push(request.postDataJSON()); });
  await localPlan(page, 'publishing-primary');
  await openPublishing(page);
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.publishing-dialog').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Publish learner link', exact: true })).toBeEnabled();
    expect((await new AxeBuilder({ page }).include('.publishing-dialog').analyze()).violations).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('publishing-' + viewport.width + '.png') });
  }
  await page.getByRole('button', { name: 'Publish learner link', exact: true }).click();
  expect(uploads).toHaveLength(0);
  await page.locator('[data-publish-form="publish"]').getByLabel('Learner password', { exact: true }).fill('learner-pass');
  await page.getByRole('button', { name: 'Publish learner link', exact: true }).click();
  await expect(page.locator('.publish-status')).toContainText('Live');
  const href = await page.getByLabel('Learner link', { exact: true }).inputValue();
  expect(href).toMatch(/\/schedules\/p\/[a-f0-9]{32}$/);
  expect(JSON.stringify(uploads[0].payload)).not.toContain('PRIVATE');
  expect(uploads[0].payload.plan.days).toHaveLength(1);
  const learnerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const learner = await learnerContext.newPage(); learner.on('pageerror', error => errors.push(error.message));
  await learner.goto(href);
  await expect(learner.getByLabel('Learner password')).toBeVisible();
  expect((await new AxeBuilder({ page: learner }).analyze()).violations).toEqual([]);
  await expect(learner.locator('body')).not.toContainText('Robin');
  await learner.getByLabel('Learner password').fill('wrong-pass');
  await learner.getByRole('button', { name: 'Open my schedule' }).click();
  await expect(learner.locator('#notice')).toContainText('did not match');
  await unlock(learner);
  await expect(learner.locator('#greeting')).toHaveText('Hi Robin!');
  await expect(learner.locator('#timeline')).toContainText('Read together');
  expect((await new AxeBuilder({ page: learner }).analyze()).violations).toEqual([]);
  await expect(learner.locator('#editLink')).not.toBeVisible();
  await expect(learner.locator('.day-links a')).toHaveCount(1);
  expect(await learner.evaluate(() => localStorage.getItem('woodles.schedule-planner.v1'))).toBeNull();
  await learner.screenshot({ path: test.info().outputPath('learner-unlocked-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close publishing' }).click();
  await page.evaluate(() => { const key = 'woodles.schedule-planner.v1'; const data = JSON.parse(localStorage.getItem(key)!); data.plans[0].days[0].activities[0].title = 'Build blocks'; localStorage.setItem(key, JSON.stringify(data)); });
  await page.reload(); await learner.reload(); await expect(learner.locator('#timeline')).toContainText('Read together');
  await openPublishing(page);
  await page.getByRole('button', { name: 'Publish updated plan', exact: true }).click();
  await expect(page.locator('.publish-status')).toContainText('Version 2');
  expect(await page.getByLabel('Learner link', { exact: true }).inputValue()).toBe(href);
  await learner.reload(); await expect(learner.locator('#timeline')).toContainText('Build blocks');
  await learner.getByRole('button', { name: 'Lock schedule' }).click();
  await expect(learner.locator('body')).not.toContainText('Build blocks');
  await learner.reload(); await expect(learner.getByLabel('Learner password')).toBeVisible();
  expect(await page.evaluate(() => Object.values(localStorage).join('\n'))).not.toMatch(/fixture-publisher-passphrase|learner-pass/);
  expect(errors).toEqual([]); await learnerContext.close();
});

test('access rotation, withdrawal and version restoration keep one protected link', async ({ page, browser }) => {
  await localPlan(page, 'publishing-access'); const href = await publish(page);
  const learnerContext = await browser.newContext(); const learner = await learnerContext.newPage();
  await learner.goto(href); await unlock(learner);
  await page.locator('.publish-access>summary').click();
  const access = page.locator('[data-publish-form="access"]');
  await access.getByLabel('Learner password', { exact: true }).fill('new-learner-pass');
  await access.getByRole('button', { name: 'Save access settings' }).click();
  await expect(page.locator('.publish-message')).toHaveText('Access settings saved.');
  await learner.reload(); await expect(learner.getByLabel('Learner password')).toBeVisible();
  await unlock(learner, 'new-learner-pass');
  await page.getByRole('button', { name: 'Withdraw learner link', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, withdraw learner link', exact: true }).click();
  await expect(page.locator('.publish-status')).toContainText('Withdrawn');
  await learner.reload(); await expect(learner.locator('#notice')).toContainText('unavailable');
  await page.locator('.publish-history>summary').click();
  await page.getByRole('button', { name: 'Load version history' }).click();
  await page.getByRole('button', { name: 'Preview version 1', exact: true }).click();
  await expect(page.locator('.publish-history')).toContainText('Read together');
  await page.getByRole('button', { name: 'Publish version 1 again', exact: true }).click();
  await expect(page.locator('.publish-status')).toContainText('Live');
  expect(await page.getByLabel('Learner link', { exact: true }).inputValue()).toBe(href);
  await learner.reload(); await unlock(learner, 'new-learner-pass');
  await page.getByRole('button', { name: 'Lock publishing', exact: true }).click();
  await expect(page.getByLabel('Publisher passphrase')).toBeVisible();
  await learner.reload(); await expect(learner.locator('#timeline')).toBeVisible();
  await learnerContext.close();
});

test('published catalogue supports a fresh device and imports an independent local draft', async ({ page, browser }) => {
  await localPlan(page, 'publishing-catalogue'); const href = await publish(page);
  const fresh = await browser.newContext(); const other = await fresh.newPage();
  await other.goto('/schedules/generator'); await other.getByRole('button', { name: 'Published plans', exact: true }).click();
  await other.getByLabel('Publisher passphrase').fill('fixture-publisher-passphrase'); await other.getByRole('button', { name: 'Unlock publishing' }).click();
  await expect(other.locator('.publish-catalogue')).toBeVisible();
  await other.locator('[data-pub="select"][data-id="' + href.split('/').pop() + '"]').click();
  await other.getByRole('button', { name: 'Make an editable local copy' }).click();
  await expect(other.locator('.publishing-dialog')).not.toBeVisible();
  await expect(other.locator('.activity-list')).toContainText('Read together');
  const copied = await other.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0]);
  expect(copied.id).not.toBe('publishing-catalogue'); expect(copied.id).not.toBe(href.split('/').pop());
  expect(copied.days.filter((day: any) => !day.removed)).toHaveLength(1);
  expect(JSON.stringify(copied)).not.toContain('PRIVATE');
  await openPublishing(other);
  await expect(other.getByRole('button', { name: 'Publish updated plan', exact: true })).toBeVisible();
  expect(await other.getByLabel('Learner link', { exact: true }).inputValue()).toBe(href);
  await fresh.close();
});

test('published snapshots retain every item type, nested choices, suggestions and uploaded symbols', async ({ page, browser }) => {
  const errors: string[] = [];
  await localPlan(page, 'publishing-mixed');
  await page.evaluate(() => {
    const key = 'woodles.schedule-planner.v1', data = JSON.parse(localStorage.getItem(key)!);
    const candidate = { id: 'draw', title: 'Draw a star', duration: 10, enabled: true, weight: 1, category: 'Art', icon: '⭐' };
    const suggestion = { kind: 'suggestion', title: 'Art ideas', duration: 15, rerollMode: 'limited', maxRerolls: 1, animation: 'instant', avoidRepeats: true, candidates: [candidate] };
    const first = data.plans[0].days[0].activities[0];
    first.symbolAssetId = 'picture'; first.symbolCredit = 'Test artist'; first.symbolPixelated = true;
    first.steps = [{ id: 'book', title: 'Get a book', kind: 'task' }, { id: 'story', title: 'Pick a story', kind: 'choice', options: [{ id: 'bear', title: 'Bear story', icon: '🐻' }, { id: 'cat', title: 'Cat story', icon: '🐱' }] }, { ...suggestion, id: 'art-step' }];
    data.plans[0].days[0].activities.push(
      { kind: 'choice', occurrenceId: 'pick', start: '15:15', duration: 15, options: [{ id: 'blocks', title: 'Blocks', icon: '🧱' }, { ...suggestion, id: 'art-option', title: 'Art category' }] },
      { kind: 'video', occurrenceId: 'watch', start: '15:30', duration: 10, videos: [{ id: 'song', title: 'A song', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', icon: '🎵' }] },
      { ...suggestion, occurrenceId: 'surprise', start: '15:40', duration: 15 },
      { kind: 'open-slot', occurrenceId: 'break', start: '15:55', duration: 10 }
    );
    data.images = [{ id: 'picture', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw1kAAAAASUVORK5CYII=' }];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload(); const href = await publish(page);
  const context = await browser.newContext(); const learner = await context.newPage(); learner.on('pageerror', error => errors.push(error.message));
  await learner.goto(href); await unlock(learner);
  await expect(learner.locator('#timeline > .step')).toHaveCount(6);
  await expect(learner.locator('.custom-symbol-art img')).toHaveAttribute('src', /^data:image\/png/);
  await expect(learner.locator('#credits')).toContainText('Test artist');
  const bear = learner.locator('.activity-steps .chip').filter({ hasText: 'Bear story' }); await bear.click(); await expect(bear).toHaveAttribute('aria-pressed', 'true');
  await learner.locator('.step[data-id="pick"] .chip').filter({ hasText: 'Art category' }).click();
  const category = learner.locator('.step[data-id="pick"] .nested-suggestion');
  await category.getByRole('button', { name: 'Find an activity', exact: false }).click();
  await expect(category.locator('.suggestion-result')).toContainText('Draw a star');
  await learner.reload(); await expect(learner.locator('.step[data-id="pick"] .nested-suggestion .suggestion-result')).toContainText('Draw a star');
  expect(errors).toEqual([]); await context.close();
});
