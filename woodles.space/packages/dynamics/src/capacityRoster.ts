/**
 * Shape G — Capacity + Roster. Not a multiplier — an admission list. Its
 * only power is deciding which instances get to run their own per-tick
 * primitives this step; everything left off the roster is frozen or fading,
 * by whatever rule the caller applies elsewhere.
 */

export interface Roster {
	capacity: number;
	members: string[];
}

export function freeSlots(roster: Roster): number {
	return roster.capacity - roster.members.length;
}

export function isMember(roster: Roster, id: string): boolean {
	return roster.members.includes(id);
}

/** Adds `id` if there's room and it isn't already on the roster. Returns whether it happened. */
export function admit(roster: Roster, id: string): boolean {
	if (isMember(roster, id) || freeSlots(roster) <= 0) return false;
	roster.members.push(id);
	return true;
}

export function dismiss(roster: Roster, id: string): boolean {
	const i = roster.members.indexOf(id);
	if (i < 0) return false;
	roster.members.splice(i, 1);
	return true;
}

/** Cost to raise capacity by one more, stepping through a fixed price ladder. `null` once it's exhausted. */
export function nextCapacityCost(capacity: number, start: number, costs: readonly number[]): number | null {
	const tier = capacity - start;
	return tier >= 0 && tier < costs.length ? costs[tier] : null;
}
