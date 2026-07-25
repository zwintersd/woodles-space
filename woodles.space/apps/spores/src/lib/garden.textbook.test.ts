import { beforeEach, describe, expect, it } from 'vitest';
import { GardenStore } from './garden.svelte';

beforeEach(() => {
	localStorage.clear();
});

describe('following a link', () => {
	it('returns the spore that already answers to that title', () => {
		const garden = new GardenStore();
		const moss = garden.addSpore({ title: 'Moss' });

		expect(garden.followLink('Moss').id).toBe(moss.id);
		expect(garden.followLink('  moss  ').id).toBe(moss.id);
		expect(garden.spores).toHaveLength(1);
	});

	it('sows a seed when nothing answers yet — a red link is an invitation', () => {
		const garden = new GardenStore();

		const grown = garden.followLink('Lichen');
		expect(grown.title).toBe('Lichen');
		expect(grown.status).toBe('seed');
		expect(grown.body).toBe('');
		expect(garden.spores).toHaveLength(1);
	});

	it('sows the seed onto the same shelf as the entry that wanted it', () => {
		const garden = new GardenStore();
		const book = garden.addSpellbook('Botany', 'plain');
		const from = garden.addSpore({ title: 'Moss', spellbookIds: [book.id] });

		expect(garden.followLink('Lichen', { from }).spellbookIds).toEqual([book.id]);
	});

	it('persists the seed immediately, not only on the next edit', () => {
		const garden = new GardenStore();
		garden.followLink('Lichen');

		expect(new GardenStore().spores.map((s) => s.title)).toEqual(['Lichen']);
	});
});

describe('sowing from a selection', () => {
	it('plants the link where the phrase was, and returns the new seed', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Bog', body: 'the green stuff on rocks' });

		const seed = garden.sowFromSelection(spore.id, 'green stuff', 'Moss');

		expect(seed?.title).toBe('Moss');
		expect(garden.spores.find((s) => s.id === spore.id)?.body).toBe(
			'the [[Moss|green stuff]] on rocks'
		);
	});

	it('titles the seed after the phrase when no title is given', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Bog', body: 'I saw Moss today' });

		expect(garden.sowFromSelection(spore.id, 'Moss')?.title).toBe('Moss');
		expect(garden.spores.find((s) => s.id === spore.id)?.body).toBe('I saw [[Moss]] today');
	});

	it('reuses an existing spore rather than making a second of the same title', () => {
		const garden = new GardenStore();
		const moss = garden.addSpore({ title: 'Moss' });
		const bog = garden.addSpore({ title: 'Bog', body: 'the Moss again' });

		expect(garden.sowFromSelection(bog.id, 'Moss')?.id).toBe(moss.id);
		expect(garden.spores).toHaveLength(2);
	});

	it('declines an empty phrase or a spore that is gone', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Bog', body: 'words' });

		expect(garden.sowFromSelection(spore.id, '   ')).toBeNull();
		expect(garden.sowFromSelection('missing', 'words')).toBeNull();
		expect(garden.spores).toHaveLength(1);
	});

	it('still sows when the phrase is not in the body, without corrupting it', () => {
		// The selection can go stale between highlight and click. Losing the
		// planted link is acceptable; losing the seed is not.
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Bog', body: 'words' });

		expect(garden.sowFromSelection(spore.id, 'absent')?.title).toBe('absent');
		expect(garden.spores.find((s) => s.id === spore.id)?.body).toBe('words');
	});
});

describe('status through the store', () => {
	it('advances forward only and persists each step', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Moss' });

		expect(garden.statusOf(spore)).toBe('seed');
		garden.advanceStatus(spore.id);
		expect(garden.statusOf(garden.spores[0])).toBe('growing');
		garden.advanceStatus(spore.id);
		garden.advanceStatus(spore.id);
		expect(garden.statusOf(garden.spores[0])).toBe('grown');
		expect(new GardenStore().spores[0].status).toBe('grown');
	});

	it('lets a status be set directly, for going back', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Moss', status: 'grown' });

		garden.setStatus(spore.id, 'growing');
		expect(garden.statusOf(garden.spores[0])).toBe('growing');
	});

	it('starts a new spore as a seed', () => {
		const garden = new GardenStore();
		expect(garden.addSpore({ title: 'Fresh' }).status).toBe('seed');
	});

	it('ignores an id that is gone', () => {
		const garden = new GardenStore();
		expect(() => garden.advanceStatus('missing')).not.toThrow();
	});
});

describe('covers through the store', () => {
	it('stores a chosen cover and persists it', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'Moss' });

		garden.setCover(spore.id, { accent: 'plum', glyph: '❀', blurb: 'the green one' });

		const saved = new GardenStore().spores[0];
		expect(saved.accent).toBe('plum');
		expect(saved.glyph).toBe('❀');
		expect(saved.blurb).toBe('the green one');
	});
});

describe('backlinks through the store', () => {
	it('derives them across the whole garden', () => {
		const garden = new GardenStore();
		const moss = garden.addSpore({ title: 'Moss' });
		garden.addSpore({ title: 'Fern', body: 'grows near [[Moss]]' });
		garden.addSpore({ title: 'Stone', body: 'nothing' });

		expect(garden.backlinksOf(moss).map((s) => s.title)).toEqual(['Fern']);
	});

	it('follows a rename on the next read, since nothing is stored', () => {
		const garden = new GardenStore();
		const moss = garden.addSpore({ title: 'Moss' });
		garden.addSpore({ title: 'Fern', body: 'near [[Moss]]' });

		garden.updateSpore(moss.id, { title: 'Bryophyte' });

		// The link now points at a title nothing answers to — it became a red
		// link rather than silently following the rename. That is the honest
		// outcome for text the person wrote and still owns.
		expect(garden.backlinksOf(garden.spores[0])).toEqual([]);
		const fern = garden.spores[1];
		expect(garden.segmentsOf(fern).filter((s) => s.kind === 'link')[0]).toMatchObject({
			sporeId: null
		});
	});
});
