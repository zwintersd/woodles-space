import { addScheduleItem, openScheduleTools, openActivitySection, openVisualPicker } from './support/schedule-planner';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const storageKey = 'woodles.schedule-planner.v1';
const api = 'https://api.arasaac.org/v1/pictograms/en/bestsearch/';
const results = [
  { _id: 9813, keywords: [{ type: 2, keyword: 'toys' }] },
  { _id: 7171, keywords: [{ type: 2, keyword: 'wash hands' }] },
  { _id: 2501, keywords: [{ type: 'noun', keyword: 'snack' }] },
  { _id: 'bad-id', keywords: [{ keyword: 'bad' }] },
  { _id: 9813, keywords: [{ keyword: 'duplicate' }] }
];
async function setup(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [S.sanitizePlan({ id: 'arasaac', learner: 'Sam', days: [] })], activities: [], images: [] }));
  });
  await page.goto('/schedules/generator?plan=arasaac&day=monday');
  // Stable image fixture: API selection and persistence should not depend on CDN uptime.
  await page.route('https://static.arasaac.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" rx="10" fill="#3978c7"/></svg>' }));
}
async function choose(page: Page, selector: string, id: number) {
  if (selector.includes('data-sprite-target="form"')) await openVisualPicker(page, selector.startsWith('#choiceForm') ? '#choiceForm' : '#activityForm');
  await page.locator(selector).click();
  await expect(page.locator('#arasaacResults [data-arasaac-id]')).toHaveCount(3);
  await page.locator(`[data-arasaac-id="${id}"]`).click();
  await expect(page.locator('#arasaacDialog')).not.toBeVisible();
}

test('ARASAAC search works in activities, steps, choices and suggestion options and persists across transfers', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const searches: string[] = [];
  await setup(page);
  await page.route(api + '**', route => {
    searches.push(decodeURIComponent(route.request().url().slice(api.length)));
    return route.fulfill({ json: results });
  });
  await addScheduleItem(page, 'activity');
  await page.locator('#activityForm [name="title"]').fill('Morning routine');
  await choose(page, '#activityForm [data-action="search-arasaac"][data-sprite-target="form"]', 2501);
  await expect(page.locator('#activityForm [name="pictogramUrl"]')).toHaveValue('2501');
  await expect(page.locator('#activityForm .symbol-preview img')).toHaveAttribute('src', /2501_300.png$/);
  await page.locator('#activityForm [data-action="pick-custom-symbol"]').click();
  await page.locator('#customSymbolUpload').setInputFiles({ name: 'test_sprite.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Use :test_sprite:', exact: true }).click();
  await expect(page.locator('#activityForm [name="symbolAssetId"]')).not.toHaveValue('');
  await choose(page, '#activityForm [data-action="search-arasaac"][data-sprite-target="form"]', 2501);
  await expect(page.locator('#activityForm [name="symbolAssetId"]')).toHaveValue('');
  await page.locator('[data-action="toggle-symbol-picker"]').click();
  await page.locator('[data-action="select-symbol"][data-symbol="⭐"]').click();
  await expect(page.locator('#activityForm [name="pictogramUrl"]')).toHaveValue('');
  await choose(page, '#activityForm [data-action="search-arasaac"][data-sprite-target="form"]', 2501);
  await openActivitySection(page, 'steps');
  await page.locator('[data-action="add-activity-step"]').click();
  await page.locator('[data-step-field="title"]').fill('Choose Activity');
  await choose(page, '[data-action="search-arasaac"][data-sprite-target="step"]', 7171);
  await expect(page.locator('[data-step-field="pictogram"]').first()).toHaveValue('7171');
  await page.locator('[data-step-kind="0"]').selectOption('choice');
  for (const [index, title] of ['Play with toys', 'Have a snack'].entries()) {
    await page.locator('[data-action="add-step-option"]').click();
    await page.locator(`[data-step-field="title"][data-option-index="${index}"]`).fill(title);
    await choose(page, `[data-action="search-arasaac"][data-sprite-target="step-option"][data-option-index="${index}"]`, index ? 2501 : 9813);
  }
  await openActivitySection(page, 'steps');
  await page.locator('[data-action="add-activity-step"]').click();
  await page.locator('[data-step-field="title"][data-step-index="1"]').fill('Find a short activity');
  await page.locator('[data-step-kind="1"]').selectOption('suggestion');
  await choose(page, '[data-action="search-arasaac"][data-sprite-target="step"][data-step-index="1"]', 7171);
  await page.locator('[data-action="configure-step-suggestion"]').click();
  await page.locator('#candidateTitle').fill('Toys');
  await choose(page, '[data-action="search-arasaac"][data-sprite-target="candidate-new"]', 9813);
  await expect(page.locator('#candidatePictogram')).toHaveValue('9813');
  await page.locator('[data-action="suggestion-add-candidate"]').click();
  await expect(page.locator('#candidatePictogram')).toHaveValue('');
  await choose(page, '[data-action="search-arasaac"][data-sprite-target="candidate"]', 2501);
  await page.locator('#suggestionForm [name="animation"]').selectOption('instant');
  await page.locator('#suggestionForm button[type="submit"]').click();
  await expect(page.locator('#activityForm [name="title"]')).toHaveValue('Morning routine');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#activityDialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('[data-sprite-target="step-option"][data-option-index="0"][data-action="search-arasaac"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('arasaac-step-editor-mobile.png') });
  await page.locator('#activityForm button[type="submit"]').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await addScheduleItem(page, 'choice');
  await page.locator('#optionTitle').fill('Toys');
  await choose(page, '#choiceForm [data-action="search-arasaac"][data-sprite-target="form"]', 9813);
  await page.locator('[data-action="add-choice-option"]').click();
  await expect(page.locator('#choiceForm [name="optionPictogram"]')).toHaveValue('');
  await page.locator('#optionTitle').fill('Snack');
  await page.locator('[data-action="add-choice-option"]').click();
  await choose(page, '#choiceOptions [data-action="search-arasaac"] >> nth=1', 2501);
  await page.locator('#choiceForm button[type="submit"]').click();
  await page.reload();
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), storageKey);
  const activity = saved.plans[0].days[0].activities[0];
  expect(activity.pictogram).toBe('2501');
  expect(activity.steps[0].pictogram).toBe('7171');
  expect(activity.steps[0].options.map((o: any) => o.pictogram)).toEqual(['9813', '2501']);
  expect(activity.steps[1].candidates[0].pictogram).toBe('2501');
  expect(saved.plans[0].days[0].activities[1].options.map((o: any) => o.pictogram)).toEqual(['9813', '2501']);
  await page.locator('[data-action="edit-activity"]').click();
  await expect(page.locator('#activityForm .symbol-preview img')).toHaveAttribute('src', /2501_300.png$/);
  await page.locator('#activityForm [data-close-dialog]').click();
  const exporting = page.waitForEvent('download');
  await openScheduleTools(page, 'plan');
  await page.locator('[data-action="export-plan"]').click();
  const download = await exporting;
  await page.locator('#importFile').setInputFiles((await download.path())!);
  const imported = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), storageKey);
  expect(imported.plans[1].days[0].activities[0].steps[0].options[0].pictogram).toBe('9813');
  await page.goto('/schedules/view?plan=arasaac&day=monday');
  await expect(page.locator('.activity-steps .chip img').first()).toHaveAttribute('src', /9813_300.png$/);
  await expect(page.locator('.nested-suggestion .video-head img')).toHaveAttribute('src', /7171_300.png$/);
  await expect(page.locator('.credits')).toContainText('ARASAAC');
  await page.locator('.nested-suggestion [data-suggestion-draw]').click();
  await expect(page.locator('.nested-suggestion .suggestion-art img')).toHaveAttribute('src', /2501_300.png$/);
  expect(searches).toContain('Play with toys');
  expect(searches).toContain('Morning routine');
  expect(errors).toEqual([]);
});

test('search handles empty, failed and stale requests; supports keyboard selection and accessible mobile results', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  let delayed: (() => Promise<void>) | undefined;
  const requests: string[] = [];
  await page.route(api + '**', route => {
    const query = decodeURIComponent(route.request().url().slice(api.length)); requests.push(query);
    if (query === 'slow') {
      delayed = async () => { await route.fulfill({ json: [{ _id: 99, name: 'stale result' }] }).catch(() => {}); };
      return;
    }
    if (query === 'offline') return route.fulfill({ status: 503, body: 'Unavailable' });
    if (query === 'nothing') return route.fulfill({ status: 404, json: [] });
    return route.fulfill({ json: results });
  });
  await addScheduleItem(page, 'activity');
  const trigger = page.locator('#activityForm [data-action="search-arasaac"]');
  await openVisualPicker(page);
  await trigger.click();
  await page.locator('#arasaacSearch').fill('x');
  await page.locator('#arasaacSearch').press('Enter');
  await expect(page.locator('#arasaacStatus')).toContainText('at least two');
  expect(requests).toEqual([]);
  await page.locator('#arasaacSearch').fill('offline');
  await page.locator('#arasaacSearch').press('Enter');
  await expect(page.locator('#arasaacStatus')).toContainText('unavailable');
  await expect(page.getByRole('link', { name: 'Browse ARASAAC' })).toHaveAttribute('href', /offline$/);
  await page.locator('#arasaacSearch').fill('nothing');
  await page.locator('#arasaacSearch').press('Enter');
  await expect(page.locator('#arasaacStatus')).toContainText('No pictograms');
  await page.locator('#arasaacSearch').fill('slow');
  await page.locator('#arasaacSearch').press('Enter');
  await expect.poll(() => Boolean(delayed)).toBe(true);
  await page.locator('#arasaacSearch').fill('play / toys');
  await page.locator('#arasaacSearch').press('Enter');
  await expect(page.locator('#arasaacResults [data-arasaac-id]')).toHaveCount(3);
  await delayed!();
  await expect(page.locator('[data-arasaac-id="99"]')).toHaveCount(0);
  expect(requests).toContain('play / toys');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#arasaacDialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('#arasaacDialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('arasaac-search-mobile.png') });
  await page.locator('[data-arasaac-id="9813"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#arasaacDialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator('#activityForm [name="pictogramUrl"]')).toHaveValue('9813');
  await page.locator('#activityForm [data-action="clear-picture"]').click();
  await expect(page.locator('#activityForm [name="pictogramUrl"]')).toHaveValue('');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#arasaacDialog')).not.toBeVisible();
  await expect(page.locator('#activityForm')).toBeVisible();
  expect(errors).toEqual([]);
});
