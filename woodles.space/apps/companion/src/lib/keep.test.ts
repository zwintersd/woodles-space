import { beforeEach, describe, expect, it } from 'vitest';
import { createHandoffQueue } from '@woodles/handoff';
import { sanitizeHtml } from '@woodles/text';
import { captureFromMenu, type Capture } from '@extension/protocol.js';
import { keep, keepableFromCapture, keepableFromCard, prettyUrl, toHandoff } from './keep';

const page = { title: 'A good essay', url: 'https://example.com/essay' };
const stamp = { id: 'c-1', now: '2026-10-04T12:00:00.000Z' };

function capture(info: Parameters<typeof captureFromMenu>[0], target: 'write' | 'whiteboard' = 'write'): Capture {
	const made = captureFromMenu(info, page, target, stamp);
	if (!made) throw new Error('expected a capture');
	return made;
}

beforeEach(() => localStorage.clear());

describe('what goes to Write', () => {
	it('quotes a selection and links back to the page, in HTML Write’s sanitizer keeps whole', () => {
		const handoff = toHandoff(keepableFromCapture(capture({ selectionText: 'first\n\nsecond <b>' })), 'write');
		expect(handoff).toMatchObject({ title: 'A good essay', format: 'html', source: { app: 'companion', label: page.title, href: page.url } });
		expect(handoff.body).toBe(
			'<blockquote><p>first</p><p>second &lt;b&gt;</p></blockquote><p>from <a href="https://example.com/essay">A good essay</a></p>'
		);
		expect(sanitizeHtml(handoff.body ?? '')).toBe(handoff.body);
	});

	it('carries the page link itself, because Write drops `source` on the way in', () => {
		const handoff = toHandoff(keepableFromCard('why I kept it', page)!, 'write');
		expect(handoff.body).toBe('<p>why I kept it</p><p><a href="https://example.com/essay">A good essay</a></p>');
	});

	it('names a link by where it goes', () => {
		const handoff = toHandoff(keepableFromCapture(capture({ linkUrl: 'https://www.other.example/a/b/' })), 'write');
		expect(handoff.title).toBe('other.example/a/b');
		expect(handoff.body).toContain('<a href="https://www.other.example/a/b/">other.example/a/b</a>');
	});
});

describe('what goes to a board', () => {
	it('is plain text without the page url — Whiteboard appends `source.href` itself', () => {
		const handoff = toHandoff(keepableFromCapture(capture({ selectionText: 'a line' }, 'whiteboard')), 'whiteboard');
		expect(handoff).toMatchObject({ format: 'text', body: '“a line”', source: { href: page.url } });
		expect(handoff.body).not.toContain(page.url);
	});

	it('keeps a link’s own url, which is not the page’s', () => {
		const handoff = toHandoff(keepableFromCapture(capture({ linkUrl: 'https://l.example/x' }, 'whiteboard')), 'whiteboard');
		expect(handoff.body).toBe('https://l.example/x');
	});
});

describe('the keep card', () => {
	it('has nothing to keep until there is a page or a line', () => {
		expect(keepableFromCard('   ', null)).toBeNull();
		expect(keepableFromCard('', page)).toMatchObject({ kind: 'page' });
	});

	it('titles a bare thought by its first line', () => {
		const handoff = toHandoff(keepableFromCard('buy string\nfor the kite', null)!, 'write');
		expect(handoff).toMatchObject({ title: 'buy string', source: { app: 'companion' } });
		expect(handoff.source).not.toHaveProperty('href');
		expect(handoff.body).toBe('<p>buy string<br>for the kite</p>');
	});
});

describe('keeping', () => {
	it('queues for the receiver, with the capture’s id as the handoff’s', () => {
		const result = keep(keepableFromCapture(capture({})), 'write', { id: 'c-1' });
		expect(result).toMatchObject({ ok: true, duplicate: false });
		expect(createHandoffQueue('write').peek().map((handoff) => handoff.id)).toEqual(['c-1']);
		expect(createHandoffQueue('whiteboard').count()).toBe(0);
	});

	it('notices a second delivery of the same capture instead of filing it twice', () => {
		const item = keepableFromCapture(capture({}));
		keep(item, 'write', { id: 'c-1' });
		expect(keep(item, 'write', { id: 'c-1' })).toEqual({ ok: true, duplicate: true });
		expect(createHandoffQueue('write').count()).toBe(1);
	});

	it('reports a storage that refuses, rather than throwing', () => {
		const refusing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
		expect(keep(keepableFromCard('x', null)!, 'write', { storage: refusing })).toMatchObject({ ok: false });
	});
});

it('prettifies a url for a title', () => {
	expect(prettyUrl('https://www.example.com/')).toBe('example.com');
	expect(prettyUrl('nope')).toBe('nope');
});
