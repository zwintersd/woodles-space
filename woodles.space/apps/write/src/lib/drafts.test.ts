import { beforeEach, describe, expect, it } from 'vitest';
import { sendHandoff } from '@woodles/handoff';
import {
	bootstrap,
	clearActiveDraftId,
	createDraftId,
	cycleDraftStatus,
	filterDrafts,
	getActiveDraftId,
	handoffToDraftBody,
	kindsPresent,
	listDrafts,
	loadDraft,
	migrateLegacyDraft,
	pendingHandoffs,
	removeDraftBody,
	saveDraft,
	setActiveDraftId,
	tagCounts,
	textToHtml,
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

	it('stores kind and tags when given', () => {
		const out = upsertIndex([], 'd-1', 'a story', t1, { kind: 'story', tags: ['fic'] });
		expect(out[0]).toEqual({ id: 'd-1', title: 'a story', updatedAt: t1, kind: 'story', tags: ['fic'] });
	});

	it('keeps an entry’s kind when a caller updates without extras', () => {
		const before = upsertIndex([], 'd-1', 'a story', t1, { kind: 'story' });
		const after = upsertIndex(before, 'd-1', 'renamed', t2);
		expect(after[0].kind).toBe('story');
	});
});

describe('filterDrafts + kindsPresent', () => {
	const list: DraftIndexItem[] = [
		{ id: 'd-1', title: 'to my sister', updatedAt: '3' },
		{ id: 'd-2', title: 'the lighthouse chapter', updatedAt: '2', kind: 'story' },
		{ id: 'd-3', title: '', updatedAt: '1', kind: 'note', tags: ['from:notebook', 'garden'] }
	];

	it('returns everything for a blank query and no kind', () => {
		expect(filterDrafts(list, '', null)).toHaveLength(3);
	});

	it('matches titles case-insensitively', () => {
		expect(filterDrafts(list, 'LIGHTHOUSE', null).map((d) => d.id)).toEqual(['d-2']);
	});

	it('matches tags, so a migrated capture stays findable without a title', () => {
		expect(filterDrafts(list, 'garden', null).map((d) => d.id)).toEqual(['d-3']);
	});

	it('filters by kind, reading a missing kind as letter', () => {
		expect(filterDrafts(list, '', 'letter').map((d) => d.id)).toEqual(['d-1']);
		expect(filterDrafts(list, '', 'story').map((d) => d.id)).toEqual(['d-2']);
	});

	it('combines query and kind', () => {
		expect(filterDrafts(list, 'lighthouse', 'note')).toHaveLength(0);
	});

	it('lists only the kinds present, in canonical order', () => {
		expect(kindsPresent(list)).toEqual(['letter', 'story', 'note']);
		expect(kindsPresent([])).toEqual([]);
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

describe('handoffs', () => {
	it('turns plain text into paragraphs, keeping soft breaks inside one', () => {
		expect(textToHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>');
		expect(textToHtml('   ')).toBe('');
	});

	it('escapes text so a thought about markup does not become markup', () => {
		expect(textToHtml('<script>alert(1)</script>')).toBe(
			'<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
		);
	});

	it('sanitizes an html body — it may be model output from two apps ago', () => {
		const body = handoffToDraftBody({
			id: 'h-1',
			target: 'write',
			title: 'risky',
			body: '<p>keep</p><script>alert(1)</script>',
			format: 'html',
			tags: [],
			source: { app: 'spores' },
			createdAt: '2026-07-25T00:00:00.000Z'
		});
		expect(body.layers?.foreground?.html).toContain('keep');
		expect(body.layers?.foreground?.html).not.toContain('script');
	});

	it('lands each arrival in its own draft, opening the newest', () => {
		sendHandoff('write', { title: 'first', body: 'a', source: { app: 'notebook' } });
		sendHandoff('write', { title: 'second', body: 'b', source: { app: 'spores' } });

		const boot = bootstrap();

		expect(boot.handoffs).toBe(2);
		expect(boot.body?.title).toBe('second');
		expect(boot.drafts.map((d) => d.title)).toContain('first');
		expect(boot.drafts.map((d) => d.title)).toContain('second');
		expect(getActiveDraftId()).toBe(boot.activeId);
	});

	it('carries a handoff’s tags onto the draft, so provenance stays searchable', () => {
		const body = handoffToDraftBody({
			id: 'h-2',
			target: 'write',
			title: 'tagged',
			body: 'words',
			format: 'text',
			tags: ['essay', 'from:spores'],
			source: { app: 'spores' },
			createdAt: '2026-07-25T00:00:00.000Z'
		});
		expect(body.tags).toEqual(['essay', 'from:spores']);
	});

	it('puts the arrival in the foreground layer, where writing starts', () => {
		sendHandoff('write', { title: 'note', body: 'some words', source: { app: 'notebook' } });

		const boot = bootstrap();
		expect(boot.body?.layers?.foreground?.html).toBe('<p>some words</p>');
	});

	it('does not re-open the same handoff on the next load', () => {
		sendHandoff('write', { title: 'once', body: 'x', source: { app: 'notebook' } });

		const first = bootstrap();
		expect(first.handoffs).toBe(1);
		expect(pendingHandoffs()).toBe(0);

		const second = bootstrap();
		expect(second.handoffs).toBe(0);
		expect(second.activeId).toBe(first.activeId);
		expect(listDrafts().filter((d) => d.title === 'once')).toHaveLength(1);
	});

	it('leaves an ordinary load untouched when nothing was sent', () => {
		setActiveDraftId('d-mine');
		saveDraft('d-mine', { title: 'mine' });
		writeIndex([{ id: 'd-mine', title: 'mine', updatedAt: '2026-01-01T00:00:00.000Z' }]);

		const boot = bootstrap();
		expect(boot.handoffs).toBe(0);
		expect(boot.activeId).toBe('d-mine');
		expect(boot.body?.title).toBe('mine');
	});
});

describe('cycleDraftStatus', () => {
	it('infers seed from an empty draft and advances to growing', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 'blank', updatedAt: 'x' }];
		saveDraft('d-1', { title: 'blank' });
		const out = cycleDraftStatus(list, 'd-1');
		expect(out[0].status).toBe('growing');
	});

	it('infers growing from a draft with words and advances to grown', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 'has words', updatedAt: 'x' }];
		saveDraft('d-1', { title: 'has words', layers: { foreground: { html: '<p>hi</p>' } } });
		const out = cycleDraftStatus(list, 'd-1');
		expect(out[0].status).toBe('grown');
	});

	it('advances an explicit status forward', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 't', updatedAt: 'x', status: 'seed' }];
		expect(cycleDraftStatus(list, 'd-1')[0].status).toBe('growing');
	});

	it('stays at grown', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 't', updatedAt: 'x', status: 'grown' }];
		expect(cycleDraftStatus(list, 'd-1')[0].status).toBe('grown');
	});

	it('persists the change to the index', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 't', updatedAt: 'x', status: 'seed' }];
		cycleDraftStatus(list, 'd-1');
		expect(listDrafts()[0].status).toBe('growing');
	});

	it('is a no-op for an id that is not in the list', () => {
		const list: DraftIndexItem[] = [{ id: 'd-1', title: 't', updatedAt: 'x' }];
		expect(cycleDraftStatus(list, 'd-missing')).toBe(list);
	});
});

describe('tagCounts', () => {
	it('aggregates case-insensitively, keeping the most common casing', () => {
		const list: DraftIndexItem[] = [
			{ id: 'd-1', title: 'a', updatedAt: 'x', tags: ['Fiction', 'draft'] },
			{ id: 'd-2', title: 'b', updatedAt: 'x', tags: ['fiction'] },
			{ id: 'd-3', title: 'c', updatedAt: 'x', tags: ['fiction'] }
		];
		expect(tagCounts(list)).toEqual([
			{ tag: 'fiction', count: 3 },
			{ tag: 'draft', count: 1 }
		]);
	});

	it('sorts ties alphabetically', () => {
		const list: DraftIndexItem[] = [
			{ id: 'd-1', title: 'a', updatedAt: 'x', tags: ['zeta'] },
			{ id: 'd-2', title: 'b', updatedAt: 'x', tags: ['alpha'] }
		];
		expect(tagCounts(list).map((t) => t.tag)).toEqual(['alpha', 'zeta']);
	});

	it('returns [] when nothing is tagged', () => {
		expect(tagCounts([{ id: 'd-1', title: 'a', updatedAt: 'x' }])).toEqual([]);
	});
});
