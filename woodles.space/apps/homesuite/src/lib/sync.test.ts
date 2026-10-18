import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listHomeSuiteTrash, moveHomeSuiteArtifactToTrash } from '@shared/homesuiteTrash';
import { listDrafts } from '../../../write/src/lib/drafts';
import { connect, disconnect, pushIfChanged, syncNow, syncState } from './sync.svelte';
import { HOMESUITE_SYNC_BASE_KEY } from './suiteSync';
import { listEverything, surfaceFor } from './surfaces';

const documents = surfaceFor('document')!;

/** /api/sync in memory: compare-and-swap, and keys handed back reordered like JSONB. */
function fakeServer() {
	const row = { blob: null as unknown, version: 0, pushes: 0 };
	const shuffle = (value: unknown): unknown => Array.isArray(value) ? value.map(shuffle)
		: value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, shuffle(v)])) : value;
	const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
	return {
		row,
		fetch: vi.fn(async (_url: string, init?: RequestInit) => {
			if (!init?.method || init.method === 'GET') return reply({ blob: shuffle(row.blob), version: row.version });
			const { blob, baseVersion } = JSON.parse(init.body as string);
			if (baseVersion !== row.version) return reply({ conflict: true, server: { blob: shuffle(row.blob), version: row.version } }, 409);
			row.blob = blob; row.version += 1; row.pushes += 1;
			return reply({ ok: true, version: row.version });
		})
	};
}

function snapshot(): Map<string, string> {
	const saved = new Map<string, string>();
	for (let i = 0; i < localStorage.length; i++) saved.set(localStorage.key(i)!, localStorage.getItem(localStorage.key(i)!)!);
	return saved;
}

function restore(saved: Map<string, string>): void {
	localStorage.clear();
	for (const [key, value] of saved) localStorage.setItem(key, value);
}

let server: ReturnType<typeof fakeServer>;

beforeEach(() => {
	localStorage.clear();
	server = fakeServer();
	vi.stubGlobal('fetch', server.fetch);
});

afterEach(() => {
	disconnect();
	vi.unstubAllGlobals();
});

describe('HomeSuite sync, through the sync client', () => {
	it('connects a phone and a computer with one passphrase, and keeps a trash move', async () => {
		const note = documents.create();
		await connect('pass');
		expect(syncState.errorMessage).toBeNull();
		expect(syncState.connected).toBe(true);
		const phone = snapshot();

		localStorage.clear();
		await connect('pass');
		expect(listEverything().artifacts.map((item) => item.ref.id)).toEqual([note.ref.id]);
		moveHomeSuiteArtifactToTrash({ ref: note.ref, kind: 'document', title: note.title, updatedAt: note.updatedAt });
		await pushIfChanged();

		restore(phone);
		await syncNow();
		expect(listHomeSuiteTrash().map((entry) => entry.ref.id)).toEqual([note.ref.id]);
		expect(listDrafts().map((entry) => entry.id)).toEqual([note.ref.id]);
	});

	it('pushes nothing when nothing changed, even with the keys reordered', async () => {
		documents.create();
		await connect('pass');
		const pushes = server.row.pushes;
		await syncNow();
		await syncNow();
		await pushIfChanged();
		expect(server.row.pushes).toBe(pushes);
	});

	it('forgets what it agreed on when disconnected, so a later connect only adds', async () => {
		documents.create();
		await connect('pass');
		expect(localStorage.getItem(HOMESUITE_SYNC_BASE_KEY)).not.toBeNull();
		disconnect();
		expect(localStorage.getItem(HOMESUITE_SYNC_BASE_KEY)).toBeNull();
	});
});
