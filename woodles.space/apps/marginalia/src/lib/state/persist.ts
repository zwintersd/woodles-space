// localStorage save/load + export.

const KEY = 'marginalia.save.v1';

export interface SaveShape {
	v: 1;
	glosses: number;
	commentaries: number;
	apparatus: number;
	recensions: number;
	palimpsest: number;
	prestigeIndex: number;
	totalGlossesEver: number;
	clicksEver: number;
	generators: Record<string, number>;
	upgrades: Record<string, boolean>;
	practiceCooldowns: Record<string, number>; // ms timestamp when ready
	palinodeUsedThisRun: boolean;
	startedAt: number;
	// v2.0 — contested passage
	contestedReadyAt?: number;
	canonicalCitations?: string[];
	passagesRead?: string[];
	// early-game scaffolding
	whispersShown?: Record<string, boolean>;
	// v2.5 — recitation
	canonicalRemembered?: string[];
	// v3.0 — update modal
	lastSeenVersion?: string | null;
}

export function emptySave(): SaveShape {
	return {
		v: 1,
		glosses: 0,
		commentaries: 0,
		apparatus: 0,
		recensions: 0,
		palimpsest: 1,
		prestigeIndex: 0,
		totalGlossesEver: 0,
		clicksEver: 0,
		generators: {},
		upgrades: {},
		practiceCooldowns: {},
		palinodeUsedThisRun: false,
		startedAt: Date.now()
	};
}

export function load(): SaveShape | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed?.v !== 1) return null;
		return { ...emptySave(), ...parsed };
	} catch {
		return null;
	}
}

export function save(state: SaveShape): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// ignore quota errors
	}
}

export function wipe(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(KEY);
}

export function exportSave(state: SaveShape): string {
	return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(blob: string): SaveShape | null {
	try {
		const json = decodeURIComponent(escape(atob(blob.trim())));
		const parsed = JSON.parse(json);
		if (parsed?.v !== 1) return null;
		return { ...emptySave(), ...parsed };
	} catch {
		return null;
	}
}
