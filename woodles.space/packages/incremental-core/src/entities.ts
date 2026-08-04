import type { Entity, EntityKind, GameDef } from './types.js';

export interface EntityRef {
	id: string;
	kind: EntityKind;
	name: string;
	entity: Entity;
}

/**
 * Every entity in the def, by id. Ids are unique across kinds — an upgrade and
 * a currency can't share one — which is what lets `Effect.target`, `resets`,
 * `reveals`, and `layout` all be plain id strings instead of tagged pairs.
 */
export function entityIndex(def: GameDef): Map<string, EntityRef> {
	const index = new Map<string, EntityRef>();
	const add = (kind: EntityKind, entity: Entity & { id: string; name: string }): void => {
		if (!index.has(entity.id)) index.set(entity.id, { id: entity.id, kind, name: entity.name, entity });
	};

	for (const currency of def.currencies) add('currency', currency);
	for (const generator of def.generators) add('generator', generator);
	for (const upgrade of def.upgrades) add('upgrade', upgrade);
	for (const layer of def.prestigeLayers) add('prestige', layer);
	for (const unlock of def.unlocks) add('unlock', unlock);
	for (const milestone of def.milestones) add('milestone', milestone);

	return index;
}

/** Every id in the def, in the order the kinds are declared. Duplicates are kept. */
export function allEntityIds(def: GameDef): string[] {
	return [
		...def.currencies.map((entity) => entity.id),
		...def.generators.map((entity) => entity.id),
		...def.upgrades.map((entity) => entity.id),
		...def.prestigeLayers.map((entity) => entity.id),
		...def.unlocks.map((entity) => entity.id),
		...def.milestones.map((entity) => entity.id)
	];
}

/** A naming function for the `describe*` helpers; falls back to the raw id. */
export function nameLookup(def: GameDef): (id: string) => string {
	const index = entityIndex(def);
	return (id) => index.get(id)?.name ?? id;
}

export const ENTITY_KINDS: EntityKind[] = [
	'currency',
	'generator',
	'upgrade',
	'prestige',
	'unlock',
	'milestone'
];

/** Plural labels for the sidebar's system groups. */
export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
	currency: 'Currencies',
	generator: 'Generators',
	upgrade: 'Upgrades',
	prestige: 'Prestige',
	unlock: 'Unlocks',
	milestone: 'Milestones'
};

/**
 * Turns a display name into a stable slug id, de-duplicating against ids
 * already in use. Ids are the join key for the whole schema, so they are
 * generated once and never regenerated when a name changes.
 */
export function slugify(name: string, taken: Iterable<string> = []): string {
	const used = new Set(taken);
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'entity';

	if (!used.has(base)) return base;
	let suffix = 2;
	while (used.has(`${base}-${suffix}`)) suffix += 1;
	return `${base}-${suffix}`;
}
