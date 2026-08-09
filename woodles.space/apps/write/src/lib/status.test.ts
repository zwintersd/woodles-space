import { describe, expect, it } from 'vitest';
import { draftStatus, nextDraftStatus } from './status';

describe('draftStatus', () => {
	it('defaults an empty draft to seed', () => {
		expect(draftStatus(undefined, false)).toBe('seed');
	});

	it('defaults a draft with words to growing', () => {
		expect(draftStatus(undefined, true)).toBe('growing');
	});

	it('never infers grown — that is a claim only a person can make', () => {
		expect(draftStatus(undefined, true)).not.toBe('grown');
	});

	it('an explicit status always wins over the inferred default', () => {
		expect(draftStatus('grown', false)).toBe('grown');
		expect(draftStatus('seed', true)).toBe('seed');
	});

	it('ignores a corrupt stored value and falls back to inference', () => {
		expect(draftStatus('withered' as never, true)).toBe('growing');
	});
});

describe('nextDraftStatus', () => {
	it('advances forward one step at a time', () => {
		expect(nextDraftStatus('seed')).toBe('growing');
		expect(nextDraftStatus('growing')).toBe('grown');
	});

	it('stays at grown — the cycle is forward-only', () => {
		expect(nextDraftStatus('grown')).toBe('grown');
	});
});
