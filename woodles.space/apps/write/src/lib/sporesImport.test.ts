import { beforeEach, describe, expect, it } from 'vitest';
import {
	importSporesEntries,
	SPORES_SPELLBOOKS_KEY,
	SPORES_SPORES_KEY,
	SPORES_IMPORT_FLAG_KEY
} from './sporesImport';
import { bootstrap, listDrafts, loadDraft } from './drafts';

function spore(overrides: Record<string, unknown> = {}) {
	return {
		id: 'spore-1',
		title: 'Piranesi',
		body: 'A novel about a house that is also a world.',
		data: {},
		spellbookIds: [],
		tags: ['fiction'],
		created: '2026-07-01T00:00:00.000Z',
		updated: '2026-07-02T00:00:00.000Z',
		...overrides
	};
}

beforeEach(() => {
	localStorage.clear();
});

describe('importSporesEntries', () => {
	it('turns each spore into its own note draft, tagged from:spores', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore()]));

		const result = importSporesEntries([]);

		expect(result.count).toBe(1);
		expect(result.drafts).toEqual([
			{
				id: 'd-sp-spore-1',
				title: 'Piranesi',
				updatedAt: '2026-07-02T00:00:00.000Z',
				kind: 'note',
				tags: ['fiction', 'from:spores']
			}
		]);
		const body = loadDraft('d-sp-spore-1');
		expect(body?.layers?.foreground?.html).toBe(
			'<p>A novel about a house that is also a world.</p>'
		);
	});

	it('resolves [[wikilinks]] between spores in the same export into draft references', () => {
		localStorage.setItem(
			SPORES_SPORES_KEY,
			JSON.stringify([
				spore({ id: 'a', title: 'A', body: 'links to [[B]]' }),
				spore({ id: 'b', title: 'B', body: 'links back to [[A|the first one]]' })
			])
		);

		importSporesEntries([]);

		expect(loadDraft('d-sp-a')?.layers?.foreground?.html).toBe(
			'<p>links to <a data-ref-app="write" data-ref-kind="draft" data-ref-id="d-sp-b">B</a></p>'
		);
		expect(loadDraft('d-sp-b')?.layers?.foreground?.html).toBe(
			'<p>links back to <a data-ref-app="write" data-ref-kind="draft" data-ref-id="d-sp-a">the first one</a></p>'
		);
	});

	it('flattens a link to a title outside the export to plain text', () => {
		localStorage.setItem(
			SPORES_SPORES_KEY,
			JSON.stringify([spore({ body: 'a red link to [[Nowhere]]' })])
		);

		importSporesEntries([]);

		expect(loadDraft('d-sp-spore-1')?.layers?.foreground?.html).toBe('<p>a red link to Nowhere</p>');
	});

	it('carries an explicit status across', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore({ status: 'grown' })]));

		const result = importSporesEntries([]);

		expect(result.drafts[0].status).toBe('grown');
		expect(loadDraft('d-sp-spore-1')?.status).toBe('grown');
	});

	it('tags a spore with its spellbook memberships', () => {
		localStorage.setItem(SPORES_SPELLBOOKS_KEY, JSON.stringify([{ id: 'sb-1', title: 'Novels' }]));
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore({ spellbookIds: ['sb-1'] })]));

		const result = importSporesEntries([]);

		expect(result.drafts[0].tags).toEqual(['fiction', 'from:spores', 'spellbook:Novels']);
	});

	it('synthesizes a body from typed data when a spore has none — the worldbuilding case', () => {
		localStorage.setItem(
			SPORES_SPORES_KEY,
			JSON.stringify([
				spore({
					title: 'Marsh Lurker',
					body: '',
					data: { biome: 'the low marsh', loreFragment: 'older than the witch’s house' }
				})
			])
		);

		importSporesEntries([]);

		expect(loadDraft('d-sp-spore-1')?.layers?.foreground?.html).toBe(
			'<p>Biome: the low marsh</p><p>Lore fragment: older than the witch’s house</p>'
		);
	});

	it('drops flights and covers — no field for either in a draft', () => {
		localStorage.setItem(
			SPORES_SPORES_KEY,
			JSON.stringify([spore({ accent: 'rose', glyph: '✦', blurb: 'a hand-picked blurb' })])
		);

		importSporesEntries([]);

		const body = loadDraft('d-sp-spore-1');
		expect(body).not.toHaveProperty('accent');
		expect(body).not.toHaveProperty('glyph');
		expect(body).not.toHaveProperty('blurb');
	});

	it('leaves the spores document in place — retirement is non-destructive', () => {
		const stored = JSON.stringify([spore()]);
		localStorage.setItem(SPORES_SPORES_KEY, stored);

		importSporesEntries([]);

		expect(localStorage.getItem(SPORES_SPORES_KEY)).toBe(stored);
	});

	it('runs once — the flag stops a second visit from importing again', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore()]));

		const first = importSporesEntries([]);
		const second = importSporesEntries(first.drafts);

		expect(first.count).toBe(1);
		expect(second.count).toBe(0);
		expect(localStorage.getItem(SPORES_IMPORT_FLAG_KEY)).not.toBeNull();
	});

	it('dedupes by deterministic id even when the flag was lost', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore()]));

		const first = importSporesEntries([]);
		localStorage.removeItem(SPORES_IMPORT_FLAG_KEY);
		const second = importSporesEntries(first.drafts);

		expect(second.count).toBe(0);
		expect(second.drafts).toHaveLength(1);
	});

	it('skips a malformed spore without losing its neighbors', () => {
		localStorage.setItem(
			SPORES_SPORES_KEY,
			JSON.stringify([42, { tags: ['x'] }, spore({ id: 'ok', title: 'survivor' })])
		);

		const result = importSporesEntries([]);

		expect(result.count).toBe(1);
		expect(result.drafts[0].id).toBe('d-sp-ok');
	});

	it('imports nothing, quietly, when spores was never used', () => {
		const result = importSporesEntries([]);
		expect(result.count).toBe(0);
		expect(result.drafts).toEqual([]);
	});
});

describe('bootstrap with a retired spores', () => {
	it('brings spores into drafts without stealing the opening slot', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore()]));

		const boot = bootstrap();

		expect(boot.sporesImports).toBe(1);
		expect(boot.activeId).not.toBe('d-sp-spore-1');
		expect(boot.drafts.map((d) => d.id)).toContain('d-sp-spore-1');
		expect(listDrafts().map((d) => d.id)).toContain('d-sp-spore-1');
	});

	it('reports zero on every later load', () => {
		localStorage.setItem(SPORES_SPORES_KEY, JSON.stringify([spore()]));

		bootstrap();
		const again = bootstrap();

		expect(again.sporesImports).toBe(0);
		expect(again.drafts.filter((d) => d.id === 'd-sp-spore-1')).toHaveLength(1);
	});
});
