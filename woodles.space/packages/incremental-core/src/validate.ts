import { conditionReferences } from './conditions.js';
import { allEntityIds, entityIndex } from './entities.js';
import { SCHEMA_VERSION, type Condition, type Curve, type GameDef } from './types.js';

/**
 * Validation is how a broken def stops being a mystery. The editor pins these
 * to the offending node; the engine refuses to run anything carrying an
 * `error`, because a simulation over a dangling reference produces numbers that
 * look fine and mean nothing.
 *
 * `warning` is for things that are legal but almost certainly a mistake — a
 * currency nothing produces, a prestige layer that resets its own reward.
 */
export type Severity = 'error' | 'warning';

export type ValidationCode =
	| 'schema-version'
	| 'missing-meta'
	| 'duplicate-id'
	| 'invalid-id'
	| 'dangling-reference'
	| 'invalid-number'
	| 'invalid-curve'
	| 'unlock-cycle'
	| 'unreachable'
	| 'orphan-currency'
	| 'self-reset'
	| 'self-tax';

export interface ValidationIssue {
	severity: Severity;
	code: ValidationCode;
	message: string;
	/** Dotted path into the def, e.g. `generators[0].cost.base`. */
	path: string;
	/** The entity the editor should badge, when there is one. */
	entityId?: string;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
	return issues.some((issue) => issue.severity === 'error');
}

export function issuesFor(issues: ValidationIssue[], entityId: string): ValidationIssue[] {
	return issues.filter((issue) => issue.entityId === entityId);
}

export function validateGameDef(def: GameDef): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const error = (code: ValidationCode, message: string, path: string, entityId?: string): void => {
		issues.push({ severity: 'error', code, message, path, entityId });
	};
	const warn = (code: ValidationCode, message: string, path: string, entityId?: string): void => {
		issues.push({ severity: 'warning', code, message, path, entityId });
	};

	if (def.schemaVersion !== SCHEMA_VERSION) {
		error('schema-version', `expected schemaVersion ${SCHEMA_VERSION}, found ${def.schemaVersion}`, 'schemaVersion');
	}
	if (!def.meta?.id) error('missing-meta', 'the project needs a meta.id', 'meta.id');
	if (!def.meta?.title?.trim()) error('missing-meta', 'the project needs a title', 'meta.title');

	const index = entityIndex(def);
	const currencyIds = new Set(def.currencies.map((currency) => currency.id));
	const generatorIds = new Set(def.generators.map((generator) => generator.id));
	const upgradeIds = new Set(def.upgrades.map((upgrade) => upgrade.id));
	const layerIds = new Set(def.prestigeLayers.map((layer) => layer.id));

	const seen = new Set<string>();
	for (const id of allEntityIds(def)) {
		if (!id || !/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
			error('invalid-id', `"${id}" is not a usable id — use letters, digits and dashes`, 'id', id);
		}
		if (seen.has(id)) error('duplicate-id', `"${id}" is used by more than one entity`, 'id', id);
		seen.add(id);
	}

	// ── currencies ────────────────────────────────────────────────────────
	for (const [i, currency] of def.currencies.entries()) {
		const path = `currencies[${i}]`;
		if (!currency.name?.trim()) error('missing-meta', 'a currency needs a name', `${path}.name`, currency.id);
		if (!Number.isFinite(currency.format?.decimalPlaces) || currency.format.decimalPlaces < 0) {
			error('invalid-number', 'decimal places must be zero or more', `${path}.format.decimalPlaces`, currency.id);
		}

		if (currency.spendTax) {
			if (!currencyIds.has(currency.spendTax.intoCurrencyId)) {
				error(
					'dangling-reference',
					`${currency.name || currency.id}'s spend tax feeds "${currency.spendTax.intoCurrencyId}", which is not a currency`,
					`${path}.spendTax.intoCurrencyId`,
					currency.id
				);
			} else if (currency.spendTax.intoCurrencyId === currency.id) {
				warn(
					'self-tax',
					`${currency.name || currency.id} taxes itself, which just partially refunds every spend rather than creating a byproduct`,
					`${path}.spendTax.intoCurrencyId`,
					currency.id
				);
			}
			if (!Number.isFinite(currency.spendTax.rate) || currency.spendTax.rate < 0) {
				error('invalid-number', 'a spend tax rate cannot be negative', `${path}.spendTax.rate`, currency.id);
			}
		}

		const produced = def.generators.some((generator) => generator.producesCurrencyId === currency.id);
		const awarded = def.prestigeLayers.some((layer) => layer.currencyId === currency.id);
		const taxed = def.currencies.some((entry) => entry.spendTax?.intoCurrencyId === currency.id);
		if (!produced && !awarded && !taxed) {
			warn('orphan-currency', `nothing produces ${currency.name}`, `${path}.id`, currency.id);
		}
	}

	// ── generators ────────────────────────────────────────────────────────
	for (const [i, generator] of def.generators.entries()) {
		const path = `generators[${i}]`;
		if (!generator.name?.trim()) error('missing-meta', 'a generator needs a name', `${path}.name`, generator.id);
		if (!currencyIds.has(generator.producesCurrencyId)) {
			error(
				'dangling-reference',
				`${generator.name || generator.id} produces "${generator.producesCurrencyId}", which is not a currency`,
				`${path}.producesCurrencyId`,
				generator.id
			);
		}
		if (!currencyIds.has(generator.cost.currencyId)) {
			error(
				'dangling-reference',
				`${generator.name || generator.id} is priced in "${generator.cost.currencyId}", which is not a currency`,
				`${path}.cost.currencyId`,
				generator.id
			);
		}
		if (!Number.isFinite(generator.baseRate) || generator.baseRate < 0) {
			error('invalid-number', 'base rate cannot be negative', `${path}.baseRate`, generator.id);
		}
		if (!Number.isFinite(generator.cost.base) || generator.cost.base <= 0) {
			error('invalid-number', 'base cost must be greater than zero', `${path}.cost.base`, generator.id);
		}
		if (generator.maxLevel !== undefined && (!Number.isInteger(generator.maxLevel) || generator.maxLevel < 1)) {
			error('invalid-number', 'max level must be a whole number of at least 1', `${path}.maxLevel`, generator.id);
		}
		if (generator.startsOwned !== undefined && (!Number.isInteger(generator.startsOwned) || generator.startsOwned < 0)) {
			error('invalid-number', 'starting levels must be a whole number of zero or more', `${path}.startsOwned`, generator.id);
		}
		checkCurve(generator.rateCurve, `${path}.rateCurve`, generator.id, issues);
		checkCurve(generator.cost.curve, `${path}.cost.curve`, generator.id, issues);
		checkTags(generator.tags, `${path}.tags`, generator.id, issues);
		if (generator.populationBoost) {
			if (!Number.isFinite(generator.populationBoost.perUnit) || generator.populationBoost.perUnit < 0) {
				error(
					'invalid-number',
					'the per-unit population boost cannot be negative',
					`${path}.populationBoost.perUnit`,
					generator.id
				);
			}
			if (generator.populationBoost.metric === 'taggedLevelSum') {
				const tag = generator.populationBoost.tag;
				if (!tag?.trim()) {
					error('missing-meta', 'a tagged population boost needs a tag to sum', `${path}.populationBoost.tag`, generator.id);
				} else if (!hasTag(def, tag)) {
					warn(
						'unreachable',
						`nothing in this game is tagged "${tag}", so this boost always reads zero`,
						`${path}.populationBoost.tag`,
						generator.id
					);
				}
			}
		}
		if (generator.converts) {
			if (!currencyIds.has(generator.converts.fromCurrencyId)) {
				error(
					'dangling-reference',
					`${generator.name || generator.id} converts "${generator.converts.fromCurrencyId}", which is not a currency`,
					`${path}.converts.fromCurrencyId`,
					generator.id
				);
			}
			if (!Number.isFinite(generator.converts.ratio) || generator.converts.ratio <= 0) {
				error('invalid-number', 'a conversion ratio must be greater than zero', `${path}.converts.ratio`, generator.id);
			}
		}
	}

	// ── upgrades ──────────────────────────────────────────────────────────
	for (const [i, upgrade] of def.upgrades.entries()) {
		const path = `upgrades[${i}]`;
		if (!upgrade.name?.trim()) error('missing-meta', 'an upgrade needs a name', `${path}.name`, upgrade.id);
		if (!currencyIds.has(upgrade.cost.currencyId)) {
			error(
				'dangling-reference',
				`${upgrade.name || upgrade.id} is priced in "${upgrade.cost.currencyId}", which is not a currency`,
				`${path}.cost.currencyId`,
				upgrade.id
			);
		}
		if (!Number.isFinite(upgrade.cost.amount) || upgrade.cost.amount <= 0) {
			error('invalid-number', 'cost must be greater than zero', `${path}.cost.amount`, upgrade.id);
		}
		if (upgrade.repeatable) {
			if (!Number.isInteger(upgrade.repeatable.maxLevel) || upgrade.repeatable.maxLevel < 1) {
				error('invalid-number', 'max level must be a whole number of at least 1', `${path}.repeatable.maxLevel`, upgrade.id);
			}
			checkCurve(upgrade.repeatable.costCurve, `${path}.repeatable.costCurve`, upgrade.id, issues);
		}
		if (!upgrade.effects.length) {
			warn('unreachable', `${upgrade.name || upgrade.id} has no effects and does nothing`, `${path}.effects`, upgrade.id);
		}

		for (const [j, effect] of upgrade.effects.entries()) {
			const effectPath = `${path}.effects[${j}]`;
			if (!Number.isFinite(effect.value)) {
				error('invalid-number', 'effect value must be a number', `${effectPath}.value`, upgrade.id);
			}
			if (effect.op === 'mul' && effect.value < 0) {
				warn('invalid-number', 'a negative multiplier flips the sign of what it scales', `${effectPath}.value`, upgrade.id);
			}
			if (effect.target.type === 'generator' && !generatorIds.has(effect.target.id)) {
				error('dangling-reference', `no generator "${effect.target.id}"`, `${effectPath}.target.id`, upgrade.id);
			}
			if (effect.target.type === 'currency' && !currencyIds.has(effect.target.id)) {
				error('dangling-reference', `no currency "${effect.target.id}"`, `${effectPath}.target.id`, upgrade.id);
			}
		}

		checkCondition(upgrade.visibleWhen, `${path}.visibleWhen`, upgrade.id, index, issues);
		checkCondition(upgrade.purchasableWhen, `${path}.purchasableWhen`, upgrade.id, index, issues);
		checkTags(upgrade.tags, `${path}.tags`, upgrade.id, issues);
	}

	// ── prestige ──────────────────────────────────────────────────────────
	for (const [i, layer] of def.prestigeLayers.entries()) {
		const path = `prestigeLayers[${i}]`;
		if (!layer.name?.trim()) error('missing-meta', 'a prestige layer needs a name', `${path}.name`, layer.id);
		if (!currencyIds.has(layer.currencyId)) {
			error('dangling-reference', `no currency "${layer.currencyId}" to award`, `${path}.currencyId`, layer.id);
		}
		if (!currencyIds.has(layer.gainFormula.sourceCurrencyId)) {
			error(
				'dangling-reference',
				`no currency "${layer.gainFormula.sourceCurrencyId}" to measure`,
				`${path}.gainFormula.sourceCurrencyId`,
				layer.id
			);
		}
		if (!Number.isFinite(layer.gainFormula.threshold) || layer.gainFormula.threshold <= 0) {
			error('invalid-number', 'threshold must be greater than zero', `${path}.gainFormula.threshold`, layer.id);
		}
		if (!Number.isFinite(layer.gainFormula.exponent) || layer.gainFormula.exponent <= 0) {
			error('invalid-number', 'exponent must be greater than zero', `${path}.gainFormula.exponent`, layer.id);
		}
		if (!Number.isFinite(layer.multiplier.perUnit) || layer.multiplier.perUnit < 0) {
			error('invalid-number', 'the per-unit multiplier cannot be negative', `${path}.multiplier.perUnit`, layer.id);
		}
		if (layer.resets.includes(layer.currencyId)) {
			warn(
				'self-reset',
				`${layer.name || layer.id} resets the very currency it awards, so a reset pays nothing`,
				`${path}.resets`,
				layer.id
			);
		}
		for (const [j, id] of layer.resets.entries()) {
			if (!currencyIds.has(id) && !generatorIds.has(id) && !upgradeIds.has(id)) {
				error(
					'dangling-reference',
					`"${id}" is not a currency, generator or upgrade to reset`,
					`${path}.resets[${j}]`,
					layer.id
				);
			}
		}
		checkCondition(layer.availableWhen, `${path}.availableWhen`, layer.id, index, issues);
		checkTags(layer.tags, `${path}.tags`, layer.id, issues);
	}

	// ── unlocks & milestones ──────────────────────────────────────────────
	for (const [i, unlock] of def.unlocks.entries()) {
		const path = `unlocks[${i}]`;
		if (!unlock.name?.trim()) error('missing-meta', 'an unlock needs a name', `${path}.name`, unlock.id);
		if (!unlock.reveals.length) {
			warn('unreachable', `${unlock.name || unlock.id} reveals nothing`, `${path}.reveals`, unlock.id);
		}
		for (const [j, id] of unlock.reveals.entries()) {
			if (!index.has(id)) {
				error('dangling-reference', `nothing here has the id "${id}"`, `${path}.reveals[${j}]`, unlock.id);
			}
		}
		checkCondition(unlock.when, `${path}.when`, unlock.id, index, issues);
	}

	for (const [i, milestone] of def.milestones.entries()) {
		const path = `milestones[${i}]`;
		if (!milestone.name?.trim()) error('missing-meta', 'a milestone needs a name', `${path}.name`, milestone.id);
		checkCondition(milestone.when, `${path}.when`, milestone.id, index, issues);
	}

	for (const id of findGateCycles(def)) {
		error(
			'unlock-cycle',
			`"${index.get(id)?.name ?? id}" is part of a gating loop, so it can never unlock`,
			'unlocks',
			id
		);
	}

	// ── canvas bookkeeping ────────────────────────────────────────────────
	for (const [i, note] of def.notes.entries()) {
		if (typeof note.text !== 'string') {
			error('invalid-number', 'a note needs text', `notes[${i}].text`, note.id);
		}
	}
	for (const id of Object.keys(def.layout)) {
		if (!index.has(id)) {
			// Not an error: a stale layout key is harmless, and dropping it
			// silently on load would lose a position the user may want back.
			warn('dangling-reference', `layout keeps a position for "${id}", which no longer exists`, `layout.${id}`);
		}
	}

	// Unknown ids inside layerIds are impossible by construction; referenced to
	// keep the set alive for readers scanning what each lookup is for.
	void layerIds;

	return issues;
}

function checkCurve(curve: Curve, path: string, entityId: string, issues: ValidationIssue[]): void {
	const error = (message: string, suffix = ''): void => {
		issues.push({ severity: 'error', code: 'invalid-curve', message, path: path + suffix, entityId });
	};

	switch (curve.kind) {
		case 'geometric':
			if (!Number.isFinite(curve.growth) || curve.growth <= 0) error('growth must be greater than zero', '.growth');
			break;
		case 'linear':
			if (!Number.isFinite(curve.slope)) error('slope must be a number', '.slope');
			break;
		case 'polynomial':
			if (!Number.isFinite(curve.exponent)) error('exponent must be a number', '.exponent');
			break;
		case 'steps': {
			let previous = 0;
			for (const [i, breakpoint] of curve.breakpoints.entries()) {
				if (!Number.isInteger(breakpoint.level) || breakpoint.level < 1) {
					error('a breakpoint level must be a whole number of at least 1', `.breakpoints[${i}].level`);
				}
				if (!Number.isFinite(breakpoint.multiplier) || breakpoint.multiplier <= 0) {
					error('a breakpoint multiplier must be greater than zero', `.breakpoints[${i}].multiplier`);
				}
				if (breakpoint.level <= previous) {
					error('breakpoints must be in increasing level order', `.breakpoints[${i}].level`);
				}
				previous = breakpoint.level;
			}
			break;
		}
	}
}

function checkCondition(
	condition: Condition | undefined,
	path: string,
	entityId: string,
	index: Map<string, unknown>,
	issues: ValidationIssue[]
): void {
	if (!condition) return;
	for (const id of conditionReferences(condition)) {
		if (index.has(id)) continue;
		issues.push({
			severity: 'error',
			code: 'dangling-reference',
			message: `this condition reads "${id}", which does not exist`,
			path,
			entityId
		});
	}
}

function checkTags(tags: string[] | undefined, path: string, entityId: string, issues: ValidationIssue[]): void {
	if (!tags) return;
	for (const [i, tag] of tags.entries()) {
		if (!tag?.trim()) {
			issues.push({ severity: 'error', code: 'missing-meta', message: 'a tag cannot be blank', path: `${path}[${i}]`, entityId });
		}
	}
}

/** Whether anything in the def — a generator, an upgrade, a prestige layer — carries `tag`. */
function hasTag(def: GameDef, tag: string): boolean {
	return (
		def.generators.some((generator) => generator.tags?.includes(tag)) ||
		def.upgrades.some((upgrade) => upgrade.tags?.includes(tag)) ||
		def.prestigeLayers.some((layer) => layer.tags?.includes(tag))
	);
}

/**
 * Finds entities caught in a gating loop — A can't unlock until B does, and B
 * can't unlock until A does. Both are then permanently unreachable, which is
 * the kind of bug you'd otherwise discover by playing for an hour and noticing
 * a node never lit up.
 */
function findGateCycles(def: GameDef): string[] {
	/** id → ids that must be satisfied before it can appear. */
	const dependsOn = new Map<string, Set<string>>();
	const require = (dependent: string, requirement: string): void => {
		const set = dependsOn.get(dependent) ?? new Set<string>();
		set.add(requirement);
		dependsOn.set(dependent, set);
	};

	for (const unlock of def.unlocks) {
		for (const revealed of unlock.reveals) {
			for (const reference of conditionReferences(unlock.when)) require(revealed, reference);
		}
	}
	for (const upgrade of def.upgrades) {
		for (const condition of [upgrade.visibleWhen, upgrade.purchasableWhen]) {
			if (!condition) continue;
			for (const reference of conditionReferences(condition)) require(upgrade.id, reference);
		}
	}
	for (const layer of def.prestigeLayers) {
		if (!layer.availableWhen) continue;
		for (const reference of conditionReferences(layer.availableWhen)) require(layer.id, reference);
	}

	const state = new Map<string, 'visiting' | 'done'>();
	const looping = new Set<string>();

	const visit = (id: string, trail: string[]): void => {
		const mark = state.get(id);
		if (mark === 'done') return;
		if (mark === 'visiting') {
			// Everything from where this id first appeared onwards is in the loop.
			for (const member of trail.slice(trail.indexOf(id))) looping.add(member);
			return;
		}
		state.set(id, 'visiting');
		trail.push(id);
		for (const requirement of dependsOn.get(id) ?? []) visit(requirement, trail);
		trail.pop();
		state.set(id, 'done');
	};

	for (const id of dependsOn.keys()) visit(id, []);
	return [...looping].sort();
}
