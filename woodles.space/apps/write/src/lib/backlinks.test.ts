import { beforeEach, describe, expect, it } from 'vitest';
import { referenceHtml } from '@woodles/text';
import { backlinkCounts, draftsReferencing } from './backlinks';
import { saveDraft, type DraftIndexItem } from './drafts';

beforeEach(() => {
	localStorage.clear();
});

const index: DraftIndexItem[] = [
	{ id: 'd-a', title: 'A', updatedAt: 'x' },
	{ id: 'd-b', title: 'B', updatedAt: 'x' },
	{ id: 'd-c', title: 'C', updatedAt: 'x' }
];

describe('draftsReferencing', () => {
	it('finds a draft whose foreground links to the target', () => {
		saveDraft('d-b', {
			title: 'B',
			layers: {
				foreground: {
					html: `<p>See ${referenceHtml({ app: 'write', kind: 'draft', id: 'd-a', text: 'A' })}</p>`
				}
			}
		});
		expect(draftsReferencing('d-a', index).map((d) => d.id)).toEqual(['d-b']);
	});

	it('checks every layer, not just the foreground', () => {
		saveDraft('d-c', {
			title: 'C',
			layers: {
				midground: {
					html: `<p>${referenceHtml({ app: 'write', kind: 'draft', id: 'd-a', text: 'A' })}</p>`
				}
			}
		});
		expect(draftsReferencing('d-a', index).map((d) => d.id)).toEqual(['d-c']);
	});

	it('ignores references to other apps and other drafts', () => {
		saveDraft('d-b', {
			title: 'B',
			layers: {
				foreground: {
					html: `<p>${referenceHtml({ app: 'thinking-about', kind: 'entry', id: 'd-a', text: 'A' })}
					${referenceHtml({ app: 'write', kind: 'draft', id: 'd-c', text: 'C' })}</p>`
				}
			}
		});
		expect(draftsReferencing('d-a', index)).toEqual([]);
	});

	it('never lists a draft as its own backlink', () => {
		saveDraft('d-a', {
			title: 'A',
			layers: {
				foreground: {
					html: `<p>${referenceHtml({ app: 'write', kind: 'draft', id: 'd-a', text: 'A' })}</p>`
				}
			}
		});
		expect(draftsReferencing('d-a', index)).toEqual([]);
	});

	it('returns nothing when no draft mentions the target', () => {
		expect(draftsReferencing('d-a', index)).toEqual([]);
	});
});

describe('backlinkCounts', () => {
	it('counts references to each draft in a single pass', () => {
		saveDraft('d-b', {
			title: 'B',
			layers: {
				foreground: {
					html: `<p>${referenceHtml({ app: 'write', kind: 'draft', id: 'd-a', text: 'A' })}</p>`
				}
			}
		});
		saveDraft('d-c', {
			title: 'C',
			layers: {
				foreground: {
					html: `<p>${referenceHtml({ app: 'write', kind: 'draft', id: 'd-a', text: 'A' })}</p>`
				}
			}
		});
		const counts = backlinkCounts(index);
		expect(counts.get('d-a')).toBe(2);
		expect(counts.get('d-b')).toBeUndefined();
	});

	it('is empty when nothing references anything', () => {
		expect(backlinkCounts(index).size).toBe(0);
	});
});
