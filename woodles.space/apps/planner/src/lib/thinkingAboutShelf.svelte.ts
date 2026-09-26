// Reading Thinking About's shelf — what's currently being read, played, or
// watched — so Carillon can offer it when you're deciding what today holds.
//
// Two sources, in this order:
//
//   1. localStorage, same origin, synchronous. Instant, and the common case:
//      both apps are one deployment, so the board you touched an hour ago is
//      already on this device.
//   2. /api/sync, when a passphrase is connected. This is what makes the
//      picker work on a device where Thinking About has never been opened —
//      the reason the ledgers ride sync at all (REFERENCES.md §3).
//
// The states follow the shape every reader in this workspace uses — idle →
// loading → ready/empty → error — and every one of them is survivable: no
// shelf means no picker, never a broken composer. Carillon has always been
// able to schedule a thing by typing its name and still can.

import {
	pull,
	hasPassphrase,
	readShelfBlob,
	THINKING_ABOUT_SHELF_APP,
	THINKING_ABOUT_SHELF_STORAGE_KEY,
	type ShelfEntry
} from '@woodles/sync';

export type ShelfStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

function readLocalShelf(): ShelfEntry[] | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(THINKING_ABOUT_SHELF_STORAGE_KEY);
		if (raw === null) return null;
		return readShelfBlob(JSON.parse(raw))?.entries ?? null;
	} catch {
		return null;
	}
}

// loadLocal() re-parses localStorage on every call, which hands back a brand
// new array even when nothing published has changed. Assigning that straight
// to a $state field would make `entries` look "changed" on every read, and
// any effect that reads it while also calling refresh() (TaskEditDrawer,
// TodayInstrument) would retrigger itself forever — effect_update_depth_exceeded,
// and the whole page's reactivity wedges with it. Comparing by value first
// keeps the reference stable when the shelf itself hasn't moved.
function sameEntries(a: ShelfEntry[], b: ShelfEntry[]): boolean {
	return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

export class ThinkingAboutShelf {
	entries = $state<ShelfEntry[]>([]);
	status = $state<ShelfStatus>('idle');
	/** True once a remote pull has been attempted, successful or not. */
	checkedRemote = $state(false);

	/** Entries grouped by their Thinking About column, for a picker that reads like the board. */
	get byColumn(): { columnKey: string; entries: ShelfEntry[] }[] {
		const groups = new Map<string, ShelfEntry[]>();
		for (const entry of this.entries) {
			const existing = groups.get(entry.columnKey);
			if (existing) existing.push(entry);
			else groups.set(entry.columnKey, [entry]);
		}
		return [...groups].map(([columnKey, entries]) => ({ columnKey, entries }));
	}

	find(id: string): ShelfEntry | null {
		return this.entries.find((entry) => entry.id === id) ?? null;
	}

	/** The synchronous half — safe to call during render. */
	loadLocal(): void {
		const local = readLocalShelf();
		if (local === null) return;
		if (!sameEntries(this.entries, local)) this.entries = local;
		this.status = local.length > 0 ? 'ready' : 'empty';
	}

	/**
	 * The remote half. Only overwrites local entries on a successful pull that
	 * actually returned a shelf — a network failure or an unpublished ledger
	 * leaves whatever localStorage gave us, because a shelf from this device is
	 * better than none.
	 */
	async refresh(): Promise<void> {
		this.loadLocal();
		if (!hasPassphrase()) {
			this.checkedRemote = true;
			return;
		}

		if (this.entries.length === 0) this.status = 'loading';
		try {
			const snapshot = await pull<unknown>(THINKING_ABOUT_SHELF_APP);
			const blob = readShelfBlob(snapshot.blob);
			if (blob) {
				if (!sameEntries(this.entries, blob.entries)) this.entries = blob.entries;
				this.status = blob.entries.length > 0 ? 'ready' : 'empty';
			} else if (this.entries.length === 0) {
				this.status = 'empty';
			}
		} catch {
			// Only an error when we have nothing to show. A stale local shelf is
			// a better answer than an error banner over a working composer.
			if (this.entries.length === 0) this.status = 'error';
		} finally {
			this.checkedRemote = true;
		}
	}
}

export const thinkingAboutShelf = new ThinkingAboutShelf();
