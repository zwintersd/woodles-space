import { createVersionedStorage } from '@woodles/persistence';
import type { WoodlesRef } from '@shared/homesuiteBridge';

export const HOMESUITE_FOLDERS_KEY = 'woodles.homesuite.folders.v1';
export type HomeSuiteFolder = { id: string; name: string; parentId: string | null };
export type FolderLibrary = {
	folders: HomeSuiteFolder[];
	placements: { ref: WoodlesRef; folderId: string }[];
};

export function refKey(ref: WoodlesRef): string {
	return JSON.stringify([ref.app, ref.kind, ref.id]);
}

function isLibrary(value: unknown): value is FolderLibrary {
	if (!value || typeof value !== 'object') return false;
	const library = value as FolderLibrary;
	if (!Array.isArray(library.folders) || !Array.isArray(library.placements)) return false;
	const ids = new Set<string>();
	for (const folder of library.folders) {
		if (!folder || typeof folder.id !== 'string' || !folder.id || folder.id === 'root' || ids.has(folder.id) ||
			typeof folder.name !== 'string' || !folder.name.trim() ||
			!(folder.parentId === null || typeof folder.parentId === 'string')) return false;
		ids.add(folder.id);
	}
	const byId = new Map(library.folders.map((folder) => [folder.id, folder]));
	for (const folder of library.folders) {
		const seen = new Set([folder.id]);
		let parent = folder.parentId;
		while (parent !== null) {
			if (!ids.has(parent) || seen.has(parent)) return false;
			seen.add(parent);
			parent = byId.get(parent)!.parentId;
		}
	}
	const refs = new Set<string>();
	for (const placement of library.placements) {
		const ref = placement?.ref;
		if (!ref || !['app', 'kind', 'id'].every((key) => typeof ref[key as keyof WoodlesRef] === 'string' && ref[key as keyof WoodlesRef]) ||
			!ids.has(placement.folderId) || refs.has(refKey(ref))) return false;
		refs.add(refKey(ref));
	}
	return true;
}

const store = createVersionedStorage<FolderLibrary>({
	key: HOMESUITE_FOLDERS_KEY,
	version: 1,
	fallback: () => ({ folders: [], placements: [] }),
	validate: isLibrary
});

export function loadFolders() {
	return store.load();
}

/** Read again for every edit so another tab's organization is preserved. */
function edit(change: (library: FolderLibrary) => void): FolderLibrary {
	const loaded = store.load();
	if (loaded.source === 'fallback' && loaded.issue) {
		throw new Error(`Folder organization could not be read. Nothing was saved. ${loaded.issue.message}`);
	}
	change(loaded.value);
	const saved = store.save(loaded.value);
	if (!saved.ok) throw new Error(saved.issue?.message ?? 'Could not save folder organization.');
	return loaded.value;
}

function requireFolder(library: FolderLibrary, id: string): HomeSuiteFolder {
	const folder = library.folders.find((entry) => entry.id === id);
	if (!folder) throw new Error('That folder is no longer available.');
	return folder;
}

function availableName(library: FolderLibrary, name: string, parentId: string | null, except?: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Give the folder a name.');
	if (trimmed.length > 120) throw new Error('Use a folder name of 120 characters or fewer.');
	if (library.folders.some((folder) => folder.id !== except && folder.parentId === parentId && folder.name.toLowerCase() === trimmed.toLowerCase())) {
		throw new Error('A folder with that name already exists here.');
	}
	return trimmed;
}

export function createFolder(name: string, parentId: string | null = null): HomeSuiteFolder {
	let created!: HomeSuiteFolder;
	edit((library) => {
		if (parentId !== null) requireFolder(library, parentId);
		created = { id: crypto.randomUUID(), name: availableName(library, name, parentId), parentId };
		library.folders.push(created);
	});
	return created;
}

export function renameFolder(id: string, name: string): void {
	edit((library) => {
		const folder = requireFolder(library, id);
		folder.name = availableName(library, name, folder.parentId, id);
	});
}

export function folderPath(library: FolderLibrary, id: string | null): HomeSuiteFolder[] {
	const path: HomeSuiteFolder[] = [];
	const seen = new Set<string>();
	while (id !== null && !seen.has(id)) {
		seen.add(id);
		const folder = library.folders.find((entry) => entry.id === id);
		if (!folder) break;
		path.unshift(folder);
		id = folder.parentId;
	}
	return path;
}

export function folderTree(library: FolderLibrary): { folder: HomeSuiteFolder; depth: number; path: string }[] {
	const rows: ReturnType<typeof folderTree> = [];
	function visit(parentId: string | null, depth: number, names: string[]) {
		for (const folder of library.folders.filter((entry) => entry.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))) {
			rows.push({ folder, depth, path: [...names, folder.name].join(' / ') });
			visit(folder.id, depth + 1, [...names, folder.name]);
		}
	}
	visit(null, 0, []);
	return rows;
}

export function folderForRef(library: FolderLibrary, ref: WoodlesRef): string | null {
	return library.placements.find((placement) => refKey(placement.ref) === refKey(ref))?.folderId ?? null;
}

export function moveFilesToFolder(refs: WoodlesRef[], folderId: string | null): void {
	edit((library) => {
		if (folderId !== null) requireFolder(library, folderId);
		const unique = new Map(refs.map((ref) => [refKey(ref), ref]));
		library.placements = library.placements.filter((placement) => !unique.has(refKey(placement.ref)));
		if (folderId !== null) library.placements.push(...[...unique.values()].map((ref) => ({ ref: { ...ref }, folderId })));
	});
}

export function moveFolder(id: string, parentId: string | null): void {
	edit((library) => {
		const folder = requireFolder(library, id);
		if (parentId !== null) {
			requireFolder(library, parentId);
			if (folderPath(library, parentId).some((entry) => entry.id === id)) throw new Error('A folder cannot move into itself or one of its subfolders.');
		}
		availableName(library, folder.name, parentId, id);
		folder.parentId = parentId;
	});
}

/** Lift contents one level; never delete anything in an owning app. */
export function removeFolder(id: string): void {
	edit((library) => {
		const folder = requireFolder(library, id);
		for (const child of library.folders.filter((entry) => entry.parentId === id)) {
			// Keep both folders when lifting would otherwise give siblings the same name.
			const original = child.name;
			let suffix = 2;
			while (library.folders.some((entry) => entry.id !== id && entry.id !== child.id && entry.parentId === folder.parentId && entry.name.toLowerCase() === child.name.toLowerCase())) {
				child.name = `${original} (${suffix++})`;
			}
			child.parentId = folder.parentId;
		}
		library.placements = library.placements.flatMap((placement) => placement.folderId !== id ? [placement] :
			folder.parentId === null ? [] : [{ ...placement, folderId: folder.parentId }]);
		library.folders = library.folders.filter((entry) => entry.id !== id);
	});
}
