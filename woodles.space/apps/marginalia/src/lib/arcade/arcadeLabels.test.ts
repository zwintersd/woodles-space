import { describe, expect, it } from 'vitest';
import { arcadeReadyAgainLabel, arcadeStartLabel } from './arcadeLabels';

describe('arcade labels', () => {
	it('uses one shared start control vocabulary', () => {
		expect(arcadeStartLabel('ready', 0)).toBe('start');
		expect(arcadeStartLabel('complete', 1)).toBe('again');
		expect(arcadeStartLabel('over', 2)).toBe('again');
		expect(arcadeStartLabel('running', 0)).toBe('restart');
		expect(arcadeStartLabel('running', 4)).toBe('restart');
	});

	it('uses the matching overlay prompt vocabulary', () => {
		expect(arcadeReadyAgainLabel(0)).toBe('ready?');
		expect(arcadeReadyAgainLabel(1)).toBe('again?');
	});
});
