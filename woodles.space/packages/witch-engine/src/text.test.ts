import { describe, expect, it } from 'vitest';
import { fillTemplate, pickLine } from './text.js';

describe('fillTemplate', () => {
	it('substitutes the name placeholder', () => {
		expect(fillTemplate('{name} settles in.', 'the moss carpets')).toBe('the moss carpets settles in.');
	});
});

describe('pickLine', () => {
	const options = ['a', 'b', 'c'];

	it('returns null for an empty list', () => {
		expect(pickLine([], 0.5)).toBeNull();
	});

	it('picks the first entry at r=0', () => {
		expect(pickLine(options, 0)).toBe('a');
	});

	it('never goes out of bounds at r=1', () => {
		expect(pickLine(options, 1)).toBe('c');
	});
});
