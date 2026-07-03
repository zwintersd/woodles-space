import { describe, expect, it } from 'vitest';
import { buildEchoesPublicBlob } from './publish';
import type { StoredLetter } from './letters';

function letter(overrides: Partial<StoredLetter> = {}): StoredLetter {
	return {
		id: 'l-1',
		title: 'a letter',
		theme: 'cream',
		motif: 'blobs',
		font: 'classic',
		issue: 1,
		publishedAt: '2026-07-03T00:00:00.000Z',
		layers: {
			foreground: { html: '<p>hello</p>', updatedAt: '2026-07-03T00:00:00.000Z' }
		},
		annotations: { pocketNotes: [], marginNotes: [] },
		content: '<p>hello</p>',
		replyTo: null,
		...overrides
	};
}

describe('buildEchoesPublicBlob — visibility filtering', () => {
	it('is empty when there are no letters', () => {
		expect(buildEchoesPublicBlob([])).toEqual({ letters: [] });
	});

	it('includes a letter explicitly marked public', () => {
		const out = buildEchoesPublicBlob([letter({ id: 'l-pub', public: true })]);
		expect(out.letters.map((l) => l.id)).toEqual(['l-pub']);
	});

	it('excludes a letter explicitly marked not public', () => {
		const out = buildEchoesPublicBlob([letter({ id: 'l-priv', public: false })]);
		expect(out.letters).toEqual([]);
	});

	it('excludes a letter that never set the flag at all (the default — private)', () => {
		const { public: _unused, ...rest } = letter({ id: 'l-unset' });
		const out = buildEchoesPublicBlob([rest as StoredLetter]);
		expect(out.letters).toEqual([]);
	});

	it('excludes a letter whose public flag is any other truthy-but-not-true value', () => {
		// defends the `=== true` check specifically: a loose `if (l.public)`
		// would have let a stray non-boolean truthy value slip through.
		const out = buildEchoesPublicBlob([letter({ id: 'l-odd', public: 1 as unknown as boolean })]);
		expect(out.letters).toEqual([]);
	});

	it('filters a mixed list down to only the public ones, preserving their order', () => {
		const list = [
			letter({ id: 'l-1', public: true }),
			letter({ id: 'l-2', public: false }),
			letter({ id: 'l-3', public: true }),
			letter({ id: 'l-4' })
		];
		const out = buildEchoesPublicBlob(list);
		expect(out.letters.map((l) => l.id)).toEqual(['l-1', 'l-3']);
	});

	it('carries a dangling replyTo through as-is — the parent not being public is a consumer concern, not this function\'s', () => {
		const list = [letter({ id: 'reply', replyTo: 'not-public-parent', public: true })];
		const out = buildEchoesPublicBlob(list);
		expect(out.letters[0].replyTo).toBe('not-public-parent');
	});

	it('maps only the intended PublicLetter fields — no stray editor-only or the public marker itself', () => {
		const out = buildEchoesPublicBlob([
			letter({
				id: 'l-1',
				title: '  Dear reader  ',
				public: true
			})
		]);
		expect(out.letters[0]).toEqual({
			id: 'l-1',
			title: '  Dear reader  ',
			theme: 'cream',
			motif: 'blobs',
			font: 'classic',
			issue: 1,
			publishedAt: '2026-07-03T00:00:00.000Z',
			layers: { foreground: { html: '<p>hello</p>', updatedAt: '2026-07-03T00:00:00.000Z' } },
			annotations: { pocketNotes: [], marginNotes: [] },
			content: '<p>hello</p>',
			replyTo: null
		});
		expect(out.letters[0]).not.toHaveProperty('public');
	});
});
