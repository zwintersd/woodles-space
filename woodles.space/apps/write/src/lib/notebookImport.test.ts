import { beforeEach, describe, expect, it } from 'vitest';
import {
	importNotebookCaptures,
	NOTEBOOK_HANDOFF_KEY,
	NOTEBOOK_IMPORT_FLAG_KEY,
	NOTEBOOK_V3_KEY,
	NOTEBOOK_V3_BACKUP_KEY
} from './notebookImport';
import { bootstrap, listDrafts, loadDraft } from './drafts';

function envelope(data: unknown, savedAt = '2026-08-01T00:00:00.000Z') {
	return JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 3, savedAt, data });
}

function capture(overrides: Record<string, unknown> = {}) {
	return {
		id: 'cap-1',
		title: 'a thought',
		body: 'first line\n\nsecond paragraph',
		tags: ['inbox'],
		lane: 'spark',
		createdAt: '2026-07-01T00:00:00.000Z',
		updatedAt: '2026-07-02T00:00:00.000Z',
		...overrides
	};
}

beforeEach(() => {
	localStorage.clear();
});

describe('importNotebookCaptures', () => {
	it('turns each capture into its own note draft, body through textToHtml', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture()] })
		);

		const result = importNotebookCaptures([]);

		expect(result.count).toBe(1);
		expect(result.drafts).toEqual([
			{
				id: 'd-nb-cap-1',
				title: 'a thought',
				updatedAt: '2026-07-02T00:00:00.000Z',
				kind: 'note',
				tags: ['inbox']
			}
		]);
		const body = loadDraft('d-nb-cap-1');
		expect(body?.kind).toBe('note');
		expect(body?.layers?.foreground?.html).toBe('<p>first line</p><p>second paragraph</p>');
	});

	it('leaves the notebook document in place — retirement is non-destructive', () => {
		const stored = envelope({ selectedId: 'cap-1', captures: [capture()] });
		localStorage.setItem(NOTEBOOK_V3_KEY, stored);

		importNotebookCaptures([]);

		expect(localStorage.getItem(NOTEBOOK_V3_KEY)).toBe(stored);
	});

	it('runs once — the flag stops a second visit from importing again', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture()] })
		);

		const first = importNotebookCaptures([]);
		const second = importNotebookCaptures(first.drafts);

		expect(first.count).toBe(1);
		expect(second.count).toBe(0);
		expect(localStorage.getItem(NOTEBOOK_IMPORT_FLAG_KEY)).not.toBeNull();
	});

	it('dedupes by deterministic id even when the flag was lost', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture()] })
		);

		const first = importNotebookCaptures([]);
		localStorage.removeItem(NOTEBOOK_IMPORT_FLAG_KEY);
		const second = importNotebookCaptures(first.drafts);

		expect(second.count).toBe(0);
		expect(second.drafts).toHaveLength(1);
	});

	it('skips the untouched starter capture — an empty Home nobody wrote', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({
				selectedId: 'capture-home',
				captures: [capture({ id: 'capture-home', title: 'Home', body: '', tags: ['inbox'] })]
			})
		);

		expect(importNotebookCaptures([]).count).toBe(0);
	});

	it('keeps a starter capture that was actually written in', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({
				selectedId: 'capture-home',
				captures: [capture({ id: 'capture-home', title: 'Home', body: 'real words' })]
			})
		);

		expect(importNotebookCaptures([]).count).toBe(1);
	});

	it('drains the stranded handoff queue and removes that key alone', () => {
		localStorage.setItem(
			NOTEBOOK_HANDOFF_KEY,
			JSON.stringify({
				woodles: 'woodles-persistence',
				schemaVersion: 1,
				savedAt: '2026-08-01T00:00:00.000Z',
				data: {
					items: [
						{
							id: 'h-stray',
							target: 'notebook',
							title: 'sent toward a closed door',
							body: 'still worth keeping',
							format: 'text',
							tags: [],
							source: { app: 'spores' },
							createdAt: '2026-07-30T00:00:00.000Z'
						}
					]
				}
			})
		);

		const result = importNotebookCaptures([]);

		expect(result.count).toBe(1);
		expect(result.drafts[0].title).toBe('sent toward a closed door');
		expect(localStorage.getItem(NOTEBOOK_HANDOFF_KEY)).toBeNull();
	});

	it('falls back to the backup document when the primary is corrupt', () => {
		localStorage.setItem(NOTEBOOK_V3_KEY, '{not json');
		localStorage.setItem(
			NOTEBOOK_V3_BACKUP_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture({ title: 'from backup' })] })
		);

		const result = importNotebookCaptures([]);

		expect(result.count).toBe(1);
		expect(result.drafts[0].title).toBe('from backup');
	});

	it('imports nothing, quietly, when notebook was never used', () => {
		const result = importNotebookCaptures([]);
		expect(result.count).toBe(0);
		expect(result.drafts).toEqual([]);
	});

	it('skips a malformed capture without losing its neighbors', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({
				selectedId: 'cap-1',
				captures: [42, { lane: 'spark' }, capture({ id: 'cap-ok', title: 'survivor' })]
			})
		);

		const result = importNotebookCaptures([]);

		expect(result.count).toBe(1);
		expect(result.drafts[0].id).toBe('d-nb-cap-ok');
	});
});

describe('bootstrap with a retired notebook', () => {
	it('brings captures into drafts without stealing the opening slot', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture()] })
		);

		const boot = bootstrap();

		expect(boot.notebookImports).toBe(1);
		// The active draft is the fresh empty one, not the imported archive.
		expect(boot.activeId).not.toBe('d-nb-cap-1');
		expect(boot.drafts.map((d) => d.id)).toContain('d-nb-cap-1');
		expect(listDrafts().map((d) => d.id)).toContain('d-nb-cap-1');
	});

	it('reports zero on every later load', () => {
		localStorage.setItem(
			NOTEBOOK_V3_KEY,
			envelope({ selectedId: 'cap-1', captures: [capture()] })
		);

		bootstrap();
		const again = bootstrap();

		expect(again.notebookImports).toBe(0);
		expect(again.drafts.filter((d) => d.id === 'd-nb-cap-1')).toHaveLength(1);
	});
});
