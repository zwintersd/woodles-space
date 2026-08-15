import { describe, expect, it } from 'vitest';
import {
	cardFor,
	captureAt,
	captureToInbox,
	describeLink,
	ensureInbox,
	findInbox,
	hostOf,
	inferCapture,
	INBOX_TITLE,
	parseUrl,
	resolveWoodle,
	titleForUrl
} from './capture';
import { stackCards } from './geometry';
import { kindOf, sourceOf } from './properties';
import { createCard, createEmptyBoard, createStack, type StackItem, type WhiteboardDocument } from './model';

function board(items: WhiteboardDocument['items'] = []): WhiteboardDocument {
	return { ...createEmptyBoard(), items };
}

describe('reading a link', () => {
	it('takes an http address and nothing else', () => {
		expect(parseUrl('https://example.com/brushes')?.href).toBe('https://example.com/brushes');
		expect(parseUrl('  http://example.com  ')?.href).toBe('http://example.com/');
		expect(parseUrl('example.com')).toBeNull();
		expect(parseUrl('javascript:alert(1)')).toBeNull();
		expect(parseUrl('https://example.com two words')).toBeNull();
	});

	it('names a link from its own address, since there is no server to ask', () => {
		expect(titleForUrl(new URL('https://example.com/brush-pickup-physics'), null)).toBe('brush pickup physics');
		expect(titleForUrl(new URL('https://example.com/notes/study.html'), null)).toBe('study');
		expect(titleForUrl(new URL('https://www.example.com/'), null)).toBe('example.com');
	});

	it('reports the host without its www', () => {
		expect(hostOf(new URL('https://www.example.com/x'))).toBe('example.com');
		expect(hostOf(new URL('https://example.com/x'))).toBe('example.com');
	});
});

describe('a link that turns out to be a Woodle', () => {
	it('resolves an app from the workspace manifest', () => {
		const woodle = resolveWoodle(new URL('https://woodles.space/planner'))!;
		expect(woodle.appId).toBe('planner');
		expect(woodle.appName).toBeTruthy();
		expect(woodle.recordId).toBeNull();
	});

	it('prefers the longest matching route, not the landing page', () => {
		expect(resolveWoodle(new URL('https://woodles.space/hygge/motion'))?.appId).toBe('hygge');
		expect(resolveWoodle(new URL('https://woodles.space/'))?.appId).toBe('landing');
	});

	it('follows an alias to the app that owns it', () => {
		expect(resolveWoodle(new URL('https://woodles.space/palette'))?.appId).toBe('hygge');
	});

	it('picks up the record a link addresses, when the app answers to one', () => {
		const woodle = resolveWoodle(new URL('https://woodles.space/play?game=g-42'))!;
		expect(woodle.appId).toBe('bloomforge-player');
		expect(woodle.kind).toBe('game');
		expect(woodle.recordId).toBe('g-42');
	});

	it('is not a Woodle just because it is a link', () => {
		expect(resolveWoodle(new URL('https://example.com/planner'))).toBeNull();
	});

	it('accepts the origin the board is served from, given either host or hostname', () => {
		// `location.host` carries a port and `location.hostname` does not; a caller
		// should not have to know which one this wanted.
		expect(resolveWoodle(new URL('http://localhost:5199/whiteboard'), ['localhost:5199'])?.appId).toBe('whiteboard');
		expect(resolveWoodle(new URL('http://localhost:5199/whiteboard'), ['localhost'])?.appId).toBe('whiteboard');
		expect(resolveWoodle(new URL('http://elsewhere.test/whiteboard'), ['localhost'])).toBeNull();
	});

	it('says which Woodle it is, rather than guessing at a page title', () => {
		const woodle = resolveWoodle(new URL('https://woodles.space/planner'))!;
		expect(titleForUrl(new URL('https://woodles.space/planner'), woodle)).toBe(woodle.appName);
	});
});

describe('inferring the most useful thing to make', () => {
	it('turns one address into a link', () => {
		const [item] = inferCapture('https://example.com/brush-pickup');
		expect(item).toMatchObject({ kind: 'link', host: 'example.com', title: 'brush pickup' });
	});

	it('turns a page of addresses into that many links', () => {
		const items = inferCapture('https://example.com/one\nhttps://example.com/two\n\nhttps://example.com/three');
		expect(items).toHaveLength(3);
		expect(items.every((item) => item.kind === 'link')).toBe(true);
	});

	it('turns several lines into one note, first line as its name', () => {
		const [item] = inferCapture('Brush pickup physics\nHow much a brush lifts.\nStippling beats dragging.');
		expect(item).toEqual({
			kind: 'note',
			title: 'Brush pickup physics',
			body: 'How much a brush lifts.\nStippling beats dragging.'
		});
	});

	it('turns one line into a note with nothing under it', () => {
		expect(inferCapture('Remember the seams')).toEqual([{ kind: 'note', title: 'Remember the seams', body: '' }]);
	});

	it('treats a mixture as a note, because it is not a list of links', () => {
		const [item] = inferCapture('look at this\nhttps://example.com/one');
		expect(item.kind).toBe('note');
	});

	it('has nothing to make of nothing', () => {
		expect(inferCapture('')).toEqual([]);
		expect(inferCapture('   \n  \n ')).toEqual([]);
	});
});

describe('what a capture becomes', () => {
	it('makes a note into a plain card', () => {
		const card = cardFor({ kind: 'note', title: 'Seams', body: 'check them' }, 10, 20, 5);
		expect(card).toMatchObject({ type: 'card', title: 'Seams', body: 'check them' });
		expect(card.properties).toBeUndefined();
	});

	it('makes a link into a card that knows where it came from', () => {
		const item = describeLink('https://example.com/brush-study')!;
		const card = cardFor(item, 0, 0, 1);
		expect(card.title).toBe('brush study');
		expect(sourceOf(card)).toBe('https://example.com/brush-study');
		expect(kindOf(card)).toBe('link');
	});

	it('says which Woodle a Woodle link is, as the card type', () => {
		const item = describeLink('https://woodles.space/planner')!;
		const card = cardFor(item, 0, 0, 1);
		expect(kindOf(card)).toBe(item.kind === 'link' ? item.woodle!.appName.toLowerCase() : '');
		expect(sourceOf(card)).toBe('https://woodles.space/planner');
	});
});

describe('putting captures down', () => {
	it('places them where they were dropped, fanned so none is hidden', () => {
		const { document, ids } = captureAt(board(), inferCapture('one\n\ntwo'), { x: 100, y: 50 });
		expect(ids).toHaveLength(1);
		const card = document.items.find((item) => item.id === ids[0])!;
		expect(card.x).toBe(100);
		expect(card.y).toBe(50);
	});

	it('fans several captures so they do not land on top of each other', () => {
		const links = inferCapture('https://example.com/a\nhttps://example.com/b');
		const { document, ids } = captureAt(board(), links, { x: 0, y: 0 });
		const [first, second] = ids.map((id) => document.items.find((item) => item.id === id)!);
		expect(second.x).toBeGreaterThan(first.x);
		expect(second.y).toBeGreaterThan(first.y);
	});
});

describe('the Inbox', () => {
	it('is made the first time something needs one, and is an ordinary stack', () => {
		expect(findInbox(board())).toBeNull();
		const { document, stack } = ensureInbox(board(), { x: 40, y: 60 });
		expect(stack.type).toBe('stack');
		expect(stack.title).toBe(INBOX_TITLE);
		expect(findInbox(document)?.id).toBe(stack.id);
	});

	it('is found again rather than made twice, whatever case it was named in', () => {
		const existing: StackItem = { ...createStack(0, 0), id: 'inbox', title: 'inbox' };
		const { document, stack } = ensureInbox(board([existing]), { x: 0, y: 0 });
		expect(stack.id).toBe('inbox');
		expect(document.items.filter((item) => item.type === 'stack')).toHaveLength(1);
	});

	it('files captures into it, in the order they arrived', () => {
		const { document, stackId } = captureToInbox(board(), inferCapture('first\n---\nsecond'), { x: 0, y: 0 });
		const inbox = document.items.find((item): item is StackItem => item.id === stackId)!;
		expect(stackCards(document.items, inbox).map((card) => card.title)).toEqual(['first']);
	});

	it('keeps filing into the same Inbox on later captures', () => {
		let state = captureToInbox(board(), inferCapture('one'), { x: 0, y: 0 });
		state = captureToInbox(state.document, inferCapture('two'), { x: 0, y: 0 });
		const inbox = state.document.items.find((item): item is StackItem => item.id === state.stackId)!;
		expect(stackCards(state.document.items, inbox).map((card) => card.title)).toEqual(['one', 'two']);
		expect(state.document.items.filter((item) => item.type === 'stack')).toHaveLength(1);
	});

	it('leaves the rest of the board alone', () => {
		const card = { ...createCard(500, 500), id: 'existing', title: 'already here' };
		const { document } = captureToInbox(board([card]), inferCapture('new thing'), { x: 0, y: 0 });
		expect(document.items.find((item) => item.id === 'existing')).toMatchObject({ x: 500, y: 500 });
	});
});
