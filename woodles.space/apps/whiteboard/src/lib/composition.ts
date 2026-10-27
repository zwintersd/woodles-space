import { boundsForItem, visualBoundsForItem } from './geometry';
import { makeId, now, snapshotDocument, type Bounds, type WhiteboardDocument, type WhiteboardItem } from './model';

export type LayerMove = 'front' | 'back' | 'forward' | 'backward';
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical';

export function layerOf(item: WhiteboardItem): number {
	return item.layer ?? (item.type === 'frame' ? 0 : item.type === 'stack' ? 10000 : 20000) + item.zIndex;
}
export function orderedItems(items: WhiteboardItem[]): WhiteboardItem[] {
	const layer = (item: WhiteboardItem) => {
		const stack = item.type === 'card' && item.stackId ? items.find((parent) => parent.id === item.stackId) : null;
		return stack ? Math.max(layerOf(item), layerOf(stack) + 0.5) : layerOf(item);
	};
	return items.filter((item) => item.type !== 'connector').slice().sort((a, b) => layer(a) - layer(b));
}

export function isLocked(items: WhiteboardItem[], item: WhiteboardItem): boolean {
	const local = (candidate: WhiteboardItem) => Boolean(candidate.locked || (candidate.groupId && items.some((other) => other.groupId === candidate.groupId && other.locked)));
	if (local(item)) return true;
	const parent = item.type === 'card' && item.stackId ? items.find((other) => other.id === item.stackId) : null;
	return parent ? local(parent) : false;
}

/** A flat group is a selection, never a new item or a source reference. */
export function expandGroups(items: WhiteboardItem[], ids: string[]): string[] {
	const groups = new Set(items.filter((item) => ids.includes(item.id)).map((item) => item.groupId).filter(Boolean));
	return items.filter((item) => ids.includes(item.id) || (item.groupId && groups.has(item.groupId))).map((item) => item.id);
}

export function groupItems(items: WhiteboardItem[], ids: string[], ungroup = false): WhiteboardItem[] {
	const selected = new Set(expandGroups(items, ids));
	const eligible = items.filter((item) => selected.has(item.id) && item.type !== 'connector' && !(item.type === 'card' && item.stackId));
	if (eligible.some((item) => isLocked(items, item)) || (!ungroup && eligible.length < 2)) return items;
	if (ungroup && !eligible.some((item) => item.groupId)) return items;
	if (!ungroup && eligible[0]?.groupId && eligible.every((item) => item.groupId === eligible[0].groupId)) return items;
	const groupId = ungroup ? undefined : makeId('group');
	return items.map((item) => eligible.includes(item) ? { ...item, groupId, updatedAt: now() } : item);
}

export function reorderLayers(items: WhiteboardItem[], ids: string[], move: LayerMove): WhiteboardItem[] {
	const selected = new Set(expandGroups(items, ids));
	for (const item of items) if (item.type === 'card' && item.stackId && selected.has(item.stackId)) selected.add(item.id);
	const ordered = orderedItems(items);
	if (!ordered.some((item) => selected.has(item.id))) return items;
	let result: WhiteboardItem[];
	if (move === 'front' || move === 'back') {
		const chosen = ordered.filter((item) => selected.has(item.id));
		const others = ordered.filter((item) => !selected.has(item.id));
		result = move === 'front' ? [...others, ...chosen] : [...chosen, ...others];
	} else {
		result = [...ordered];
		if (move === 'forward') {
			for (let i = result.length - 2; i >= 0; i--) if (selected.has(result[i].id) && !selected.has(result[i + 1].id)) [result[i], result[i + 1]] = [result[i + 1], result[i]];
		} else {
			for (let i = 1; i < result.length; i++) if (selected.has(result[i].id) && !selected.has(result[i - 1].id)) [result[i], result[i - 1]] = [result[i - 1], result[i]];
		}
	}
	const ranks = new Map(result.map((item, index) => [item.id, index]));
	return items.map((item) => ranks.has(item.id) ? { ...item, layer: ranks.get(item.id), updatedAt: now() } : item);
}

export function unionBounds(bounds: Bounds[]): Bounds | null {
	if (!bounds.length) return null;
	const x = Math.min(...bounds.map((b) => b.x));
	const y = Math.min(...bounds.map((b) => b.y));
	return { x, y, width: Math.max(...bounds.map((b) => b.x + b.width)) - x, height: Math.max(...bounds.map((b) => b.y + b.height)) - y };
}

export function compositionUnits(items: WhiteboardItem[], ids: string[]) {
	const selected = new Set(expandGroups(items, ids));
	const map = new Map<string, WhiteboardItem[]>();
	for (const item of items) {
		if (!selected.has(item.id) || item.type === 'connector' || (item.type === 'card' && item.stackId)) continue;
		const key = item.groupId ?? item.id;
		map.set(key, [...map.get(key) ?? [], item]);
	}
	return [...map.values()].map((members) => ({ members, bounds: unionBounds(members.map((item) => visualBoundsForItem(items, item)))! }));
}

export function alignItems(items: WhiteboardItem[], ids: string[], alignment: Alignment): WhiteboardItem[] {
	const units = compositionUnits(items, ids);
	if (units.length < (alignment === 'horizontal' || alignment === 'vertical' ? 3 : 2) || units.some((unit) => unit.members.some((item) => isLocked(items, item)))) return items;
	const total = unionBounds(units.map((unit) => unit.bounds))!;
	const offsets = new Map<string, { x: number; y: number }>();
	const horizontal = ['left', 'center', 'right', 'horizontal'].includes(alignment);
	const axis = horizontal ? 'x' : 'y';
	const size = horizontal ? 'width' : 'height';
	const sorted = units.slice().sort((a, b) => a.bounds[axis] - b.bounds[axis]);
	const gap = (total[size] - units.reduce((sum, unit) => sum + unit.bounds[size], 0)) / (units.length - 1);
	let cursor = total[axis];
	for (const unit of sorted) {
		const b = unit.bounds;
		let target = total[axis];
		if (alignment === 'center' || alignment === 'middle') target += (total[size] - b[size]) / 2;
		if (alignment === 'right' || alignment === 'bottom') target += total[size] - b[size];
		if (alignment === 'horizontal' || alignment === 'vertical') { target = cursor; cursor += b[size] + gap; }
		for (const member of unit.members) offsets.set(member.id, { x: horizontal ? target - b.x : 0, y: horizontal ? 0 : target - b.y });
	}
	return items.map((item) => { const offset = offsets.get(item.id); return offset ? { ...item, x: item.x + offset.x, y: item.y + offset.y, updatedAt: now() } : item; });
}

/** Copies a composition's board-local objects; canonical sources remain references. */
export function duplicateItems(document: WhiteboardDocument, ids: string[]): { items: WhiteboardItem[]; ids: string[] } {
	const selected = new Set(expandGroups(document.items, ids));
	for (const item of document.items) if (item.type === 'card' && item.stackId && selected.has(item.stackId)) selected.add(item.id);
	const originals = snapshotDocument(document).items.filter((item) => selected.has(item.id) || (item.type === 'connector' && selected.has(item.fromId) && selected.has(item.toId)));
	const idMap = new Map(originals.map((item) => [item.id, makeId(item.type)]));
	const groups = new Map(originals.filter((item) => item.groupId).map((item) => [item.groupId!, makeId('group')]));
	const top = Math.max(0, ...document.items.map(layerOf));
	const ranks = new Map(orderedItems(originals).map((item, i) => [item.id, top + i + 1]));
	const clones = originals.map((item) => {
		const bounds = boundsForItem(document.items, item);
		const cloned = { ...item, id: idMap.get(item.id)!, x: bounds.x + 28, y: bounds.y + 28, layer: ranks.get(item.id), groupId: item.groupId ? groups.get(item.groupId) : undefined, createdAt: now(), updatedAt: now() };
		if (cloned.type === 'stack') cloned.cardIds = cloned.cardIds.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id));
		if (cloned.type === 'card') { cloned.stackId = cloned.stackId ? idMap.get(cloned.stackId) : undefined; cloned.freePosition = undefined; }
		if (cloned.type === 'connector') { cloned.fromId = idMap.get(cloned.fromId)!; cloned.toId = idMap.get(cloned.toId)!; }
		return cloned;
	});
	return { items: [...document.items, ...clones], ids: clones.filter((item) => item.type !== 'connector' && !(item.type === 'card' && item.stackId)).map((item) => item.id) };
}

export type AlignmentGuide = { axis: 'x' | 'y'; at: number; start: number; end: number };
export function snapTranslation(items: WhiteboardItem[], ids: string[], original: Bounds, dx: number, dy: number, tolerance: number) {
	const moving = { ...original, x: original.x + dx, y: original.y + dy };
	const others = items.filter((item) => !ids.includes(item.id) && item.type !== 'connector' && !(item.type === 'card' && item.stackId));
	const guides: AlignmentGuide[] = [];
	const shift = { x: 0, y: 0 };
	for (const axis of ['x', 'y'] as const) {
		const size = axis === 'x' ? 'width' : 'height';
		let distance = tolerance + 1;
		let guide: AlignmentGuide | undefined;
		for (const item of others) {
			const target = visualBoundsForItem(items, item);
			for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) {
				const at = target[axis] + target[size] * a;
				const difference = at - (moving[axis] + moving[size] * b);
				if (Math.abs(difference) >= distance || Math.abs(difference) > tolerance) continue;
				distance = Math.abs(difference); shift[axis] = difference;
				guide = { axis, at, start: Math.min(moving[axis === 'x' ? 'y' : 'x'], target[axis === 'x' ? 'y' : 'x']) - 20, end: Math.max(moving[axis === 'x' ? 'y' : 'x'] + moving[axis === 'x' ? 'height' : 'width'], target[axis === 'x' ? 'y' : 'x'] + target[axis === 'x' ? 'height' : 'width']) + 20 };
			}
		}
		if (guide) guides.push(guide);
	}
	return { dx: dx + shift.x, dy: dy + shift.y, guides };
}
