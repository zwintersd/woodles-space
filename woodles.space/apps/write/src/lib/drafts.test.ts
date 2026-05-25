import { beforeEach, describe, expect, it } from 'vitest';
import {
	bootstrap,
	clearActiveDraftId,
	createDraftId,
	getActiveDraftId,
	listDrafts,
	loadDraft,
	migrateLegacyDraft,
	removeDraftBody,
	saveDraft,
	setActiveDraftId,
	upsertIndex,
	writeIndex,
	type DraftBody,
	type DraftIndexItem
} from './drafts';

const KEY_INDEX = 'woodles_drafts_index';
const KEY_ACTIVE = 'woodles_active_draft_id';
const PREFIX = 'woodles_draft_';
const KEY_LEGACY = 'woodles_write_draft';

beforeEach(() => {
	localStorage.clear();
});

describe('createDraftId', () => {
	it('always emits a "d-" prefix', () => {
		expect(createDraftId().startsWith('d-')).toBe(true);
	});
	it('produces distinct ids across calls (separated in time)', async () => {
		const a = createDraftId();
		await new Promise((r) => setTimeout(r, 4));
		const b = createDraftId();
		expect(a).not.toBe(b);
	});
});

describe('listDrafts', () => {
	it('returns [] when nothing is stored', () => {
		expect(listDrafts()).toEqual([]);
	});
	it('parses an existing index', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 't', updatedAt: 'x' }];
		localStorage.setItem(KEY_INDEX, JSON.stringify(list));
		expect(listDrafts()).toEqual(list);
	});
	it('returns [] on a malformed index', () => {
		localStorage.setItem(KEY_INDEX, '{not json');
		expect(listDrafts()).toEqual([]);
	});
	it('returns [] when the stored index is not an array', () => {
		localStorage.setItem(KEY_INDEX, JSON.stringify({ id: 'x' }));
		expect(listDrafts()).toEqual([]);
	});
});

describe('saveDraft + loadDraft', () => {
	it('roundtrips a body', () => {
		const body: DraftBody = { title: 'hi', layers: { foreground: { html: '<p>x</p>' } } };
		saveDraft('d-1', body);
		expect(loadDraft('d-1')).toEqual(body);
	});
	it('returns null for a missing draft', () => {
		expect(loadDraft('d-missing')).toBeNull();
	});
	it('returns null on a malformed body', () => {
		localStorage.setItem(PREFIX + 'd-bad', '{not json');
		expect(loadDraft('d-bad')).toBeNull();
	});
});

describe('removeDraftBody', () => {
	it('removes only the body, not the index entry', () => {
		writeIndex([{ id: 'd-1', title: 't', updatedAt: 'x' }]);
		saveDraft('d-1', { title: 't' });
		removeDraftBody('d-1');
		expect(loadDraft('d-1')).toBeNull();
		expect(listDrafts()).toHaveLength(1);
	});
});

describe('active draft id', () => {
	it('roundtrips set/get/clear', () => {
		expect(getActiveDraftId()).toBeNull();
		setActiveDraftId('d-active');
		expect(getActiveDraftId()).toBe('d-active');
		clearActiveDraftId();
		expect(getActiveDraftId()).toBeNull();
	});
});

describe('upsertIndex', () => {
	const t1 = '2024-01-01T00:00:00.000Z';
	const t2 = '2024-01-02T00:00:00.000Z';
	it('appends a new entry', () => {
		const out = upsertIndex([], 'd-1', 'first', t1);
		expect(out).toEqual([{ id: 'd-1', title: 'first', updatedAt: t1 }]);
	});
	it('updates title/updatedAt for an existing id', () => {
		const before: DraftIndexItem[] = [{ id: 'd-1', title: 'old', updatedAt: t1 }];
		const after = upsertIndex(before, 'd-1', 'new', t2);
		expect(after).toEqual([{ id: 'd-1', title: 'new', updatedAt: t2 }]);
	});
	it('does not mutate the input array', () => {
		const before: DraftIndexItem[] = [{ id: 'd-1', title: 'old', updatedAt: t1 }];
		upsertIndex(before, 'd-1', 'new', t2);
		expect(before[0].title).toBe('old');
	});
});

describe('migrateLegacyDraft', () => {
	it('returns null when no legacy key is set', () => {
		expect(migrateLegacyDraft()).toBeNull();
	});
	it('promotes the legacy single-draft body to an indexed slot', () => {
		const legacy = { title: 'Letter X', savedAt: '2024-05-01T00:00:00.000Z' };
		localStorage.setItem(KEY_LEGACY, JSON.stringify(legacy));
		const out = migrateLegacyDraft();
		expect(out).not.toBeNull();
		expect(out!.entry.title).toBe('Letter X');
		expect(out!.entry.updatedAt).toBe('2024-05-01T00:00:00.000Z');
		expect(loadDraft(out!.id)).toEqual(legacy);
		expect(localStorage.getItem(KEY_LEGACY)).toBeNull();
	});
	it('uses "untitled" + now for a body missing fields', () => {
		localStorage.setItem(KEY_LEGACY, JSON.stringify({}));
		const out = migrateLegacyDraft();
		expect(out!.entry.title).toBe('untitled');
		expect(out!.entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});

describe('bootstrap', () => {
	it('creates an empty draft when nothing is stored', () => {
		const boot = bootstrap();
		expect(boot.drafts).toHaveLength(1);
		expect(boot.activeId).toBe(boot.drafts[0].id);
		expect(boot.body).toBeNull();
		// state is persisted
		expect(getActiveDraftId()).toBe(boot.activeId);
		expect(listDrafts()).toHaveLength(1);
	});

	it('reads an existing active draft + body', () => {
		writeIndex([{ id: 'd-old', title: 'kept', updatedAt: '2024-01-01' }]);
		setActiveDraftId('d-old');
		saveDraft('d-old', { title: 'kept', content: '<p>hi</p>' });
		const boot = bootstrap();
		expect(boot.activeId).toBe('d-old');
		expect(boot.drafts.map((d) => d.id)).toEqual(['d-old']);
		expect(boot.body?.title).toBe('kept');
	});

	it('migrates a legacy single-draft when no active id is set', () => {
		localStorage.setItem(
			KEY_LEGACY,
			JSON.stringify({ title: 'legacy', savedAt: '2024-01-01T00:00:00.000Z' })
		);
		const boot = bootstrap();
		expect(boot.drafts).toHaveLength(1);
		expect(boot.drafts[0].title).toBe('legacy');
		expect(boot.body?.title).toBe('legacy');
		expect(localStorage.getItem(KEY_LEGACY)).toBeNull();
	});
});
