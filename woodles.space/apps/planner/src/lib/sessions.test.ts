// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { readSessionsBlob, CARILLON_SESSIONS_STORAGE_KEY } from '@woodles/sync';
import { buildSessions, sessionsMatch, SESSION_LEDGER_DAYS } from './sessions';
import { PlannerStore } from './store.svelte';
import type { LoggedSession } from './types';

function logged(id: string, date: string, entryId = 'piranesi'): LoggedSession {
	return { id, entryId, date, createdAt: '2026-08-09T09:00:00.000Z' };
}

const TODAY = new Date('2026-08-09T12:00:00.000Z');

describe('buildSessions', () => {
	it('carries only what Thinking About needs to create the session', () => {
		const blob = buildSessions([logged('session-piranesi-2026-08-04', '2026-08-04')], TODAY);

		expect(blob.sittings).toEqual([
			{ id: 'session-piranesi-2026-08-04', entryId: 'piranesi', date: '2026-08-04' }
		]);
	});

	it('drops sittings past the window, which have long since landed', () => {
		const old = new Date(TODAY);
		old.setDate(old.getDate() - SESSION_LEDGER_DAYS - 5);
		const oldKey = old.toISOString().slice(0, 10);

		const blob = buildSessions(
			[logged('recent', '2026-08-04'), logged('ancient', oldKey)],
			TODAY
		);

		expect(blob.sittings.map((s) => s.id)).toEqual(['recent']);
	});

	it('round-trips through the contract validator', () => {
		const blob = buildSessions([logged('s1', '2026-08-04')], TODAY);
		expect(readSessionsBlob(JSON.parse(JSON.stringify(blob)))).toEqual(blob);
	});
});

describe('sessionsMatch', () => {
	it('ignores publishedAt', () => {
		const one = [logged('s1', '2026-08-04')];
		expect(
			sessionsMatch(buildSessions(one, TODAY, 'a'), buildSessions(one, TODAY, 'b'))
		).toBe(true);
	});

	it('notices a new sitting', () => {
		expect(
			sessionsMatch(
				buildSessions([logged('s1', '2026-08-04')], TODAY),
				buildSessions([logged('s1', '2026-08-04'), logged('s2', '2026-08-05')], TODAY)
			)
		).toBe(false);
	});
});

describe('accepting an offer', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		store = new PlannerStore();
	});

	it('records one sitting per entry per day, however many times it is tapped', () => {
		// A Thinking About session is a sitting, not a fifteen-minute sample —
		// eight bells across a reading evening are one sitting, not eight.
		const first = store.logThinkingAboutSession('piranesi', '2026-08-09');
		const second = store.logThinkingAboutSession('piranesi', '2026-08-09');

		expect(second.id).toBe(first.id);
		expect(store.loggedSessions).toHaveLength(1);
	});

	it('keeps different days apart', () => {
		store.logThinkingAboutSession('piranesi', '2026-08-08');
		store.logThinkingAboutSession('piranesi', '2026-08-09');
		expect(store.loggedSessions).toHaveLength(2);
	});

	it('reports whether a day is already logged, and can be undone', () => {
		expect(store.hasLoggedSession('piranesi', '2026-08-09')).toBe(false);

		store.logThinkingAboutSession('piranesi', '2026-08-09');
		expect(store.hasLoggedSession('piranesi', '2026-08-09')).toBe(true);

		store.unlogThinkingAboutSession('piranesi', '2026-08-09');
		expect(store.hasLoggedSession('piranesi', '2026-08-09')).toBe(false);
	});

	it('mirrors the ledger for a same-origin reader on every change', () => {
		store.logThinkingAboutSession('piranesi', '2026-08-09');

		const raw = localStorage.getItem(CARILLON_SESSIONS_STORAGE_KEY);
		expect(readSessionsBlob(JSON.parse(raw as string))?.sittings[0]).toMatchObject({
			entryId: 'piranesi',
			date: '2026-08-09'
		});
	});

	it('is never created by observing alone', () => {
		// Observing is a fact about the day; a sitting is a thing a person says
		// they did. The instrument offers, it does not convert.
		store.observeInterval({ date: '2026-08-09', intervalStart: '20:00', kind: 'rest' });
		expect(store.loggedSessions).toEqual([]);
	});
});

describe('which entries an interval is about', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		store = new PlannerStore();
	});

	it('finds the entry a task in that block references', () => {
		// Blocks must come from the day's own pile: an interval resolves against
		// the shape that date actually uses, not every block in the rack.
		const date = '2026-08-09';
		const block = store.getBlocksForDateKey(date)[0];
		store.addTask({
			title: 'read a chapter',
			thinkingAboutEntryId: 'piranesi',
			targetBlockId: block.id,
			targetDate: date
		});

		expect(store.linkedEntryIdsForInterval(date, block.startTime)).toEqual(['piranesi']);
	});

	it('offers nothing for an interval with no linked task', () => {
		const block = store.getBlocksForDateKey('2026-08-09')[0];
		expect(store.linkedEntryIdsForInterval('2026-08-09', block.startTime)).toEqual([]);
	});

	it('does not repeat an entry two tasks both point at', () => {
		const date = '2026-08-09';
		const block = store.getBlocksForDateKey(date)[0];
		for (const title of ['read a chapter', 'read another']) {
			store.addTask({
				title,
				thinkingAboutEntryId: 'piranesi',
				targetBlockId: block.id,
				targetDate: date
			});
		}

		expect(store.linkedEntryIdsForInterval(date, block.startTime)).toEqual(['piranesi']);
	});
});
