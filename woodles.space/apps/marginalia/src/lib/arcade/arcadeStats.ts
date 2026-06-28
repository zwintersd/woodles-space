import type { BestiaryCreature } from '$lib/witch/bestiaryDb';

export const ARCADE_CORE_STATS = ['body', 'mind', 'grace', 'heart'] as const;

export type ArcadeActivePet = BestiaryCreature | null;
export type ArcadeCoreStat = (typeof ARCADE_CORE_STATS)[number];
export type ArcadeStatTier = 0 | 1 | 2 | 3;
export type ArcadeStatCreature = Pick<BestiaryCreature, 'stats'> | null | undefined;
export type ArcadeStatEffect =
	| string
	| ((value: number, tier: ArcadeStatTier, stat: ArcadeCoreStat) => string);
export type ArcadeStatEffects = Partial<Record<ArcadeCoreStat, ArcadeStatEffect>>;

export interface ArcadeStatPerk {
	stat: ArcadeCoreStat;
	value: number;
	tier: ArcadeStatTier;
	effect: string;
}

export function statTier(value: number | null | undefined): ArcadeStatTier {
	const safeValue = Number.isFinite(value) ? Number(value) : 0;
	if (safeValue >= 9) return 3;
	if (safeValue >= 7) return 2;
	if (safeValue >= 5) return 1;
	return 0;
}

export function coreStatValue(creature: ArcadeStatCreature, stat: ArcadeCoreStat): number {
	return creature?.stats?.[stat] ?? 0;
}

export function coreStatPerks(
	creature: ArcadeStatCreature,
	effects: ArcadeStatEffects = {}
): ArcadeStatPerk[] {
	return ARCADE_CORE_STATS.map((stat) => {
		const value = coreStatValue(creature, stat);
		const tier = statTier(value);
		const effect = effects[stat];

		return {
			stat,
			value,
			tier,
			effect:
				typeof effect === 'function'
					? effect(value, tier, stat)
					: (effect ?? (tier > 0 ? `tier ${tier}` : 'baseline'))
		};
	});
}
