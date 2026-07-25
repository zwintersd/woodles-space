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
	it('carries every standing rule regardless of output contract', () => {
		for (const output of ['page', 'fragment'] as const) {
			const brief = buildBrief({ topic: 'Moss', output });
			expect(brief).toContain('semantic drift');
			expect(brief).toContain('Never sports.');
			expect(brief).toContain('Standing lenses');
			expect(brief).toContain('inflation-adjusted');
			expect(brief).toContain('primary/seminal sources');
			expect(brief).toContain('No closing');
		}
	});

	it('leads with the topic, and says so plainly when there is none yet', () => {
		expect(buildBrief({ topic: 'Moss' })).toMatch(/^Write this as .*on: Moss/);
		expect(buildBrief({ topic: '   ' })).toContain('[TOPIC]');
	});

	it('includes subject and context only when they were given', () => {
		const full = buildBrief({ topic: 'Moss', subject: 'botany', context: 'I grow it' });
		expect(full).toContain('Domain / subdomain for the masthead kicker: botany');
		expect(full).toContain('Optional context: I grow it');

		const bare = buildBrief({ topic: 'Moss' });
		expect(bare).not.toContain('masthead kicker');
		expect(bare).not.toContain('Optional context');
	});

	it('adds the health-condition sections only when asked', () => {
		expect(buildBrief({ topic: 'ADHD', diagnosis: true })).toContain('risk-assessment');
		expect(buildBrief({ topic: 'ADHD' })).not.toContain('risk-assessment');
	});
});

describe('output contracts', () => {
	it('asks the Garden for a body, not a document', () => {
		const brief = buildBrief({ topic: 'Moss', output: 'fragment' });
		expect(brief).toContain('[[double brackets]]');
		expect(brief).toContain('No title, no masthead');
		expect(brief).toContain('no code fences');
	});

	it('says nothing about shape for a page — the appendix carries that', () => {
		expect(OUTPUT_CONTRACTS.page).toBe('');
		expect(buildBrief({ topic: 'Moss', output: 'page' })).not.toContain('[[double brackets]]');
	});

	it('appends a caller trailer behind a rule, so it reads as its own section', () => {
		const brief = buildBrief({ topic: 'Moss', output: 'page', appendix: 'VISUAL SYSTEM — …' });
		expect(brief).toContain('\n---\n\nVISUAL SYSTEM — …');
	});

	it('defaults to the fragment, which is what a body already stores', () => {
		expect(buildBrief({ topic: 'Moss' })).toContain('[[double brackets]]');
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

	it('keeps wikilinks untouched, which is the whole point', () => {
		expect(ingestDraft('the [[Chlorophyll|green pigment]] and [[Moss]]', htmlToText)).toBe(
			'the [[Chlorophyll|green pigment]] and [[Moss]]'
		);
	});

	it('keeps links through a fenced HTML answer too', () => {
		expect(ingestDraft('```html\n<p>see [[Moss]]</p>\n```', htmlToText)).toBe('see [[Moss]]');
	});

	it('returns nothing for nothing, rather than throwing', () => {
		expect(ingestDraft('', htmlToText)).toBe('');
		expect(ingestDraft('   ', htmlToText)).toBe('');
	});
});
