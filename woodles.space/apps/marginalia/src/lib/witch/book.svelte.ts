// The Witch's Book — game state. Svelte 5 runes.
//
// Foundations build: the data model and the two modes (the Web, the World)
// exist and are interactive, but the loop is deliberately not balanced or
// closed. There is no prestige yet — that is the next pass.

import { conditions, conditionById } from './content/conditions';
import { revealedEmergences } from './content/emergences';
import { revealedLife, lifeById, type Life } from './content/life';
import { journalSeeds, type FavorBand } from './content/journal';
import { load, save, wipe, type BookSave } from './persist';

// observation stages
export const STAGE_NOTICED = 0; // it has emerged; she has not looked yet
export const STAGE_OBSERVED = 1;
export const STAGE_STUDIED = 2;
export const STAGE_KNOWN = 3;

export const stageLabel = ['noticed', 'observed', 'studied', 'known'] as const;

// insight granted for advancing a life one observation stage
const INSIGHT_PER_STAGE = [0, 1, 2, 4]; // index = stage reached

export interface JournalEntry {
	id: string;
	text: string;
}

function fmtInt(n: number): string {
	return Math.floor(n).toString();
}

export { fmtInt as fmt };

export class Book {
	// ── meta resources (will cross worlds, once prestige exists) ─────────────
	essence = $state(6); // raw creative power — spent writing conditions
	knowing = $state(0); // accumulated understanding across all worlds

	// ── this-world resources ─────────────────────────────────────────────────
	insight = $state(0); // understanding of this world's things
	favor = $state(60); // the world's relationship with her, 0..100

	// ── progress ─────────────────────────────────────────────────────────────
	writtenConditions = $state<string[]>([]);
	observation = $state<Record<string, number>>({}); // lifeId -> stage
	journalShown = $state<string[]>([]);
	worldIndex = $state(0);
	bookOpen = $state(false);

	// which mode the open Book is showing
	mode = $state<'web' | 'world'>('web');

	// ── reading room — "reading alongside Brianna" (a side feature) ──────────
	readingMsTowardNextPoint = $state(0);
	readingStarPoints = $state(0);
	readingCompletedStars = $state(0);
	readingCumulativeMs = $state(0);
	readingCumulativeWords = $state(0);

	static readonly READING_POINT_MS = 20 * 60 * 1000;
	static readonly READING_POINTS_PER_STAR = 5;

	// ── derived ──────────────────────────────────────────────────────────────

	private writtenSet = $derived(new Set(this.writtenConditions));

	hasWritten(id: string): boolean {
		return this.writtenSet.has(id);
	}

	emergences = $derived(revealedEmergences(this.writtenSet));
	life = $derived(revealedLife(this.writtenSet));

	// observation stage for a given life (0 if it has only just emerged)
	stageOf(lifeId: string): number {
		return this.observation[lifeId] ?? STAGE_NOTICED;
	}

	// world metrics — health indicators, derived for now from what exists
	complexity = $derived(this.life.length + this.emergences.length);
	nutrients = $derived(
		(this.hasWritten('returning') ? 40 : 0) + (this.hasWritten('flow') ? 20 : 0)
	);
	oxygen = $derived(this.life.filter((l) => l.domain === 'plant').length * 12);

	private studiedCount = $derived(
		Object.values(this.observation).filter((s) => s >= STAGE_STUDIED).length
	);

	stability = $derived(Math.min(100, 30 + this.studiedCount * 10));

	favorBand: FavorBand = $derived(
		this.favor >= 70 ? 'high' : this.favor <= 35 ? 'low' : 'even'
	);

	// Brianna's current title
	title = $derived.by(() => {
		if (this.worldIndex >= 999) return 'witness';
		const tendedSomething = this.life.some(
			(l) => l.domain === 'plant' && this.stageOf(l.id) >= STAGE_OBSERVED
		);
		if (tendedSomething) return 'gardener';
		if (this.writtenConditions.length > 0) return 'dreamer';
		return 'witch';
	});

	// the latest journal entry she could be shown
	pendingJournal = $derived.by(() => {
		const n = this.writtenConditions.length;
		const band = this.favorBand;
		// most-specific match: highest atConditions <= n, band matching or 'even'
		const eligible = journalSeeds
			.filter((s) => s.atConditions <= n && (s.band === band || s.band === 'even'))
			.filter((s) => !this.journalShown.includes(s.id))
			.sort((a, b) => b.atConditions - a.atConditions);
		return eligible[0] ?? null;
	});

	// ── api: the Book ────────────────────────────────────────────────────────

	openBook() {
		this.bookOpen = true;
		this.persist();
	}

	closeBook() {
		this.bookOpen = false;
		this.persist();
	}

	// ── api: the Web (author mode) ───────────────────────────────────────────

	canWrite(id: string): boolean {
		const c = conditionById(id);
		if (!c) return false;
		if (this.hasWritten(id)) return false;
		return this.essence >= c.cost;
	}

	writeCondition(id: string) {
		const c = conditionById(id);
		if (!c || !this.canWrite(id)) return;
		this.essence -= c.cost;
		this.writtenConditions = [...this.writtenConditions, id];
		// writing teaches her something about the shape of the web
		this.knowing += 1;
		this.persist();
	}

	// ── api: the World (witness mode) ────────────────────────────────────────

	canObserve(lifeId: string): boolean {
		return this.stageOf(lifeId) < STAGE_KNOWN;
	}

	// advance a life one observation stage. attention is the only currency
	// that buys the right to intervene.
	observe(lifeId: string) {
		if (!lifeById(lifeId)) return;
		const stage = this.stageOf(lifeId);
		if (stage >= STAGE_KNOWN) return;
		const next = stage + 1;
		this.observation = { ...this.observation, [lifeId]: next };
		this.insight += INSIGHT_PER_STAGE[next] ?? 0;
		this.knowing += 1;
		// witnessing kindly raises Favor; knowing a thing fully is its own gift
		if (next === STAGE_KNOWN) this.favor = Math.min(100, this.favor + 2);
		else this.favor = Math.min(100, this.favor + 1);
		this.persist();
	}

	stageTextFor(life: Life): string {
		switch (this.stageOf(life.id)) {
			case STAGE_KNOWN:
				return life.know;
			case STAGE_STUDIED:
				return life.study;
			case STAGE_OBSERVED:
				return life.observe;
			default:
				return life.notice;
		}
	}

	// ── api: the journal ─────────────────────────────────────────────────────

	dismissJournal(id: string) {
		if (!this.journalShown.includes(id)) {
			this.journalShown = [...this.journalShown, id];
			this.persist();
		}
	}

	// ── reading room ─────────────────────────────────────────────────────────

	creditReadingMs(dtMs: number) {
		if (dtMs <= 0) return;
		this.readingCumulativeMs += dtMs;
		this.readingMsTowardNextPoint += dtMs;
		while (this.readingMsTowardNextPoint >= Book.READING_POINT_MS) {
			this.readingMsTowardNextPoint -= Book.READING_POINT_MS;
			this.readingStarPoints += 1;
			if (this.readingStarPoints >= Book.READING_POINTS_PER_STAR) {
				this.readingStarPoints = 0;
				this.readingCompletedStars += 1;
			}
		}
	}

	addReadingWords(words: number) {
		if (words > 0) this.readingCumulativeWords += words;
	}

	// ── persistence ──────────────────────────────────────────────────────────

	toSave(): BookSave {
		return {
			v: 1,
			essence: this.essence,
			knowing: this.knowing,
			insight: this.insight,
			favor: this.favor,
			writtenConditions: [...this.writtenConditions],
			observation: { ...this.observation },
			journalShown: [...this.journalShown],
			worldIndex: this.worldIndex,
			bookOpen: this.bookOpen,
			readingMsTowardNextPoint: this.readingMsTowardNextPoint,
			readingStarPoints: this.readingStarPoints,
			readingCompletedStars: this.readingCompletedStars,
			readingCumulativeMs: this.readingCumulativeMs,
			readingCumulativeWords: this.readingCumulativeWords,
			startedAt: Date.now()
		};
	}

	fromSave(s: BookSave) {
		this.essence = s.essence;
		this.knowing = s.knowing;
		this.insight = s.insight;
		this.favor = s.favor;
		this.writtenConditions = [...s.writtenConditions];
		this.observation = { ...s.observation };
		this.journalShown = [...s.journalShown];
		this.worldIndex = s.worldIndex;
		this.bookOpen = s.bookOpen;
		this.readingMsTowardNextPoint = s.readingMsTowardNextPoint;
		this.readingStarPoints = s.readingStarPoints;
		this.readingCompletedStars = s.readingCompletedStars;
		this.readingCumulativeMs = s.readingCumulativeMs;
		this.readingCumulativeWords = s.readingCumulativeWords;
	}

	hydrate() {
		const s = load();
		if (s) this.fromSave(s);
	}

	persist() {
		save(this.toSave());
	}

	hardReset() {
		wipe();
		this.essence = 6;
		this.knowing = 0;
		this.insight = 0;
		this.favor = 60;
		this.writtenConditions = [];
		this.observation = {};
		this.journalShown = [];
		this.worldIndex = 0;
		this.bookOpen = false;
		this.mode = 'web';
		this.readingMsTowardNextPoint = 0;
		this.readingStarPoints = 0;
		this.readingCompletedStars = 0;
		this.readingCumulativeMs = 0;
		this.readingCumulativeWords = 0;
	}
}

export const book = new Book();

// total conditions, exposed for the Web's "essence for ~N more" hint
export const totalConditions = conditions.length;
