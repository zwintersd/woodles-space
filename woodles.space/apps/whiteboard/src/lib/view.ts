import { createVersionedStorage, type StorageLike } from '@woodles/persistence';

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
};

export const DEFAULT_VIEW: ViewPreferences = { restChrome: true, minimapOn: false };

export function isViewPreferences(value: unknown): value is ViewPreferences {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return typeof record.restChrome === 'boolean' && typeof record.minimapOn === 'boolean';
}

/** Anything unreadable falls back to the default rather than costing the rest. */
export function normalizeView(value: unknown): ViewPreferences {
	const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
	return {
		restChrome: typeof record.restChrome === 'boolean' ? record.restChrome : DEFAULT_VIEW.restChrome,
		minimapOn: typeof record.minimapOn === 'boolean' ? record.minimapOn : DEFAULT_VIEW.minimapOn
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
