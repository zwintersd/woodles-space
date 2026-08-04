import { blankGameDef, cozyGarden, mergeProjectIndexes, type GameDef, type ProjectIndex } from '@woodles/incremental-core';
import { describe, expect, it } from 'vitest';
import { mergeLibraries } from './sync.svelte.js';
import type { LibraryBlob } from './projects.js';

function shelf(entries: { id: string; title: string; at: string; def?: GameDef }[]): LibraryBlob {
	const defs: Record<string, GameDef> = {};
	for (const entry of entries) defs[entry.id] = entry.def ?? blankGameDef(entry.title);
	return {
		index: {
			projects: entries.map((entry) => ({ id: entry.id, title: entry.title, updatedAt: entry.at })),
			lastOpenedId: entries[0]?.id ?? null
		},
		defs
	};
}

describe('merging two shelves', () => {
	it('keeps a project that only one device has ever seen', () => {
		// The whole point. Editing a different game on each device has to leave
		// you holding both, not whichever device happened to sync last.
		const laptop = shelf([{ id: 'a', title: 'Garden', at: '2026-01-01T10:00:00Z' }]);
		const phone = shelf([{ id: 'b', title: 'Factory', at: '2026-01-01T11:00:00Z' }]);

		const merged = mergeLibraries(laptop, phone);
		expect(merged.index.projects.map((entry) => entry.id)).toEqual(['a', 'b']);
		expect(Object.keys(merged.defs).sort()).toEqual(['a', 'b']);
	});

	it('takes the newer copy when both have the same project', () => {
		const older = shelf([{ id: 'a', title: 'Old name', at: '2026-01-01T10:00:00Z' }]);
		const newer = shelf([
			{ id: 'a', title: 'New name', at: '2026-01-02T10:00:00Z', def: structuredClone(cozyGarden) }
		]);

		expect(mergeLibraries(older, newer).index.projects[0].title).toBe('New name');
		expect(mergeLibraries(older, newer).defs.a.meta.id).toBe('cozy-garden');
	});

	it('takes the definition from the same side as the summary that won', () => {
		// A project's metadata and its content must never end up describing
		// different copies.
		const local = shelf([{ id: 'a', title: 'Local', at: '2026-02-01T00:00:00Z', def: blankGameDef('Local') }]);
		const remote = shelf([{ id: 'a', title: 'Remote', at: '2026-01-01T00:00:00Z', def: blankGameDef('Remote') }]);

		const merged = mergeLibraries(local, remote);
		expect(merged.index.projects[0].title).toBe('Local');
		expect(merged.defs.a.meta.title).toBe('Local');
	});

	it('gives the same answer whichever way round it is merged', () => {
		// `createAppSync` retries a merged snapshot against the version it just
		// observed. An order-dependent merge would ping-pong instead of settling.
		const laptop = shelf([
			{ id: 'a', title: 'Garden', at: '2026-01-03T00:00:00Z' },
			{ id: 'c', title: 'Only here', at: '2026-01-01T00:00:00Z' }
		]);
		const phone = shelf([
			{ id: 'a', title: 'Garden older', at: '2026-01-01T00:00:00Z' },
			{ id: 'b', title: 'Factory', at: '2026-01-02T00:00:00Z' }
		]);

		const forwards = mergeLibraries(laptop, phone);
		const backwards = mergeLibraries(phone, laptop);
		expect(forwards.index.projects).toEqual(backwards.index.projects);
		expect(Object.keys(forwards.defs).sort()).toEqual(Object.keys(backwards.defs).sort());
	});

	it('is stable when merged with itself', () => {
		const one = shelf([{ id: 'a', title: 'Garden', at: '2026-01-01T00:00:00Z' }]);
		expect(mergeLibraries(one, one).index.projects).toEqual(one.index.projects);
	});

	it('drops an index entry with no definition behind it', () => {
		// A phantom project would show in the picker and fail to open.
		const broken: LibraryBlob = {
			index: { projects: [{ id: 'ghost', title: 'Ghost', updatedAt: '2026-01-01T00:00:00Z' }], lastOpenedId: null },
			defs: {}
		};
		expect(mergeLibraries(broken, broken).index.projects).toEqual([]);
	});

	it('copes with an empty shelf on either side', () => {
		const empty: LibraryBlob = { index: { projects: [], lastOpenedId: null }, defs: {} };
		const one = shelf([{ id: 'a', title: 'Garden', at: '2026-01-01T00:00:00Z' }]);

		expect(mergeLibraries(empty, one).index.projects).toHaveLength(1);
		expect(mergeLibraries(one, empty).index.projects).toHaveLength(1);
		expect(mergeLibraries(empty, empty).index.projects).toEqual([]);
	});
});

describe('merging the index alone', () => {
	const index = (projects: [string, string][], last: string | null = null): ProjectIndex => ({
		projects: projects.map(([id, at]) => ({ id, title: id, updatedAt: at })),
		lastOpenedId: last
	});

	it('keeps this device on the project it was looking at', () => {
		const local = index([['a', '2026-01-01T00:00:00Z']], 'a');
		const remote = index([['b', '2026-01-02T00:00:00Z']], 'b');
		expect(mergeProjectIndexes(local, remote).lastOpenedId).toBe('a');
	});

	it('borrows the remote place only when this device has none', () => {
		const local = index([['a', '2026-01-01T00:00:00Z']], null);
		const remote = index([['b', '2026-01-02T00:00:00Z']], 'b');
		expect(mergeProjectIndexes(local, remote).lastOpenedId).toBe('b');
	});
});
