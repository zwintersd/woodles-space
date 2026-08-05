import { createVersionedStorage } from '@woodles/persistence';
import {
	cozyGarden,
	emptyGameDef,
	isProjectIndex,
	LIBRARY_VERSION,
	parseGameDef,
	PROJECT_INDEX_KEY,
	projectKey,
	type GameDef,
	type ProjectIndex,
	type ProjectSummary
} from '@woodles/incremental-core';

/**
 * Projects live in localStorage, one entry per project plus an index. The
 * MVP's whole persistence story is this plus JSON export/import — `@woodles/sync`
 * is a Phase 4 promise, and wiring it in early would freeze an API before the
 * editor has stopped moving.
 */

// Key names and blob shapes come from the core so the player, which reads the
// very same entries, cannot drift from what the studio writes.
export type { ProjectSummary };

const indexStore = createVersionedStorage<ProjectIndex>({
	key: PROJECT_INDEX_KEY,
	version: LIBRARY_VERSION,
	fallback: () => ({ projects: [], lastOpenedId: null }),
	validate: isProjectIndex
});

function projectStore(id: string) {
	return createVersionedStorage<GameDef>({
		key: projectKey(id),
		version: LIBRARY_VERSION,
		fallback: () => emptyGameDef(),
		// The def is re-validated on the way in as well as on the way out: a
		// half-written localStorage entry should fall back to the backup copy
		// rather than load an economy the engine will refuse to run.
		validate: (value): value is GameDef => {
			try {
				parseGameDef(value);
				return true;
			} catch {
				return false;
			}
		}
	});
}

export function listProjects(): ProjectSummary[] {
	return [...indexStore.load().value.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function lastOpenedId(): string | null {
	return indexStore.load().value.lastOpenedId;
}

export function loadProject(id: string): GameDef | null {
	const result = projectStore(id).load();
	return result.source === 'fallback' ? null : result.value;
}

export function saveProject(id: string, def: GameDef): boolean {
	const saved = projectStore(id).save(def);
	if (!saved.ok) return false;

	const index = indexStore.load().value;
	const summary: ProjectSummary = { id, title: def.meta.title, updatedAt: saved.savedAt ?? new Date().toISOString() };
	indexStore.save({
		projects: [...index.projects.filter((project) => project.id !== id), summary],
		lastOpenedId: id
	});
	return true;
}

export function markOpened(id: string): void {
	const index = indexStore.load().value;
	indexStore.save({ ...index, lastOpenedId: id });
}

/**
 * Retitles a project on disk without touching `meta.id` — that's the key the
 * player's save progress is filed under, and a rename that drifted it would
 * silently orphan a save.
 */
export function renameProject(id: string, title: string): boolean {
	const def = loadProject(id);
	if (!def) return false;
	def.meta.title = title;
	return saveProject(id, def);
}

/** Clones a project's definition under a fresh id, `"<title> copy"` titled. */
export function duplicateProject(id: string): string | null {
	const def = loadProject(id);
	if (!def) return null;
	const clone = structuredClone(def);
	clone.meta.title = `${def.meta.title} copy`;
	const copyId = newProjectId();
	return saveProject(copyId, clone) ? copyId : null;
}

export function deleteProject(id: string): void {
	try {
		localStorage.removeItem(projectKey(id));
		localStorage.removeItem(`${projectKey(id)}.backup`);
	} catch {
		// A browser that refuses to remove an item will also refuse to save, and
		// the index update below is what actually takes the project out of view.
	}
	const index = indexStore.load().value;
	const projects = index.projects.filter((project) => project.id !== id);
	indexStore.save({
		projects,
		lastOpenedId: index.lastOpenedId === id ? (projects[0]?.id ?? null) : index.lastOpenedId
	});
}

// ── the whole shelf, for sync ────────────────────────────────────────────

/**
 * Every project in one blob: the index, plus each definition keyed by project
 * id. This is the unit `@woodles/sync` moves, because syncing a single project
 * would quietly lose the rest.
 */
export interface LibraryBlob {
	index: ProjectIndex;
	defs: Record<string, GameDef>;
}

export function readLibrary(): LibraryBlob {
	const index = indexStore.load().value;
	const defs: Record<string, GameDef> = {};
	for (const summary of index.projects) {
		const def = loadProject(summary.id);
		if (def) defs[summary.id] = def;
	}
	// Only projects whose definition actually loaded: shipping an index entry
	// with nothing behind it would give the other device a phantom project.
	return { index: { ...index, projects: index.projects.filter((summary) => defs[summary.id]) }, defs };
}

/** Applies a synced shelf locally, replacing what was here. */
export function writeLibrary(blob: LibraryBlob): void {
	for (const summary of blob.index.projects) {
		const def = blob.defs[summary.id];
		if (!def) continue;
		projectStore(summary.id).save(def);
	}
	indexStore.save(blob.index);
}

/** A fresh project id. Time-ordered so the picker's sort is stable without a clock skew fight. */
export function newProjectId(): string {
	return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * What a first-time visitor opens. An empty canvas is honest but says nothing
 * about what the tool is for; the cozy garden is a working economy you can
 * press play on and then take apart.
 */
export function starterProject(): GameDef {
	return structuredClone(cozyGarden);
}

/**
 * The saved copy of the example garden, if one is still around. Matched on
 * `meta.id` rather than on title, so renaming it doesn't strand it — and
 * returning null is a fine answer, since the caller can always make a fresh one.
 */
export function findExampleProject(): string | null {
	for (const summary of listProjects()) {
		if (loadProject(summary.id)?.meta.id === cozyGarden.meta.id) return summary.id;
	}
	return null;
}
