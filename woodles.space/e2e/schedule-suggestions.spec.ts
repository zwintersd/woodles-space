import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const storageKey = 'woodles.schedule-planner.v1';
const progressKey = 'woodles.schedule-planner.progress.v1';

async function blankPlan(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const studio = (window as any).ScheduleStudio;
    const image = { id: 'snack-picture', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=' };
    const activity = studio.sanitizeActivity({ id: 'snack', title: 'Make a snack', category: 'Chores', duration: 5, imageAssetId: image.id,
      steps: [{ id: 'wash', title: 'Wash hands' }, { id: 'pick', title: 'Choose fruit', kind: 'choice', options: [{ id: 'apple', title: 'Apple' }, { id: 'banana', title: 'Banana' }] }] });
    localStorage.setItem(studio.STORAGE_KEY, JSON.stringify({ plans: [studio.sanitizePlan({ id: 'suggestion-test', learner: 'Sam', name: 'Optional activities', days: [] })], activities: [activity], images: [image] }));
  });
  await page.goto('/schedules/generator?plan=suggestion-test&day=monday');
}

async function addCandidate(page: Page, title: string, category: string, duration = '5', url = '') {
  await page.locator('#candidateTitle').fill(title);
  await page.locator('#candidateCategory').fill(category);
  await page.locator('#candidateDuration').fill(duration);
  await page.locator('#candidateUrl').fill(url);
  await page.locator('[data-action="suggestion-add-candidate"]').click();
}

async function savedState(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), storageKey);
}

test('maker pools, rules, saved steps and pictures survive copies and export/import', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await blankPlan(page);
  await page.locator('[data-action="add-suggestion"]').click();
  await page.locator('#suggestionForm button[type="submit"]').click();
  await expect(page.locator('#suggestionError')).toContainText('Enable at least one');
  await page.locator('[data-action="suggestion-library-candidate"]').click();
  await addCandidate(page, 'Watch a nature video', 'Videos', '10', 'https://example.com/nature');
  await addCandidate(page, 'A long walk', 'Movement', '30');
  await expect(page.locator('#suggestionReadiness')).toContainText('2 of 3');
  await page.getByRole('combobox', { name: 'Rerolls', exact: true }).selectOption('limited');
  await page.getByLabel('Rerolls after the first spin').fill('1');
  await page.getByLabel('Let the learner choose a category').check();
  await page.getByLabel('Allow “Skip this”').check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#activityDialog').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('maker-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#suggestionForm button[type="submit"]').click();
  await expect(page.locator('.suggestion-card')).toContainText('2 available');
  let saved = await savedState(page);
  expect(saved.plans[0].days[0].activities).toHaveLength(1);
  expect(saved.suggestionPools).toHaveLength(1);
  expect(saved.suggestionPools[0].candidates[0].steps).toHaveLength(2);
  await page.locator('#copyDestination').selectOption('tuesday');
  await page.locator('[data-action="copy-day"]').click();
  await page.locator('[data-action="edit-suggestion"]').click();
  await expect(page.getByRole('combobox', { name: 'Rerolls', exact: true })).toHaveValue('limited');
  await page.getByLabel('Rerolls after the first spin').fill('2');
  await page.locator('#suggestionForm button[type="submit"]').click();
  saved = await savedState(page);
  expect(saved.plans[0].days[0].activities[0].maxRerolls).toBe(2);
  expect(saved.plans[0].days[1].activities[0].maxRerolls).toBe(1);
  await page.locator('[data-action="add-suggestion"]').click();
  await page.locator('#suggestionPool').selectOption(saved.suggestionPools[0].id);
  await expect(page.locator('.suggestion-candidate')).toHaveCount(3);
  await expect(page.getByLabel('Rerolls after the first spin')).toHaveValue('2');
  await page.locator('#suggestionForm button[type="submit"]').click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.suggestion-card').first()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  const exporting = page.waitForEvent('download');
  await page.locator('[data-action="export-plan"]').click();
  const download = await exporting;
  await page.locator('#importFile').setInputFiles((await download.path())!);
  saved = await savedState(page);
  expect(saved.plans).toHaveLength(2);
  expect(saved.suggestionPools).toHaveLength(2);
  const candidate = saved.plans[1].days[0].activities[0].candidates[0];
  expect(candidate.steps[1].options).toHaveLength(2);
  expect(candidate.imageAssetId).not.toBe('snack-picture');
  expect(saved.images.some((image: any) => image.id === candidate.imageAssetId)).toBe(true);
  expect(saved.plans[1].days[0].activities[0].poolId).toBe(saved.suggestionPools[1].id);
  expect(errors).toEqual([]);
});

async function seedSuggestion(page: Page, extra: Record<string, unknown> = {}) {
  await blankPlan(page);
  await page.evaluate((config) => {
    const studio = (window as any).ScheduleStudio;
    const workspace = JSON.parse(localStorage.getItem(studio.STORAGE_KEY)!);
    workspace.plans[0].days[0].activities = [{ kind: 'suggestion', occurrenceId: 'draw', start: '09:00',
      title: 'What shall we do?', duration: 15, rerollMode: 'limited', maxRerolls: 1, avoidRepeats: true,
      allowCategoryChoice: true, allowSkip: true, animation: 'spin',
      candidates: [{ id: 'fold', title: 'Fold towels', category: 'Chores', duration: 5, weight: 1, icon: '🧺' },
        { id: 'watch', title: 'Watch a nature video', category: 'Videos', duration: 10, weight: 1, icon: '▶', url: 'https://example.com/nature' },
        { id: 'disabled', title: 'Unavailable', category: 'Chores', enabled: false, duration: 5 },
        { id: 'too-long', title: 'A long walk', category: 'Movement', duration: 30 }], ...config }];
    localStorage.setItem(studio.STORAGE_KEY, JSON.stringify(workspace));
  }, extra);
  await page.goto('/schedules/view?plan=suggestion-test&day=monday');
}

test('spins persist through animation refresh, category changes, acceptance and clear checks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seedSuggestion(page);
  const category = page.locator('[data-suggestion-category]');
  await expect(category.locator('option')).toHaveCount(3);
  await category.selectOption('Chores');
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-stage')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('.suggestion-result')).toContainText('Fold towels');
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await page.locator('[data-suggestion-category]').selectOption('Videos');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-result')).toContainText('Watch a nature video');
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('.suggestion-budget')).toContainText('0 rerolls left');
  await page.locator('[data-suggestion-accept]').click();
  await expect(page.locator('.suggestion-result a')).toHaveAttribute('href', 'https://example.com/nature');
  await expect(page.locator('[data-suggestion-category]')).toBeDisabled();
  await page.locator('[data-done="draw"]').click();
  await page.locator('#reset').click();
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await expect(page.locator('.suggestion-status')).toContainText('You chose this');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)['suggestion-test:monday'].suggestions.draw, progressKey);
  expect(state.spins).toBe(2);
  expect(state.seen).toEqual(['fold', 'watch']);
  expect(state.accepted).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('learner-mobile.png'), fullPage: true });
  await page.goto('/schedules/generator?plan=suggestion-test&day=monday');
  await page.locator('[data-action="edit-suggestion"]').click();
  await page.getByText('Maker override', { exact: true }).click();
  await page.locator('[data-action="suggestion-reset-progress"]').click();
  await page.goto('/schedules/view?plan=suggestion-test&day=monday');
  await expect(page.locator('[data-suggestion-draw]')).toBeEnabled();
  await expect(page.locator('.suggestion-result')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('no rerolls, skip, day rollover and calm reveal', async ({ page }) => {
  await seedSuggestion(page, { rerollMode: 'none', animation: 'instant' });
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await page.locator('[data-suggestion-skip]').click();
  await expect(page.locator('.suggestion-status')).toContainText('Skipped');
  await page.locator('#reset').click();
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key)!);
    value['suggestion-test:monday'].date = '2000-01-01';
    localStorage.setItem(key, JSON.stringify(value));
  }, progressKey);
  await page.reload();
  await expect(page.locator('[data-suggestion-draw]')).toBeEnabled();
});

test('reel finishes once, rapid clicks are ignored, and accepted activities retain their steps', async ({ page }) => {
  await seedSuggestion(page, { allowCategoryChoice: false, allowSkip: false,
    candidates: [{ id: 'snack', title: 'Make a snack', category: 'Chores', duration: 5, weight: 1,
      steps: [{ id: 'wash', title: 'Wash hands' }, { id: 'pick', title: 'Choose fruit', kind: 'choice', options: [{ id: 'apple', title: 'Apple' }, { id: 'banana', title: 'Banana' }] }] }] });
  await page.locator('[data-suggestion-draw]').click();
  await expect(page.locator('.suggestion-stage')).toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-suggestion-draw]').evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('.suggestion-stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.suggestion-result')).toContainText('Make a snack');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)['suggestion-test:monday'].suggestions.draw, progressKey);
  expect(state.spins).toBe(1);
  await page.locator('[data-suggestion-accept]').click();
  await expect(page.locator('.activity-steps')).toContainText('Wash hands');
  await page.locator('.activity-steps .chip').filter({ hasText: 'Apple' }).click();
  await page.reload();
  await expect(page.locator('.activity-steps .chip').filter({ hasText: 'Apple' })).toHaveAttribute('aria-pressed', 'true');
});

test('two learner tabs share one first draw and the same reroll budget', async ({ page }) => {
  await seedSuggestion(page, { rerollMode: 'none', animation: 'instant' });
  const other = await page.context().newPage();
  await other.goto('/schedules/view?plan=suggestion-test&day=monday');
  await Promise.all([page, other].map((tab) => tab.locator('[data-suggestion-draw]').evaluate((button) => button.dispatchEvent(new MouseEvent('click', { bubbles: true })) )));
  await expect(page.locator('[data-suggestion-draw]')).toBeDisabled();
  await expect(other.locator('[data-suggestion-draw]')).toBeDisabled();
  await expect(page.locator('.suggestion-result')).toHaveCount(1);
  await expect(other.locator('.suggestion-result')).toHaveCount(1);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)['suggestion-test:monday'].suggestions.draw, progressKey);
  expect(state.spins).toBe(1);
  await other.close();
});

test('weighted policy handles limits, unavailable items, exhaustion and configuration changes', async ({ page }) => {
  await page.goto('/schedules/generator');
  const result = await page.evaluate(() => {
    const studio = (window as any).ScheduleStudio;
    const item = studio.sanitizeSuggestion({ duration: 15, rerollMode: 'unlimited', avoidRepeats: true,
      candidates: [{ id: 'light', title: 'Light', duration: 5, weight: 1 }, { id: 'heavy', title: 'Heavy', duration: 5, weight: 9 },
        { id: 'disabled', title: 'Off', enabled: false }, { id: 'long', title: 'Long', duration: 30 }] });
    const first = studio.drawSuggestion(item, {}, '', () => .2);
    const second = studio.drawSuggestion(item, first, '', () => .2);
    const third = studio.drawSuggestion(item, second);
    const repeating = { ...item, avoidRepeats: false };
    const repeat = studio.drawSuggestion(repeating, second, '', () => .2);
    const noRerolls = studio.drawSuggestion({ ...item, rerollMode: 'none' }, first);
    const changed = studio.suggestionStatus({ ...item, candidates: item.candidates.filter((entry: any) => entry.id !== 'heavy') }, { ...first, accepted: true });
    const empty = studio.suggestionStatus({ ...item, candidates: [] }, {});
    const invalid = studio.sanitizeSuggestion({ maxRerolls: -20, candidates: [{ id: 'duplicate', title: 'One', weight: -100 }, { id: 'duplicate', title: 'Two' }] });
    return { first: first.selected, second: second.selected, third, repeat: repeat.selected, noRerolls,
      changedSelected: changed.selected, emptyDraw: empty.canDraw, invalidWeight: invalid.candidates[0].weight, deduplicated: invalid.candidates.length };
  });
  expect(result).toEqual({ first: 'heavy', second: 'light', third: null, repeat: 'heavy', noRerolls: null,
    changedSelected: null, emptyDraw: false, invalidWeight: 1, deduplicated: 1 });
});

test('suggestion setup and learner controls meet automated accessibility checks', async ({ page }) => {
  await blankPlan(page);
  await page.locator('[data-action="add-suggestion"]').click();
  await page.locator('[data-action="suggestion-library-candidate"]').click();
  const maker = await new AxeBuilder({ page }).include('#suggestionForm').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(maker.violations, JSON.stringify(maker.violations, null, 2)).toEqual([]);
  await seedSuggestion(page, { animation: 'instant' });
  await page.locator('[data-suggestion-draw]').click();
  const learner = await new AxeBuilder({ page }).include('.suggestion').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(learner.violations, JSON.stringify(learner.violations, null, 2)).toEqual([]);
});

