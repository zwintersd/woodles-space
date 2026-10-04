import { addScheduleItem, openScheduleTools, openActivitySection, openVisualPicker } from './support/schedule-planner';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const key = 'woodles.schedule-planner.v1';
async function setup(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [S.sanitizePlan({ id: 'sprites', learner: 'Sam', name: 'Sprite schedule', days: [] })], activities: [], images: [] }));
  });
  await page.goto('/schedules/generator?plan=sprites&day=monday');
}
async function upload(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#2a7090'; ctx.fillRect(8, 4, 16, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#customSymbolUpload').setInputFiles([
    { name: 'Happy Cat.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
    { name: 'Happy Cat.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
    { name: 'Sparkle.gif', mimeType: 'image/gif', buffer: Buffer.from('47494638396101000100800000ff00000000ff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex') }
  ]);
  await expect(page.locator('#customSymbolStatus')).toContainText('3 symbols added');
}
async function pick(page: Page, selector: string, name = 'happy_cat') {
  if (selector.includes('data-sprite-target="form"')) await openVisualPicker(page, selector.startsWith('#choiceForm') ? '#choiceForm' : '#activityForm');
  await page.locator(selector).click();
  await page.getByRole('button', { name: `Use :${name}:`, exact: true }).click();
  await expect(page.locator('#customSymbolDialog')).not.toBeVisible();
}

test('sprite library supports uploads, groups, editing, backups and accessible mobile controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.locator('[data-action="manage-custom-symbols"]').click();
  await upload(page);
  await expect(page.locator('.custom-symbol-card')).toHaveCount(3);
  const state = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(state.customSymbols.map((s: any) => s.symbolName)).toEqual(['happy_cat', 'happy_cat_2', 'sparkle']);
  const still = state.images.find((i: any) => i.id === state.customSymbols[0].symbolAssetId).data;
  const dimensions = await page.evaluate(async data => {
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return [img.width, img.height, ctx.getImageData(0, 0, 1, 1).data[3]];
  }, still);
  expect(dimensions).toEqual([32, 32, 0]);
  await page.locator('.custom-symbol-card').first().locator('[data-library-action="edit"]').first().click();
  await page.locator('#customSymbolEditor [name="symbolName"]').fill('calm_cat');
  await page.locator('#customSymbolEditor [name="group"]').fill('Feelings');
  await page.locator('#customSymbolEditor [name="symbolCredit"]').fill('My own artwork');
  await page.locator('#customSymbolEditor [name="symbolPixelated"]').uncheck();
  await page.getByRole('button', { name: 'Save symbol', exact: true }).click();
  await page.locator('#customSymbolGroup').selectOption('Feelings');
  await expect(page.locator('.custom-symbol-card')).toHaveCount(1);
  await page.locator('#customSymbolSearch').fill('missing');
  await expect(page.locator('#customSymbolGrid')).toContainText('No symbols match');
  await page.locator('#customSymbolSearch').fill('calm');
  await expect(page.locator('.custom-symbol-card')).toHaveCount(1);
  const backupEvent = page.waitForEvent('download');
  await page.locator('#customSymbolExport').click();
  const backup = await backupEvent;
  await page.locator('#customSymbolImport').setInputFiles((await backup.path())!);
  await expect(page.locator('#customSymbolStatus')).toContainText('3 symbols imported');
  await page.locator('#customSymbolGroup').selectOption('');
  await page.locator('#customSymbolSearch').fill('');
  await expect(page.locator('.custom-symbol-card')).toHaveCount(6);
  await page.locator('#customSymbolUpload').setInputFiles({ name: 'large.gif', mimeType: 'image/gif', buffer: Buffer.alloc(65001) });
  await expect(page.locator('#customSymbolStatus')).toContainText('65 KB or smaller');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#customSymbolDialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('#customSymbolDialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('custom-symbol-library-mobile.png'), fullPage: true });
  await page.locator('[data-library-action="close"]').click();
  await page.reload();
  await page.locator('[data-action="manage-custom-symbols"]').click();
  await expect(page.locator('.custom-symbol-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('custom symbols survive nested activity use, removal and week transfers; GIFs respect motion and print', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.locator('[data-action="manage-custom-symbols"]').click();
  await upload(page);
  await page.locator('[data-library-action="close"]').click();
  await addScheduleItem(page, 'activity');
  await page.locator('#activityForm [name="title"]').fill('Sprite routine');
  await pick(page, '#activityForm [data-sprite-target="form"][data-action="pick-custom-symbol"]', 'sparkle');
  await openActivitySection(page, 'steps');
  await page.locator('[data-action="add-activity-step"]').click();
  await page.locator('[data-step-field="title"]').fill('Choose a sprite');
  await pick(page, '[data-sprite-target="step"][data-action="pick-custom-symbol"]');
  await page.locator('[data-step-kind="0"]').selectOption('choice');
  for (const [i, title] of ['Cat', 'Other cat'].entries()) {
    await page.locator('[data-action="add-step-option"]').click();
    await page.locator(`[data-step-field="title"][data-option-index="${i}"]`).fill(title);
    await pick(page, `[data-sprite-target="step-option"][data-option-index="${i}"][data-action="pick-custom-symbol"]`);
  }
  await openActivitySection(page, 'steps');
  await page.locator('[data-action="add-activity-step"]').click();
  await page.locator('[data-step-field="title"][data-step-index="1"]').fill('Recommended sprite');
  await page.locator('[data-step-kind="1"]').selectOption('suggestion');
  await pick(page, '[data-sprite-target="step"][data-step-index="1"][data-action="pick-custom-symbol"]');
  await page.locator('[data-action="configure-step-suggestion"]').click();
  await page.locator('#candidateTitle').fill('Cat activity');
  await page.locator('#candidateCategory').fill('Feelings');
  await pick(page, '[data-sprite-target="candidate-new"][data-action="pick-custom-symbol"]');
  await page.locator('[data-action="suggestion-add-candidate"]').click();
  await pick(page, '[data-sprite-target="candidate"][data-action="pick-custom-symbol"]', 'happy_cat_2');
  await page.locator('#suggestionForm [name="animation"]').selectOption('instant');
  await page.locator('#suggestionForm button[type="submit"]').click();
  await page.locator('#activityForm button[type="submit"]').click();
  await addScheduleItem(page, 'choice');
  await page.locator('#optionTitle').fill('Sprite option');
  await pick(page, '#choiceForm [data-sprite-target="form"][data-action="pick-custom-symbol"]');
  await page.locator('[data-action="add-choice-option"]').click();
  await expect(page.locator('#choiceForm [name="symbolAssetId"]')).toHaveValue('');
  await page.locator('#optionTitle').fill('Emoji option');
  await page.locator('[data-action="add-choice-option"]').click();
  await pick(page, '[data-sprite-target="choice-option"][data-action="pick-custom-symbol"] >> nth=0');
  await page.locator('#choiceForm button[type="submit"]').click();
  await page.reload();
  const state = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  const item = state.plans[0].days[0].activities[0];
  expect(item.symbolName).toBe('sparkle');
  expect(item.steps[0].symbolName).toBe('happy_cat');
  expect(item.steps[0].options[0].symbolName).toBe('happy_cat');
  expect(item.steps[1].candidates[0].symbolName).toBe('happy_cat_2');
  expect(item.steps[1].symbolName).toBe('happy_cat');
  expect(state.plans[0].days[0].activities[1].options[1].symbolAssetId).toBe('');
  await page.locator('[data-action="manage-custom-symbols"]').click();
  await page.getByRole('button', { name: 'Remove :happy_cat: from library', exact: true }).click();
  await page.locator('[data-library-action="close"]').click();
  const exporting = page.waitForEvent('download');
  await openScheduleTools(page, 'plan');
  await page.locator('[data-action="export-plan"]').click();
  const download = await exporting;
  await page.locator('#importFile').setInputFiles((await download.path())!);
  const imported = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  const copy = imported.plans[1].days[0].activities[0];
  expect(copy.symbolAssetId).not.toBe(item.symbolAssetId);
  expect(copy.symbolStillAssetId).not.toBe(item.symbolStillAssetId);
  expect(copy.steps[0].options[0].symbolAssetId).not.toBe(item.steps[0].options[0].symbolAssetId);
  expect(imported.images.some((i: any) => i.id === copy.steps[0].options[0].symbolAssetId)).toBe(true);
  expect(copy.steps[1].symbolAssetId).toBe(copy.steps[0].symbolAssetId);
  await page.goto('/schedules/view?plan=sprites&day=monday');
  const gif = page.locator('.custom-symbol-art img[src^="data:image/gif"]').first();
  await expect(gif).toBeVisible();
  expect(await gif.evaluate((img: HTMLImageElement) => img.currentSrc.startsWith('data:image/gif'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => gif.evaluate((img: HTMLImageElement) => img.currentSrc.startsWith('data:image/png'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference', media: 'print' });
  await expect.poll(() => gif.evaluate((img: HTMLImageElement) => img.currentSrc.startsWith('data:image/png'))).toBe(true);
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('.activity-steps .custom-symbol-art img').first()).toHaveCSS('image-rendering', 'pixelated');
  await page.locator('.nested-suggestion [data-suggestion-draw]').click();
  await expect(page.locator('.nested-suggestion .video-head .custom-symbol-art img')).toBeVisible();
  await expect(page.locator('.nested-suggestion .suggestion-reel-card .custom-symbol-art img')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('custom-symbol-learner-mobile.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).include('.activity-steps').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  expect(errors).toEqual([]);
});
