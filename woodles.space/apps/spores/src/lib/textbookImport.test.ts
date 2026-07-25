import { beforeEach, describe, expect, it } from 'vitest';
import { GardenStore } from './garden.svelte';
import {
	TEXTBOOK_KEY,
	bodyToText,
	importTextbook,
	importTextbookOnce,
	readTextbook
} from './textbookImport';

beforeEach(() => {
	localStorage.clear();
});

const TEXTBOOK = {
	v: 1,
	last: 'photosynthesis',
	order: ['photosynthesis', 'chlorophyll'],
	entries: {
		photosynthesis: {
			id: 'photosynthesis',
			title: 'Photosynthesis',
			subject: 'biology',
			status: 'growing',
			accent: 'sage',
			glyph: '❀',
			body:
				'<p class="lede">Light becomes sugar.</p>' +
				'<p>The work is done by <a class="entry-link" data-entry="chlorophyll">the green pigment</a>.</p>',
			created: 1,
			updated: 2
		},
		chlorophyll: {
			id: 'chlorophyll',
			title: 'Chlorophyll',
			subject: 'biology',
			status: 'seed',
			body: '',
			created: 1,
			updated: 2
		}
	}
};

function stored(value: unknown) {
	return JSON.stringify(value);
}

describe('reading the blob', () => {
	it('ignores absent, unparseable, and shapeless data', () => {
		expect(readTextbook(null)).toBeNull();
		expect(readTextbook('not json')).toBeNull();
		expect(readTextbook('{}')).toBeNull();
		expect(readTextbook(stored({ entries: {}, order: [] }))).toBeNull();
	});

	it('drops an order entry with no body behind it', () => {
		const parsed = readTextbook(
			stored({ entries: { a: { title: 'A' } }, order: ['a', 'ghost'] })
		);
		expect(parsed?.order).toEqual(['a']);
	});

	it('rescues an entry that fell out of the order rather than losing it', () => {
		const parsed = readTextbook(
			stored({ entries: { a: { title: 'A' }, orphan: { title: 'Orphan' } }, order: ['a'] })
		);
		expect(parsed?.order).toEqual(['a', 'orphan']);
	});
});

describe('turning HTML into a spore body', () => {
	const titles = new Map([['chlorophyll', 'Chlorophyll']]);

	it('rewrites an internal link into a wikilink, keeping its display text', () => {
		const { text } = bodyToText(
			'work by <a class="entry-link" data-entry="chlorophyll">the green pigment</a>.',
			titles
		);
		expect(text).toBe('work by [[Chlorophyll|the green pigment]].');
	});

	it('uses a bare wikilink when the text already is the title', () => {
		const { text } = bodyToText('<a data-entry="chlorophyll">Chlorophyll</a>', titles);
		expect(text).toBe('[[Chlorophyll]]');
	});

	it('keeps a link whose entry is missing, and counts it', () => {
		const { text, dangling } = bodyToText('<a data-entry="gone">Lost Thing</a>', titles);
		expect(text).toBe('[[Lost Thing]]');
		expect(dangling).toBe(1);
	});

	it('keeps paragraph structure as blank lines', () => {
		const { text } = bodyToText('<p>one</p><p>two</p>', titles);
		expect(text).toBe('one\n\ntwo');
	});

	it('turns list items into dashes rather than running them together', () => {
		const { text } = bodyToText('<ul><li>first</li><li>second</li></ul>', titles);
		expect(text).toBe('— first\n\n— second');
	});

	it('decodes entities so text reads as it was written', () => {
		const { text } = bodyToText('<p>Ampersands &amp; &lt;brackets&gt;</p>', titles);
		expect(text).toBe('Ampersands & <brackets>');
	});

	it('drops markup the reader never typed', () => {
		const { text } = bodyToText('<p><strong>bold</strong> and <em>italic</em></p>', titles);
		expect(text).toBe('bold and italic');
	});
});

describe('folding the Textbook in', () => {
	it('gathers every entry into one spellbook, in reading order', () => {
		const garden = new GardenStore();
		const summary = importTextbook(garden, readTextbook(stored(TEXTBOOK))!);

		expect(summary.entries).toBe(2);
		expect(garden.spellbooks.map((b) => b.title)).toEqual(['Textbook']);
		expect(garden.spores.map((s) => s.title)).toEqual(['Photosynthesis', 'Chlorophyll']);
		for (const spore of garden.spores) {
			expect(spore.spellbookIds).toEqual([summary.spellbookId]);
		}
	});

	it('carries status and cover choices across', () => {
		const garden = new GardenStore();
		importTextbook(garden, readTextbook(stored(TEXTBOOK))!);

		const entry = garden.spores.find((s) => s.title === 'Photosynthesis')!;
		expect(entry.status).toBe('growing');
		expect(entry.accent).toBe('sage');
		expect(entry.glyph).toBe('❀');
		expect(garden.spores.find((s) => s.title === 'Chlorophyll')?.status).toBe('seed');
	});

	it('tags each entry with its subject alongside a textbook tag', () => {
		const garden = new GardenStore();
		importTextbook(garden, readTextbook(stored(TEXTBOOK))!);

		expect(garden.spores[0].tags).toEqual(['textbook', 'biology']);
	});

	it('leaves the links resolvable against the imported spores', () => {
		const garden = new GardenStore();
		importTextbook(garden, readTextbook(stored(TEXTBOOK))!);

		const entry = garden.spores.find((s) => s.title === 'Photosynthesis')!;
		const linked = garden.segmentsOf(entry).filter((s) => s.kind === 'link');
		expect(linked).toHaveLength(1);
		expect(linked[0]).toMatchObject({ sporeId: garden.spores[1].id });
	});

	it('gives the linked entry a backlink without storing one', () => {
		const garden = new GardenStore();
		importTextbook(garden, readTextbook(stored(TEXTBOOK))!);

		const chlorophyll = garden.spores.find((s) => s.title === 'Chlorophyll')!;
		expect(garden.backlinksOf(chlorophyll).map((s) => s.title)).toEqual(['Photosynthesis']);
	});

	it('defaults a status the export did not have rather than refusing it', () => {
		const garden = new GardenStore();
		importTextbook(
			garden,
			readTextbook(stored({ entries: { a: { title: 'A', body: 'x' } }, order: ['a'] }))!
		);
		expect(garden.spores[0].status).toBe('seed');
	});

	it('ignores an accent that is not one of the real names', () => {
		const garden = new GardenStore();
		importTextbook(
			garden,
			readTextbook(
				stored({ entries: { a: { title: 'A', accent: 'neon', body: '' } }, order: ['a'] })
			)!
		);
		expect(garden.spores[0].accent).toBeUndefined();
	});
});

describe('running it once', () => {
	it('imports from localStorage and marks itself done', () => {
		localStorage.setItem(TEXTBOOK_KEY, stored(TEXTBOOK));
		const garden = new GardenStore();

		expect(importTextbookOnce(garden)?.entries).toBe(2);
		expect(garden.settings.textbookImported).toBe(true);
	});

	it('never runs twice, so the Garden cannot silently double', () => {
		localStorage.setItem(TEXTBOOK_KEY, stored(TEXTBOOK));

		const first = new GardenStore();
		importTextbookOnce(first);
		const count = first.spores.length;

		const second = new GardenStore();
		expect(importTextbookOnce(second)).toBeNull();
		expect(second.spores).toHaveLength(count);
	});

	it('does nothing when there is no Textbook to fold in', () => {
		const garden = new GardenStore();
		expect(importTextbookOnce(garden)).toBeNull();
		expect(garden.settings.textbookImported).toBeUndefined();
	});
});
