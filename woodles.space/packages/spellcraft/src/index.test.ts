import { describe, expect, it } from 'vitest';
import { OUTPUT_CONTRACTS, buildBrief, ingestDraft, stripCodeFences } from './index.js';

// The package stays free of a DOM; callers inject @woodles/text's real one.
const htmlToText = (html: string) =>
	html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
		.replace(/<[^>]*>/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

describe('the brief is the part that must not drift', () => {
	it('carries every standing rule', () => {
		const brief = buildBrief({ topic: 'Moss' });
		expect(brief).toContain('semantic drift');
		expect(brief).toContain('Never sports.');
		expect(brief).toContain('Standing lenses');
		expect(brief).toContain('inflation-adjusted');
		expect(brief).toContain('primary/seminal sources');
		expect(brief).toContain('No closing');
	});

	it('leads with the topic, and says so plainly when there is none yet', () => {
		expect(buildBrief({ topic: 'Moss' })).toMatch(/^Write this as .*on: Moss/);
		expect(buildBrief({ topic: '   ' })).toContain('[TOPIC]');
	});

	it('includes subject and context only when they were given', () => {
		const full = buildBrief({ topic: 'Moss', subject: 'botany', context: 'I grow it' });
		expect(full).toContain('Domain / subdomain: botany');
		expect(full).toContain('Optional context: I grow it');

		const bare = buildBrief({ topic: 'Moss' });
		expect(bare).not.toContain('Domain / subdomain');
		expect(bare).not.toContain('Optional context');
	});

	it('adds the health-condition sections only when asked', () => {
		expect(buildBrief({ topic: 'ADHD', diagnosis: true })).toContain('risk-assessment');
		expect(buildBrief({ topic: 'ADHD' })).not.toContain('risk-assessment');
	});
});

describe('the output contract', () => {
	it('asks for a body, not a document', () => {
		const brief = buildBrief({ topic: 'Moss', output: 'fragment' });
		expect(brief).toContain('No title, no masthead');
		expect(brief).toContain('no code fences');
	});

	it('appends a caller trailer behind a rule, so it reads as its own section', () => {
		const brief = buildBrief({ topic: 'Moss', appendix: 'A TRAILER — …' });
		expect(brief).toContain('\n---\n\nA TRAILER — …');
	});

	it('defaults to the fragment — the only contract left, and what a draft already is', () => {
		expect(buildBrief({ topic: 'Moss' })).toBe(buildBrief({ topic: 'Moss', output: 'fragment' }));
		expect(Object.keys(OUTPUT_CONTRACTS)).toEqual(['fragment']);
	});
});

describe('taking the answer back', () => {
	it('strips code fences the model added anyway', () => {
		expect(stripCodeFences('```html\n<p>hi</p>\n```')).toBe('<p>hi</p>');
		expect(stripCodeFences('```\nplain\n```')).toBe('plain');
		expect(stripCodeFences('  no fence  ')).toBe('no fence');
	});

	it('leaves a lone fence inside prose alone rather than mangling it', () => {
		expect(stripCodeFences('before ``` after')).toBe('before ``` after');
	});

	it('reduces an HTML answer to the text a body stores', () => {
		expect(ingestDraft('<p>one</p><p>two</p>', htmlToText)).toBe('one\n\ntwo');
	});

	it('reduces a markdown answer the same way', () => {
		expect(ingestDraft('## Heading\n\n- first\n- second', htmlToText)).toBe(
			'Heading\n\n— first\n— second'
		);
	});

	it('drops emphasis markers — a body has no bold', () => {
		expect(ingestDraft('**bold** and *italic*', htmlToText)).toBe('bold and italic');
	});

	it('does not touch punctuation it has no rule for', () => {
		expect(ingestDraft('the (Chlorophyll) and [Moss]', htmlToText)).toBe('the (Chlorophyll) and [Moss]');
	});

	it('reduces a fenced HTML answer the same way as an unfenced one', () => {
		expect(ingestDraft('```html\n<p>see Moss</p>\n```', htmlToText)).toBe('see Moss');
	});

	it('returns nothing for nothing, rather than throwing', () => {
		expect(ingestDraft('', htmlToText)).toBe('');
		expect(ingestDraft('   ', htmlToText)).toBe('');
	});
});
