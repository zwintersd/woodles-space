import { describe, expect, it } from 'vitest';
import {
	blockKindAt,
	clearFormatting,
	convertLines,
	isHighlighted,
	nodeAt,
	normalizeLinkUrl,
	pathTo,
	pointAt,
	positionOf,
	readLines,
	toggleHighlight,
	wordBounds,
	type Position
} from './formatting';

function layer(html: string): HTMLDivElement {
	const el = document.createElement('div');
	el.innerHTML = html;
	return el;
}

const at = (line: number, offset: number): Position => ({ line, offset });

describe('readLines', () => {
	it('reads loose text, blocks and each top-level list item as lines', () => {
		// Chrome leaves the first line you type as bare text in the layer.
		const el = layer('first <b>line</b><p>two</p><ul><li>three</li><li>four</li></ul>');
		const lines = readLines(el);
		expect(lines).toHaveLength(4);
		expect(lines[0].el).toBeNull();
		expect(lines[0].nodes).toHaveLength(2);
		expect(lines.slice(1).map((line) => line.el?.textContent)).toEqual(['two', 'three', 'four']);
	});

	it('does not count whitespace between blocks as a line, but does count a lone <br>', () => {
		expect(readLines(layer('<p>a</p>\n  <p>b</p>'))).toHaveLength(2);
		expect(readLines(layer('<br>'))).toHaveLength(1);
	});
});

describe('positionOf / pointAt', () => {
	it('round-trips a point inside formatted text', () => {
		const el = layer('<p>alpha <b>beta</b> gamma</p><p>delta</p>');
		const lines = readLines(el);
		const beta = el.querySelector('b')!.firstChild!;
		const position = positionOf(el, lines, beta, 2);
		expect(position).toEqual(at(0, 8));
		const point = pointAt(el, lines, position);
		expect(point.node).toBe(beta);
		expect(point.offset).toBe(2);
	});

	it('keeps a caret in an empty paragraph on that paragraph, not the end of the one before', () => {
		const el = layer('<p>one</p><p><br></p><p>three</p>');
		const lines = readLines(el);
		const empty = el.children[1];
		expect(positionOf(el, lines, empty, 0)).toEqual(at(1, 0));
		expect(pointAt(el, lines, at(1, 0))).toEqual({ node: empty, offset: 0 });
	});

	it('leans a range start into the node that follows, and its end into the one before', () => {
		const el = layer('<p>see <a href="https://example.com">this</a> now</p>');
		const lines = readLines(el);
		const link = el.querySelector('a')!.firstChild!;
		expect(pointAt(el, lines, at(0, 4), 'forward')).toEqual({ node: link, offset: 0 });
		expect(pointAt(el, lines, at(0, 8), 'back')).toEqual({ node: link, offset: 4 });
		expect(pointAt(el, lines, at(0, 4), 'back').node).toBe(el.querySelector('p')!.firstChild);
	});

	it('places a boundary on the layer itself at the start of the next line', () => {
		const el = layer('<p>one</p><p>two</p>');
		expect(positionOf(el, readLines(el), el, 1)).toEqual(at(1, 0));
		expect(positionOf(el, readLines(el), el, 2)).toEqual(at(1, 3));
	});

	it('counts into a loose run when the boundary sits between its nodes', () => {
		const el = layer('one <b>two</b> three<p>four</p>');
		expect(positionOf(el, readLines(el), el, 1)).toEqual(at(0, 4));
	});
});

describe('convertLines', () => {
	it('turns a paragraph into a list beside its neighbours, not inside it', () => {
		const el = layer('<p data-anchor="a-1">one</p><p data-anchor="a-2">two</p><p>three</p>');
		convertLines(el, at(1, 1), at(1, 1), 'ul');
		expect(el.innerHTML).toBe('<p data-anchor="a-1">one</p><ul><li data-anchor="a-2">two</li></ul><p>three</p>');
	});

	it('gathers several lines, loose text included, into one list', () => {
		const el = layer('first<p>second</p><p>third</p>');
		convertLines(el, at(0, 0), at(1, 2), 'ol');
		expect(el.innerHTML).toBe('<ol><li>first</li><li>second</li></ol><p>third</p>');
	});

	it('takes one item out of a list, splitting the list around it', () => {
		const el = layer('<ul data-anchor="a-1"><li>one</li><li>two</li><li>three</li></ul>');
		convertLines(el, at(1, 0), at(1, 3), 'p');
		expect(el.innerHTML).toBe('<ul data-anchor="a-1"><li>one</li></ul><p>two</p><ul><li>three</li></ul>');
	});

	it('switches a list item between bullets and numbers', () => {
		const el = layer('<ul><li>one</li><li>two</li></ul>');
		convertLines(el, at(0, 0), at(1, 3), 'ol');
		expect(el.innerHTML).toBe('<ol><li>one</li><li>two</li></ol>');
	});

	it('joins a new item onto the list next to it', () => {
		const el = layer('<ul><li>one</li></ul><p>two</p>');
		convertLines(el, at(1, 0), at(1, 0), 'ul');
		expect(el.innerHTML).toBe('<ul><li>one</li><li>two</li></ul>');
	});

	it('leaves two lists that already sat side by side apart when neither is touched', () => {
		const el = layer('<ul><li>a</li></ul><ul><li>b</li></ul><p>c</p>');
		convertLines(el, at(2, 0), at(2, 0), 'h2');
		expect(el.innerHTML).toBe('<ul><li>a</li></ul><ul><li>b</li></ul><h2>c</h2>');
	});

	it('changes headings and quotes, keeping the words and their formatting', () => {
		const el = layer('<p>a <i>quiet</i> line</p>');
		convertLines(el, at(0, 0), at(0, 0), 'h1');
		expect(el.innerHTML).toBe('<h1>a <i>quiet</i> line</h1>');
		convertLines(el, at(0, 0), at(0, 0), 'blockquote');
		expect(el.innerHTML).toBe('<blockquote>a <i>quiet</i> line</blockquote>');
	});

	it('leaves out a line the selection only reaches the very start of', () => {
		const el = layer('<p>one</p><p>two</p>');
		convertLines(el, at(0, 0), at(1, 0), 'h2');
		expect(el.innerHTML).toBe('<h2>one</h2><p>two</p>');
	});

	it('gives an empty layer an empty block to type into', () => {
		const el = layer('');
		convertLines(el, at(0, 0), at(0, 0), 'h1');
		expect(el.innerHTML).toBe('<h1><br></h1>');
		const list = layer('');
		convertLines(list, at(0, 0), at(0, 0), 'ul');
		expect(list.innerHTML).toBe('<ul><li><br></li></ul>');
	});

	it('moves an item’s nested list out after it, since a paragraph cannot hold one', () => {
		const el = layer('<ul><li>parent<ul><li>child</li></ul></li></ul>');
		convertLines(el, at(0, 0), at(0, 0), 'p');
		expect(el.innerHTML).toBe('<p>parent</p><ul><li>child</li></ul>');
	});

	it('flattens blocks inside a block into lines of one', () => {
		const el = layer('<blockquote><p>one</p><p>two</p></blockquote>');
		convertLines(el, at(0, 0), at(0, 0), 'p');
		expect(el.innerHTML).toBe('<p>one<br>two</p>');
	});
});

describe('blockKindAt', () => {
	it('names the style every touched line shares', () => {
		const el = layer('<h1>a</h1><ul><li>b</li><li>c</li></ul>loose');
		expect(blockKindAt(el, at(0, 0), at(0, 0))).toBe('h1');
		expect(blockKindAt(el, at(1, 0), at(2, 1))).toBe('ul');
		expect(blockKindAt(el, at(3, 1), at(3, 1))).toBe('p');
		expect(blockKindAt(el, at(0, 0), at(1, 1))).toBeNull();
	});

	it('has nothing to say about styles the menu does not offer', () => {
		expect(blockKindAt(layer('<h3>x</h3>'), at(0, 0), at(0, 0))).toBeNull();
	});
});

describe('toggleHighlight', () => {
	it('highlights across formatting with one continuous mark per run of text', () => {
		const el = layer('<p>alpha <b>beta</b> gamma</p>');
		expect(toggleHighlight(el, at(0, 2), at(0, 13))).toBe(true);
		expect(el.innerHTML).toBe('<p>al<mark>pha </mark><b><mark>beta</mark></b><mark> ga</mark>mma</p>');
		expect(isHighlighted(el, at(0, 2), at(0, 13))).toBe(true);
	});

	it('takes the highlight off only the selected part', () => {
		const el = layer('<p><mark>one two three</mark></p>');
		toggleHighlight(el, at(0, 4), at(0, 7));
		expect(el.innerHTML).toBe('<p><mark>one </mark>two<mark> three</mark></p>');
	});

	it('extends a partial highlight to the whole selection rather than removing it', () => {
		const el = layer('<p><mark>one</mark> two</p>');
		toggleHighlight(el, at(0, 0), at(0, 7));
		expect(el.innerHTML).toBe('<p><mark>one two</mark></p>');
	});

	it('reaches across paragraphs', () => {
		const el = layer('<p>one</p><p>two</p>');
		toggleHighlight(el, at(0, 1), at(1, 2));
		expect(el.innerHTML).toBe('<p>o<mark>ne</mark></p><p><mark>tw</mark>o</p>');
	});

	it('does nothing for a caret or a selection of only spaces', () => {
		const el = layer('<p>a b</p>');
		expect(toggleHighlight(el, at(0, 1), at(0, 1))).toBe(false);
		expect(toggleHighlight(el, at(0, 1), at(0, 2))).toBe(false);
		expect(el.innerHTML).toBe('<p>a b</p>');
	});
});

describe('clearFormatting', () => {
	it('clears the middle of a bold phrase and leaves both ends bold', () => {
		const el = layer('<p><b>one <i>two</i> three</b></p>');
		clearFormatting(el, at(0, 2), at(0, 10));
		expect(el.innerHTML).toBe('<p><b>on</b>e two th<b>ree</b></p>');
	});

	it('keeps links and references, and their words', () => {
		const el = layer('<p><b>see <a href="https://example.com">this</a></b> and <a data-ref-id="x" href="/x"><mark>that</mark></a></p>');
		clearFormatting(el, at(0, 0), at(0, 17));
		expect(el.innerHTML).toBe('<p>see <a href="https://example.com">this</a> and <a data-ref-id="x" href="/x">that</a></p>');
	});

	it('unwraps the spans editing leaves behind', () => {
		const el = layer('<p><span style="font-weight: normal">plain</span></p>');
		clearFormatting(el, at(0, 0), at(0, 5));
		expect(el.innerHTML).toBe('<p>plain</p>');
	});
});

describe('wordBounds', () => {
	it('finds the word the caret is in or touching', () => {
		expect(wordBounds('alpha beta gamma', 8)).toEqual([6, 10]);
		expect(wordBounds('alpha beta gamma', 10)).toEqual([6, 10]);
		expect(wordBounds('alpha beta gamma', 6)).toEqual([6, 10]);
	});

	it('keeps an apostrophe inside a word but not quotes around it', () => {
		expect(wordBounds('it’s fine', 1)).toEqual([0, 4]);
		expect(wordBounds("say 'hello'", 7)).toEqual([5, 10]);
	});

	it('has no word to give between spaces or punctuation', () => {
		expect(wordBounds('a  b', 2)).toBeNull();
		expect(wordBounds('—', 0)).toBeNull();
		expect(wordBounds('', 0)).toBeNull();
	});

	it('reads letters beyond ASCII', () => {
		expect(wordBounds('très café', 7)).toEqual([5, 9]);
	});
});

describe('normalizeLinkUrl', () => {
	it('keeps web, email and fragment links', () => {
		expect(normalizeLinkUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
		expect(normalizeLinkUrl('  http://example.com ')).toBe('http://example.com');
		expect(normalizeLinkUrl('mailto:me@example.com')).toBe('mailto:me@example.com');
		expect(normalizeLinkUrl('#section')).toBe('#section');
	});

	it('gives a bare address the scheme it means', () => {
		expect(normalizeLinkUrl('example.com')).toBe('https://example.com');
		expect(normalizeLinkUrl('example.com/path')).toBe('https://example.com/path');
		expect(normalizeLinkUrl('//example.com')).toBe('https://example.com');
		expect(normalizeLinkUrl('me@example.com')).toBe('mailto:me@example.com');
		expect(normalizeLinkUrl('localhost:5173')).toBe('https://localhost:5173');
	});

	it('refuses what the sanitizer would strip, or what is not an address', () => {
		expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
		expect(normalizeLinkUrl('data:text/html,hi')).toBeNull();
		expect(normalizeLinkUrl('ftp://example.com')).toBeNull();
		expect(normalizeLinkUrl('just words')).toBeNull();
		expect(normalizeLinkUrl('word')).toBeNull();
		expect(normalizeLinkUrl('')).toBeNull();
		expect(normalizeLinkUrl('#')).toBeNull();
	});
});

describe('pathTo / nodeAt', () => {
	it('finds the same node in a copy', () => {
		const el = layer('<p>a <a href="https://example.com">b</a></p>');
		const anchor = el.querySelector('a')!;
		const path = pathTo(el, anchor)!;
		const copy = el.cloneNode(true) as HTMLElement;
		expect((nodeAt(copy, path) as HTMLElement).outerHTML).toBe(anchor.outerHTML);
		expect(pathTo(el, document.createElement('p'))).toBeNull();
	});
});
