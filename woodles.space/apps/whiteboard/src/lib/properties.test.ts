import { describe, expect, it } from 'vitest';
import {
	colorOf,
	formatStamp,
	hasProperties,
	kindOf,
	propertyCount,
	setItemProperty,
	setProperty,
	sourceLabel,
	sourceLink,
	statusOf,
	timestamps
} from './properties';
import { labelItems } from './labels';
import { createCard, createEmptyBoard, createFrame, type WhiteboardDocument } from './model';

function board(): WhiteboardDocument {
	return {
		...createEmptyBoard(),
		items: [
			{ ...createCard(0, 0), id: 'card', title: 'Brush pickup physics' },
			{ ...createFrame(0, 0, 800, 600), id: 'frame', title: 'Brushes', tint: 'peach' }
		]
	};
}

describe('the optional layer', () => {
	it('leaves an untouched object with no property sheet', () => {
		const card = createCard(0, 0);
		expect(card.properties).toBeUndefined();
		expect(hasProperties(card)).toBe(false);
		expect(propertyCount(card)).toBe(0);
	});

	it('writes a property and reads it back', () => {
		let card = setProperty(createCard(0, 0), 'status', 'doing');
		card = setProperty(card, 'kind', 'question');
		card = setProperty(card, 'source', 'Ashley Hetherington, brush notes');
		expect(statusOf(card)).toBe('doing');
		expect(kindOf(card)).toBe('question');
		expect(propertyCount(card)).toBe(3);
	});

	it('clears back to nothing, so a cleared object matches one never touched', () => {
		let card = setProperty(createCard(0, 0), 'status', 'doing');
		card = setProperty(card, 'status', null);
		expect(card.properties).toBeUndefined();
		expect(hasProperties(card)).toBe(false);
	});

	it('treats blank input as clearing rather than as a value', () => {
		let card = setProperty(createCard(0, 0), 'kind', 'note');
		card = setProperty(card, 'kind', '   ');
		expect(card.properties).toBeUndefined();
	});

	it('takes any word as a status, because a Status stack confers its own name', () => {
		expect(statusOf(setProperty(createCard(0, 0), 'status', 'BUILDING'))).toBe('BUILDING');
		expect(statusOf(setProperty(createCard(0, 0), 'status', 'flourishing'))).toBe('flourishing');
	});

	it('keeps a status short enough to wear on a card', () => {
		const long = setProperty(createCard(0, 0), 'status', 'x'.repeat(80));
		expect(statusOf(long)!.length).toBe(32);
	});

	it('still refuses a colour outside the palette', () => {
		expect(setProperty(createCard(0, 0), 'tint', 'chartreuse').properties).toBeUndefined();
	});

	it('keeps the other properties when one of them changes', () => {
		let card = setProperty(createCard(0, 0), 'status', 'open');
		card = setProperty(card, 'kind', 'note');
		card = setProperty(card, 'status', 'done');
		expect(statusOf(card)).toBe('done');
		expect(kindOf(card)).toBe('note');
	});

	it('keeps the labels an object already wears when a property is set', () => {
		let document = labelItems(board(), ['card'], 'physics');
		document = setItemProperty(document, 'card', 'status', 'doing');
		const card = document.items.find((item) => item.id === 'card')!;
		expect(card.properties?.labelIds).toHaveLength(1);
		expect(statusOf(card)).toBe('doing');
	});
});

describe('colour', () => {
	it('gives a card its colour through the property sheet', () => {
		const card = setProperty(createCard(0, 0), 'tint', 'sage');
		expect(colorOf(card)).toBe('sage');
	});

	it('writes a frame colour where a frame has always kept it, not twice', () => {
		const frame = setProperty(createFrame(0, 0), 'tint', 'lavender');
		expect(frame.type === 'frame' && frame.tint).toBe('lavender');
		expect(frame.properties).toBeUndefined();
		expect(colorOf(frame)).toBe('lavender');
	});
});

describe('source', () => {
	it('links a source that is a link', () => {
		expect(sourceLink('https://example.com/brushes')).toBe('https://example.com/brushes');
		expect(sourceLabel('https://www.example.com/brushes')).toBe('example.com/brushes');
		expect(sourceLabel('https://example.com/')).toBe('example.com');
	});

	it('leaves a source that is a note as a note', () => {
		expect(sourceLink('a conversation with Ashley')).toBeNull();
		expect(sourceLabel('a conversation with Ashley')).toBe('a conversation with Ashley');
	});

	it('does not invent a scheme to make a bare word clickable', () => {
		expect(sourceLink('example.com')).toBeNull();
		expect(sourceLink('javascript:alert(1)')).toBeNull();
		expect(sourceLink('  ftp://example.com  ')).toBeNull();
	});
});

describe('created and updated', () => {
	it('reads the stamps off the item rather than storing them again', () => {
		const card = { ...createCard(0, 0), createdAt: '2026-01-04T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z' };
		expect(timestamps(card)).toEqual({ created: '2026-01-04T10:00:00.000Z', updated: '2026-08-01T10:00:00.000Z' });
		expect(card.properties).toBeUndefined();
	});

	it('touches Updated whenever a property is written', () => {
		const card = { ...createCard(0, 0), updatedAt: '2020-01-01T00:00:00.000Z' };
		expect(setProperty(card, 'status', 'open').updatedAt).not.toBe(card.updatedAt);
	});

	it('says so plainly when a stamp cannot be read', () => {
		expect(formatStamp('not a date')).toBe('unknown');
	});
});
