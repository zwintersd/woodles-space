const DB_NAME = 'whiteboard-assets';
const STORE = 'images';
const VERSION = 1;

export type ImageAsset = {
	id: string;
	name: string;
	blob: Blob;
	createdAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not open image storage.'));
	});
	return dbPromise;
}

export function imageStorageAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}

export async function saveImageAsset(asset: ImageAsset): Promise<void> {
	const db = await openDatabase();
	await transaction(db, 'readwrite', (store) => store.put(asset, asset.id));
}

export async function getImageAsset(id: string): Promise<ImageAsset | undefined> {
	const db = await openDatabase();
	return transaction(db, 'readonly', (store) => store.get(id));
}

export async function removeImageAsset(id: string): Promise<void> {
	const db = await openDatabase();
	await transaction(db, 'readwrite', (store) => store.delete(id));
}

function transaction<T>(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const request = action(tx.objectStore(STORE));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('The image store could not complete that action.'));
		tx.onerror = () => reject(tx.error ?? new Error('The image store could not complete that action.'));
		tx.onabort = () => reject(tx.error ?? new Error('The image store was interrupted.'));
	});
}

export function imageDimensions(source: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
		image.onerror = () => reject(new Error('That image could not be read.'));
		image.src = source;
	});
}
