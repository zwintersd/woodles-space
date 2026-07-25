import { beforeEach, describe, expect, it } from 'vitest';
import { createHandoffQueue, sendHandoff } from '@woodles/handoff';
import { GardenStore } from './garden.svelte';

beforeEach(() => {
	localStorage.clear();
});

describe('GardenStore handoffs', () => {
	it('plants everything waiting as spores', () => {
		sendHandoff('spores', {
			title: 'photosynthesis',
			body: 'light into sugar',
			tags: ['biology'],
			source: { app: 'notebook' }
		});
		sendHandoff('spores', { title: 'chlorophyll', source: { app: 'notebook' } });

		const garden = new GardenStore();
		const grown = garden.ingestHandoffs();

		expect(grown).toHaveLength(2);
		expect(garden.spores.map((s) => s.title)).toEqual(['photosynthesis', 'chlorophyll']);
		expect(garden.spores[0].body).toBe('light into sugar');
	});

	it('records where each arrival came from, alongside its own tags', () => {
		sendHandoff('spores', {
			title: 'tagged',
			tags: ['biology'],
			source: { app: 'notebook' }
		});

		const garden = new GardenStore();
		garden.ingestHandoffs();

		expect(garden.spores[0].tags).toEqual(['biology', 'from:notebook']);
	});

	it('empties the queue, so a second visit does not plant duplicates', () => {
		sendHandoff('spores', { title: 'once', source: { app: 'write' } });

		const garden = new GardenStore();
		expect(garden.ingestHandoffs()).toHaveLength(1);
		expect(garden.pendingHandoffs()).toBe(0);
		expect(garden.ingestHandoffs()).toHaveLength(0);
		expect(garden.spores).toHaveLength(1);
	});

	it('persists an arrival immediately, not only on the next edit', () => {
		sendHandoff('spores', { title: 'durable', source: { app: 'notebook' } });

		new GardenStore().ingestHandoffs();

		// A fresh store reads localStorage on construction — if the arrival
		// hadn't been written, it would be gone on reload.
		expect(new GardenStore().spores.map((s) => s.title)).toEqual(['durable']);
	});

	it('flattens an html body into the plain text a spore body holds', () => {
		sendHandoff('spores', {
			body: '<p>first</p><p>second <em>bit</em></p>',
			format: 'html',
			source: { app: 'write' }
		});

		const garden = new GardenStore();
		garden.ingestHandoffs();

		expect(garden.spores[0].body).toBe('first\n\nsecond bit');
		// No title given, so the opening line becomes one.
		expect(garden.spores[0].title).toBe('first');
	});

	it('titles a wholly empty capture rather than dropping it', () => {
		sendHandoff('spores', { source: { app: 'notebook' } });

		const garden = new GardenStore();
		expect(garden.ingestHandoffs()).toHaveLength(1);
		expect(garden.spores[0].title).toBe('untitled');
	});

	it('hands a spore on to write with its tags and provenance', () => {
		const garden = new GardenStore();
		const spore = garden.addSpore({ title: 'wants prose', body: 'a seed', tags: ['essay'] });

		const result = garden.promoteSpore(spore.id, 'write');
		expect(result?.ok).toBe(true);

		const waiting = createHandoffQueue('write').peek();
		expect(waiting).toHaveLength(1);
		expect(waiting[0]).toMatchObject({
			title: 'wants prose',
			body: 'a seed',
			tags: ['essay'],
			source: { app: 'spores', label: 'wants prose' }
		});
	});

	it('reports nothing to promote for a spore that is gone', () => {
		expect(new GardenStore().promoteSpore('missing', 'write')).toBeNull();
	});

	it('does not let an arrival be mistaken for an empty first-run garden', () => {
		// maybeStartOnboarding only fires on an empty garden. An arrival plants
		// first, so the guided first cast can't open over the top of it.
		sendHandoff('spores', { title: 'arrived', source: { app: 'notebook' } });

		const garden = new GardenStore();
		garden.ingestHandoffs();
		garden.maybeStartOnboarding();

		expect(garden.showOnboarding).toBe(false);
	});
});
