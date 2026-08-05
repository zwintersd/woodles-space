import { num } from './num.js';
import type { Effect, EffectTarget, GameDef, Generator, PopulationBoost, Upgrade } from './types.js';
import { countUnequippedUpgrades, sumTaggedLevels, type SimState } from './state.js';

/**
 * Upgrades resolved into per-entity numbers, so the tick loop reads a lookup
 * instead of walking every upgrade's effects 360,000 times.
 *
 * Each stat resolves the same way: `(base + Σ add) × ∏ mul`. All the `add`
 * contributions land before any `mul` does, which is the ordering people expect
 * and — more importantly — the only ordering that doesn't depend on the order
 * upgrades happen to sit in the def.
 */
export interface Modifiers {
	/** Flat additions to a generator's output, before multipliers. */
	rateAdd: Record<string, number>;
	rateMul: Record<string, number>;
	/** 0–1 chance per tick that a generator's output is multiplied by CRIT_MULTIPLIER. */
	crit: Record<string, number>;
	/** Multiplies a generator's next-level cost. */
	generatorCostScale: Record<string, number>;
	/** Multiplies an upgrade's next-level cost. */
	upgradeCostScale: Record<string, number>;
	/** A generator's `populationBoost` resolved against the current state. Defaults to 1. */
	populationMul: Record<string, number>;
}

/** What a critical production tick is worth. Constant in the MVP. */
export const CRIT_MULTIPLIER = 2;

export function resolveModifiers(def: GameDef, state: SimState): Modifiers {
	const rateAdd: Record<string, number> = {};
	const rateMul: Record<string, number> = {};
	const critAdd: Record<string, number> = {};
	const critMul: Record<string, number> = {};
	const generatorCostAdd: Record<string, number> = {};
	const generatorCostMul: Record<string, number> = {};
	const upgradeCostAdd: Record<string, number> = {};
	const upgradeCostMul: Record<string, number> = {};
	const populationMul: Record<string, number> = {};

	for (const generator of def.generators) {
		rateAdd[generator.id] = 0;
		rateMul[generator.id] = 1;
		critAdd[generator.id] = 0;
		critMul[generator.id] = 1;
		generatorCostAdd[generator.id] = 0;
		generatorCostMul[generator.id] = 1;
		populationMul[generator.id] = generator.populationBoost
			? num.add(1, num.mul(generator.populationBoost.perUnit, resolvePopulationMetric(generator.populationBoost, def, state)))
			: 1;
	}
	for (const upgrade of def.upgrades) {
		upgradeCostAdd[upgrade.id] = 0;
		upgradeCostMul[upgrade.id] = 1;
	}

	for (const upgrade of def.upgrades) {
		const record = state.upgrades[upgrade.id];
		const level = record?.level ?? 0;
		// Owned but unequipped is not owned, mechanically: the upgrade contributes
		// nothing until the player equips it again, at whatever level it's at.
		if (level <= 0 || !record?.equipped) continue;

		for (const effect of upgrade.effects) {
			switch (effect.stat) {
				case 'rate':
					applyToGenerators(def, effect, level, rateAdd, rateMul);
					break;
				case 'critChance':
					applyToGenerators(def, effect, level, critAdd, critMul);
					break;
				case 'costScale':
					applyToCosts(def, effect, level, generatorCostAdd, generatorCostMul, upgradeCostAdd, upgradeCostMul);
					break;
			}
		}
	}

	return {
		rateAdd,
		rateMul,
		crit: combine(critAdd, critMul, 0),
		generatorCostScale: combine(generatorCostAdd, generatorCostMul, 1),
		upgradeCostScale: combine(upgradeCostAdd, upgradeCostMul, 1),
		populationMul
	};
}

/** What a `populationBoost`'s metric currently counts. */
function resolvePopulationMetric(boost: PopulationBoost, def: GameDef, state: SimState): number {
	switch (boost.metric) {
		case 'unequippedUpgrades':
			return countUnequippedUpgrades(state);
		case 'taggedLevelSum':
			return sumTaggedLevels(def, state, boost.tag);
		default:
			return assertNeverMetric(boost);
	}
}

function assertNeverMetric(value: never): never {
	throw new Error(`unhandled population metric: ${JSON.stringify(value)}`);
}

/**
 * The production multiplier every prestige layer contributes. Driven by the
 * units the player is *holding*, so spending prestige currency on something
 * else is a real trade rather than a free lunch. Layers compose by
 * multiplication.
 */
export function prestigeMultiplier(def: GameDef, state: SimState): number {
	let multiplier = 1;
	for (const layer of def.prestigeLayers) {
		const units = state.currencies[layer.currencyId]?.amount ?? 0;
		multiplier = num.mul(multiplier, num.add(1, num.mul(layer.multiplier.perUnit, units)));
	}
	return multiplier;
}

/** A generator's output per second right now, including every modifier but crit. */
export function effectiveRate(
	generator: Generator,
	level: number,
	modifiers: Modifiers,
	prestige: number,
	baseOutput: number
): number {
	if (level <= 0) return 0;
	const flat = num.add(baseOutput, modifiers.rateAdd[generator.id] ?? 0);
	const population = modifiers.populationMul[generator.id] ?? 1;
	return num.mul(num.mul(num.mul(flat, modifiers.rateMul[generator.id] ?? 1), prestige), population);
}

function applyToGenerators(
	def: GameDef,
	effect: Effect,
	level: number,
	adds: Record<string, number>,
	muls: Record<string, number>
): void {
	for (const generator of def.generators) {
		if (!targetsGenerator(effect.target, generator)) continue;
		if (effect.op === 'add') adds[generator.id] = num.add(adds[generator.id], num.mul(effect.value, level));
		else muls[generator.id] = num.mul(muls[generator.id], num.pow(effect.value, level));
	}
}

function applyToCosts(
	def: GameDef,
	effect: Effect,
	level: number,
	generatorAdds: Record<string, number>,
	generatorMuls: Record<string, number>,
	upgradeAdds: Record<string, number>,
	upgradeMuls: Record<string, number>
): void {
	// A cost effect aimed at a currency scales everything *priced in* that
	// currency, which is the only reading that makes "cheaper petals" mean what
	// an author means by it.
	for (const generator of def.generators) {
		if (!targetsPrice(effect.target, generator.id, generator.cost.currencyId)) continue;
		if (effect.op === 'add') generatorAdds[generator.id] = num.add(generatorAdds[generator.id], num.mul(effect.value, level));
		else generatorMuls[generator.id] = num.mul(generatorMuls[generator.id], num.pow(effect.value, level));
	}
	for (const upgrade of def.upgrades) {
		if (!targetsPrice(effect.target, upgrade.id, upgrade.cost.currencyId)) continue;
		if (effect.op === 'add') upgradeAdds[upgrade.id] = num.add(upgradeAdds[upgrade.id], num.mul(effect.value, level));
		else upgradeMuls[upgrade.id] = num.mul(upgradeMuls[upgrade.id], num.pow(effect.value, level));
	}
}

function targetsGenerator(target: EffectTarget, generator: Generator): boolean {
	switch (target.type) {
		case 'global':
			return true;
		case 'generator':
			return target.id === generator.id;
		case 'currency':
			return target.id === generator.producesCurrencyId;
	}
}

function targetsPrice(target: EffectTarget, entityId: string, pricedIn: string): boolean {
	switch (target.type) {
		case 'global':
			return true;
		case 'generator':
			return target.id === entityId;
		case 'currency':
			return target.id === pricedIn;
	}
}

function combine(adds: Record<string, number>, muls: Record<string, number>, base: number): Record<string, number> {
	const out: Record<string, number> = {};
	for (const key of Object.keys(adds)) out[key] = num.mul(num.add(base, adds[key]), muls[key]);
	return out;
}

/** Human summary of one effect, for node subtitles and the inspector. */
export function describeEffect(effect: Effect, nameOf: (id: string) => string): string {
	const target =
		effect.target.type === 'global'
			? 'everything'
			: effect.target.type === 'generator'
				? nameOf(effect.target.id)
				: `all ${nameOf(effect.target.id)} production`;
	const change = effect.op === 'add' ? `+${effect.value}` : `×${effect.value}`;
	const stat = effect.stat === 'rate' ? 'output' : effect.stat === 'critChance' ? 'crit chance' : 'cost';
	return `${change} ${stat} — ${target}`;
}

/** The upgrades whose effects touch an entity, used to draw modifier edges. */
export function upgradesAffecting(def: GameDef, entityId: string): Upgrade[] {
	return def.upgrades.filter((upgrade) =>
		upgrade.effects.some((effect) => effect.target.type !== 'global' && effect.target.id === entityId)
	);
}
