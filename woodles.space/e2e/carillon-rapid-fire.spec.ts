import { expect, test, type Page } from '@playwright/test';
import { addRecord, createCollection, setCellValue } from '../packages/collections/src/index';

// Rapid fire reads two other apps' saved data — Thinking About's shelf and
// Data's Collection library — so the proof that it meets them is here, against
// the built site, rather than in either side's unit tests.

function reinforcers() {
	let collection = createCollection('Reinforcers', 'tracker');
	const primary = collection.fields.find((field) => field.primary)!;
	for (let index = 1; index <= 25; index++) {
		collection = addRecord(collection);
		collection = setCellValue(collection, collection.records.at(-1)!.id, primary.id, `Reinforcer ${index}`);
	}
	return collection;
}

const shelf = {
	version: 1,
	publishedAt: '2026-10-18T09:00:00.000Z',
	entries: [
		{ id: 'entry-piranesi', title: 'Piranesi', columnKey: 'reading', sectionKey: 'book', color: '#3f51b5', lastSessionDate: null },
		{ id: 'entry-wilds', title: 'Outer Wilds', columnKey: 'playing', sectionKey: 'pc_solo', color: '#33b679', lastSessionDate: '2026-10-12' }
	]
};

async function open(page: Page, options: { reducedMotion?: boolean } = {}) {
	await page.clock.setFixedTime(new Date('2026-10-18T12:03:20'));
	if (options.reducedMotion ?? true) await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
	await page.addInitScript(([library, shelfBlob]) => {
		const seedOnce = (key: string, value: unknown) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
		seedOnce('planner.settings.v1', { onboardingComplete: true, bellsEnabled: false, samplingIntervalMinutes: 5, fixedPaletteMode: 'late-afternoon' });
		seedOnce('thinking-about.shelf.v1', shelfBlob);
		seedOnce('woodles.data.collections.v1', library);
	}, [{ woodles: 'woodles-persistence', schemaVersion: 1, savedAt: '2026-10-18T09:00:00.000Z', data: { collections: [reinforcers()] } }, shelf] as const);
	await page.goto('/planner');
}

test('a rapid-fire round refills each pick in place and saves what was endorsed', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	const libraryBefore = await page.evaluate(() => localStorage.getItem('woodles.data.collections.v1'));

	await sampler.getByTestId('rapid-fire-open').click();
	const rapid = sampler.getByTestId('rapid-fire');
	await rapid.getByTestId('rapid-fire-source').selectOption({ label: 'Reinforcers · 25' });
	const chips = rapid.locator('.grid .chip');
	await expect(chips).toHaveCount(20);
	await expect(rapid.getByText('5 more behind these')).toBeVisible();

	// The slot keeps its place; only its occupant changes.
	const before = await chips.allInnerTexts();
	await chips.nth(3).click();
	const after = await chips.allInnerTexts();
	expect(after[3]).not.toBe(before[3]);
	expect(after.filter((_, index) => index !== 3)).toEqual(before.filter((_, index) => index !== 3));
	expect(before).not.toContain(after[3]);
	await expect(rapid.getByTestId('rapid-fire-picked')).toContainText(before[3]);

	await chips.nth(0).click();
	// A mis-tap goes back behind the grid.
	await rapid.getByRole('button', { name: `Put ${before[0]} back` }).click();
	await expect(rapid.getByTestId('rapid-fire-picked')).not.toContainText(before[0]);

	await rapid.getByTestId('rapid-fire-done').click();
	await expect(sampler.getByText('Moment saved')).toBeVisible();

	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved).toHaveLength(1);
	expect(saved[0].label).toBe(before[3]);
	expect(saved[0].endorsement).toMatchObject({ source: { kind: 'collection', title: 'Reinforcers' }, shown: 22, pool: 25 });
	expect(saved[0].endorsement.picks.map((pick: { label: string }) => pick.label)).toEqual([before[3]]);
	await expect(page.getByText('Picked 1 of 22 shown · Reinforcers', { exact: true })).toBeVisible();

	// Carillon reads Data's library and the chosen source is remembered; it writes neither app's data.
	expect(await page.evaluate(() => localStorage.getItem('woodles.data.collections.v1'))).toBe(libraryBefore);
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('planner.settings.v1')!).rapidFireSource)).toMatch(/^collection:/);
	expect(errors).toEqual([]);
});

test('Thinking About empties out, and picking nothing is still an answer', async ({ page }) => {
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByTestId('rapid-fire-open').click();
	const rapid = sampler.getByTestId('rapid-fire');
	await expect(rapid.getByTestId('rapid-fire-source')).toHaveValue('thinking-about');
	await rapid.getByRole('button', { name: 'Piranesi', exact: true }).click();
	await rapid.getByRole('button', { name: 'Outer Wilds', exact: true }).click();
	await expect(rapid.getByText('That’s all of them.')).toBeVisible();
	await rapid.getByRole('button', { name: 'Back to writing' }).click();

	// Leaving the round without finishing records nothing.
	await expect(sampler.getByTestId('moment-endorsement')).toHaveCount(0);
	await sampler.getByTestId('rapid-fire-open').click();
	await rapid.getByTestId('rapid-fire-done').click();
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].label).toBe('Nothing fit · Thinking About');
	expect(saved[0].endorsement).toMatchObject({ source: { kind: 'thinking-about', title: 'Thinking About' }, picks: [], shown: 2, pool: 2 });
	expect(saved[0].endorsement.passed.map((item: { label: string }) => item.label).sort()).toEqual(['Outer Wilds', 'Piranesi']);
});

test('with motion on, a pick flashes out and its replacement arrives in the same slot', async ({ page }) => {
	await open(page, { reducedMotion: false });
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByTestId('rapid-fire-open').click();
	const rapid = sampler.getByTestId('rapid-fire');
	await rapid.getByTestId('rapid-fire-source').selectOption({ label: 'Reinforcers · 25' });
	const chip = rapid.locator('.grid .chip').nth(5);
	const label = await chip.innerText();
	// The states last a third of a second each, so they are recorded as they
	// happen rather than polled for.
	await chip.evaluate((element) => {
		const seen: string[] = ((window as unknown as { rapidStates: string[] }).rapidStates = []);
		const note = () => seen.push(`${element.className.match(/leaving|arriving|idle/)?.[0]}:${element.textContent?.trim()}`);
		new MutationObserver(note).observe(element, { attributes: true, attributeFilter: ['class'], characterData: true, childList: true, subtree: true });
	});
	await chip.click();
	await expect(chip).not.toHaveText(label);
	await expect(chip).toHaveClass(/idle/);
	const states = await page.evaluate(() => (window as unknown as { rapidStates: string[] }).rapidStates);
	const next = await chip.innerText();
	const order = [`leaving:${label}`, `arriving:${next}`, `idle:${next}`].map((state) => states.indexOf(state));
	expect(order.every((at) => at !== -1), states.join(' → ')).toBe(true);
	expect(order).toEqual([...order].sort((a, b) => a - b));
	expect(states).not.toContain(`leaving:${next}`);
});

test('on a phone the grid fits the page', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByTestId('rapid-fire-open').click();
	await sampler.getByTestId('rapid-fire-source').selectOption({ label: 'Reinforcers · 25' });
	await expect(sampler.locator('.rapid .grid .chip')).toHaveCount(12);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a Collection made from Thinking About in HomeSuite is a source in Carillon', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2026-10-18T12:03:20'));
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, body: '' }));
	await page.addInitScript((shelfBlob) => {
		const seedOnce = (key: string, value: unknown) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
		seedOnce('planner.settings.v1', { onboardingComplete: true, bellsEnabled: false, samplingIntervalMinutes: 5, fixedPaletteMode: 'late-afternoon' });
		seedOnce('thinking-about.shelf.v1', shelfBlob);
	}, shelf);

	await page.goto('/homesuite');
	await page.getByRole('button', { name: '＋ New', exact: true }).click();
	await page.getByRole('menuitem', { name: /Collection/ }).click();
	const dialog = page.getByRole('dialog', { name: 'New collection' });
	const group = dialog.locator('details').filter({ has: page.getByRole('button', { name: /Thinking About/, includeHidden: true }) });
	if (await group.getAttribute('open') === null) await group.locator('summary').click();
	await dialog.getByRole('button', { name: /Thinking About/ }).click();
	const surface = page.frameLocator('iframe.native-surface');
	await expect(surface.locator('.source-status')).toContainText('source records');
	await expect(surface.getByText('Outer Wilds')).toBeVisible();
	await expect(surface.getByRole('textbox', { name: 'Section, Outer Wilds' })).toHaveValue('PC · solo');

	await page.goto('/planner');
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByTestId('rapid-fire-open').click();
	await sampler.getByTestId('rapid-fire-source').selectOption({ label: 'Thinking About · 2', index: 1 });
	await expect(sampler.getByTestId('rapid-fire-source')).toHaveValue(/^collection:/);
	await sampler.getByTestId('rapid-fire').getByRole('button', { name: 'Piranesi', exact: true }).click();
	await sampler.getByTestId('rapid-fire-done').click();
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].endorsement).toMatchObject({ source: { kind: 'collection', title: 'Thinking About' }, picks: [{ label: 'Piranesi' }], shown: 2, pool: 2 });
});

test('the cog opens settings for the grid’s size and how a round runs', async ({ page }) => {
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByTestId('rapid-fire-open').click();
	const rapid = sampler.getByTestId('rapid-fire');
	await rapid.getByTestId('rapid-fire-source').selectOption({ label: 'Reinforcers · 25' });
	const chips = rapid.locator('.grid .chip');
	await expect(chips).toHaveCount(20);

	await rapid.getByRole('button', { name: 'Rapid fire settings' }).click();
	const settings = rapid.getByTestId('rapid-fire-settings');
	await settings.getByTestId('rapid-fire-size').selectOption('9');
	await expect(chips).toHaveCount(9);
	await settings.getByLabel(/Shuffle/).uncheck();
	await expect(chips.first()).toHaveText('Reinforcer 1');
	await settings.getByTestId('rapid-fire-limit').selectOption('1');
	await settings.getByLabel(/Save the moment when the round ends/).uncheck();

	// One fixed page: the picked slot stays empty.
	await settings.getByTestId('rapid-fire-refill').uncheck();
	await expect(rapid.getByText('One page · 25 in the list')).toBeVisible();
	await chips.nth(1).click();
	await expect(rapid.locator('.grid .chip.spent')).toHaveCount(1);
	// A single choice: the rest of the grid stops answering.
	await expect(rapid.getByText('That’s your pick.')).toBeVisible();
	await chips.nth(0).click({ force: true });
	await expect(rapid.getByTestId('rapid-fire-picked').locator('.picked-chip')).toHaveCount(1);

	// A grid change under a round with picks waits rather than dropping them.
	await settings.getByTestId('rapid-fire-size').selectOption('6');
	await expect(settings.getByText('Grid changes start with the next round.')).toBeVisible();
	await expect(chips).toHaveCount(9);

	await rapid.getByTestId('rapid-fire-done').click();
	await expect(sampler.getByTestId('moment-endorsement')).toContainText('Reinforcer 2');
	expect(await page.evaluate(() => localStorage.getItem('planner.observations.v1'))).toBeNull();
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].endorsement).toMatchObject({ picks: [{ label: 'Reinforcer 2' }], shown: 9, pool: 25 });
	expect(saved[0].endorsement.passed).toHaveLength(8);

	// Settings outlast the round.
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('planner.settings.v1')!).rapidFire)).toEqual({ size: 6, refill: false, shuffle: false, maxPicks: 1, saveOnFinish: false, keepPassed: true });
});
