/**
 * Where a Bloomforge project lives, and under what shape.
 *
 * The studio writes these keys and the player reads them — two apps on one
 * origin, which is the whole reason "open this in the player" needs no export
 * step. Keeping the contract here rather than in either app means neither can
 * quietly drift from the other; it is data, not behaviour, so it costs core
 * nothing and stays free of the DOM.
 */

export const PROJECT_INDEX_KEY = 'bloomforge-projects';
export const PROJECT_PREFIX = 'bloomforge-project';
export const SAVE_PREFIX = 'bloomforge-save';
/**
 * The game the player had open. Holds the whole definition rather than a
 * pointer to one, so a game opened from a file resumes as readily as one off
 * the studio's shelf.
 */
export const LAST_PLAYED_KEY = 'bloomforge-player-last';
export const LIBRARY_VERSION = 1;

/** Storage key for one project's definition. */
export function projectKey(id: string): string {
	return `${PROJECT_PREFIX}:${id}`;
}

/** Storage key for a player's progress through one game. Keyed by `meta.id`. */
export function saveKey(gameId: string): string {
	return `${SAVE_PREFIX}:${gameId}`;
}

export interface ProjectSummary {
	id: string;
	title: string;
	updatedAt: string;
}

export interface ProjectIndex {
	projects: ProjectSummary[];
	lastOpenedId: string | null;
}

export function isProjectIndex(value: unknown): value is ProjectIndex {
	return !!value && typeof value === 'object' && Array.isArray((value as ProjectIndex).projects);
}

/**
 * Merges two project indexes, newest-wins per project.
 *
 * This is what makes syncing a library across devices safe: editing a
 * different project on each device has to leave you with both, not with
 * whichever device wrote last. Deterministic and order-independent — merging
 * A into B gives the same answer as B into A, which is the property a sync
 * layer retries against.
 */
export function mergeProjectIndexes(local: ProjectIndex, remote: ProjectIndex): ProjectIndex {
	const byId = new Map<string, ProjectSummary>();
	for (const summary of [...remote.projects, ...local.projects]) {
		const existing = byId.get(summary.id);
		if (!existing || summary.updatedAt > existing.updatedAt) byId.set(summary.id, summary);
	}
	return {
		projects: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
		// The device doing the merge keeps its own place; only fall back to the
		// remote's when this one has never opened anything.
		lastOpenedId: local.lastOpenedId ?? remote.lastOpenedId
	};
}
