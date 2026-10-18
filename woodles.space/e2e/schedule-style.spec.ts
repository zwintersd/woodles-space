import { expect, test, type Page } from '@playwright/test';

const nextThemes = ['mushroom', 'library', 'farm', 'music', 'arctic', 'potions'];

async function openPlan(page: Page) {
  await page.goto('/schedules/generator');
  await page.evaluate(() => {
    const S = (window as any).ScheduleStudio;
    const key = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][(new Date().getDay() + 6) % 7];
    const plan = S.sanitizePlan({ id: 'styled', learner: 'Sam', name: 'Weekly plan', days: [{ key, start: '00:00', end: '23:59', activities: [
      { kind: 'activity', occurrenceId: 'book', title: 'Read a book', start: '00:00', duration: 480, icon: '📖' },
      { kind: 'activity', occurrenceId: 'snack', title: 'Make a snack', start: '08:00', duration: 480, icon: '🍎' },
      { kind: 'activity', occurrenceId: 'play', title: 'Play outside', start: '16:00', duration: 470, icon: '⚽' }
    ] }] });
    localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [], images: [] }));
  });
  await page.goto('/schedules/generator?plan=styled');
}

const savedStyle = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('woodles.schedule-planner.v1')!).plans[0].style);

test('style studio themes a plan and the learner view wears it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await openPlan(page);

  await page.getByRole('button', { name: 'Style', exact: false }).click();
  const studio = page.locator('.style-studio-dialog');
  await expect(studio.getByRole('heading', { name: 'Style Sam’s schedule' })).toBeVisible();
  await expect(studio.locator('.theme-card')).toHaveCount(30);
  await expect(studio.getByRole('button', { name: 'Save look' })).toBeDisabled();

  await studio.locator('.theme-card[data-theme="trains"]').click();
  await expect(studio.locator('.theme-card[data-theme="trains"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(studio.locator('.lp-hero strong')).toHaveText('All aboard, Sam!');
  await expect(studio.locator('.lp-nn.now small')).toHaveText('THIS STOP');

  await studio.getByText('Large', { exact: true }).first().click();
  await studio.locator('[data-word="greeting"]').fill('Choo choo, {name}!');
  await expect(studio.locator('.lp-hero strong')).toHaveText('Choo choo, Sam!');
  await studio.locator('[data-colour="ink"]').fill('#f0f0f0');
  await expect(studio.locator('.studio-warnings')).toContainText('hard to read');
  await studio.locator('[data-colour="ink"]').fill('#101820');
  await expect(studio.locator('.studio-warnings')).toBeEmpty();
  await studio.locator('select[name="celebrate"]').selectOption('party');
  await studio.locator('.font-card[data-font="atkinson"]').click();
  await expect(studio.locator('.font-card[data-font="atkinson"]')).toHaveAttribute('aria-pressed', 'true');

  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: test.info().outputPath(`studio-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await studio.getByRole('button', { name: 'Save look' }).click();
  await expect(studio).not.toBeVisible();
  expect(await savedStyle(page)).toMatchObject({ theme: 'trains', textSize: 'large', celebrate: 'party', headingFont: 'atkinson', colors: { ink: '#101820' }, words: { greeting: 'Choo choo, {name}!' } });
  await expect(page.locator('[data-action="open-style-studio"]')).toContainText('🚂');

  await page.goto('/schedules/view?plan=styled');
  await expect(page.locator('#greeting')).toHaveText('Choo choo, Sam!');
  await expect(page.locator('#kicker')).toHaveText('Next stop: today');
  await expect(page.locator('#nowLabel')).toHaveText('THIS STOP');
  await expect(page.locator('#heroArt svg.scene-trains')).toBeVisible();
  await expect(page.locator('#heroMascots')).toBeHidden();
  await expect(page.locator('#heroScene')).toBeHidden();
  const root = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { theme: document.documentElement.dataset.theme, track: style.getPropertyValue('--track-w').trim(), text: style.getPropertyValue('--text').trim(), ink: style.getPropertyValue('--ink').trim() };
  });
  expect(root).toEqual({ theme: 'trains', track: '18px', text: '1.15', ink: '#101820' });
  await expect(page.locator('.step.is-now .time .marker')).toBeVisible();
  await expect(page.locator('.step.is-now .time .marker')).toHaveText('🚂');
  const now = page.locator('.step.is-now');
  await now.locator('.done-btn').click();
  await expect(now.locator('.done-btn .stamp')).toBeVisible();
  await expect(now.locator('.done-btn .stamp')).toHaveText('🎫');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: test.info().outputPath(`view-trains-${viewport.width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('every theme renders the learner view without overflow and with readable cards', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await openPlan(page);
  const themes: string[] = await page.evaluate(() => (window as any).ScheduleThemes.THEMES.map((theme: any) => theme.id));
  for (const theme of themes) {
    const fromPicker = nextThemes.includes(theme);
    await page.goto('/schedules/generator');
    await page.evaluate(({ id, fromPicker }) => {
      const S = (window as any).ScheduleStudio;
      const workspace = JSON.parse(localStorage.getItem(S.STORAGE_KEY)!);
      workspace.plans[0].style = fromPicker ? {} : { theme: id };
      localStorage.setItem(S.STORAGE_KEY, JSON.stringify(workspace));
      const look = (window as any).ScheduleThemes.resolve({ theme: id });
      if ((window as any).ScheduleThemes.warnings(look).length) throw new Error(id + ': ' + (window as any).ScheduleThemes.warnings(look).join(' '));
    }, { id: theme, fromPicker });
    if (fromPicker) {
      await page.goto('/schedules/generator?plan=styled');
      await page.getByRole('button', { name: 'Style', exact: false }).click();
      const studio = page.locator('.style-studio-dialog');
      await studio.locator('.theme-card[data-theme="' + theme + '"]').click();
      await expect(studio.locator('.lp-scene svg.scene-' + theme)).toBeVisible();
      await studio.getByRole('button', { name: 'Save look' }).click();
      await page.reload();
      expect((await savedStyle(page)).theme).toBe(theme);
      const snapshotTheme = await page.evaluate(() => {
        const workspace = (window as any).ScheduleStudio.readWorkspace();
        const plan = workspace.plans[0];
        return (window as any).SchedulePublishing.snapshot(plan, workspace, plan.days.map((day: any) => day.key)).plan.style.theme;
      });
      expect(snapshotTheme).toBe(theme);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/schedules/view?plan=styled');
    await expect(page.locator('#timeline')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    // Bright sky keeps its ticket scene and Quiet and calm stays empty; every other theme draws a banner.
    const illustrated = !['classic', 'calm'].includes(theme);
    await expect(page.locator('#heroArt svg.scene-art')).toHaveCount(illustrated ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (fromPicker) {
      await expect(page.locator('html')).toHaveAttribute('data-motion', theme === 'library' ? 'off' : 'on');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await page.locator('#heroArt [class^="sc-"]').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none'))).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`theme-${theme}-mobile.png`), fullPage: true });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.screenshot({ path: test.info().outputPath(`theme-${theme}.png`) });
  }
});

test('published snapshots carry the look, and unknown values fall back safely', async ({ page }) => {
  await openPlan(page);
  const result = await page.evaluate(() => {
    const workspace = (window as any).ScheduleStudio.readWorkspace();
    workspace.plans[0].style = { theme: 'space', track: 'nope', colors: { accent: 'blue' }, mascots: ['🚀', '<b>'], scene: 'custom' };
    const plan = (window as any).ScheduleStudio.sanitizePlan(workspace.plans[0]);
    const snapshot = (window as any).SchedulePublishing.snapshot(plan, workspace, plan.days.filter((day: any) => !day.removed).map((day: any) => day.key));
    return { style: snapshot.plan.style, bogus: (window as any).ScheduleThemes.sanitizeStyle({ theme: 'nope', headingFont: 'comic-sans' }) };
  });
  expect(result.style).toMatchObject({ theme: 'space', track: '', colors: { accent: '' }, mascots: ['🚀', 'b'], scene: 'custom' });
  expect(result.bogus).toMatchObject({ theme: 'classic', headingFont: '' });
});
