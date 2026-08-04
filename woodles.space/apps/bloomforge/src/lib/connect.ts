import { connectionIntent, defaultCurve, type GameDef } from '@woodles/incremental-core';

/**
 * Turns a drag between two nodes into an edit of the def.
 *
 * This is the whole reason edges aren't stored: there is no "add an edge" here,
 * only "set `producesCurrencyId`", "push an effect", "push a reveal". A
 * connection you can draw is a connection the data can express, and a drag that
 * wouldn't mean anything is refused with a reason rather than left dangling.
 */
export interface ConnectionResult {
	ok: boolean;
	message: string;
}

export function applyConnection(def: GameDef, sourceId: string, targetId: string): ConnectionResult {
	const intent = connectionIntent(def, sourceId, targetId);
	if (!intent.ok) return { ok: false, message: intent.reason };

	switch (intent.kind) {
		case 'produces': {
			const generator = def.generators.find((entry) => entry.id === intent.generatorId);
			if (!generator) return { ok: false, message: 'that generator is gone' };
			generator.producesCurrencyId = intent.currencyId;
			return { ok: true, message: intent.description };
		}

		case 'pricedIn': {
			const generator = def.generators.find((entry) => entry.id === intent.generatorId);
			if (!generator) return { ok: false, message: 'that generator is gone' };
			generator.cost.currencyId = intent.currencyId;
			return { ok: true, message: intent.description };
		}

		case 'effect': {
			const upgrade = def.upgrades.find((entry) => entry.id === intent.upgradeId);
			if (!upgrade) return { ok: false, message: 'that upgrade is gone' };
			const already = upgrade.effects.some(
				(effect) => effect.target.type !== 'global' && effect.target.id === intent.targetId
			);
			if (already) return { ok: false, message: `${upgrade.name} already boosts that` };

			upgrade.effects.push({
				target:
					intent.targetKind === 'generator'
						? { type: 'generator', id: intent.targetId }
						: { type: 'currency', id: intent.targetId },
				stat: 'rate',
				op: 'mul',
				value: 2
			});
			return { ok: true, message: intent.description };
		}

		case 'reveals': {
			const unlock = def.unlocks.find((entry) => entry.id === intent.unlockId);
			if (!unlock) return { ok: false, message: 'that unlock is gone' };
			if (unlock.reveals.includes(intent.entityId)) {
				return { ok: false, message: `${unlock.name} already reveals that` };
			}
			unlock.reveals.push(intent.entityId);
			return { ok: true, message: intent.description };
		}

		case 'awards': {
			const layer = def.prestigeLayers.find((entry) => entry.id === intent.layerId);
			if (!layer) return { ok: false, message: 'that prestige layer is gone' };
			layer.currencyId = intent.currencyId;
			// A layer that resets the currency it pays out in pays out nothing.
			layer.resets = layer.resets.filter((entry) => entry !== intent.currencyId);
			return { ok: true, message: intent.description };
		}
	}
}

/**
 * Adds a currency-priced generator when the canvas has one but not the other,
 * used by the "start from here" affordances. Kept beside `applyConnection`
 * because both answer the same question: what does this gesture mean?
 */
export function ensureCurve(def: GameDef, generatorId: string): void {
	const generator = def.generators.find((entry) => entry.id === generatorId);
	if (!generator) return;
	generator.rateCurve ??= defaultCurve('polynomial');
	generator.cost.curve ??= defaultCurve('geometric');
}
