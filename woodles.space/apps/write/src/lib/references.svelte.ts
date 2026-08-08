// What prose can point at.
//
// `#` reaches a thing you're thinking about; `@` reaches a day. Both are the
// same gesture over different sources, so they share one registry rather than
// one picker per source — a picker written against the shelf alone would
// hardcode the shelf, and a creature is the obvious second thing to name in a
// sentence after a book.
//
// Every source is thin because the spine already does the work: the ledgers
// carry the records, `readLocalLedger`/`pullLedger` fetch them, and
// `entityHref` turns an id into a link that resolves through the manifest.

import { entityHref } from '@woodles/app-manifest';
import {
	hasPassphrase,
	pullLedger,
	readLocalLedger,
	readShelfBlob,
	THINKING_ABOUT_SHELF_APP,
	THINKING_ABOUT_SHELF_STORAGE_KEY,
	type ShelfEntry
} from '@woodles/sync';

export type Sigil = '#' | '@';

/** One thing a reference could point at, ready to render in a picker. */
export type ReferenceCandidate = {
	app: string;
	kind: string;
	id: string;
	/** What goes into the prose. */
	text: string;
	/** A second line for the picker — never stored. */
	hint?: string;
	color?: string;
};

export type ReferenceSource = {
	sigil: Sigil;
	/** Candidates matching a query, best first. */
	list(query: string): ReferenceCandidate[];
	/** Resolve a stored reference to its current state, or null if it has gone cold. */
	resolve(kind: string, id: string): ReferenceCandidate | null;
};

export function referenceHref(app: string, kind: string, id: string): string | null {
	try {
		return entityHref(app, kind, id);
	} catch {
		// An app that no longer declares the kind — the reference still reads as
		// prose, it just stops being a link.
		return null;
	}
}

function matches(candidate: string, query: string): boolean {
	return candidate.toLowerCase().includes(query.trim().toLowerCase());
}

// ── # : things you're thinking about ────────────────────────────────────

class ShelfSource implements ReferenceSource {
	sigil: Sigil = '#';
	entries = $state<ShelfEntry[]>([]);

	loadLocal(): void {
		const blob = readLocalLedger(THINKING_ABOUT_SHELF_STORAGE_KEY, readShelfBlob);
		if (blob) this.entries = blob.entries;
	}

	async refresh(): Promise<void> {
		this.loadLocal();
		if (!hasPassphrase()) return;
		try {
			const blob = await pullLedger(THINKING_ABOUT_SHELF_APP, readShelfBlob);
			if (blob) this.entries = blob.entries;
		} catch {
			// Whatever is on this device still stands.
		}
	}

	list(query: string): ReferenceCandidate[] {
		return this.entries
			.filter((entry) => matches(entry.title, query))
			.map((entry) => this.#toCandidate(entry));
	}

	resolve(kind: string, id: string): ReferenceCandidate | null {
		if (kind !== 'entry') return null;
		const entry = this.entries.find((candidate) => candidate.id === id);
		return entry ? this.#toCandidate(entry) : null;
	}

	#toCandidate(entry: ShelfEntry): ReferenceCandidate {
		return {
			app: 'thinking-about',
			kind: 'entry',
			id: entry.id,
			text: entry.title,
			hint: entry.columnKey,
			color: entry.color
		};
	}
}

// ── @ : days ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** `YYYY-MM-DD` → "Thursday, 13 August". A date is the identity every app shares. */
export function dayLabel(key: string): string {
	const [y, m, d] = key.split('-').map(Number);
	if (!y || !m || !d) return key;
	const date = new Date(y, m - 1, d, 12);
	return `${WEEKDAYS[date.getDay()]}, ${d} ${date.toLocaleString('en', { month: 'long' })}`;
}

function dayKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Days need no ledger at all — a date is the one identity Carillon, Thinking
 * About and Write already share. The list is generated, not fetched: today
 * and the fortnight either side of it, plus anything typed that parses as a
 * date.
 */
class DaySource implements ReferenceSource {
	sigil: Sigil = '@';

	list(query: string): ReferenceCandidate[] {
		const trimmed = query.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return [this.#toCandidate(trimmed)];

		const today = new Date();
		const days: ReferenceCandidate[] = [];
		for (let offset = -14; offset <= 14; offset += 1) {
			const date = new Date(today);
			date.setDate(date.getDate() + offset);
			const key = dayKey(date);
			const candidate = this.#toCandidate(key, offset);
			if (!trimmed || matches(candidate.text, trimmed) || matches(key, trimmed)) {
				days.push(candidate);
			}
		}
		// Nearest to today first — "@thurs" almost always means this week's.
		return days.sort(
			(a, b) => Math.abs(offsetOf(a.id, today)) - Math.abs(offsetOf(b.id, today))
		);
	}

	resolve(kind: string, id: string): ReferenceCandidate | null {
		if (kind !== 'day') return null;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
		// A day never goes cold. It happened, or it will.
		return this.#toCandidate(id);
	}

	#toCandidate(key: string, offset?: number): ReferenceCandidate {
		return {
			app: 'planner',
			kind: 'day',
			id: key,
			text: dayLabel(key),
			hint: offset === 0 ? 'today' : offset === -1 ? 'yesterday' : offset === 1 ? 'tomorrow' : key
		};
	}
}

function offsetOf(key: string, from: Date): number {
	const [y, m, d] = key.split('-').map(Number);
	return Math.round((new Date(y, m - 1, d, 12).getTime() - from.getTime()) / 86_400_000);
}

export const shelfSource = new ShelfSource();
export const daySource = new DaySource();

const SOURCES: ReferenceSource[] = [shelfSource, daySource];

export function sourcesFor(sigil: Sigil): ReferenceSource[] {
	return SOURCES.filter((source) => source.sigil === sigil);
}

export function candidatesFor(sigil: Sigil, query: string): ReferenceCandidate[] {
	return sourcesFor(sigil).flatMap((source) => source.list(query));
}

/** The current state of a stored reference, or null once it has gone cold. */
export function resolveReference(kind: string, id: string): ReferenceCandidate | null {
	for (const source of SOURCES) {
		const found = source.resolve(kind, id);
		if (found) return found;
	}
	return null;
}

export async function refreshReferenceSources(): Promise<void> {
	await shelfSource.refresh();
}
