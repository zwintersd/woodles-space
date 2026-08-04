import { createVersionedStorage } from '@woodles/persistence';
import {
	cozyGarden,
	isProjectIndex,
	isSaveGame,
	LAST_PLAYED_KEY,
	LIBRARY_VERSION,
	parseGameDef,
	PROJECT_INDEX_KEY,
	projectKey,
	saveKey,
	type GameDef,
	type ProjectIndex,
	type ProjectSummary,
	type SaveGame
} from '@woodles/incremental-core';

/**
 * Reading the studio's shelf.
 *
 * The player and the studio sit on one origin, so "play this" needs no export
 * step — the player simply reads the same localStorage entries the studio
 * writes. The key names and blob shapes come from the core rather than being
 * retyped here, which is what stops the two apps drifting apart.
 *
 * Read-only, deliberately: a player must never be able to edit the game out
 * from under its own save.
 */

const indexStore = createVersionedStorage<ProjectIndex>({
	key: PROJECT_INDEX_KEY,
	version: LIBRARY_VERSION,
	fallback: () => ({ projects: [], lastOpenedId: null }),
	validate: isProjectIndex
});

export function listProjects(): ProjectSummary[] {
	return [...indexStore.load().value.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadProject(id: string): GameDef | null {
	const store = createVersionedStorage<GameDef>({
		key: projectKey(id),
		version: LIBRARY_VERSION,
		fallback: () => cozyGarden,
		validate: (value): value is GameDef => {
			try {
				parseGameDef(value);
				return true;
			} catch {
				return false;
			}
		}
	});
	const result = store.load();
	return result.source === 'fallback' ? null : result.value;
}

/** The bundled game, for a visitor who arrived without one of their own. */
export function exampleGame(): GameDef {
	return structuredClone(cozyGarden);
}

// ── what you had open ────────────────────────────────────────────────────

const lastPlayedStore = createVersionedStorage<GameDef | null>({
	key: LAST_PLAYED_KEY,
	version: LIBRARY_VERSION,
	fallback: () => null,
	validate: (value): value is GameDef | null => {
		if (value === null) return true;
		try {
			parseGameDef(value);
			return true;
		} catch {
			return false;
		}
	}
});

/** Reloading the page should land you back in your game, not at the shelf. */
export function rememberLastPlayed(def: GameDef): void {
	lastPlayedStore.save(def);
}

export function lastPlayed(): GameDef | null {
	return lastPlayedStore.load().value;
}

export function forgetLastPlayed(): void {
	lastPlayedStore.save(null);
}

// ── saves ────────────────────────────────────────────────────────────────
// A save is keyed by `meta.id`, not by project id: the same game played from
// two different project entries is the same game, and a player who reimports
// their own export should find their progress waiting.

function saveStore(gameId: string) {
	return createVersionedStorage<SaveGame | null>({
		key: saveKey(gameId),
		version: LIBRARY_VERSION,
		fallback: () => null,
		validate: (value): value is SaveGame | null => value === null || isSaveGame(value)
	});
}

export function loadSave(gameId: string): SaveGame | null {
	return saveStore(gameId).load().value;
}

export function writeSave(gameId: string, save: SaveGame): boolean {
	return saveStore(gameId).save(save).ok;
}

export function clearSave(gameId: string): void {
	try {
		localStorage.removeItem(saveKey(gameId));
		localStorage.removeItem(`${saveKey(gameId)}.backup`);
	} catch {
		// Nothing to do: a browser that won't remove an item won't have saved one.
	}
}
