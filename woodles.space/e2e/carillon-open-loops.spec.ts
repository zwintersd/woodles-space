import { expect, test, type Page } from '@playwright/test';
import type { PlannerBlob } from '../apps/planner/src/lib/types';

async function open(page: Page) {
	await page.clock.setFixedTime(new Date('2026-10-18T12:03:20'));
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ status: 200, body: '' }));
	await page.addInitScript(() => {
		if (!localStorage.getItem('planner.settings.v1')) localStorage.setItem('planner.settings.v1', JSON.stringify({ onboardingComplete: true, bellsEnabled: false, samplingIntervalMinutes: 5, fixedPaletteMode: 'late-afternoon' }));
	});
	await page.goto('/planner');
}

test('neutral capture leaves ratings absent and retains unlinked bodily observations', async ({ page }, testInfo) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	await open(page);
	const sampler = page.getByTestId('interval-sampler');
	await expect(sampler.getByRole('heading', { name: 'Anything else you notice?' })).toBeVisible();
	await expect(sampler.getByRole('slider')).toHaveCount(0);
	for (const text of ['Very low', 'Depleted', 'Overwhelming']) await expect(sampler.getByRole('button', { name: text, exact: true })).not.toBeVisible();
	await expect(sampler.getByRole('group', { name: 'Optional noticing categories' }).locator('[aria-pressed="true"]')).toHaveCount(0);
	await page.screenshot({ path: testInfo.outputPath('today-neutral-desktop.png'), fullPage: true });
	await page.setViewportSize({ width: 390, height: 900 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('today-neutral-mobile.png'), fullPage: true });
	await page.setViewportSize({ width: 1280, height: 900 });
	await sampler.getByLabel('What’s happening now?', { exact: true }).fill('Watching a video');
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].details).toEqual({});
	expect(saved[0].noticings ?? []).toEqual([]);
	expect(saved[0].linkedLoopIds ?? []).toEqual([]);
	await page.getByRole('button', { name: 'Reopen 12:00: Watching a video', exact: true }).click();
	await sampler.getByRole('button', { name: 'In my body', exact: true }).click();
	await sampler.getByLabel('What sensation? Where?', { exact: true }).fill('Tight shoulders / pit in stomach');
	await sampler.getByRole('button', { name: 'Save changes', exact: true }).click();
	await page.reload();
	await expect(page.getByText('Body: Tight shoulders / pit in stomach', { exact: true })).toBeVisible();
	saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].noticings).toEqual([{ channel: 'body', note: 'Tight shoulders / pit in stomach' }]);
	expect(saved[0].linkedLoopIds ?? []).toEqual([]);
	expect(saved[0].details).toEqual({});
	await page.setViewportSize({ width: 390, height: 900 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('saved-body-mobile.png'), fullPage: true });
	expect(errors).toEqual([]);
});

test('loops close, release, reopen and retain optional consequences across reload', async ({ page }, testInfo) => {
	await open(page);
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'New loop', exact: true }).click();
	await notebook.getByLabel('Loop title', { exact: true }).fill('Reply to Mom');
	await notebook.getByRole('button', { name: 'Save loop', exact: true }).click();
	await notebook.locator('.loop-list > summary').click();
	const loop = notebook.getByRole('article', { name: 'Reply to Mom', exact: true });
	await loop.getByRole('button', { name: 'Close loop', exact: true }).click();
	const reflection = page.getByTestId('closure-reflection');
	await expect(reflection.getByRole('heading', { name: 'What changed, if anything?' })).toBeFocused();
	await reflection.getByRole('button', { name: 'Lighter', exact: true }).click();
	await reflection.getByRole('button', { name: 'No noticeable change', exact: true }).click();
	await expect(reflection.getByRole('button', { name: 'Lighter', exact: true })).toHaveAttribute('aria-pressed', 'false');
	await reflection.getByRole('button', { name: 'Lighter', exact: true }).click();
	await reflection.getByLabel('Reflection note').fill('Cleaning feels approachable');
	await reflection.getByRole('button', { name: 'Something else is approachable', exact: true }).click();
	await page.screenshot({ path: testInfo.outputPath('loop-closure.png'), fullPage: true });
	await reflection.getByRole('button', { name: 'Save reflection', exact: true }).click();
	await page.reload();
	await notebook.locator('.loop-list > summary').click();
	await expect(loop.getByText('Closed', { exact: true })).toBeVisible();
	await notebook.locator('.history > summary').click();
	await expect(notebook.getByText('Cleaning feels approachable', { exact: true })).toBeVisible();
	await loop.getByRole('button', { name: 'Reopen loop', exact: true }).click();
	await loop.getByRole('button', { name: 'Let go', exact: true }).click();
	await reflection.getByRole('button', { name: 'Less comfortable', exact: true }).click();
	await reflection.getByRole('button', { name: 'Rest', exact: true }).click();
	await reflection.getByRole('button', { name: 'Save reflection', exact: true }).click();
	const saved = await page.evaluate(() => ({ loops: JSON.parse(localStorage.getItem('planner.openLoops.v1') || '[]'), events: JSON.parse(localStorage.getItem('planner.loopEvents.v1') || '[]'), reflections: JSON.parse(localStorage.getItem('planner.closureReflections.v1') || '[]') }));
	expect(saved.loops[0]).toMatchObject({ status: 'resolved', resolution: 'released' });
	expect(saved.events.map((event: { type: string }) => event.type)).toEqual(['noticed', 'closed', 'reopened', 'released']);
	expect(saved.reflections).toHaveLength(2);
	expect(saved.reflections[1]).toMatchObject({ descriptors: ['Less comfortable'], nextFeelsPossible: 'rest' });
});

test('unattributed events keep their own time and closure can skip reflection', async ({ page }) => {
	await open(page);
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'Notice', exact: true }).click();
	await notebook.getByLabel('Event note').fill('An unfinished intention came to mind');
	await notebook.getByText('Event time', { exact: false }).first().click();
	await notebook.getByLabel('When it happened').fill('2026-10-18T11:42');
	await notebook.getByRole('button', { name: 'Save event', exact: true }).click();
	await notebook.getByRole('button', { name: 'New loop', exact: true }).click();
	await notebook.getByLabel('Loop title', { exact: true }).fill('Subscription');
	await notebook.getByRole('button', { name: 'Save loop', exact: true }).click();
	await notebook.getByRole('button', { name: 'Closed / let go', exact: true }).click();
	await notebook.getByLabel('Which loop?', { exact: true }).selectOption({ label: 'Subscription · open' });
	await notebook.getByRole('button', { name: 'Save event', exact: true }).click();
	await page.getByTestId('closure-reflection').getByRole('button', { name: 'Skip reflection', exact: true }).click();
	await page.reload();
	const saved = await page.evaluate(() => ({ events: JSON.parse(localStorage.getItem('planner.loopEvents.v1') || '[]'), reflections: JSON.parse(localStorage.getItem('planner.closureReflections.v1') || '[]') }));
	expect(saved.events[0].loopId).toBeUndefined();
	expect(saved.events[0].occurredAt).not.toEqual(saved.events[0].recordedAt);
	expect(saved.events[2].recordedAt).toContain('03:20');
	expect(saved.reflections).toEqual([]);
});

test('five contacts allow switching, undo and early stopping without closing the linked loop', async ({ page }, testInfo) => {
	await open(page);
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'New loop', exact: true }).click();
	await notebook.getByLabel('Loop title', { exact: true }).fill('Laundry');
	await notebook.getByRole('button', { name: 'Save loop', exact: true }).click();
	const contacts = page.getByTestId('five-contacts');
	await contacts.getByRole('button', { name: 'Start Five Contacts', exact: true }).click();
	await contacts.getByText('Add a note or loop', { exact: false }).click();
	await contacts.getByLabel('Link the next contact to a loop').selectOption({ label: 'Laundry' });
	await contacts.getByLabel('Note for the next contact').fill('Picked up a towel');
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await contacts.getByLabel('Note for the next contact').fill('Moved laundry');
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await contacts.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(contacts.getByRole('status').first()).toContainText(/1\s*\/ 5/);
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await page.reload();
	await expect(contacts.getByRole('status').first()).toContainText(/2\s*\/ 5/);
	await contacts.getByText('Add a note or loop', { exact: false }).click();
	for (const note of ['Kitchen counter', 'Kitchen cup', 'Kitchen trash']) {
		await contacts.getByLabel('Note for the next contact').fill(note);
		await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	}
	await expect(contacts.getByRole('heading', { name: 'Five contacts complete.' })).toBeFocused();
	await expect(contacts.getByRole('button', { name: 'Count a contact', exact: true })).toHaveCount(0);
	await contacts.getByRole('button', { name: 'Undo last contact', exact: true }).click();
	await expect(contacts.getByRole('status').first()).toContainText(/4\s*\/ 5/);
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await contacts.getByLabel('Anything feel different?', { exact: false }).fill('No noticeable change');
	await contacts.getByRole('button', { name: 'Save reflection', exact: true }).click();
	await page.screenshot({ path: testInfo.outputPath('five-contacts-complete.png'), fullPage: true });
	let saved = await page.evaluate(() => ({ rounds: JSON.parse(localStorage.getItem('planner.fiveContactsRounds.v1') || '[]'), loops: JSON.parse(localStorage.getItem('planner.openLoops.v1') || '[]') }));
	expect(saved.rounds[0].status).toBe('completed');
	expect(saved.rounds[0].contacts.filter((contact: { removedAt?: string }) => !contact.removedAt)).toHaveLength(5);
	expect(saved.loops[0].status).toBe('open');
	await contacts.getByRole('button', { name: 'Done', exact: true }).click();
	await contacts.getByRole('button', { name: 'Start Five Contacts', exact: true }).click();
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await contacts.getByRole('button', { name: 'Stop this round', exact: true }).click();
	await page.reload();
	saved = await page.evaluate(() => ({ rounds: JSON.parse(localStorage.getItem('planner.fiveContactsRounds.v1') || '[]'), loops: JSON.parse(localStorage.getItem('planner.openLoops.v1') || '[]') }));
	expect(saved.rounds.map((round: { status: string }) => round.status)).toEqual(['completed', 'stopped']);
});

test('retrospectively links an observation without changing historical metrics', async ({ page }) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('planner.observations.v1')) localStorage.setItem('planner.observations.v1', JSON.stringify([{ id: 'observation-2026-10-18@09:00', date: '2026-10-18', intervalStart: '09:00', source: 'live', kind: 'elsewhere', label: 'Historical moment', details: { mood: 3, energy: 1, coping: 5, body: 'Tense shoulders' }, trackerAnswers: [{ tracker: { id: 'old-focus', name: 'Focus', type: 'rating', cue: '', low: 'Low', high: 'High' }, value: 3 }], capturedAt: '2026-10-18T13:00:00Z', updatedAt: '2026-10-18T13:00:00Z' }]));
	});
	await open(page);
	await page.getByRole('button', { name: 'Reopen 09:00: Historical moment', exact: true }).click();
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByRole('button', { name: '+ Link an open loop', exact: true }).click();
	await sampler.getByLabel('New loop name', { exact: false }).fill('Reply to Mom');
	await sampler.getByRole('button', { name: 'Create and link', exact: true }).click();
	await sampler.getByRole('button', { name: 'Save changes', exact: true }).click();
	await page.reload();
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('planner.observations.v1') || '[]'));
	expect(saved[0].details).toEqual({ mood: 3, energy: 1, coping: 5, body: 'Tense shoulders' });
	expect(saved[0].trackerAnswers[0].value).toBe(3);
	expect(saved[0].linkedLoopIds).toHaveLength(1);
	expect(saved[0].capturedAt).toBe('2026-10-18T13:00:00Z');
});

test('new notebook data reaches sync and survives a concurrent device conflict', async ({ page }) => {
	const snapshots = new Map<string, { blob: unknown; version: number }>();
	let conflictNext = false;
	await page.addInitScript(() => localStorage.setItem('woodles_sync_passphrase', 'browser-test-only'));
	await page.route('**/api/sync*', async route => {
		const request = route.request();
		if (request.method() === 'GET') {
			const app = new URL(request.url()).searchParams.get('app')!;
			await route.fulfill({ json: snapshots.get(app) ?? { blob: null, version: 0 } }); return;
		}
		const data = request.postDataJSON() as { app: string; blob: PlannerBlob; baseVersion: number };
		const current = snapshots.get(data.app) ?? { blob: null, version: 0 };
		if (data.app === 'planner' && conflictNext) {
			conflictNext = false;
			const remote = structuredClone(current.blob) as PlannerBlob;
			remote.openLoops = [...(remote.openLoops ?? []), { id: 'other-device-loop', title: 'A note from another device', status: 'open', createdAt: '2026-10-18T14:00:00Z', updatedAt: '2026-10-18T14:00:00Z' }];
			const newer = { blob: remote, version: current.version + 1 };
			snapshots.set(data.app, newer);
			await route.fulfill({ status: 409, json: { server: newer } }); return;
		}
		if (data.baseVersion !== current.version) { await route.fulfill({ status: 409, json: { server: current } }); return; }
		snapshots.set(data.app, { blob: data.blob, version: current.version + 1 });
		await route.fulfill({ json: { ok: true, version: current.version + 1 } });
	});
	await open(page);
	const server = () => snapshots.get('planner')?.blob as PlannerBlob | undefined;
	await expect.poll(() => server()?.openLoops).toEqual([]);
	conflictNext = true;
	const notebook = page.getByTestId('loop-notebook');
	await notebook.getByRole('button', { name: 'New loop', exact: true }).click();
	await notebook.getByLabel('Loop title', { exact: true }).fill('Reply to Mom');
	await notebook.getByRole('button', { name: 'Save loop', exact: true }).click();
	await expect.poll(() => server()?.openLoops?.map(loop => loop.title).sort()).toEqual(['A note from another device', 'Reply to Mom']);
	await notebook.locator('.loop-list > summary').click();
	await notebook.getByRole('article', { name: 'Reply to Mom', exact: true }).getByRole('button', { name: 'Close loop', exact: true }).click();
	const reflection = page.getByTestId('closure-reflection');
	await reflection.getByRole('button', { name: 'No noticeable change', exact: true }).click();
	await reflection.getByRole('button', { name: 'Save reflection', exact: true }).click();
	await expect.poll(() => server()?.closureReflections?.[0]?.descriptors).toEqual(['No noticeable change']);
	const sampler = page.getByTestId('interval-sampler');
	await sampler.getByLabel('What’s happening now?', { exact: true }).fill('At my desk');
	await sampler.getByRole('button', { name: 'In my attention', exact: true }).click();
	await sampler.getByLabel('What do you notice in your attention?').fill('Drifting');
	await sampler.getByRole('button', { name: 'Save moment', exact: true }).click();
	await expect.poll(() => server()?.observations?.[0]?.noticings).toEqual([{ channel: 'attention', note: 'Drifting' }]);
	const contacts = page.getByTestId('five-contacts');
	await contacts.getByRole('button', { name: 'Start Five Contacts', exact: true }).click();
	await contacts.getByRole('button', { name: 'Count a contact', exact: true }).click();
	await expect.poll(() => server()?.fiveContactsRounds?.[0]?.contacts.length).toBe(1);
	await page.reload();
	await expect(contacts.getByRole('status').first()).toContainText(/1\s*\/ 5/);
	await expect.poll(() => server()?.loopEvents?.map(event => event.type)).toEqual(['noticed', 'closed']);
});
