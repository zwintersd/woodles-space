import { describe, expect, it } from 'vitest';
import { createViewStorage, DEFAULT_VIEW, isViewPreferences, normalizeView, VIEW_STORAGE_KEY } from './view';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

describe('what this device wants to see', () => {
	it('starts with the edges resting and the map put away', () => {
		expect(DEFAULT_VIEW).toEqual({ restChrome: true, minimapOn: false });
	});

	it('remembers a choice across a reload', () => {
		const storage = memoryStorage();
		createViewStorage(storage).save({ restChrome: false, minimapOn: true });
		expect(createViewStorage(storage).load().value).toEqual({ restChrome: false, minimapOn: true });
	});

	it('falls back to the default rather than to nothing when the save is unreadable', () => {
		const storage = memoryStorage();
		storage.setItem(VIEW_STORAGE_KEY, '{ not json');
		const loaded = createViewStorage(storage).load();
		expect(loaded.source).toBe('fallback');
		expect(loaded.value).toEqual(DEFAULT_VIEW);
	});

	it('works at all when there is no storage to work with', () => {
		const loaded = createViewStorage(null).load();
		expect(loaded.value).toEqual(DEFAULT_VIEW);
		expect(createViewStorage(null).save({ ...DEFAULT_VIEW }).ok).toBe(false);
	});

	it('knows a whole preference set from half of one', () => {
		expect(isViewPreferences({ restChrome: true, minimapOn: false })).toBe(true);
		expect(isViewPreferences({ restChrome: true })).toBe(false);
		expect(isViewPreferences(null)).toBe(false);
	});

	it('keeps the half it can read', () => {
		expect(normalizeView({ minimapOn: true })).toEqual({ restChrome: true, minimapOn: true });
		expect(normalizeView({ restChrome: 'yes' })).toEqual(DEFAULT_VIEW);
	});
});
