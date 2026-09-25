import { describe, expect, it } from 'vitest';
import { admit, dismiss, freeSlots, isMember, nextCapacityCost } from './capacityRoster.js';

describe('roster admission', () => {
	it('admits up to capacity and refuses past it', () => {
		const roster = { capacity: 2, members: [] as string[] };
		expect(admit(roster, 'a')).toBe(true);
		expect(admit(roster, 'b')).toBe(true);
		expect(freeSlots(roster)).toBe(0);
		expect(admit(roster, 'c')).toBe(false);
		expect(roster.members).toEqual(['a', 'b']);
	});

	it('refuses a duplicate admission without spending a slot', () => {
		const roster = { capacity: 2, members: ['a'] };
		expect(admit(roster, 'a')).toBe(false);
		expect(freeSlots(roster)).toBe(1);
	});

	it('dismisses a member and frees its slot', () => {
		const roster = { capacity: 2, members: ['a', 'b'] };
		expect(dismiss(roster, 'a')).toBe(true);
		expect(isMember(roster, 'a')).toBe(false);
		expect(freeSlots(roster)).toBe(1);
	});

	it('dismissing a non-member is a no-op', () => {
		const roster = { capacity: 2, members: ['a'] };
		expect(dismiss(roster, 'z')).toBe(false);
	});
});

describe('nextCapacityCost', () => {
	const costs = [45, 130, 320, 750];

	it('reads the ladder by tier above the starting capacity', () => {
		expect(nextCapacityCost(2, 2, costs)).toBe(45);
		expect(nextCapacityCost(3, 2, costs)).toBe(130);
	});

	it('is null once the ladder is exhausted', () => {
		expect(nextCapacityCost(6, 2, costs)).toBeNull();
	});
});
