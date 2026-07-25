import { beforeEach, describe, expect, it } from 'vitest';
import { GardenStore } from './garden.svelte';
import {
	DEVLOG_KEY,
	importDevlogEntries,
	importDevlogOnce,
	readDevlogEntries
} from './devlogImport';

beforeEach(() => {
	localStorage.clear();
});

const ENTRY = {
	id: 'e1',
	date: '2026-03-04',
	title: 'the drifting week',
	createdAt: '2026-03-04T00:00:00.000Z',
	updatedAt: '2026-03-04T00:00:00.000Z',
	blocks: [
		{ type: 'prose', id: 'p1', content: 'first thought' },
		{ type: 'prose', id: 'p2', content: 'second thought' },
		{
			type: 'creature',
			id: 'c1',
			name: 'Driftling',
			biome: { kind: 'biome', label: 'Saltmarsh' },
			loreFragment: 'it drifts',
			interventionBehavior: 'scatters',
			visualNotes: 'pale',
			relationships: 'follows tides'
		},
		{
			type: 'biome',
			id: 'b1',
			name: 'Saltmarsh',
			hexGridPosition: '2,3',
			climateMood: 'brackish',
			nativeCreatures: [{ kind: 'creature', label: 'Driftling' }],
			mechanicExpression: 'movement costs double',
			atmosphereNotes: 'low light'
		}
	]
};

function devlog(entries: unknown[]) {
	return JSON.stringify({ entries });
}

describe('reading the export', () => {
	it('ignores absent, unparseable, and shapeless data', () => {
		expect(readDevlogEntries(null)).toBeNull();
		expect(readDevlogEntries('not json')).toBeNull();
		expect(readDevlogEntries('{}')).toBeNull();
		expect(readDevlogEntries(devlog([]))).toBeNull();
	});

	it('accepts a well-formed export', () => {
		expect(readDevlogEntries(devlog([ENTRY]))).toHaveLength(1);
	});
});

describe('folding the Dev Log in', () => {
	it('gathers everything into one spellbook', () => {
		const garden = new GardenStore();
		const summary = importDevlogEntries(garden, [ENTRY]);

		expect(garden.spellbooks).toHaveLength(1);
		expect(garden.spellbooks[0].title).toBe('Dev Log');
		expect(summary.spellbookId).toBe(garden.spellbooks[0].id);
		for (const spore of garden.spores) {
			expect(spore.spellbookIds).toEqual([garden.spellbooks[0].id]);
		}
	});

	it('makes one spore per entry, with its prose as the body', () => {
		const garden = new GardenStore();
		const summary = importDevlogEntries(garden, [ENTRY]);

		expect(summary.entries).toBe(1);
		const entry = garden.spores.find((s) => s.data.kind === 'devlog-entry');
		expect(entry?.title).toBe('the drifting week');
		expect(entry?.body).toBe('first thought\n\nsecond thought');
		expect(entry?.data.date).toBe('2026-03-04');
		expect(entry?.tags).toEqual(['devlog']);
	});

	it('makes one spore per typed block, keeping its fields as data', () => {
		const garden = new GardenStore();
		const summary = importDevlogEntries(garden, [ENTRY]);

		expect(summary.records).toBe(2);
		const creature = garden.spores.find((s) => s.title === 'Driftling');
		expect(creature?.data).toMatchObject({
			kind: 'creature',
			loreFragment: 'it drifts',
			interventionBehavior: 'scatters'
		});
		expect(creature?.tags).toEqual(['devlog', 'creature']);
	});

	it('does not make a spore for prose — a spore already has a body', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [ENTRY]);

		expect(garden.spores.some((s) => s.data.kind === 'prose')).toBe(false);
	});

	it('links each entry to the blocks it contained', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [ENTRY]);

		const entry = garden.spores.find((s) => s.data.kind === 'devlog-entry');
		const linked = garden.linkedSpores(entry!.id).map((l) => l.spore.title);
		expect(linked.sort()).toEqual(['Driftling', 'Saltmarsh']);
	});

	it('turns smart links into flights between the blocks themselves', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [ENTRY]);

		const creature = garden.spores.find((s) => s.title === 'Driftling')!;
		const biome = garden.spores.find((s) => s.title === 'Saltmarsh')!;
		const between = garden.flights.filter(
			(f) =>
				(f.from === creature.id && f.to === biome.id) ||
				(f.from === biome.id && f.to === creature.id)
		);
		// One edge, not two — the pair links each other and addFlight dedupes.
		expect(between).toHaveLength(1);
	});

	it('resolves a smart link pointing forward to a later entry', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [
			{
				id: 'e1',
				date: '2026-01-01',
				title: 'first',
				blocks: [
					{ type: 'ability', id: 'a1', name: 'Tidecall', tiedTo: [{ kind: 'stat', label: 'Poise' }] }
				]
			},
			{
				id: 'e2',
				date: '2026-01-02',
				title: 'second',
				blocks: [{ type: 'stat', id: 's1', name: 'Poise', narrativeMeaning: 'steadiness' }]
			}
		]);

		const ability = garden.spores.find((s) => s.title === 'Tidecall')!;
		expect(garden.linkedSpores(ability.id).map((l) => l.spore.title)).toContain('Poise');
	});

	it('counts a link naming a block that was never exported, rather than failing', () => {
		const garden = new GardenStore();
		const summary = importDevlogEntries(garden, [
			{
				id: 'e1',
				date: '2026-01-01',
				title: 'dangling',
				blocks: [
					{ type: 'creature', id: 'c1', name: 'Ghost', biome: { kind: 'biome', label: 'Nowhere' } }
				]
			}
		]);

		expect(summary.unresolvedLinks).toBe(1);
		expect(summary.records).toBe(1);
	});

	it('keeps a lore block’s text as the body, where it can be read', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [
			{
				id: 'e1',
				date: '2026-01-01',
				title: 'lore',
				blocks: [{ type: 'lore', id: 'l1', title: 'The Drowned Bell', content: 'it still rings' }]
			}
		]);

		const lore = garden.spores.find((s) => s.title === 'The Drowned Bell');
		expect(lore?.body).toBe('it still rings');
	});

	it('names an untitled entry by its date rather than leaving it blank', () => {
		const garden = new GardenStore();
		importDevlogEntries(garden, [{ id: 'e1', date: '2026-05-06', title: '', blocks: [] }]);

		expect(garden.spores[0].title).toBe('Dev Log — 2026-05-06');
	});

	it('skips block types it does not recognize instead of importing junk', () => {
		const garden = new GardenStore();
		const summary = importDevlogEntries(garden, [
			{ id: 'e1', date: '2026-01-01', title: 'mixed', blocks: [{ type: 'nonsense', id: 'x' }] }
		]);

		expect(summary.records).toBe(0);
		expect(garden.spores).toHaveLength(1);
	});
});

describe('running it once', () => {
	it('imports from localStorage and marks itself done', () => {
		localStorage.setItem(DEVLOG_KEY, devlog([ENTRY]));
		const garden = new GardenStore();

		const summary = importDevlogOnce(garden);
		expect(summary?.entries).toBe(1);
		expect(garden.settings.devlogImported).toBe(true);
	});

	it('never runs twice, so the Garden cannot silently double', () => {
		localStorage.setItem(DEVLOG_KEY, devlog([ENTRY]));

		const first = new GardenStore();
		importDevlogOnce(first);
		const countAfterFirst = first.spores.length;

		// A fresh store reads the persisted settings flag.
		const second = new GardenStore();
		expect(importDevlogOnce(second)).toBeNull();
		expect(second.spores).toHaveLength(countAfterFirst);
	});

	it('does nothing when there is no Dev Log to fold in', () => {
		const garden = new GardenStore();
		expect(importDevlogOnce(garden)).toBeNull();
		expect(garden.spores).toEqual([]);
		// Nothing was imported, so a later export still gets its chance.
		expect(garden.settings.devlogImported).toBeUndefined();
	});
});
