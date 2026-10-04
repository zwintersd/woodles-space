// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUE_LIMIT, createHandoffQueue, sendHandoff, type Handoff, type HandoffDraft } from '@woodles/handoff';
import { blankEntry, deleteEntry, isUntouched, uid } from './entries';
import {
	ARRIVAL,
	ARRIVALS_KEY,
	arrivalNotice,
	arrivalTitle,
	createArrivals,
	entryFromHandoff,
	ingestHandoffs,
	takeHandoffs,
	type SyncGate
} from './handoffs';
import { buildShelf } from './shelf';
import type { ThinkingAboutEntry } from './types';

const NOW = '2026-10-04T15:00:00.000Z';
const now = () => NOW;

function handoff(overrides: Partial<Handoff> = {}): Handoff {
	return {
		id: 'c-1',
		target: 'thinking-about',
		title: 'A good essay',
		body: 'why I kept it',
		format: 'text',
		tags: [],
		source: { app: 'companion', label: 'A good essay', href: 'https://example.com/essay' },
		createdAt: '2026-10-03T09:30:00.000Z',
		...overrides
	};
}

function send(draft: Partial<HandoffDraft> = {}, id = 'c-1') {
	return createHandoffQueue('thinking-about', { newId: () => id }).send({
		title: 'A good essay',
		body: 'why I kept it',
		source: { app: 'companion', href: 'https://example.com/essay' },
		...draft
	});
}

/** A board held in a closure, the way the store holds it. */
function board(initial: ThinkingAboutEntry[] = []) {
	const state = { entries: initial, ingested: [] as string[] };
	const ingest = vi.fn((items: Handoff[]) => {
		const result = ingestHandoffs(state.entries, items, state.ingested, now);
		state.entries = result.entries;
		state.ingested = result.ingested;
		return result.added;
	});
	return { state, ingest };
}

function gate(overrides: Partial<SyncGate> = {}): SyncGate {
	return { status: 'idle', syncing: false, connected: false, ...overrides };
}

beforeEach(() => localStorage.clear());

describe('what an arrival becomes', () => {
	it('lands in Reading · Articles under the handoff’s own id', () => {
		const entry = entryFromHandoff(handoff(), NOW);
		expect(entry).toMatchObject({ id: 'c-1', columnKey: 'reading', sectionKey: 'article', title: 'A good essay', status: 'active' });
		expect(ARRIVAL).toEqual({ columnKey: 'reading', sectionKey: 'article' });
	});

	it('is dated when it was kept, and stamped when it landed', () => {
		expect(entryFromHandoff(handoff(), NOW)).toMatchObject({
			createdAt: '2026-10-03T09:30:00.000Z',
			dateStarted: '2026-10-03',
			updatedAt: NOW
		});
		expect(entryFromHandoff(handoff({ createdAt: 'whenever' }), NOW)).toMatchObject({ createdAt: NOW, dateStarted: '2026-10-04' });
	});

	it('keeps the body, then the link back, in its notes', () => {
		expect(entryFromHandoff(handoff(), NOW).notes).toBe('why I kept it\n\nhttps://example.com/essay');
		expect(entryFromHandoff(handoff({ source: { app: 'companion' } }), NOW).notes).toBe('why I kept it');
	});

	it('leaves out a body that only repeats the title, and a link the body already holds', () => {
		expect(entryFromHandoff(handoff({ body: 'A good essay' }), NOW).notes).toBe('https://example.com/essay');
		expect(entryFromHandoff(handoff({ body: 'A good essay', source: { app: 'companion' } }), NOW).notes).toBe('');
		expect(entryFromHandoff(handoff({ body: 'see https://example.com/essay' }), NOW).notes).toBe('see https://example.com/essay');
	});

	it('flattens an HTML body, keeping its paragraphs', () => {
		const notes = entryFromHandoff(handoff({ format: 'html', body: '<p>one &amp; two</p><blockquote><p>a line</p></blockquote>' }), NOW).notes;
		expect(notes).toBe('one & two\n\na line\n\nhttps://example.com/essay');
	});

	it('is never untitled, so it is never swept or left off the shelf', () => {
		const cases: [Partial<Handoff>, string][] = [
			[{ title: '  ' }, 'A good essay'],
			[{ title: '', source: { app: 'companion', href: 'https://example.com/essay' } }, 'why I kept it'],
			[{ title: '', body: 'x'.repeat(90), source: { app: 'companion' } }, 'x'.repeat(79) + '…'],
			[{ title: '', body: '', source: { app: 'companion', href: 'https://www.example.com/a' } }, 'example.com'],
			[{ title: '', body: '', source: { app: 'companion' } }, 'something kept']
		];
		for (const [overrides, title] of cases) {
			const item = handoff(overrides);
			expect(arrivalTitle(item)).toBe(title);
			const entry = entryFromHandoff(item, NOW);
			expect(isUntouched(entry)).toBe(false);
			expect(buildShelf([entry]).entries.map((e) => e.id)).toEqual([item.id]);
		}
	});

	it('can never collide with an entry made here', () => {
		// Entry ids never hold a dash; handoff ids always do — the spine's own
		// `h-…` here, and the companion's `c-…` (tested with its protocol).
		for (let i = 0; i < 50; i += 1) {
			expect(uid()).not.toContain('-');
			expect(sendHandoff('thinking-about', { source: { app: 'test' } }).handoff.id).toMatch(/^[a-z]+-/);
		}
	});
});

describe('folding arrivals into the board', () => {
	const existing = { ...blankEntry('reading', 'book', 'Piranesi'), id: 'e1' };

	it('lands newest on top, above what was there, leaving it untouched', () => {
		const result = ingestHandoffs([existing], [handoff({ id: 'a' }), handoff({ id: 'b' })], [], now);
		expect(result.entries.map((e) => e.id)).toEqual(['b', 'a', 'e1']);
		expect(result.entries[2]).toBe(existing);
		expect(result).toMatchObject({ added: 2, accounted: 2, ingested: ['a', 'b'] });
	});

	it('changes nothing the second time', () => {
		const first = ingestHandoffs([existing], [handoff()], [], now);
		const second = ingestHandoffs(first.entries, [handoff()], first.ingested, now);
		expect(second).toEqual({ entries: first.entries, ingested: first.ingested, added: 0, accounted: 0 });
		expect(second.entries).toBe(first.entries);
	});

	it('keeps a deleted arrival deleted', () => {
		const first = ingestHandoffs([], [handoff()], [], now);
		const again = ingestHandoffs(deleteEntry(first.entries, 'c-1'), [handoff()], first.ingested, now);
		expect(again.entries).toEqual([]);
		expect(again.added).toBe(0);
	});

	it('records an id already on the board without landing it twice', () => {
		const onBoard = { ...existing, id: 'c-1' };
		expect(ingestHandoffs([onBoard], [handoff()], [], now)).toMatchObject({ added: 0, accounted: 1, ingested: ['c-1'] });
	});

	it('lands a duplicate within one batch once', () => {
		expect(ingestHandoffs([], [handoff(), handoff()], [], now)).toMatchObject({ added: 1, accounted: 1 });
	});

	it('remembers only the newest QUEUE_LIMIT ids', () => {
		const old = Array.from({ length: QUEUE_LIMIT }, (_, i) => `old-${i}`);
		const result = ingestHandoffs([], [handoff({ id: 'new' })], old, now);
		expect(result.ingested).toHaveLength(QUEUE_LIMIT);
		expect(result.ingested.at(-1)).toBe('new');
		expect(result.ingested[0]).toBe('old-1');
	});
});

describe('when a take is allowed', () => {
	it('leaves the queue alone after a failed hydrate, or during one', () => {
		send();
		for (const sync of [gate({ status: 'error' }), gate({ status: 'ok', syncing: true })]) {
			const { ingest } = board();
			expect(takeHandoffs(sync, ingest)).toBeNull();
			expect(ingest).not.toHaveBeenCalled();
			expect(createHandoffQueue('thinking-about').count()).toBe(1);
		}
	});

	it('takes after a hydrate that went through, or with no sync at all', () => {
		for (const status of ['ok', 'idle'] as const) {
			send();
			const { state, ingest } = board();
			expect(takeHandoffs(gate({ status }), ingest)).toBe(1);
			expect(state.entries.map((e) => e.id)).toEqual(['c-1']);
			expect(createHandoffQueue('thinking-about').count()).toBe(0);
		}
	});

	it('lands once when the queue could not be emptied', () => {
		send();
		// Reads work, writes fail — drain hands the items over but can't clear them.
		const stuck = {
			getItem: (key: string) => localStorage.getItem(key),
			setItem: () => {
				throw new Error('quota');
			},
			removeItem: () => {}
		};
		const { state, ingest } = board();
		expect(takeHandoffs(gate(), ingest, { storage: stuck })).toBe(1);
		expect(takeHandoffs(gate(), ingest, { storage: stuck })).toBe(0);
		expect(state.entries).toHaveLength(1);
	});

	it('lands once when the queue comes back from its backup', () => {
		send();
		const { state, ingest } = board();
		takeHandoffs(gate(), ingest);
		// The emptied queue is gone; persistence restores the batch it last held.
		localStorage.removeItem(ARRIVALS_KEY);
		expect(createHandoffQueue('thinking-about').count()).toBe(1);
		expect(takeHandoffs(gate(), ingest)).toBe(0);
		expect(state.entries).toHaveLength(1);
	});
});

describe('arriving while the board is open', () => {
	function arrivals(sync: { status: SyncGate['status']; syncing: boolean; connected: boolean }, catchUp = vi.fn(async () => {})) {
		const { state, ingest } = board();
		return { state, catchUp, ...createArrivals({ sync, catchUp, ingest }) };
	}

	it('waits for the load’s own sync before taking anything live', async () => {
		send();
		const live = arrivals(gate({ connected: true, status: 'ok' }));
		expect(await live.live()).toBe(0);
		expect(live.catchUp).not.toHaveBeenCalled();
		expect(createHandoffQueue('thinking-about').count()).toBe(1);
	});

	it('does not touch the network when nothing is waiting', async () => {
		const live = arrivals(gate({ connected: true, status: 'ok' }));
		live.takeAfterLoadSync();
		expect(await live.live()).toBe(0);
		expect(live.catchUp).not.toHaveBeenCalled();
	});

	it('catches up with the server first, then takes', async () => {
		const sync = { status: 'ok' as SyncGate['status'], syncing: false, connected: true };
		const waitingAtCatchUp: number[] = [];
		const live = arrivals(
			sync,
			vi.fn(async () => {
				await Promise.resolve();
				waitingAtCatchUp.push(createHandoffQueue('thinking-about').count());
			})
		);
		live.takeAfterLoadSync();
		send();
		expect(await live.live()).toBe(1);
		// Still queued while the board caught up; drained only after.
		expect(waitingAtCatchUp).toEqual([1]);
		expect(createHandoffQueue('thinking-about').count()).toBe(0);
		expect(live.state.entries.map((e) => e.id)).toEqual(['c-1']);
	});

	it('leaves the queue alone when catching up fails', async () => {
		const sync = { status: 'ok' as SyncGate['status'], syncing: false, connected: true };
		const live = arrivals(sync, vi.fn(async () => void (sync.status = 'error')));
		live.takeAfterLoadSync();
		send();
		expect(await live.live()).toBe(0);
		expect(createHandoffQueue('thinking-about').count()).toBe(1);
	});

	it('takes straight away on a board with no sync', async () => {
		const live = arrivals(gate());
		live.takeAfterLoadSync();
		send();
		expect(await live.live()).toBe(1);
		expect(live.catchUp).not.toHaveBeenCalled();
	});

	it('catches up once when asked twice at the same moment', async () => {
		const live = arrivals(gate({ connected: true, status: 'ok' }));
		live.takeAfterLoadSync();
		send();
		const [a, b] = await Promise.all([live.live(), live.live()]);
		expect(live.catchUp).toHaveBeenCalledTimes(1);
		expect(a + b).toBe(1);
	});
});

describe('settling a held link', () => {
	it('waits past a load whose sync failed, for the take that lands the arrival', async () => {
		const sync = { status: 'error' as SyncGate['status'], syncing: false, connected: true };
		const onFirstTake = vi.fn();
		const { ingest } = board();
		const arrivals = createArrivals({ sync, catchUp: async () => void (sync.status = 'ok'), ingest, onFirstTake });
		send();
		arrivals.takeAfterLoadSync();
		expect(onFirstTake).not.toHaveBeenCalled();
		expect(await arrivals.live()).toBe(1);
		expect(onFirstTake).toHaveBeenCalledTimes(1);
	});

	it('settles on the load’s take when it ran, even with nothing to take — and only once', async () => {
		const onFirstTake = vi.fn();
		const { ingest } = board();
		const arrivals = createArrivals({ sync: gate(), catchUp: async () => {}, ingest, onFirstTake });
		arrivals.takeAfterLoadSync();
		expect(onFirstTake).toHaveBeenCalledTimes(1);
		send();
		await arrivals.live();
		expect(onFirstTake).toHaveBeenCalledTimes(1);
	});
});

it('says where things went, once', () => {
	expect(arrivalNotice(1)).toBe('1 handed over from elsewhere, in Reading · Articles.');
	expect(arrivalNotice(3)).toBe('3 handed over from elsewhere, in Reading · Articles.');
});

it('reads its queue under the spine’s key', () => {
	sendHandoff('thinking-about', { title: 'x', source: { app: 'companion' } });
	expect(localStorage.getItem(ARRIVALS_KEY)).toContain('"thinking-about"');
});
