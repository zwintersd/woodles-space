// A tiny IndexedDB key/value store.
//
// The bestiary keeps each creature's art inline as base64 data URLs — a
// flattened sprite plus, for studio art, every layer's own source. A handful
// of cards easily runs to several megabytes, and localStorage caps at ~5MB per
// origin (shared across every woodles app on the domain). Past that ceiling
// setItem throws QuotaExceededError and the write is silently lost, so the
// collection comes back empty. IndexedDB's quota is orders of magnitude
// larger, so card art actually persists.
//
// This is a deliberately minimal wrapper: one database, one object store, get
// and set keyed by string. Values are stored by structured clone (no JSON
// round-trip), so pass plain objects — Svelte $state proxies must be snapshot
// first by the caller.

const DB_NAME = 'bestiary';
const STORE = 'kv';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve(req.result as T | undefined);
		req.onerror = () => reject(req.error);
	});
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}
