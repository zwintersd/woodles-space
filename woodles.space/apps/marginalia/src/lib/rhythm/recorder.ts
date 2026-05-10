// Click recorder for the reading pass.
// Collects hit timestamps for future recitation / séance mechanics.
// Designed to run from v1.0 onward so data accumulates before séance is built.

const KEY = 'marginalia.rhythm.v1';
const MAX_ENTRIES = 500;

type ClickQuality = 'l' | 't' | 'w'; // luminous | tight | wide

export interface ClickRecord {
	t: number;        // performance.now() at time of click
	q: ClickQuality;
	w: string;        // word text (truncated to 24 chars)
}

// A "fragment" is a contiguous run of clicks tight enough to read as a single
// pattern. The séance recites one of these, frozen at the cadence the player
// originally produced. Beat offsets are relative to the fragment start.
export interface RecitationBeat {
	offset: number;   // ms from fragment start
	q: ClickQuality;
	w: string;
}

export interface RecitationFragment {
	beats: RecitationBeat[];
	durationMs: number;
}

// Two clicks farther apart than this become a fragment boundary. Captures
// pauses for breath without splitting on individual missed beats.
const MAX_INTRA_FRAGMENT_GAP_MS = 1800;
const MIN_FRAGMENT_BEATS = 5;
const MAX_FRAGMENT_BEATS = 14;

function toQ(quality: 'luminous' | 'tight' | 'wide'): ClickQuality {
	return quality === 'luminous' ? 'l' : quality === 'tight' ? 't' : 'w';
}

class Recorder {
	private clicks: ClickRecord[] = [];

	constructor() {
		this.load();
	}

	record(quality: 'luminous' | 'tight' | 'wide', word: string) {
		this.clicks.push({ t: performance.now(), q: toQ(quality), w: word.slice(0, 24) });
		if (this.clicks.length > MAX_ENTRIES) {
			this.clicks.splice(0, this.clicks.length - MAX_ENTRIES);
		}
		this.persist();
	}

	clear() {
		this.clicks = [];
		this.persist();
	}

	get history(): readonly ClickRecord[] {
		return this.clicks;
	}

	// Walk the click log, collecting runs whose successive deltas stay below
	// MAX_INTRA_FRAGMENT_GAP_MS. A new session starts a new run automatically
	// (performance.now() resets to zero, so the next delta is negative).
	distillFragments(): RecitationFragment[] {
		if (this.clicks.length < MIN_FRAGMENT_BEATS) return [];
		const frags: RecitationFragment[] = [];
		let current: ClickRecord[] = [];

		const flush = () => {
			if (current.length < MIN_FRAGMENT_BEATS) return;
			const slice = current.slice(0, MAX_FRAGMENT_BEATS);
			const t0 = slice[0].t;
			frags.push({
				beats: slice.map((c) => ({ offset: c.t - t0, q: c.q, w: c.w })),
				durationMs: slice[slice.length - 1].t - t0
			});
		};

		for (const r of this.clicks) {
			if (current.length === 0) {
				current.push(r);
				continue;
			}
			const last = current[current.length - 1];
			const dt = r.t - last.t;
			if (dt > 0 && dt < MAX_INTRA_FRAGMENT_GAP_MS && current.length < MAX_FRAGMENT_BEATS) {
				current.push(r);
			} else {
				flush();
				current = [r];
			}
		}
		flush();
		return frags;
	}

	pickFragment(): RecitationFragment | null {
		const frags = this.distillFragments();
		if (frags.length === 0) return null;
		return frags[(Math.random() * frags.length) | 0];
	}

	hasFragments(): boolean {
		return this.distillFragments().length > 0;
	}

	private persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.clicks));
		} catch {
			// ignore quota
		}
	}

	private load() {
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) this.clicks = JSON.parse(raw);
		} catch {
			this.clicks = [];
		}
	}
}

export const recorder = new Recorder();

