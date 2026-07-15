export type MarginMinerLootKind =
	| 'small-gold'
	| 'large-gold'
	| 'small-rock'
	| 'large-rock'
	| 'diamond'
	| 'unstable-cache'
	| 'anchored-ore'
	| 'mystery-bag';

export type MarginMinerRigUpgrade = 'motor' | 'grip' | 'clock';

export const MARGIN_MINER_BASE_SECONDS = 15;
export const MARGIN_MINER_CLOCK_UPGRADE_SECONDS = 5;
export const MARGIN_MINER_UNSTABLE_CACHE_FLOOR = 200;

export function marginMinerUnstableCacheValue(ageSeconds: number): number {
	const drops = Math.floor(Math.max(0, ageSeconds) / 2);
	return Math.max(MARGIN_MINER_UNSTABLE_CACHE_FLOOR, 800 - drops * 150);
}

export const MARGIN_MINER_RIG_UPGRADES: Array<{
	id: MarginMinerRigUpgrade;
	title: string;
	description: string;
}> = [
	{ id: 'motor', title: 'winch motor', description: 'reel 24 px/s faster' },
	{ id: 'grip', title: 'claw spring', description: 'grab radius +2 px' },
	{
		id: 'clock',
		title: 'clockwork spool',
		description: `next levels +${MARGIN_MINER_CLOCK_UPGRADE_SECONDS}s`
	}
];

export function marginMinerSeconds(clockUpgrades: number): number {
	return MARGIN_MINER_BASE_SECONDS + Math.max(0, Math.floor(clockUpgrades)) * MARGIN_MINER_CLOCK_UPGRADE_SECONDS;
}

export function marginMinerTarget(value: number): number {
	const level = Math.max(1, Math.floor(value));
	return Math.round(500 + (level - 1) * 650 + Math.pow(level - 1, 2) * 160);
}

// The board positions remain handmade/random, but each level's loot mix is deterministic.
export function marginMinerLootPlan(forLevel: number): Array<[MarginMinerLootKind, number]> {
	const level = Math.max(1, Math.floor(forLevel));
	return [
		['small-gold', 6 + level],
		['large-gold', 2 + Math.ceil(level / 2)],
		['small-rock', 4 + level],
		['large-rock', 2 + Math.floor(level / 2)],
		['diamond', 1 + Math.floor(level / 3)],
		['unstable-cache', level >= 2 ? 1 + Math.floor((level - 2) / 2) : 0],
		['anchored-ore', Math.floor(level / 2)],
		['mystery-bag', 1 + Math.floor(level / 2)]
	].filter(([, count]) => count > 0);
}
