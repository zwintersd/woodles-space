// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mentionKey, readMentionsBlob } from '@woodles/sync';
import { referenceHtml } from '@woodles/text';
import { buildMentions, mentionsMatch } from './mentions';
import type { StoredLetter } from './letters';

function letter(overrides: Partial<StoredLetter> = {}): StoredLetter {
	return {
		id: 'l-1',
		title: 'A Letter',
		theme: 'cream',
		motif: 'none',
		font: 'body',
		issue: 1,
		publishedAt: '2026-08-09T12:00:00.000Z',
		layers: { foreground: { html: '<p>plain words</p>', updatedAt: '' } },
		annotations: { pocketNotes: [], marginNotes: [] },
		content: '<p>plain words</p>',
		replyTo: null,
		...overrides
	};
}

function withRef(app: string, kind: string, id: string, text: string): string {
	return `<p>I was reading ${referenceHtml({ app, kind, id, text })} today.</p>`;
}

describe('buildMentions', () => {
	it('reads what a letter was about out of its own prose', () => {
		const blob = buildMentions([
			letter({
				layers: {
					foreground: {
						html: withRef('thinking-about', 'entry', 'e-piranesi', 'Piranesi'),
						updatedAt: ''
					}
				}
			})
		]);

		expect(blob.mentions).toEqual([
			{
				letterId: 'l-1',
				title: 'A Letter',
				date: '2026-08-09',
				refs: [mentionKey('thinking-about', 'entry', 'e-piranesi')]
			}
		]);
	});

	it('leaves out a letter that named nothing', () => {
		// Publishing it anyway would make every reader filter an empty list.
		expect(buildMentions([letter()]).mentions).toEqual([]);
	});

	it('reads every layer — a reference is as real in the midground', () => {
		const blob = buildMentions([
			letter({
				layers: {
					foreground: { html: '<p>prose</p>', updatedAt: '' },
					midground: { html: withRef('bestiary', 'card', 'c-1', 'a creature'), updatedAt: '' }
				}
			})
		]);

		expect(blob.mentions[0].refs).toEqual([mentionKey('bestiary', 'card', 'c-1')]);
	});

	it('deduplicates a thing named twice in one letter', () => {
		const ref = referenceHtml({
			app: 'thinking-about',
			kind: 'entry',
			id: 'e-1',
			text: 'Piranesi'
		});
		const blob = buildMentions([
			letter({ layers: { foreground: { html: `<p>${ref} and again ${ref}</p>`, updatedAt: '' } } })
		]);

		expect(blob.mentions[0].refs).toHaveLength(1);
	});

	it('carries days as well as things', () => {
		const blob = buildMentions([
			letter({
				layers: {
					foreground: { html: withRef('planner', 'day', '2026-08-02', 'Sunday'), updatedAt: '' }
				}
			})
		]);

		expect(blob.mentions[0].refs).toEqual([mentionKey('planner', 'day', '2026-08-02')]);
	});

	it('carries the letter id, so a reader can link back to it', () => {
		const blob = buildMentions([
			letter({
				id: 'l-specific',
				layers: {
					foreground: { html: withRef('thinking-about', 'entry', 'e-1', 'X'), updatedAt: '' }
				}
			})
		]);

		expect(blob.mentions[0].letterId).toBe('l-specific');
	});

	it('round-trips through the contract validator', () => {
		const blob = buildMentions([
			letter({
				layers: {
					foreground: { html: withRef('thinking-about', 'entry', 'e-1', 'X'), updatedAt: '' }
				}
			})
		]);
		expect(readMentionsBlob(JSON.parse(JSON.stringify(blob)))).toEqual(blob);
	});
});

describe('mentionsMatch', () => {
	const body = { foreground: { html: withRef('thinking-about', 'entry', 'e-1', 'X'), updatedAt: '' } };

	it('ignores publishedAt, which changes on every save', () => {
		expect(
			mentionsMatch(
				buildMentions([letter({ layers: body })], 'a'),
				buildMentions([letter({ layers: body })], 'b')
			)
		).toBe(true);
	});

	it('notices a letter that started naming something else', () => {
		expect(
			mentionsMatch(
				buildMentions([letter({ layers: body })]),
				buildMentions([
					letter({
						layers: {
							foreground: { html: withRef('bestiary', 'card', 'c-9', 'Y'), updatedAt: '' }
						}
					})
				])
			)
		).toBe(false);
	});
});
