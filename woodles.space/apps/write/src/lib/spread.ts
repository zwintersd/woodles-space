import { VIEW_PREFS_KEY } from './storage';
import type { LayerId } from './types';

/**
 * The open notebook: two facing pages instead of one page at a time.
 *
 * Write has always held three layers — the prose, the working notes behind it,
 * and the impulse under that — but only ever showed one, behind a tab switch.
 * A spread shows two at once, which is what the layers were always for: you
 * keep your thinking open on the left while the prose grows on the right.
 *
 * These are **device preferences, not document content** — how you like to sit
 * at the desk, not what you wrote — so they live in their own localStorage key
 * beside the pockets order, never in a draft body.
 */

export type ViewMode = 'page' | 'spread';
export type PageSide = 'verso' | 'recto';

export interface ViewPrefs {
	mode: ViewMode;
	/** Ruled paper. A look, independent of how many pages are open. */
	ruled: boolean;
	/** Left page. */
	verso: LayerId;
	/** Right page — where the prose sits by default. */
	recto: LayerId;
}

export const VIEW_MODES: readonly ViewMode[] = ['page', 'spread'];

/**
 * Working notes on the left, prose on the right — the way a person actually
 * uses a notebook, with the thinking beside the thing rather than under it.
 */
export const DEFAULT_VIEW_PREFS: ViewPrefs = {
	mode: 'spread',
	ruled: true,
	verso: 'midground',
	recto: 'foreground'
};

const LAYERS: readonly LayerId[] = ['foreground', 'midground', 'background'];

function isLayer(value: unknown): value is LayerId {
	return LAYERS.includes(value as LayerId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read stored prefs defensively, field by field — a bad `mode` shouldn't cost
 * you your ruled paper. The one invariant worth defending is that the two
 * pages never show the same layer: one element can't be in two places, so a
 * collision would blank a page rather than duplicate it.
 */
export function coerceViewPrefs(value: unknown): ViewPrefs {
	if (!isRecord(value)) return DEFAULT_VIEW_PREFS;
	const mode = VIEW_MODES.includes(value.mode as ViewMode)
		? (value.mode as ViewMode)
		: DEFAULT_VIEW_PREFS.mode;
	const ruled = typeof value.ruled === 'boolean' ? value.ruled : DEFAULT_VIEW_PREFS.ruled;
	const verso = isLayer(value.verso) ? value.verso : DEFAULT_VIEW_PREFS.verso;
	let recto = isLayer(value.recto) ? value.recto : DEFAULT_VIEW_PREFS.recto;
	if (recto === verso) {
		recto = LAYERS.find((layer) => layer !== verso) as LayerId;
	}
	return { mode, ruled, verso, recto };
}

/**
 * Put a layer on a page. Asking for the layer the *other* page is showing
 * swaps them rather than refusing — the two pages trade places, which is what
 * the gesture obviously means and keeps verso ≠ recto true by construction.
 */
export function assignLayer(prefs: ViewPrefs, side: PageSide, layer: LayerId): ViewPrefs {
	if (prefs[side] === layer) return prefs;
	const other: PageSide = side === 'verso' ? 'recto' : 'verso';
	if (prefs[other] === layer) {
		return { ...prefs, [side]: layer, [other]: prefs[side] };
	}
	return { ...prefs, [side]: layer };
}

/** Which layers are on screen — one in page view, two in a spread. */
export function visibleLayers(prefs: ViewPrefs, activeLayer: LayerId): LayerId[] {
	return prefs.mode === 'spread' ? [prefs.verso, prefs.recto] : [activeLayer];
}

export function isLayerVisible(
	prefs: ViewPrefs,
	activeLayer: LayerId,
	layer: LayerId
): boolean {
	return visibleLayers(prefs, activeLayer).includes(layer);
}

/**
 * Flex/grid order for a layer's page. Verso first, recto last, with the spine
 * between them; a hidden page's order never matters but stays stable anyway.
 */
export function pageOrder(prefs: ViewPrefs, layer: LayerId): number {
	if (prefs.mode !== 'spread') return 2;
	if (layer === prefs.verso) return 1;
	if (layer === prefs.recto) return 3;
	return 2;
}

/** Which side a layer is on, or null when it isn't open. */
export function sideOf(prefs: ViewPrefs, layer: LayerId): PageSide | null {
	if (prefs.mode !== 'spread') return null;
	if (layer === prefs.verso) return 'verso';
	if (layer === prefs.recto) return 'recto';
	return null;
}

export function loadViewPrefs(): ViewPrefs {
	if (typeof localStorage === 'undefined') return DEFAULT_VIEW_PREFS;
	try {
		const raw = localStorage.getItem(VIEW_PREFS_KEY);
		if (!raw) return DEFAULT_VIEW_PREFS;
		return coerceViewPrefs(JSON.parse(raw));
	} catch {
		return DEFAULT_VIEW_PREFS;
	}
}

export function saveViewPrefs(prefs: ViewPrefs): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// A view preference is never worth surfacing a quota error for.
	}
}
