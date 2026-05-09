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
