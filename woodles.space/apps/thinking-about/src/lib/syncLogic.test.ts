import { describe, expect, it } from 'vitest';
import { blankEntry } from './entries';
import { blobUpdatedAt, isThinkingAboutBlobNewer } from './syncLogic';
import type { ThinkingAboutBlob } from './types';

function blob(over: Partial<ThinkingAboutBlob>): ThinkingAboutBlob {
	return { entries: [], ...over };
}

describe('blobUpdatedAt', () => {
	it('prefers the blob-level timestamp', () => {
		expect(
			blobUpdatedAt(
				blob({
					updatedAt: '2026-02-01T00:00:00.000Z',
					entries: [blankEntry('reading', 'book')]
				})
			)
		).toBe('2026-02-01T00:00:00.000Z');
	});

	it('falls back to the latest entry timestamp', () => {
		expect(
			blobUpdatedAt(
				blob({
					entries: [
						{ ...blankEntry('reading', 'book'), updatedAt: '2026-01-01T00:00:00.000Z' },
						{ ...blankEntry('reading', 'book'), updatedAt: '2026-03-01T00:00:00.000Z' }
					]
				})
			)
		).toBe('2026-03-01T00:00:00.000Z');
	});
});

describe('isThinkingAboutBlobNewer', () => {
	it('uses updatedAt before entry count', () => {
		expect(
			isThinkingAboutBlobNewer(
				blob({ updatedAt: '2026-03-01T00:00:00.000Z', entries: [] }),
				blob({
					updatedAt: '2026-02-01T00:00:00.000Z',
					entries: [blankEntry('reading', 'book'), blankEntry('reading', 'article')]
				})
			)
		).toBe(true);
	});

	it('falls back to entry count when neither blob has a clock', () => {
		const undatedEntry = { ...blankEntry('reading', 'book'), createdAt: '', updatedAt: '' };
		expect(
			isThinkingAboutBlobNewer(
				blob({ entries: [undatedEntry] }),
				blob({ entries: [] })
			)
		).toBe(true);
	});

	it('does not claim local is newer when remote has the later clock', () => {
		expect(
			isThinkingAboutBlobNewer(
				blob({ updatedAt: '2026-01-01T00:00:00.000Z' }),
				blob({ updatedAt: '2026-02-01T00:00:00.000Z' })
			)
		).toBe(false);
	});
});
