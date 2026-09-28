import { beforeEach, describe, expect, it } from 'vitest';
import { sendHandoff } from '@woodles/handoff';
import { moveHomeSuiteArtifactToTrash, listHomeSuiteTrash, restoreHomeSuiteArtifact, forgetHomeSuiteArtifact, HOMESUITE_TRASH_KEY } from '@shared/homesuiteTrash';
import { isHomeSuiteShellMessage, isHomeSuiteSurfaceMessage, HOMESUITE_CHANNEL } from '@shared/homesuiteBridge';
import { getActiveDraftId, setActiveDraftId } from '../../../write/src/lib/drafts';
import { boardLibrary } from '../../../whiteboard/src/lib/library';
import { listEverything, prepareSurfaceStorage, surfaceFor, surfaceForRef } from './surfaces';
import { HOMESUITE_RECENT_LIMIT, loadHomeSuiteRecent, readHomeSuiteRecent } from '@shared/homesuiteRecent.js';

const documents = surfaceFor('document')!;
const boards = surfaceFor('board')!;
const collections = surfaceFor('collection')!;

beforeEach(() => localStorage.clear());

describe('HomeSuite surfaces', () => {
	it('lists every kind newest first and leaves out what is in Trash', () => {
		const note = documents.create();
		const board = boards.create();
		const table = collections.create('blank');
		expect(listEverything().artifacts.map((item) => item.ref.id).sort()).toEqual([note.ref.id, board.ref.id, table.ref.id].sort());

		moveHomeSuiteArtifactToTrash({ ref: board.ref, kind: 'board', title: board.title, updatedAt: board.updatedAt });
		const { artifacts, trashed } = listEverything();
		expect(artifacts.map((item) => item.kind).sort()).toEqual(['collection', 'document']);
		expect(trashed.map((entry) => entry.ref.id)).toEqual([board.ref.id]);
	});

	it('republishes the homepage widget’s ledger on every listing, Trash left out', () => {
		documents.create();
		const board = boards.create();
		for (let i = 0; i < HOMESUITE_RECENT_LIMIT; i++) collections.create('blank');
		listEverything();
		const ledger = loadHomeSuiteRecent();
		expect(ledger?.counts).toEqual({ document: 1, board: 1, collection: HOMESUITE_RECENT_LIMIT });
		expect(ledger?.recent).toHaveLength(HOMESUITE_RECENT_LIMIT);

		moveHomeSuiteArtifactToTrash({ ref: board.ref, kind: 'board', title: board.title, updatedAt: board.updatedAt });
		listEverything();
		expect(loadHomeSuiteRecent()?.counts.board).toBe(0);
		expect(loadHomeSuiteRecent()?.recent.some((item) => item.id === board.ref.id)).toBe(false);
	});

	it('reads only a ledger it recognises', () => {
		expect(readHomeSuiteRecent(null)).toBeNull();
		expect(readHomeSuiteRecent({ version: 2, recent: [] })).toBeNull();
		const read = readHomeSuiteRecent({
			version: 1, publishedAt: 'x', counts: { document: -3, board: 'many' },
			recent: [{ kind: 'document', id: 'a', title: 'A', updatedAt: '2026-09-28' }, { kind: 'poem', id: 'b', title: 'B', updatedAt: '' }]
		});
		expect(read?.counts).toEqual({ document: 0, board: 0, collection: 0 });
		expect(read?.recent.map((item) => item.id)).toEqual(['a']);
	});

	it('creates without changing what Write and Whiteboard reopen on their own', () => {
		setActiveDraftId('draft-kept-open');
		boardLibrary.setActiveId('board-kept-open');
		documents.create();
		boards.create();
		expect(getActiveDraftId()).toBe('draft-kept-open');
		expect(boardLibrary.activeId()).toBe('board-kept-open');

		boardLibrary.clearActiveId();
		boards.create();
		expect(boardLibrary.activeId()).toBeNull();
	});

	it('names a new Collection after its template, and refuses one it does not offer', () => {
		expect(collections.create('living-world').title).toBe('Bestiary + Marginalia');
		expect(collections.create('blank').title).toBe('Untitled collection');
		expect(() => collections.create('no-such-shape')).toThrow(/not available/);
		expect(collections.templates?.map((template) => template.id)).toContain('living-world');
	});

	it('will not create a Collection over a library it cannot read', () => {
		localStorage.setItem('woodles.data.collections.v1', JSON.stringify({ woodles: 'woodles-persistence', schemaVersion: 99, savedAt: new Date().toISOString(), data: { collections: [] } }));
		expect(() => collections.create('blank')).toThrow(/Nothing was saved/);
		expect(collections.notice?.()).toMatch(/schema 99/);
	});

	it('maps an owning app’s ref back to the kind that shows it', () => {
		expect(surfaceForRef({ app: 'write', kind: 'draft', id: 'x' })?.kind).toBe('document');
		expect(surfaceForRef({ app: 'whiteboard', kind: 'board', id: 'x' })?.kind).toBe('board');
		expect(surfaceForRef({ app: 'data', kind: 'collection', id: 'x' })?.kind).toBe('collection');
		expect(surfaceForRef({ app: 'bestiary', kind: 'card', id: 'x' })).toBeUndefined();
	});

	it('announces what arrived from other apps while preparing the library', () => {
		expect(prepareSurfaceStorage()).toBeNull();
		sendHandoff('write', { title: 'a thought', body: 'kept', source: { app: 'notebook' } });
		expect(prepareSurfaceStorage()).toBe('One thing sent from another app is now a document.');
		expect(listEverything().artifacts.map((item) => item.title)).toEqual(['a thought']);
	});
});

describe('HomeSuite Trash', () => {
	const ref = { app: 'write', kind: 'draft', id: 'draft-1' };

	it('keeps identity and restores or forgets by ref', () => {
		moveHomeSuiteArtifactToTrash({ ref, kind: 'document', title: 'Note', updatedAt: '2026-09-27T00:00:00.000Z' });
		moveHomeSuiteArtifactToTrash({ ref, kind: 'document', title: 'Note again', updatedAt: '2026-09-27T00:00:00.000Z' });
		expect(listHomeSuiteTrash()).toHaveLength(1);
		restoreHomeSuiteArtifact(ref);
		expect(listHomeSuiteTrash()).toEqual([]);
		moveHomeSuiteArtifactToTrash({ ref, kind: 'document', title: 'Note', updatedAt: '2026-09-27T00:00:00.000Z' });
		forgetHomeSuiteArtifact(ref);
		expect(listHomeSuiteTrash()).toEqual([]);
	});

	it('ignores entries it cannot read', () => {
		localStorage.setItem(HOMESUITE_TRASH_KEY, JSON.stringify([{ ref, kind: 'spreadsheet', title: 'x', updatedAt: 'x', trashedAt: 'x' }, { nope: true }]));
		expect(listHomeSuiteTrash()).toEqual([]);
		localStorage.setItem(HOMESUITE_TRASH_KEY, '{broken');
		expect(listHomeSuiteTrash()).toEqual([]);
	});
});

describe('HomeSuite bridge', () => {
	it('accepts only its own channel, direction, and message types', () => {
		const surface = { channel: HOMESUITE_CHANNEL, source: 'surface' };
		for (const type of ['state', 'request-palette', 'request-rename', 'navigate', 'flushed']) {
			expect(isHomeSuiteSurfaceMessage({ ...surface, type })).toBe(true);
		}
		expect(isHomeSuiteSurfaceMessage({ ...surface, type: 'delete-everything' })).toBe(false);
		expect(isHomeSuiteSurfaceMessage({ ...surface, channel: 'someone.else' , type: 'state' })).toBe(false);
		expect(isHomeSuiteSurfaceMessage({ ...surface, source: 'shell', type: 'state' })).toBe(false);
		expect(isHomeSuiteShellMessage({ channel: HOMESUITE_CHANNEL, source: 'shell', type: 'action', action: 'flush' })).toBe(true);
		expect(isHomeSuiteShellMessage({ channel: HOMESUITE_CHANNEL, source: 'surface', type: 'action' })).toBe(false);
		expect(isHomeSuiteShellMessage(null)).toBe(false);
	});
});
