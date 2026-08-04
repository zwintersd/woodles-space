import { conditionReferences } from './conditions.js';
import { entityIndex } from './entities.js';
import type { Condition, EntityKind, GameDef, XY } from './types.js';

/**
 * The canvas graph, derived from the def every time rather than stored
 * alongside it. That is the whole trick: there is no second copy of "what
 * connects to what" that could drift out of step with the data, and drawing an
 * edge in the editor is therefore a *gesture that edits the def* rather than a
 * thing that has to be kept in sync with it.
 */

export type GraphEdgeKind =
	/** generator → currency. Solid, tinted, animated while a sim runs. */
	| 'production'
	/** upgrade → generator or currency. Solid violet. */
	| 'modifier'
	/** anything → a thing it gates. Dashed grey. */
	| 'requirement'
	/** prestige layer → the currency it awards. */
	| 'award';

export interface GraphNode {
	id: string;
	kind: EntityKind;
	name: string;
	position: XY;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	kind: GraphEdgeKind;
	label?: string;
}

/** Where a node sits when the def has no layout entry for it yet. */
export const FALLBACK_POSITION: XY = { x: 40, y: 40 };

export function deriveNodes(def: GameDef): GraphNode[] {
	const nodes: GraphNode[] = [];
	for (const [id, ref] of entityIndex(def)) {
		nodes.push({
			id,
			kind: ref.kind,
			name: ref.name,
			position: def.layout[id] ?? FALLBACK_POSITION
		});
	}
	return nodes;
}

export function deriveEdges(def: GameDef): GraphEdge[] {
	const edges: GraphEdge[] = [];
	const known = entityIndex(def);
	const push = (kind: GraphEdgeKind, source: string, target: string, label?: string): void => {
		// A dangling reference is the validator's problem to report; the canvas
		// simply doesn't draw an edge to a node that isn't there.
		if (!known.has(source) || !known.has(target)) return;
		edges.push({ id: `${kind}:${source}->${target}`, source, target, kind, label });
	};

	for (const generator of def.generators) {
		push('production', generator.id, generator.producesCurrencyId);
	}

	for (const upgrade of def.upgrades) {
		// De-duplicated: two effects on the same target are one edge, not two
		// overlapping ones drawn on top of each other.
		const targets = new Set<string>();
		for (const effect of upgrade.effects) {
			// A global effect gets no edges at all. Drawing one to every node
			// turns a five-entity canvas into a hairball and says less than the
			// "affects everything" badge the node already carries.
			if (effect.target.type === 'global') continue;
			targets.add(effect.target.id);
		}
		for (const target of targets) push('modifier', upgrade.id, target);

		addRequirementEdges(upgrade.visibleWhen, upgrade.id, push);
		addRequirementEdges(upgrade.purchasableWhen, upgrade.id, push);
	}

	for (const layer of def.prestigeLayers) {
		push('award', layer.id, layer.currencyId);
		addRequirementEdges(layer.availableWhen, layer.id, push);
	}

	for (const unlock of def.unlocks) {
		addRequirementEdges(unlock.when, unlock.id, push);
		for (const revealed of unlock.reveals) push('requirement', unlock.id, revealed, 'reveals');
	}

	for (const milestone of def.milestones) {
		addRequirementEdges(milestone.when, milestone.id, push);
	}

	return edges;
}

function addRequirementEdges(
	condition: Condition | undefined,
	dependent: string,
	push: (kind: GraphEdgeKind, source: string, target: string, label?: string) => void
): void {
	if (!condition) return;
	for (const reference of new Set(conditionReferences(condition))) {
		if (reference === dependent) continue;
		push('requirement', reference, dependent);
	}
}

/**
 * What dragging an edge from one node to another would mean. The editor calls
 * this before committing so a drag either performs a real, describable edit or
 * is refused with a reason — never a dangling line the def knows nothing about.
 */
export type ConnectionIntent =
	| { ok: true; kind: 'produces'; generatorId: string; currencyId: string; description: string }
	| { ok: true; kind: 'pricedIn'; generatorId: string; currencyId: string; description: string }
	| { ok: true; kind: 'effect'; upgradeId: string; targetId: string; targetKind: 'generator' | 'currency'; description: string }
	| { ok: true; kind: 'reveals'; unlockId: string; entityId: string; description: string }
	| { ok: true; kind: 'awards'; layerId: string; currencyId: string; description: string }
	| { ok: false; reason: string };

export function connectionIntent(def: GameDef, sourceId: string, targetId: string): ConnectionIntent {
	const index = entityIndex(def);
	const source = index.get(sourceId);
	const target = index.get(targetId);

	if (!source || !target) return { ok: false, reason: 'one end of that connection is not on the canvas' };
	if (sourceId === targetId) return { ok: false, reason: 'a node cannot connect to itself' };

	if (source.kind === 'generator' && target.kind === 'currency') {
		return {
			ok: true,
			kind: 'produces',
			generatorId: sourceId,
			currencyId: targetId,
			description: `${source.name} produces ${target.name}`
		};
	}

	if (source.kind === 'currency' && target.kind === 'generator') {
		return {
			ok: true,
			kind: 'pricedIn',
			generatorId: targetId,
			currencyId: sourceId,
			description: `${target.name} is bought with ${source.name}`
		};
	}

	if (source.kind === 'upgrade' && (target.kind === 'generator' || target.kind === 'currency')) {
		return {
			ok: true,
			kind: 'effect',
			upgradeId: sourceId,
			targetId,
			targetKind: target.kind,
			description: `${source.name} boosts ${target.name}`
		};
	}

	if (source.kind === 'unlock') {
		return {
			ok: true,
			kind: 'reveals',
			unlockId: sourceId,
			entityId: targetId,
			description: `${source.name} reveals ${target.name}`
		};
	}

	if (source.kind === 'prestige' && target.kind === 'currency') {
		return {
			ok: true,
			kind: 'awards',
			layerId: sourceId,
			currencyId: targetId,
			description: `${source.name} awards ${target.name}`
		};
	}

	return { ok: false, reason: `a ${source.kind} cannot connect to a ${target.kind}` };
}
