import { describe, expect, it } from 'vitest';
import { readTrigger } from './referenceTrigger';

describe('readTrigger', () => {
	it('opens on a sigil at the start of a line', () => {
		expect(readTrigger('#Pir')).toEqual({ sigil: '#', query: 'Pir', length: 4 });
		expect(readTrigger('@Thu')).toEqual({ sigil: '@', query: 'Thu', length: 4 });
	});

	it('opens on a sigil after a space', () => {
		expect(readTrigger('reading #Pir')).toMatchObject({ sigil: '#', query: 'Pir' });
	});

	it('opens on a bare sigil, with an empty query', () => {
		expect(readTrigger('so far @')).toEqual({ sigil: '@', query: '', length: 1 });
	});

	it('does not fire mid-word, which is what spares email addresses', () => {
		// The single boundary rule, doing the work of several special cases.
		expect(readTrigger('z@example.com')).toBeNull();
		expect(readTrigger('written in C#')).toBeNull();
		expect(readTrigger('issue#42')).toBeNull();
	});

	it('allows spaces so a multi-word title is reachable', () => {
		expect(readTrigger('#The Left Hand')).toMatchObject({
			sigil: '#',
			query: 'The Left Hand'
		});
	});

	it('gives up once the query is longer than a name', () => {
		// "#1 priority" is a sentence, not a reference. It reads as a trigger
		// with a query nothing matches, and the picker shows nothing — but a
		// whole paragraph after a stray sigil stops being a trigger at all.
		expect(readTrigger('#' + 'x'.repeat(41))).toBeNull();
	});

	it('never crosses a line break', () => {
		expect(readTrigger('#Piranesi\nand then')).toBeNull();
	});

	it('takes the nearest sigil when there are two', () => {
		expect(readTrigger('#one and #two')).toMatchObject({ query: 'two' });
	});

	it('finds nothing in ordinary prose', () => {
		expect(readTrigger('just some words')).toBeNull();
		expect(readTrigger('')).toBeNull();
	});

	it('reports a length that covers the sigil and the query', () => {
		const trigger = readTrigger('#Piranesi');
		expect(trigger?.length).toBe('#Piranesi'.length);
	});
});
