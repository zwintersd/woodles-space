import { createAppSync } from '@woodles/sync';
import { mergeProjectIndexes, type GameDef, type ProjectIndex } from '@woodles/incremental-core';
import { readLibrary, writeLibrary, type LibraryBlob } from './projects.js';
import { studio } from './studio.svelte.js';

/**
 * Syncing the whole shelf, not one project.
 *
 * A project on its own is the wrong unit: you'd sync whichever one happened to
 * be open and silently lose the others. The blob is the index plus every
 * definition, and the merge is **per project, newest wins** — so editing a
 * different game on each device leaves you holding both, which is the only
 * behaviour that doesn't punish someone for owning two computers.
 *
 * `merge` also makes the conflict path safe: `createAppSync` retries a merged
 * snapshot against the server version it just saw, and a merge that is
 * order-independent is what makes that retry converge rather than ping-pong.
 */

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

export function mergeLibraries(local: LibraryBlob, remote: LibraryBlob): LibraryBlob {
	const index: ProjectIndex = mergeProjectIndexes(local.index, remote.index);
	const defs: Record<string, GameDef> = {};

	for (const summary of index.projects) {
		// Take the definition from whichever side the winning summary came from.
		// Comparing timestamps once, on the index, keeps a project's metadata and
		// its content from ever disagreeing about which copy is newer.
		const localSummary = local.index.projects.find((entry) => entry.id === summary.id);
		const fromLocal = localSummary?.updatedAt === summary.updatedAt;
		const chosen = (fromLocal ? local.defs[summary.id] : remote.defs[summary.id]) ?? remote.defs[summary.id] ?? local.defs[summary.id];
		if (chosen) defs[summary.id] = chosen;
	}

	return {
		index: { ...index, projects: index.projects.filter((summary) => defs[summary.id]) },
		defs
	};
}

export const { connectAndHydrate, initSync, flushSync, disconnect } = createAppSync<LibraryBlob>({
	adapter: {
		app: 'bloomforge',
		read: () => readLibrary(),
		write(blob: LibraryBlob): void {
			writeLibrary(blob);
			// The open project may have just been replaced by a newer copy from
			// another device. Reload it rather than leaving the editor showing a
			// version that is no longer what's on disk.
			studio.reloadOpenProject();
		},
		merge: mergeLibraries
	},
	state: syncState
});
