// Read-only access to the Bestiary app's IndexedDB store.
//
// Both apps share the same origin (woodles.space), so Marginalia can open the
// 'bestiary' database directly and read the creature list. This file only ever
// reads — it never writes to Bestiary's store.

const DB_NAME = 'bestiary';
const STORE = 'kv';
const CREATURES_KEY = 'bestiary.creatures.v1';

// Minimal shape of a Bestiary creature — only the fields Marginalia needs.
export interface BestiaryCreature {
	id: string;
	name: string;
	domain: string;
	sprite: string | null;
	// set by the studio when saving; null means no creature layer was present.
	isolatedSprite?: string | null;
	pixelated: boolean;
}

function openBestiaryDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function getBestiaryCreatures(): Promise<BestiaryCreature[]> {
	if (typeof indexedDB === 'undefined') return [];
	try {
		const db = await openBestiaryDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).get(CREATURES_KEY);
			req.onsuccess = () => resolve((req.result as BestiaryCreature[] | undefined) ?? []);
			req.onerror = () => resolve([]);
		});
	} catch {
		return [];
	}
}
