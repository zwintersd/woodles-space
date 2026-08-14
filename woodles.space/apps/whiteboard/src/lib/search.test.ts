import { describe, expect, it } from 'vitest';
import { excerpt, hitsBounds, itemsWithLabel, parseQuery, searchBoard } from './search';
import { labelItems } from './labels';
import { setItemProperty } from './properties';
import { createCard, createConnector, createEmptyBoard, createFrame, createImage, type WhiteboardDocument } from './model';

function board(): WhiteboardDocument {
	return {
		...createEmptyBoard(),
		items: [
			{ ...createCard(0, 0), id: 'pickup', title: 'Brush pickup physics', body: 'How much product a brush lifts.' },
			{ ...createCard(400, 0), id: 'blend', title: 'Foundation blending', body: 'Stippling beats dragging for coverage.' },
			{ ...createFrame(0, 0, 900, 600), id: 'brushes', title: 'Brushes' },
			{ ...createImage(1200, 0, 'asset-1', 'brush-chart.png', 1.4), id: 'chart' },
			createConnector('pickup', 'blend')
		]
	};
}

describe('finding things', () => {
	it('finds a card by its title', () => {
		const hits = searchBoard(board(), 'pickup');
		expect(hits[0].item.id).toBe('pickup');
		expect(hits[0].field).toBe('title');
	});

	it('finds a card by words in its body, and says which words', () => {
		const hits = searchBoard(board(), 'stippling');
		expect(hits[0].item.id).toBe('blend');
		expect(hits[0].field).toBe('body');
		expect(hits[0].snippet).toContain('Stippling');
	});

	it('finds a frame and an image by name', () => {
		expect(searchBoard(board(), 'brushes')[0].item.id).toBe('brushes');
		expect(searchBoard(board(), 'chart.png')[0].item.id).toBe('chart');
	});

	it('never returns a connector, which has nothing to say and nowhere to go', () => {
		const document = { ...board(), items: board().items.map((item) => item) };
		expect(searchBoard(document, 'e').every((hit) => hit.item.type !== 'connector')).toBe(true);
	});

	it('has nothing to say about an empty query', () => {
		expect(searchBoard(board(), '')).toEqual([]);
		expect(searchBoard(board(), '   ')).toEqual([]);
	});
});

describe('finding things by label', () => {
	it('finds a card by a label it wears, not just by its words', () => {
		const document = labelItems(board(), ['pickup', 'chart'], 'physics');
		const hits = searchBoard(document, 'physics');
		expect(hits.map((hit) => hit.item.id).sort()).toEqual(['chart', 'pickup']);
		// The image says nothing about physics; the label is the whole reason it is here.
		expect(hits.find((hit) => hit.item.id === 'chart')!.field).toBe('label');
	});

	it('narrows to labels alone when the query is written with a hash', () => {
		const document = labelItems(board(), ['chart'], 'physics');
		const hits = searchBoard(document, '#physics');
		expect(hits.map((hit) => hit.item.id)).toEqual(['chart']);
		// "physics" is in the pickup card's title, but this query was about labels.
		expect(hits.every((hit) => hit.field === 'label')).toBe(true);
	});

	it('carries the labels a result wears, so a hit can show them', () => {
		const document = labelItems(board(), ['pickup'], 'physics');
		expect(searchBoard(document, 'pickup')[0].labels.map((label) => label.name)).toEqual(['physics']);
	});

	it('reads a hash query as a label name however it was typed', () => {
		expect(parseQuery('#Brush Pickup')).toEqual({ text: 'brush pickup', labelOnly: true });
		expect(parseQuery('brush')).toEqual({ text: 'brush', labelOnly: false });
	});

	it('gathers everything wearing a label', () => {
		const document = labelItems(board(), ['pickup', 'brushes'], 'physics');
		expect(itemsWithLabel(document, document.labels[0].id).map((item) => item.id).sort()).toEqual(['brushes', 'pickup']);
	});
});

describe('finding things by what was said about them', () => {
	it('finds a card by its type, status, or source', () => {
		let document = setItemProperty(board(), 'pickup', 'kind', 'question');
		document = setItemProperty(document, 'blend', 'status', 'doing');
		document = setItemProperty(document, 'chart', 'source', 'https://example.com/brush-study');

		expect(searchBoard(document, 'question')[0].item.id).toBe('pickup');
		expect(searchBoard(document, 'doing')[0].item.id).toBe('blend');
		expect(searchBoard(document, 'brush-study')[0].item.id).toBe('chart');
	});
});

describe('ranking', () => {
	it('puts a title match above a body match', () => {
		const hits = searchBoard(board(), 'brush');
		expect(hits[0].item.id).not.toBe('pickup');
		const pickupHit = hits.find((hit) => hit.item.id === 'pickup')!;
		const bodyOnly = hits.find((hit) => hit.field === 'body');
		expect(pickupHit.score).toBeGreaterThan(bodyOnly?.score ?? 0);
	});

	it('puts a label match above a body match', () => {
		const document = labelItems(board(), ['chart'], 'product');
		const hits = searchBoard(document, 'product');
		expect(hits[0].item.id).toBe('chart');
		expect(hits[0].field).toBe('label');
	});

	it('prefers a match at the start of a field over one buried inside it', () => {
		const document: WhiteboardDocument = {
			...createEmptyBoard(),
			items: [
				{ ...createCard(0, 0), id: 'starts', title: 'Blend the edges' },
				{ ...createCard(0, 200), id: 'buried', title: 'How you might blend the edges' }
			]
		};
		expect(searchBoard(document, 'blend')[0].item.id).toBe('starts');
	});
});

describe('showing the results together', () => {
	it('gives one rectangle that holds every result', () => {
		const document = board();
		const bounds = hitsBounds(document.items, searchBoard(document, 'brush'))!;
		expect(bounds.x).toBeLessThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(1200);
	});

	it('has no rectangle when nothing was found', () => {
		expect(hitsBounds(board().items, [])).toBeNull();
	});
});

describe('excerpts', () => {
	it('leaves short text alone', () => {
		expect(excerpt('a brush', 2, 5)).toBe('a brush');
	});

	it('windows long text around the match and marks where it was cut', () => {
		const text = 'x'.repeat(80) + ' stippling ' + 'y'.repeat(80);
		const cut = excerpt(text, 81, 10);
		expect(cut).toContain('stippling');
		expect(cut.startsWith('…')).toBe(true);
		expect(cut.endsWith('…')).toBe(true);
		expect(cut.length).toBeLessThanOrEqual(70);
	});
});
