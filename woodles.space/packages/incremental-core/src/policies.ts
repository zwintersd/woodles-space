import type { PlayerPolicy, PolicyContext } from './engine.js';
import type { Action, SimState } from './state.js';
import type { GameDef } from './types.js';

/**
 * Two policies bracket real play well enough to balance against: nobody plays
 * worse than never buying anything, and few people play better than always
 * buying the cheapest thing available. A design that feels good under both is a
 * design that feels good.
 *
 * Scripted and optimising policies are a later problem — see the build spec's
 * deliberate-MVP list.
 */

/** Allocating a fresh `[]` 360,000 times is the one avoidable cost in the hot loop. */
const NOTHING: readonly Action[] = Object.freeze([] as Action[]);

/** Never buys anything. The floor: pure production from whatever starts owned. */
export const idlePolicy: PlayerPolicy = {
	name: 'Idle',
	decide(): readonly Action[] {
		return NOTHING;
	}
};

export interface GreedyOptions {
	/**
	 * Prestige once the reset would award at least this many times the units
	 * already held — the classic "don't reset until you'd at least double"
	 * heuristic. With nothing held yet, any whole unit will do.
	 */
	prestigeAdvantageThreshold?: number;
	/** Set false to measure a design's pre-prestige curve in isolation. */
	allowPrestige?: boolean;
}

/**
 * Buys the cheapest affordable thing every tick, and resets when a reset is
 * clearly worth it.
 *
 * "Cheapest" is deliberately naive — it is not return-on-investment ordering.
 * A greedy shopper is a *bound*, not a model of a good player, and a naive one
 * is easier to reason about when a balance chart surprises you.
 */
export function greedyPolicy(options: GreedyOptions = {}): PlayerPolicy {
	const threshold = options.prestigeAdvantageThreshold ?? 2;
	const allowPrestige = options.allowPrestige ?? true;

	return {
		name: 'Greedy',
		decide(state: Readonly<SimState>, def: GameDef, ctx: PolicyContext): readonly Action[] {
			if (allowPrestige) {
				for (const layer of def.prestigeLayers) {
					const gain = ctx.prestigeGain(layer.id);
					if (gain < 1) continue;
					const held = state.currencies[layer.currencyId]?.amount ?? 0;
					if (gain >= Math.max(1, held * threshold)) return [{ type: 'prestige', layerId: layer.id }];
				}
			}

			let bestId: string | null = null;
			let bestKind: 'generator' | 'upgrade' = 'generator';
			let bestCost = Infinity;

			for (const generator of def.generators) {
				if (!ctx.isRevealed(generator.id)) continue;
				const cost = ctx.nextCost(generator.id);
				if (cost === null || cost >= bestCost) continue;
				if ((state.currencies[generator.cost.currencyId]?.amount ?? 0) < cost) continue;
				bestId = generator.id;
				bestKind = 'generator';
				bestCost = cost;
			}

			for (const upgrade of def.upgrades) {
				if (!ctx.canBuyUpgrade(upgrade.id)) continue;
				const cost = ctx.nextCost(upgrade.id);
				if (cost === null || cost >= bestCost) continue;
				if ((state.currencies[upgrade.cost.currencyId]?.amount ?? 0) < cost) continue;
				bestId = upgrade.id;
				bestKind = 'upgrade';
				bestCost = cost;
			}

			if (bestId === null) return NOTHING;
			return [bestKind === 'generator' ? { type: 'buyGenerator', id: bestId } : { type: 'buyUpgrade', id: bestId }];
		}
	};
}

/** The default greedy shopper, ready to hand to `simulate`. */
export const greedy: PlayerPolicy = greedyPolicy();

export interface ScheduledAction {
	/** Game-seconds at which to attempt it. */
	t: number;
	action: Action;
}

/**
 * Replays a fixed list of actions at fixed times. Useful for reproducing a bug
 * report and for regression-testing a specific opening.
 */
export function scriptedPolicy(script: ScheduledAction[]): PlayerPolicy {
	const ordered = [...script].sort((a, b) => a.t - b.t);
	let cursor = 0;

	return {
		name: 'Scripted',
		decide(state: Readonly<SimState>): readonly Action[] {
			if (cursor >= ordered.length || ordered[cursor].t > state.gameTime) return NOTHING;

			const due: Action[] = [];
			while (cursor < ordered.length && ordered[cursor].t <= state.gameTime) {
				due.push(ordered[cursor].action);
				cursor += 1;
			}
			return due;
		}
	};
}
