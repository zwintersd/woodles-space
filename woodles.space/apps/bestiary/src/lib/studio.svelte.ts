// The sprite studio's live, editable state — held apart from the persisted
// bestiary so nothing is committed until the user places the art into the card.
//
// One $state Composition, a selection, and a small undo/redo history. Discrete
// actions (add, delete, reorder, flip…) push their own history step via
// commit(); continuous gestures (dragging on the stage, sliders) bracket a
// whole gesture with begin()/end(), and coalesced inputs (wheel-scale, arrow
// nudges) collapse a flurry of changes into a single step via touch().

import {
	emptyComposition,
	cloneComposition,
	createFillLayer,
	addLayerAbove,
	removeLayer,
	moveLayer,
	moveLayerToEnd,
	updateLayer,
	duplicateLayer,
	indexOfLayer,
	clampScale,
	clampOffset,
	type Composition,
	type Layer,
	type ImageLayer,
	type Fill
} from './composer';
import { bakeOutline } from './outline';
import { scenePresets, type ScenePreset } from './props';

const HISTORY_CAP = 50;

export class StudioState {
	comp = $state<Composition>(emptyComposition());
	selectedId = $state<string | null>(null);
	// reactive mirrors of the history depths, for the toolbar's enabled state
	undoDepth = $state(0);
	redoDepth = $state(0);

	// transient outline-bake cache for the live preview (never persisted) —
	// keyed by layer id, holding the bake's input key + resulting data URL
	baked = $state<Record<string, { key: string; src: string }>>({});

	private undoStack: Composition[] = [];
	private redoStack: Composition[] = [];
	private snapshot: Composition | null = null;
	private interacting = false;
	private idleTimer: ReturnType<typeof setTimeout> | null = null;
	private bakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private bakeWant = new Map<string, string>();

	// ── derived ───────────────────────────────────────────────────────

	get layers(): Layer[] {
		return this.comp.layers;
	}

	// Stack drawn bottom-first; the layer list reads top-first like every editor.
	get layersTopFirst(): Layer[] {
		return [...this.comp.layers].reverse();
	}

	get selected(): Layer | null {
		if (!this.selectedId) return null;
		return this.comp.layers.find((l) => l.id === this.selectedId) ?? null;
	}

	get isEmpty(): boolean {
		return this.comp.layers.length === 0;
	}

	// ── lifecycle ─────────────────────────────────────────────────────

	load(comp: Composition): void {
		this.comp = cloneComposition(comp);
		this.undoStack = [];
		this.redoStack = [];
		this.snapshot = null;
		this.interacting = false;
		this.baked = {};
		this.bakeTimers.forEach((t) => clearTimeout(t));
		this.bakeTimers.clear();
		this.bakeWant.clear();
		this.syncCounts();
		const top = this.comp.layers[this.comp.layers.length - 1];
		this.selectedId = top?.id ?? null;
	}

	select(id: string | null): void {
		this.selectedId = id;
	}

	// ── history ───────────────────────────────────────────────────────

	begin(): void {
		if (this.interacting) return;
		this.snapshot = cloneComposition(this.comp);
		this.interacting = true;
	}

	end(): void {
		if (!this.interacting) return;
		this.interacting = false;
		const snap = this.snapshot;
		this.snapshot = null;
		if (!snap) return;
		// Drop no-op gestures (a click that selected but changed nothing).
		if (JSON.stringify(snap) === JSON.stringify(this.comp)) return;
		this.undoStack.push(snap);
		if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
		this.redoStack = [];
		this.syncCounts();
	}

	// Wrap a discrete change as one clean undo step.
	commit(fn: () => void): void {
		this.begin();
		fn();
		this.end();
	}

	// Begin (once) and schedule an end after the input goes idle — collapses a
	// burst of wheel/arrow events into a single history entry.
	private touch(): void {
		this.begin();
		if (this.idleTimer) clearTimeout(this.idleTimer);
		this.idleTimer = setTimeout(() => this.end(), 450);
	}

	undo(): void {
		const prev = this.undoStack.pop();
		if (!prev) return;
		this.redoStack.push(cloneComposition(this.comp));
		this.comp = prev;
		this.ensureSelection();
		this.syncCounts();
	}

	redo(): void {
		const next = this.redoStack.pop();
		if (!next) return;
		this.undoStack.push(cloneComposition(this.comp));
		this.comp = next;
		this.ensureSelection();
		this.syncCounts();
	}

	private syncCounts(): void {
		this.undoDepth = this.undoStack.length;
		this.redoDepth = this.redoStack.length;
	}

	private ensureSelection(): void {
		if (this.selectedId && indexOfLayer(this.comp.layers, this.selectedId) !== -1) return;
		const top = this.comp.layers[this.comp.layers.length - 1];
		this.selectedId = top?.id ?? null;
	}

	// ── mutations: continuous (no own history — bracketed by begin/end) ──

	private setLayers(layers: Layer[]): void {
		this.comp = { ...this.comp, layers };
	}

	updateSelected(changes: Partial<Layer>): void {
		if (!this.selectedId) return;
		this.setLayers(updateLayer(this.comp.layers, this.selectedId, changes));
	}

	updateLayerById(id: string, changes: Partial<Layer>): void {
		this.setLayers(updateLayer(this.comp.layers, id, changes));
	}

	// A coalesced nudge of the selected image layer (arrow keys).
	nudge(dx: number, dy: number): void {
		const sel = this.selected;
		if (!sel || sel.kind !== 'image') return;
		this.touch();
		this.updateSelected({
			x: clampOffset(sel.x + dx),
			y: clampOffset(sel.y + dy)
		} as Partial<Layer>);
	}

	// A coalesced scale of the selected image layer (scroll wheel).
	scaleSelected(factor: number): void {
		const sel = this.selected;
		if (!sel || sel.kind !== 'image') return;
		this.touch();
		this.updateSelected({ scale: clampScale(sel.scale * factor) } as Partial<Layer>);
	}

	// ── mutations: discrete (own history step) ─────────────────────────

	addLayer(layer: Layer): void {
		this.commit(() => {
			this.setLayers(addLayerAbove(this.comp.layers, layer, this.selectedId));
			this.selectedId = layer.id;
		});
	}

	addBackdrop(fill: Fill, name = 'backdrop'): void {
		this.commit(() => {
			const layer = createFillLayer(fill, name);
			this.setLayers([layer, ...this.comp.layers]);
			this.selectedId = layer.id;
		});
	}

	removeSelected(): void {
		if (!this.selectedId) return;
		this.commit(() => {
			this.setLayers(removeLayer(this.comp.layers, this.selectedId!));
			this.ensureSelection();
		});
	}

	duplicateSelected(): void {
		const sel = this.selected;
		if (!sel) return;
		this.commit(() => {
			const copy = duplicateLayer(sel);
			this.setLayers(addLayerAbove(this.comp.layers, copy, sel.id));
			this.selectedId = copy.id;
		});
	}

	move(dir: 'up' | 'down'): void {
		if (!this.selectedId) return;
		this.commit(() => this.setLayers(moveLayer(this.comp.layers, this.selectedId!, dir)));
	}

	toEnd(end: 'front' | 'back'): void {
		if (!this.selectedId) return;
		this.commit(() => this.setLayers(moveLayerToEnd(this.comp.layers, this.selectedId!, end)));
	}

	toggleHidden(id: string): void {
		const layer = this.comp.layers.find((l) => l.id === id);
		if (!layer) return;
		this.commit(() => this.updateLayerById(id, { hidden: !layer.hidden }));
	}

	loadScene(preset: ScenePreset): void {
		this.commit(() => {
			const layers = preset.build();
			this.setLayers(layers);
			this.selectedId = layers[layers.length - 1]?.id ?? null;
		});
	}

	clearAll(): void {
		if (this.isEmpty) return;
		this.commit(() => {
			this.setLayers([]);
			this.selectedId = null;
		});
	}

	// ── outline preview cache ──────────────────────────────────────────
	// Outlines are baked to a bitmap (see outline.ts); too costly to redo on
	// every frame, so the live preview reads a cached bake and the stage shows
	// the plain art until a fresh one lands.

	private outlineKey(layer: ImageLayer): string {
		return `${layer.src.length}:${layer.src.slice(0, 48)}:${JSON.stringify(layer.outline)}`;
	}

	// The source the stage should display for an image layer — its baked outline
	// when one is current, otherwise the untouched art.
	renderSrc(layer: ImageLayer): string {
		if (!layer.outline) return layer.src;
		const got = this.baked[layer.id];
		return got && got.key === this.outlineKey(layer) ? got.src : layer.src;
	}

	// Drive the cache from a component $effect: (re)bake changed outlines and
	// drop caches for layers that lost theirs or were removed.
	syncBakes(): void {
		const live = new Set<string>();
		for (const layer of this.comp.layers) {
			if (layer.kind !== 'image' || !layer.outline) continue;
			live.add(layer.id);
			const key = this.outlineKey(layer);
			if (this.baked[layer.id]?.key === key) continue;
			if (this.bakeWant.get(layer.id) === key) continue;
			this.scheduleBake(layer, key);
		}
		for (const id of Object.keys(this.baked)) {
			if (!live.has(id)) {
				const next = { ...this.baked };
				delete next[id];
				this.baked = next;
			}
		}
	}

	private scheduleBake(layer: ImageLayer, key: string): void {
		this.bakeWant.set(layer.id, key);
		const prev = this.bakeTimers.get(layer.id);
		if (prev) clearTimeout(prev);
		const id = layer.id;
		const src = layer.src;
		const nw = layer.naturalW;
		const nh = layer.naturalH;
		const outline = JSON.parse(JSON.stringify(layer.outline));
		const timer = setTimeout(async () => {
			this.bakeTimers.delete(id);
			try {
				const out = await bakeOutline(src, nw, nh, outline);
				if (this.bakeWant.get(id) === key) this.baked = { ...this.baked, [id]: { key, src: out } };
			} catch {
				// leave the preview on the plain art
			}
		}, 70);
		this.bakeTimers.set(id, timer);
	}
}

export { scenePresets };
