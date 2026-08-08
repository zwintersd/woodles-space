import { describe, expect, it } from 'vitest';
import { ingestSittings } from './sittings';
import { blankEntry } from './entries';
import type { ThinkingAboutEntry } from './types';

const NOW = () => '2026-08-09T12:00:00.000Z';

function entry(id: string, overrides: Partial<ThinkingAboutEntry> = {}): ThinkingAboutEntry {
	return { ...blankEntry('reading', 'book', 'Piranesi'), id, ...overrides };
}

function sitting(id: string, entryId = 'e1', date = '2026-08-04') {
	return { id, entryId, date };
}

describe('ingestSittings', () => {
	it('lands a sitting on its entry, dated the day it happened', () => {
		// The whole point: `logSession` here always means today, so a Sunday
		// recalled on Tuesday could not be logged at all before this.
		const result = ingestSittings([entry('e1')], [sitting('s1', 'e1', '2026-08-02')], [], NOW);

		expect(result.added).toBe(1);
		expect(result.entries[0].sessions[0]).toEqual({
			id: 's1',
			date: '2026-08-02',
			note: ''
		});
		expect(result.ingested).toEqual(['s1']);
	});

	it('is idempotent — re-reading the same ledger changes nothing', () => {
		const first = ingestSittings([entry('e1')], [sitting('s1')], [], NOW);
		const second = ingestSittings(first.entries, [sitting('s1')], first.ingested, NOW);

		expect(second.added).toBe(0);
		expect(second.entries[0].sessions).toHaveLength(1);
		expect(second.entries).toBe(first.entries);
	});

	it('keeps a deleted sitting deleted', () => {
		// The reason ingestion is tracked rather than inferred from the sessions
		// themselves: without this, removing one would invite it straight back.
		const first = ingestSittings([entry('e1')], [sitting('s1')], [], NOW);
		const afterDelete = first.entries.map((e) => ({ ...e, sessions: [] }));

		const second = ingestSittings(afterDelete, [sitting('s1')], first.ingested, NOW);
		expect(second.added).toBe(0);
		expect(second.entries[0].sessions).toEqual([]);
	});

	it('does not double-log when a session with that id is already there', () => {
		const existing = entry('e1', {
			sessions: [{ id: 's1', date: '2026-08-04', note: 'ch. 12' }]
		});
		const result = ingestSittings([existing], [sitting('s1')], [], NOW);

		expect(result.added).toBe(0);
		expect(result.entries[0].sessions).toHaveLength(1);
		// And it did not overwrite the note someone typed.
		expect(result.entries[0].sessions[0].note).toBe('ch. 12');
	});

	it('accounts for a sitting whose entry is gone, rather than retrying forever', () => {
		const result = ingestSittings([entry('e1')], [sitting('s9', 'deleted-entry')], [], NOW);

		expect(result.added).toBe(0);
		expect(result.ingested).toEqual(['s9']);
	});

	it('puts an ingested sitting newest-first, like one logged here', () => {
		const existing = entry('e1', {
			sessions: [{ id: 'old', date: '2026-08-01', note: '' }]
		});
		const result = ingestSittings([existing], [sitting('new')], [], NOW);

		expect(result.entries[0].sessions.map((s) => s.id)).toEqual(['new', 'old']);
	});

	it('spreads a mixed ledger across the right entries and leaves others alone', () => {
		const result = ingestSittings(
			[entry('e1'), entry('e2'), entry('e3')],
			[sitting('s1', 'e1'), sitting('s2', 'e2')],
			[],
			NOW
		);

		expect(result.entries[0].sessions).toHaveLength(1);
		expect(result.entries[1].sessions).toHaveLength(1);
		expect(result.entries[2].sessions).toEqual([]);
		expect(result.added).toBe(2);
	});

	it('touches updatedAt only on the entries that changed', () => {
		const untouched = entry('e2', { updatedAt: '2020-01-01T00:00:00.000Z' });
		const result = ingestSittings([entry('e1'), untouched], [sitting('s1', 'e1')], [], NOW);

		expect(result.entries[0].updatedAt).toBe(NOW());
		expect(result.entries[1].updatedAt).toBe('2020-01-01T00:00:00.000Z');
	});

	it('does nothing at all for an empty ledger', () => {
		const entries = [entry('e1')];
		const result = ingestSittings(entries, [], [], NOW);

		expect(result.added).toBe(0);
		expect(result.entries).toBe(entries);
	});
});
