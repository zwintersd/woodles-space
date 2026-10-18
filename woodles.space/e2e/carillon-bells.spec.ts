import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bellLog, installFakeAudio } from './support/fake-audio';

async function open(page: Page, options: { locked?: boolean; settings?: Record<string, unknown> } = {}) {
	await installFakeAudio(page, { locked: options.locked });
	// The clock is installed, not just fixed, so the minute ticks can be driven.
	await page.clock.install({ time: new Date('2026-10-18T12:29:30') });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 200, body: '' }));
	await page.addInitScript(settings => {
		if (!localStorage.getItem('planner.settings.v1')) localStorage.setItem('planner.settings.v1', JSON.stringify({ onboardingComplete: true, bellsEnabled: true, samplingIntervalMinutes: 15, fixedPaletteMode: 'late-afternoon', ...settings }));
	}, options.settings ?? {});
	await page.goto('/planner');
	// Let the app finish mounting (and start its minute timer) before the clock is driven.
	await expect(page.getByTestId('bell-status')).toBeVisible();
	await page.waitForTimeout(250);
}

/** Advance whole minutes, letting each minute's tick run. */
async function minutes(page: Page, count: number) {
	for (let index = 0; index < count; index++) await page.clock.runFor(60_000);
}

const bellStatus = (page: Page) => page.getByTestId('bell-status');

test('existing bells sound as they always have until a set is chosen', async ({ page }) => {
	await open(page);
	await page.locator('body').click({ position: { x: 5, y: 5 } });
	await minutes(page, 1);
	await expect.poll(async () => (await bellLog(page)).bells).toEqual([{ mark: 'half', voice: 'bell', at: new Date('2026-10-18T12:30:00').toISOString() }]);
	await expect(bellStatus(page)).toHaveText('rang 12:30 pm · half hour');
	// The original bell, then Sunday's 12:30 Midday block keeps its own meal bell, after the chime.
	const log = await bellLog(page);
	expect(log.oscillators.map(oscillator => oscillator.freq)).toEqual([783.99, 987.77, 523.25, 659.25]);
	expect(log.oscillators[2].start).toBeGreaterThan(log.oscillators[1].start + 0.8);
});

test('hours, halves and quarters can each have their own sound', async ({ page }, testInfo) => {
	await open(page);
	await bellStatus(page).click();
	const panel = page.getByTestId('bell-settings');
	await expect(page.locator('#binder-panel .binder-title')).toBeFocused();
	await panel.getByRole('button', { name: /clock face/ }).click();
	await expect(panel.getByRole('button', { name: /clock face/ })).toHaveAttribute('aria-pressed', 'true');
	// Choose a different quarter sound directly.
	await panel.getByLabel('sound: quarters').selectOption({ label: 'wood block' });
	await expect(panel.getByRole('list').first()).toContainText('half past');
	await page.screenshot({ path: testInfo.outputPath('bells-panel-desktop.png'), fullPage: true });
	await page.keyboard.press('Escape');
	await expect(bellStatus(page)).toBeFocused();
	await minutes(page, 1);
	await minutes(page, 15);
	await minutes(page, 15);
	await expect.poll(async () => (await bellLog(page)).bells.map(bell => `${bell.mark}:${bell.voice}`)).toEqual(['half:chime', 'quarter:wood', 'hour:bowl']);
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.settings.v1') || '{}'));
	expect(saved.bellSounds.marks).toMatchObject({ hour: { voice: 'bowl' }, half: { voice: 'chime' }, quarter: { voice: 'wood' } });
	expect(saved.settingsStamps.bellSounds).toBeTruthy();
});

test('a page nobody has touched holds its bells, and the first tap plays nothing stale', async ({ page }) => {
	await open(page, { locked: true });
	await minutes(page, 1);
	await expect(bellStatus(page)).toContainText('tap to let it sound');
	expect((await bellLog(page)).oscillators).toEqual([]);
	await page.locator('body').click({ position: { x: 5, y: 5 } });
	await expect.poll(async () => (await bellLog(page)).state).toBe('running');
	expect((await bellLog(page)).oscillators).toEqual([]);
	await expect(bellStatus(page)).toHaveText(/^next bell · 12:45 pm · quarter$/);
	await minutes(page, 15);
	await expect.poll(async () => (await bellLog(page)).bells.map(bell => bell.mark)).toEqual(['quarter']);
});

test('pause and stop on this device; previews follow the sound', async ({ page }) => {
	await open(page);
	await bellStatus(page).click();
	const panel = page.getByTestId('bell-settings');
	await panel.getByRole('button', { name: 'pause until 1:29 pm' }).click();
	await expect(panel.getByRole('button', { name: 'resume now' })).toBeFocused();
	await expect(panel.getByRole('status')).toHaveText('bells paused on this device until 1:29 pm');
	await page.keyboard.press('Escape');
	await expect(bellStatus(page)).toHaveText('bells paused until 1:29 pm');
	await minutes(page, 16);
	expect((await bellLog(page)).bells).toEqual([]);
	expect(await page.evaluate(() => localStorage.getItem('planner.bellPause.v1'))).toContain('T');
	await bellStatus(page).click();
	await panel.getByRole('button', { name: 'resume now' }).click();
	await expect(panel.getByRole('button', { name: /^pause until/ }).first()).toBeFocused();
	await panel.getByRole('button', { name: 'westminster' }).click();
	await panel.getByRole('button', { name: 'play on the hour' }).click();
	await expect(panel.getByRole('button', { name: 'stop on the hour' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'stop sound' })).toBeVisible();
	expect((await bellLog(page)).oscillators.length).toBe(4 * 4 * 6);
	await page.keyboard.press('Escape');
	await expect(panel.getByRole('button', { name: 'play on the hour' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'stop sound' })).toHaveCount(0);
});

test('the panel is reachable, readable and accessible on a phone', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, { settings: { samplingIntervalMinutes: 30 } });
	await expect(page.locator('.binder-tab:not(.binder-tab-add)').first()).toBeHidden();
	await bellStatus(page).click();
	const panel = page.getByTestId('bell-settings');
	await expect(panel).toBeVisible();
	await expect(panel.getByText('your 30-minute rows skip :15 :45.')).toBeVisible();
	await expect(panel.locator('fieldset[data-mark="quarter"]')).toHaveCount(0);
	await panel.getByLabel('chime them anyway (no moment asked)').check();
	await expect(panel.locator('fieldset[data-mark="quarter"]')).toHaveCount(1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('bells-panel-phone.png'), fullPage: false });
	await panel.locator('details').first().locator('summary').click();
	await panel.locator('details').nth(1).locator('summary').click();
	const results = await new AxeBuilder({ page }).include('#binder-panel').withTags(['wcag2a', 'wcag21a']).analyze();
	const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
	expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('bells-panel-phone-open.png'), fullPage: false });
});
