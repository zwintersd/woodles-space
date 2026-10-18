import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { PlannerBlob } from '../apps/planner/src/lib/types';

async function open(page: Page, time = '2026-10-18T12:03:20') {
	await page.clock.setFixedTime(new Date(time));
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 200, body: '' }));
	await page.addInitScript(() => {
		if (!localStorage.getItem('planner.settings.v1')) localStorage.setItem('planner.settings.v1', JSON.stringify({ onboardingComplete: true, bellsEnabled: false, samplingIntervalMinutes: 5, fixedPaletteMode: 'late-afternoon' }));
	});
	await page.goto('/planner');
}

async function newLoop(page: Page, title: string) {
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'New loop', exact: true }).click();
	await notebook.getByLabel('Loop title', { exact: true }).fill(title);
	await notebook.getByRole('button', { name: 'Save loop', exact: true }).click();
}

async function openLoopList(page: Page) {
	const list = page.getByTestId('loop-notebook').locator('.loop-list');
	if (!(await list.evaluate(element => (element as HTMLDetailsElement).open))) await list.locator('> summary').click();
}

const stored = (page: Page, key: string) => page.evaluate(name => JSON.parse(localStorage.getItem(name) || '[]'), key);

test('a recurring loop closes one cycle at a time and only reminds when asked', async ({ page }, testInfo) => {
	await open(page);
	const notebook = page.getByTestId('loop-notebook');
	await newLoop(page, 'Shower');
	await openLoopList(page);
	const row = notebook.getByRole('article', { name: 'Shower', exact: true });
	await row.getByRole('button', { name: 'Edit loop', exact: true }).click();
	const form = row.getByRole('form', { name: 'Edit Shower' });
	await expect(form.getByLabel('Loop title')).toBeFocused();
	await form.getByLabel('This is a recurring need').check();
	await form.getByLabel('Usual rhythm, in days', { exact: false }).fill('1');
	await form.getByLabel('Remind me this long after each closed cycle').check();
	await form.getByRole('button', { name: 'Save loop details', exact: true }).click();
	await expect(row.getByText('Open · recurring · about every 1 day', { exact: true })).toBeVisible();

	await row.getByRole('button', { name: 'Close this cycle', exact: true }).click();
	const reflection = page.getByTestId('closure-reflection');
	await expect(reflection.getByText('Shower · cycle closed')).toBeVisible();
	await reflection.getByRole('button', { name: 'Skip reflection', exact: true }).click();
	await expect(row.getByText('Between cycles · recurring · about every 1 day', { exact: true })).toBeVisible();
	await expect(row.getByRole('button', { name: 'Need is back', exact: true })).toBeVisible();
	// Closing asks for nothing more: no reminder yet, no ideas.
	await expect(page.getByTestId('loop-reminders')).toHaveCount(0);
	await expect(page.getByTestId('loop-ideas')).toHaveCount(0);

	await page.clock.setFixedTime(new Date('2026-10-19T12:10:00'));
	await page.reload();
	const card = page.getByTestId('loop-reminders');
	await expect(card.getByRole('heading', { name: 'A reminder you asked for' })).toBeVisible();
	await expect(card.getByText('The rhythm you chose has passed.', { exact: false })).toBeVisible();
	await expect(card).not.toContainText(/overdue|behind|missed/i);
	await page.screenshot({ path: testInfo.outputPath('between-cycles-reminder.png'), fullPage: true });
	await card.getByRole('button', { name: 'Need is back', exact: true }).click();
	await expect(card.getByRole('status')).toHaveText('Next cycle of “Shower” started.');
	await expect(card.getByRole('article')).toHaveCount(0);
	await openLoopList(page);
	await expect(row.getByText('Open · recurring · about every 1 day', { exact: true })).toBeVisible();
	await notebook.locator('.history > summary').click();
	await expect(notebook.locator('.record').filter({ hasText: 'Need returned' })).toHaveCount(1);
	await expect(notebook.locator('.record').filter({ hasText: 'Cycle closed' })).toHaveCount(1);
	expect((await stored(page, 'planner.loopEvents.v1')).map((event: { type: string }) => event.type)).toEqual(['noticed', 'closed', 'reopened']);
	expect((await stored(page, 'planner.loopReminders.v1'))[0]).toMatchObject({ ending: 'acknowledged' });
});

test('a plain reminder appears when due, can move later, and finishes without repeating', async ({ page }) => {
	await open(page);
	await newLoop(page, 'Reply to Mom');
	await openLoopList(page);
	const row = page.getByTestId('loop-notebook').getByRole('article', { name: 'Reply to Mom', exact: true });
	await row.getByRole('button', { name: 'Remind me', exact: true }).click();
	const form = row.getByRole('form', { name: 'Reminder for Reply to Mom' });
	await form.getByRole('button', { name: 'In an hour', exact: true }).click();
	await expect(form.getByLabel('Remind me at')).toHaveValue('2026-10-18T13:03');
	await form.getByLabel('Reminder note', { exact: false }).fill('Just say hi');
	await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
	await expect(row.getByText(/Reminder .* · Just say hi/)).toBeVisible();
	await expect(page.getByTestId('loop-reminders')).toHaveCount(0);

	await page.clock.setFixedTime(new Date('2026-10-18T13:05:00'));
	await page.reload();
	const card = page.getByTestId('loop-reminders');
	await expect(card.getByRole('article', { name: 'Reminder: Reply to Mom' })).toContainText('Just say hi');
	await card.getByRole('button', { name: 'In an hour', exact: true }).click();
	await expect(card.getByRole('article')).toHaveCount(0);
	await page.clock.setFixedTime(new Date('2026-10-18T14:10:00'));
	await page.reload();
	await card.getByRole('button', { name: 'Thanks', exact: true }).click();
	await page.clock.setFixedTime(new Date('2026-10-20T09:00:00'));
	await page.reload();
	await expect(page.getByTestId('loop-reminders')).toHaveCount(0);
	const reminders = await stored(page, 'planner.loopReminders.v1');
	expect(reminders).toHaveLength(1);
	expect(reminders[0]).toMatchObject({ ending: 'acknowledged', note: 'Just say hi' });
});

test('a saved event can be corrected and re-attributed without losing when it was entered', async ({ page }) => {
	await open(page);
	await newLoop(page, 'Laundry');
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'Notice', exact: true }).click();
	await notebook.getByLabel('Event note').fill('Something unfinished came to mind');
	await notebook.getByRole('button', { name: 'Save event', exact: true }).click();
	await notebook.locator('.history > summary').click();
	const record = notebook.locator('.record').filter({ hasText: 'Something unfinished came to mind' });
	await record.getByRole('button', { name: 'Edit noticed event for Unattributed observation', exact: true }).click();
	const form = record.getByRole('form', { name: 'Correct this event' });
	await expect(form.getByLabel('When it happened')).toHaveValue('2026-10-18T12:03');
	await form.getByLabel('When it happened').fill('2026-10-18T09:40');
	await form.getByLabel('Which loop?').selectOption({ label: 'Laundry' });
	await form.getByRole('button', { name: 'Save event changes', exact: true }).click();
	await expect(record.getByText(/^Time corrected · first entered as/)).toBeVisible();
	await page.reload();
	const expected = await page.evaluate(() => new Date('2026-10-18T09:40').toISOString());
	const [, corrected] = await stored(page, 'planner.loopEvents.v1');
	const loops = await stored(page, 'planner.openLoops.v1');
	expect(corrected).toMatchObject({ occurredAt: expected, loopId: loops[0].id, note: 'Something unfinished came to mind' });
	expect(corrected.originalOccurredAt).toBe(corrected.recordedAt);

	// Lifecycle events keep their loop; only the time and note can change.
	await openLoopList(page);
	await notebook.getByRole('article', { name: 'Laundry', exact: true }).getByRole('button', { name: 'Close loop', exact: true }).click();
	await page.getByTestId('closure-reflection').getByRole('button', { name: 'Skip reflection', exact: true }).click();
	await notebook.locator('.history > summary').click();
	const closure = notebook.locator('.record').filter({ hasText: 'Closed ·' });
	await closure.getByRole('button', { name: 'Edit closed event for Laundry', exact: true }).click();
	await expect(closure.getByText('Closures, pauses, releases and reopenings stay with their loop.')).toBeVisible();
	await expect(closure.getByLabel('Which loop?')).toHaveCount(0);
	// A future occurrence is refused before it reaches the record.
	const before = await stored(page, 'planner.loopEvents.v1');
	await closure.getByLabel('When it happened').fill('2026-10-19T09:00');
	await closure.getByRole('button', { name: 'Save event changes', exact: true }).click();
	expect(await closure.getByLabel('When it happened').evaluate(input => (input as HTMLInputElement).validity.rangeOverflow)).toBe(true);
	expect(await stored(page, 'planner.loopEvents.v1')).toEqual(before);
	await closure.getByLabel('When it happened').fill('2026-10-18T11:15');
	await closure.getByRole('button', { name: 'Save event changes', exact: true }).click();
	await expect(closure.getByRole('status')).toHaveText('Event updated.');
	const resolvedAt = await page.evaluate(() => new Date('2026-10-18T11:15').toISOString());
	expect((await stored(page, 'planner.openLoops.v1'))[0]).toMatchObject({ status: 'resolved', resolvedAt });
});

test('a single noticing can carry its own loop link, and offers stay offers', async ({ page }, testInfo) => {
	await open(page);
	await newLoop(page, 'Reply to Mom');
	const sampler = page.getByTestId('interval-sampler');
	const entry = sampler.getByLabel('What’s happening now?', { exact: true });
	await entry.fill('Thinking about replying to mom');
	const linkOffer = sampler.getByTestId('loop-link-offer');
	await expect(linkOffer).toContainText('Possibly about Reply to Mom?');
	await linkOffer.getByRole('button', { name: 'Not this', exact: true }).click();
	await expect(linkOffer).toHaveCount(0);

	await entry.fill('Thinking about replying to mom; I should cancel the gym subscription');
	const candidate = sampler.getByTestId('loop-candidate-offer');
	await expect(candidate).toContainText('Keep “Cancel the gym subscription” as an open loop?');
	await candidate.getByRole('button', { name: 'Name it as a loop', exact: true }).click();
	await expect(sampler.getByLabel('New loop name', { exact: false })).toHaveValue('Cancel the gym subscription');
	await expect(sampler.getByLabel('New loop name', { exact: false })).toBeFocused();
	expect(await stored(page, 'planner.openLoops.v1')).toHaveLength(1);
	await sampler.getByRole('button', { name: 'Create and link', exact: true }).click();

	await sampler.getByRole('button', { name: 'In my body', exact: true }).click();
	await sampler.getByLabel('What sensation? Where?').fill('Pit in my stomach');
	await sampler.getByLabel('Connect this in my body note to a loop').selectOption({ label: 'Reply to Mom' });
	await expect(sampler.getByRole('button', { name: 'Unlink Reply to Mom from this in my body note', exact: true })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('per-noticing-link.png'), fullPage: true });
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	await expect(page.getByText('Body: Pit in my stomach → Reply to Mom', { exact: true })).toBeVisible();

	const loops = await stored(page, 'planner.openLoops.v1');
	const mom = loops.find((loop: { title: string }) => loop.title === 'Reply to Mom');
	const gym = loops.find((loop: { title: string }) => loop.title === 'Cancel the gym subscription');
	const [moment] = await stored(page, 'planner.observations.v1');
	expect(moment.noticings).toEqual([{ channel: 'body', note: 'Pit in my stomach', linkedLoopIds: [mom.id] }]);
	expect(moment.linkedLoopIds).toEqual([gym.id]);
	await page.getByLabel('Find a moment').fill('reply to mom');
	await expect(page.getByRole('button', { name: /^Reopen 12:00/ })).toBeVisible();
});

test('patterns describe records, offer names, and show ideas only on request', async ({ page }, testInfo) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('planner.openLoops.v1')) return;
		const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes).toISOString();
		const loop = (id: string, title: string, extra = {}) => ({ id, title, status: 'open', createdAt: at(1, 7), updatedAt: at(1, 7), ...extra });
		const event = (id: string, type: string, occurredAt: string, loopId?: string) => ({ id, type, occurredAt, recordedAt: occurredAt, loopId });
		const moment = (day: number, start: string, tag: string | null, label: string, extra = {}) => ({
			id: `observation-2026-10-${day}@${start}`, date: `2026-10-${day}`, intervalStart: start, source: 'live', kind: 'care', label,
			sampleTag: tag ? { id: tag, name: tag, color: '#548068', kind: 'care' } : null, capturedAt: at(day, 9), updatedAt: at(day, 9), ...extra
		});
		localStorage.setItem('planner.openLoops.v1', JSON.stringify([
			loop('mom', 'Reply to Mom'), loop('feature', 'Woodles feature'), loop('sub', 'Cancel subscription'),
			loop('shower', 'Shower', { recurring: true, rhythmDays: 2 }), loop('room', 'Clean room')
		]));
		localStorage.setItem('planner.loopEvents.v1', JSON.stringify([
			event('old', 'closed', at(1, 8), 'mom'), event('again', 'reopened', at(2, 8), 'mom'),
			event('n1', 'noticed', at(15, 9), 'mom'), event('a1', 'approached', at(15, 18), 'mom'), event('c1', 'closed', at(16, 10), 'mom'),
			event('n2', 'noticed', at(16, 9), 'feature'), event('r2', 'released', at(17, 14), 'feature'),
			event('n3', 'noticed', at(17, 9), 'sub'), event('c3', 'closed', at(18, 9), 'sub'),
			event('s1', 'closed', at(12, 8), 'shower'), event('s2', 'closed', at(14, 8), 'shower'), event('s3', 'closed', at(17, 8), 'shower'),
			event('room-a', 'approached', at(17, 11), 'room')
		]));
		localStorage.setItem('planner.closureReflections.v1', JSON.stringify([
			{ id: 'r-c1', loopEventId: 'c1', descriptors: ['Lighter'], nextFeelsPossible: 'something', recordedAt: at(16, 10) },
			{ id: 'r-r2', loopEventId: 'r2', descriptors: ['Lighter', 'Less comfortable'], nextFeelsPossible: 'something', recordedAt: at(17, 14) }
		]));
		localStorage.setItem('planner.observations.v1', JSON.stringify([
			moment(16, '10:30', 'Cleaning', 'Wiped the counter', { noticings: [{ channel: 'body', note: 'loose shoulders' }] }),
			moment(16, '13:00', 'Rest', 'Laundry pile on the chair'),
			moment(17, '15:00', 'Cleaning', 'Folding laundry'),
			moment(17, '17:00', null, 'At my desk', { noticings: [{ channel: 'attention', note: 'thinking about laundry' }, { channel: 'body', note: 'tight', linkedLoopIds: ['sub'] }] }),
			moment(18, '09:15', 'Rest', 'Lying down', { linkedLoopIds: ['sub'] })
		]));
	});
	await open(page);
	await expect(page.getByTestId('loop-patterns')).toHaveCount(0);
	await page.getByText('Patterns in your loops', { exact: true }).click();
	const patterns = page.getByTestId('loop-patterns');
	await expect(patterns.getByText(/aren’t necessarily causes/)).toBeVisible();
	await expect(patterns.getByText(/^6 closed · 1 let go since/)).toBeVisible();
	await expect(patterns.getByRole('table', { name: 'What changed, as you described it' }).getByRole('row', { name: /Lighter/ })).toContainText('11');
	const neighbours = patterns.getByRole('table', { name: /Moments that began within 2 hours after a resolution/ });
	await expect(neighbours.getByRole('row', { name: /^Cleaning/ })).toContainText('2 of 3 (67%)');
	await expect(patterns.getByText('Body: 1 connected to a loop · 1 on their own', { exact: true })).toBeVisible();
	await expect(patterns.getByText(/Shower\s*3 cycles closed · typical gap 2.5 days · last gap 3 days · your rhythm about 2 days/)).toBeVisible();

	const offers = patterns.getByTestId('loop-offers');
	await expect(offers).toContainText('“laundry” came up in 3 notes across 2 days');
	await expect(offers).toContainText('“Reply to Mom” has closed 2 times.');
	await offers.getByRole('button', { name: 'Use about 2.5 days', exact: true }).click();
	await expect(patterns.getByRole('status')).toHaveText('Rhythm for “Shower” set to about 2.5 days.');
	await offers.getByRole('button', { name: 'Not a loop', exact: true }).click();
	await expect(offers).not.toContainText('laundry');
	expect((await stored(page, 'planner.openLoops.v1')).find((loop: { id: string }) => loop.id === 'shower').rhythmDays).toBe(2.5);
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('planner.settings.v1') || '{}').dismissedOffers)).toContain('theme:laundry');

	await expect(patterns.getByTestId('loop-ideas')).toHaveCount(0);
	await patterns.getByRole('button', { name: 'Show ideas', exact: true }).click();
	const ideas = patterns.getByTestId('loop-ideas');
	await expect(ideas).toContainText('After two of two closures you noted that something else felt approachable');
	await expect(ideas).toContainText('“Clean room”');
	await expect(ideas).toContainText('Doing nothing is a fine choice too.');
	await page.screenshot({ path: testInfo.outputPath('patterns-desktop.png'), fullPage: true });

	const results = await new AxeBuilder({ page }).include('[data-testid="loop-patterns"]').include('[data-testid="loop-notebook"]').withTags(['wcag2a', 'wcag21a']).analyze();
	const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
	expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

	await ideas.getByRole('button', { name: 'Not useful', exact: true }).click();
	await expect(ideas).toContainText('Nothing stands out in your notes right now.');
	await page.setViewportSize({ width: 390, height: 900 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('patterns-mobile.png'), fullPage: true });
});

test('loop edits and reminders reach sync', async ({ page }) => {
	const snapshots = new Map<string, { blob: unknown; version: number }>();
	await page.addInitScript(() => localStorage.setItem('woodles_sync_passphrase', 'browser-test-only'));
	await page.route('**/api/sync*', async route => {
		const request = route.request();
		if (request.method() === 'GET') {
			const app = new URL(request.url()).searchParams.get('app')!;
			await route.fulfill({ json: snapshots.get(app) ?? { blob: null, version: 0 } }); return;
		}
		const data = request.postDataJSON() as { app: string; blob: PlannerBlob; baseVersion: number };
		const current = snapshots.get(data.app) ?? { blob: null, version: 0 };
		if (data.baseVersion !== current.version) { await route.fulfill({ status: 409, json: { server: current } }); return; }
		snapshots.set(data.app, { blob: data.blob, version: current.version + 1 });
		await route.fulfill({ json: { ok: true, version: current.version + 1 } });
	});
	await open(page);
	const server = () => snapshots.get('planner')?.blob as PlannerBlob | undefined;
	await newLoop(page, 'Reply to Mom');
	await openLoopList(page);
	const row = page.getByTestId('loop-notebook').getByRole('article', { name: 'Reply to Mom', exact: true });
	await row.getByRole('button', { name: 'Remind me', exact: true }).click();
	await row.getByRole('button', { name: 'Tomorrow morning', exact: true }).click();
	await row.getByRole('button', { name: 'Save reminder', exact: true }).click();
	await row.getByRole('button', { name: 'Edit loop', exact: true }).click();
	await row.getByLabel('Loop title').fill('Reply to Mom and Dad');
	await row.getByRole('button', { name: 'Save loop details', exact: true }).click();
	await expect.poll(() => server()?.loopReminders?.length).toBe(1);
	await expect.poll(() => server()?.openLoops?.[0]?.title).toBe('Reply to Mom and Dad');
	expect(server()?.openLoops?.[0]?.editedAt).toBeTruthy();
});
