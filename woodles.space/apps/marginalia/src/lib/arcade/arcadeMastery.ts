// Per-pet, per-game mastery — the arcade's reward-scaling layer.
//
// A pet that keeps playing the same cabinet machine gets better at it: enough
// finished rounds bank into a mastery level, and each level raises an insight
// multiplier for that one pet/game pairing (see `previewMasteredReward` in
// arcadeRewards.ts, which scales a reward's cap along with the reward itself,
// so mastery raises the ceiling rather than just filling up to a fixed one).
// Local and per-device, like arcadeRecords.ts — the same pet on another
// device starts this machine cold.

const MASTERY_VERSION = 1;

// Flat XP for one finished round, regardless of outcome — mastery rewards
// repetition with this pet on this game; arcadeRewards.ts already prices
// performance, so mastery doesn't need to price it again.
export const MASTERY_XP_PER_PLAY = 10;

// Cumulative XP to reach level N follows a triangular ramp: 30, 90, 180,
// 300, ... (LEVEL_XP_STEP * N * (N + 1) / 2). Level 1 lands after 3 plays
// ("a few plays"), and each further level takes proportionally longer.
const LEVEL_XP_STEP = 30;

// +10% insight per mastery level: level 1 = 1.1x, level 2 = 1.2x, and so on.
const MASTERY_MULTIPLIER_STEP = 0.1;

export interface PetMasteryRecord {
	v: 1;
	gameId: string;
	creatureId: string;
	xp: number;
	plays: number;
	updatedAt: string | null;
}

export interface PetMasteryProgress {
	level: number;
	xp: number;
	// the insight multiplier this level grants; 1 at level 0
	multiplier: number;
	// 0..1 progress from this level's threshold toward the next
	progress: number;
	xpToNextLevel: number;
	// true only on the play that just crossed a level threshold
	leveledUp: boolean;
}

export function arcadeMasteryKey(gameId: string, creatureId: string): string {
	return `marginalia.arcade.mastery.v1.${encodeURIComponent(gameId)}.${encodeURIComponent(creatureId)}`;
}

function emptyMasteryRecord(gameId: string, creatureId: string): PetMasteryRecord {
	return { v: MASTERY_VERSION, gameId, creatureId, xp: 0, plays: 0, updatedAt: null };
}

function normalizeMasteryRecord(
	gameId: string,
	creatureId: string,
	parsed: unknown
): PetMasteryRecord | null {
	if (!parsed || typeof parsed !== 'object') return null;
	const record = parsed as Partial<PetMasteryRecord>;
	if (record.v !== MASTERY_VERSION || record.gameId !== gameId || record.creatureId !== creatureId) {
		return null;
	}

	return {
		v: MASTERY_VERSION,
		gameId,
		creatureId,
		xp: typeof record.xp === 'number' && Number.isFinite(record.xp) ? Math.max(0, record.xp) : 0,
		plays: typeof record.plays === 'number' ? record.plays : 0,
		updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null
	};
}

export function loadPetMastery(gameId: string, creatureId: string): PetMasteryRecord {
	if (typeof localStorage === 'undefined') return emptyMasteryRecord(gameId, creatureId);
	try {
		const raw = localStorage.getItem(arcadeMasteryKey(gameId, creatureId));
		if (!raw) return emptyMasteryRecord(gameId, creatureId);
		return (
			normalizeMasteryRecord(gameId, creatureId, JSON.parse(raw)) ?? emptyMasteryRecord(gameId, creatureId)
		);
	} catch {
		return emptyMasteryRecord(gameId, creatureId);
	}
}

function saveMasteryRecord(record: PetMasteryRecord): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(arcadeMasteryKey(record.gameId, record.creatureId), JSON.stringify(record));
	} catch {
		// Ignore quota or privacy-mode failures; mastery should never block play.
	}
}

export function clearPetMastery(gameId: string, creatureId: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(arcadeMasteryKey(gameId, creatureId));
}

// Cumulative XP required to reach `level`.
export function totalXpForLevel(level: number): number {
	const safeLevel = Number.isFinite(level) && level > 0 ? level : 0;
	return (LEVEL_XP_STEP * safeLevel * (safeLevel + 1)) / 2;
}

export function levelForXp(xp: number): number {
	const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
	// Closed-form inverse of the triangular ramp gets within ~1 of the true
	// level; the correction loops below make it exact even at floating-point
	// boundary values, in at most a couple of steps.
	let level = Math.max(0, Math.floor((-1 + Math.sqrt(1 + (8 * safeXp) / LEVEL_XP_STEP)) / 2));
	while (totalXpForLevel(level + 1) <= safeXp) level += 1;
	while (level > 0 && totalXpForLevel(level) > safeXp) level -= 1;
	return level;
}

// +10% insight per level: baseline (level 0, or no pet) is 1x.
export function masteryMultiplier(level: number): number {
	const safeLevel = Number.isFinite(level) && level > 0 ? level : 0;
	return 1 + safeLevel * MASTERY_MULTIPLIER_STEP;
}

function levelProgress(xp: number, level: number): number {
	const floor = totalXpForLevel(level);
	const ceiling = totalXpForLevel(level + 1);
	if (ceiling <= floor) return 1;
	return Math.min(1, Math.max(0, (xp - floor) / (ceiling - floor)));
}

function toProgress(xp: number, leveledUp: boolean): PetMasteryProgress {
	const level = levelForXp(xp);
	return {
		level,
		xp,
		multiplier: masteryMultiplier(level),
		progress: levelProgress(xp, level),
		xpToNextLevel: Math.max(0, totalXpForLevel(level + 1) - xp),
		leveledUp
	};
}

// Read-only snapshot for a pet/game pair — safe to call with no active pet
// (reads as untrained: level 0, 1x, no progress) so callers don't need to
// branch before previewing a reward or rendering a mastery readout.
export function petMasteryProgress(
	gameId: string,
	creatureId: string | null | undefined
): PetMasteryProgress {
	if (!creatureId) return toProgress(0, false);
	return toProgress(loadPetMastery(gameId, creatureId).xp, false);
}

// Credit one finished round's mastery XP for a pet/game pair, persist it, and
// report whether this play crossed a level threshold. A no-op read (no XP
// banked, nothing written) with no active pet — mastery belongs to a specific
// pet, never ambient.
export function recordMasteryPlay(
	gameId: string,
	creatureId: string | null | undefined,
	amount: number = MASTERY_XP_PER_PLAY
): PetMasteryProgress {
	if (!creatureId || amount <= 0) return petMasteryProgress(gameId, creatureId);

	const current = loadPetMastery(gameId, creatureId);
	const levelBefore = levelForXp(current.xp);
	const nextXp = current.xp + amount;
	saveMasteryRecord({
		...current,
		xp: nextXp,
		plays: current.plays + 1,
		updatedAt: new Date().toISOString()
	});

	return toProgress(nextXp, levelForXp(nextXp) > levelBefore);
}
