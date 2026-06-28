export type ArcadeRecordValue = string | number | boolean | null;
export type ArcadeRunSummary = Record<string, ArcadeRecordValue>;

export interface ArcadeGameRecord {
	v: 1;
	gameId: string;
	bestScore: number;
	plays: number;
	recentRuns: ArcadeRunSummary[];
	updatedAt: string | null;
}

export interface ArcadeRunResult {
	score?: number;
	summary?: ArcadeRunSummary;
	endedAt?: string;
}

const RECORD_VERSION = 1;
const MAX_RECENT_RUNS = 5;

export function arcadeRecordKey(gameId: string): string {
	return `marginalia.arcade.records.v1.${encodeURIComponent(gameId)}`;
}

function emptyRecord(gameId: string): ArcadeGameRecord {
	return {
		v: RECORD_VERSION,
		gameId,
		bestScore: 0,
		plays: 0,
		recentRuns: [],
		updatedAt: null
	};
}

function normalizeRecord(gameId: string, parsed: unknown): ArcadeGameRecord | null {
	if (!parsed || typeof parsed !== 'object') return null;
	const record = parsed as Partial<ArcadeGameRecord>;
	if (record.v !== RECORD_VERSION || record.gameId !== gameId) return null;

	return {
		v: RECORD_VERSION,
		gameId,
		bestScore: typeof record.bestScore === 'number' ? record.bestScore : 0,
		plays: typeof record.plays === 'number' ? record.plays : 0,
		recentRuns: Array.isArray(record.recentRuns) ? record.recentRuns.slice(0, MAX_RECENT_RUNS) : [],
		updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null
	};
}

export function loadArcadeRecord(gameId: string): ArcadeGameRecord {
	if (typeof localStorage === 'undefined') return emptyRecord(gameId);
	try {
		const raw = localStorage.getItem(arcadeRecordKey(gameId));
		if (!raw) return emptyRecord(gameId);
		return normalizeRecord(gameId, JSON.parse(raw)) ?? emptyRecord(gameId);
	} catch {
		return emptyRecord(gameId);
	}
}

export function saveArcadeRecord(record: ArcadeGameRecord): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(arcadeRecordKey(record.gameId), JSON.stringify(record));
	} catch {
		// Ignore quota or privacy-mode failures; records should never block play.
	}
}

export function clearArcadeRecord(gameId: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(arcadeRecordKey(gameId));
}

export function recordArcadeRun(gameId: string, result: ArcadeRunResult): ArcadeGameRecord {
	const current = loadArcadeRecord(gameId);
	const score = result.score ?? 0;
	const summary = result.summary
		? [{ ...result.summary, score }, ...current.recentRuns].slice(0, MAX_RECENT_RUNS)
		: current.recentRuns;
	const next: ArcadeGameRecord = {
		...current,
		bestScore: Math.max(current.bestScore, score),
		plays: current.plays + 1,
		recentRuns: summary,
		updatedAt: result.endedAt ?? new Date().toISOString()
	};

	saveArcadeRecord(next);
	return next;
}
