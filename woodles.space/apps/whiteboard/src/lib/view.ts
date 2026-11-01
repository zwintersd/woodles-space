import { createVersionedStorage, type StorageLike } from '@woodles/persistence';
import { DEFAULT_PLACEMENT, GRID_SIZES, PLACE_GAPS, PLACE_KEEPS, PLACE_MODES, type PlaceGap, type PlaceKeep, type PlaceMode, type PlacementSettings } from './placement';

/**
 * What this device wants to *see* of the app, as opposed to what any board
 * holds. Deliberately not part of the document: hiding the overview map is a
 * statement about the window you are working in, not about the board, and it
 * should not travel to another device or into a duplicate.
 */

export const VIEW_STORAGE_KEY = 'woodles.whiteboard.view.v1';
export const VIEW_SCHEMA_VERSION = 1;

export type ViewPreferences = {
	/**
	 * Let the edges rest: the chrome fades out a few seconds after you stop
	 * moving, and comes back the moment you do. Off pins everything in place.
	 */
	restChrome: boolean;
	/** The overview map. Off by default — it is a thing you ask for, not furniture. */
	minimapOn: boolean;
	snap?: boolean;
	/** Where new things go: the middle of the screen, in a column under the last one, or flowing across. */
	place?: PlaceMode;
	/** Space between things placed in a run. */
	gap?: PlaceGap;
	/** How long the last addition stays the thing to continue from. */
	keep?: PlaceKeep;
	/** Grid size in board units for snapping dragged and placed things; 0 or absent is off. */
	grid?: number;
};

/** The placement choices with the defaults filled in. */
export function placementSettings(view: ViewPreferences): PlacementSettings {
	return {
		mode: view.place ?? DEFAULT_PLACEMENT.mode,
		gap: view.gap ?? DEFAULT_PLACEMENT.gap,
		keep: view.keep ?? DEFAULT_PLACEMENT.keep,
		grid: view.grid ?? DEFAULT_PLACEMENT.grid
	};
}

export const DEFAULT_VIEW: ViewPreferences = { restChrome: true, minimapOn: false };

export function isViewPreferences(value: unknown): value is ViewPreferences {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return typeof record.restChrome === 'boolean' && typeof record.minimapOn === 'boolean' && (record.snap === undefined || typeof record.snap === 'boolean') &&
		(record.place === undefined || PLACE_MODES.includes(record.place as PlaceMode)) &&
		(record.gap === undefined || PLACE_GAPS.includes(record.gap as PlaceGap)) &&
		(record.keep === undefined || PLACE_KEEPS.includes(record.keep as PlaceKeep)) &&
		(record.grid === undefined || GRID_SIZES.includes(record.grid as number));
}

/** Anything unreadable falls back to the default rather than costing the rest. */
export function normalizeView(value: unknown): ViewPreferences {
	const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
	return {
		restChrome: typeof record.restChrome === 'boolean' ? record.restChrome : DEFAULT_VIEW.restChrome,
		minimapOn: typeof record.minimapOn === 'boolean' ? record.minimapOn : DEFAULT_VIEW.minimapOn,
		...(typeof record.snap === 'boolean' ? { snap: record.snap } : {}),
		...(PLACE_MODES.includes(record.place as PlaceMode) ? { place: record.place as PlaceMode } : {}),
		...(PLACE_GAPS.includes(record.gap as PlaceGap) ? { gap: record.gap as PlaceGap } : {}),
		...(PLACE_KEEPS.includes(record.keep as PlaceKeep) ? { keep: record.keep as PlaceKeep } : {}),
		...(GRID_SIZES.includes(record.grid as number) ? { grid: record.grid as number } : {})
	};
}

export function createViewStorage(storage?: StorageLike | null) {
	return createVersionedStorage<ViewPreferences>({
		key: VIEW_STORAGE_KEY,
		version: VIEW_SCHEMA_VERSION,
		fallback: () => ({ ...DEFAULT_VIEW }),
		validate: isViewPreferences,
		migrate: normalizeView,
		...(storage === undefined ? {} : { storage })
	});
}

export const viewPreferences = createViewStorage();
