import type { HomeSuiteArtifactKind, WoodlesRef } from './homesuiteBridge';

export const HOMESUITE_TRASH_KEY = 'woodles.homesuite.trash.v1';

export type HomeSuiteTrashEntry = {
	ref: WoodlesRef;
	kind: HomeSuiteArtifactKind;
	title: string;
	updatedAt: string;
	trashedAt: string;
};

function storage(): Storage | null {
	return typeof localStorage === 'undefined' ? null : localStorage;
}

function sameRef(a: WoodlesRef, b: WoodlesRef): boolean {
	return a.app === b.app && a.kind === b.kind && a.id === b.id;
}

export function listHomeSuiteTrash(): HomeSuiteTrashEntry[] {
	const store = storage();
	if (!store) return [];
	try {
		const value: unknown = JSON.parse(store.getItem(HOMESUITE_TRASH_KEY) ?? '[]');
		if (!Array.isArray(value)) return [];
		return value.filter((entry): entry is HomeSuiteTrashEntry =>
			typeof entry === 'object' && entry !== null &&
			typeof entry.ref?.app === 'string' && typeof entry.ref?.kind === 'string' && typeof entry.ref?.id === 'string' &&
			['document', 'board', 'collection'].includes(entry.kind) && typeof entry.title === 'string' &&
			typeof entry.updatedAt === 'string' && typeof entry.trashedAt === 'string'
		);
	} catch {
		return [];
	}
}

function save(entries: HomeSuiteTrashEntry[]): void {
	storage()?.setItem(HOMESUITE_TRASH_KEY, JSON.stringify(entries));
}

export function isHomeSuiteTrashed(ref: WoodlesRef): boolean {
	return listHomeSuiteTrash().some((entry) => sameRef(entry.ref, ref));
}

export function moveHomeSuiteArtifactToTrash(entry: Omit<HomeSuiteTrashEntry, 'trashedAt'>): void {
	const entries = listHomeSuiteTrash().filter((item) => !sameRef(item.ref, entry.ref));
	save([...entries, { ...entry, ref: { ...entry.ref }, trashedAt: new Date().toISOString() }]);
}

export function restoreHomeSuiteArtifact(ref: WoodlesRef): void {
	save(listHomeSuiteTrash().filter((entry) => !sameRef(entry.ref, ref)));
}

export function forgetHomeSuiteArtifact(ref: WoodlesRef): void {
	restoreHomeSuiteArtifact(ref);
}
