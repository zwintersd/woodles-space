// The Witch's Book — game state. Svelte 5 runes.
//
// This build adds the idle layer: the World lives on its own clock. Life she
// is attending to deepens through the observation stages over time; witnessed
// life yields Insight every second; Favor drifts; and time away is credited.

import { conditions, conditionById } from './content/conditions';
import { revealedEmergences } from './content/emergences';
import { revealedLife, lifeById, world1Life, type Life } from './content/life';
import { journalSeeds, type FavorBand } from './content/journal';
import {
	STAGE_SECONDS,
	LOOK_CLOSER_SECONDS,
	STAGE_INSIGHT_MULT,
	ATTENTION_START,
	ATTENTION_COSTS,
	DISTILL_INSIGHT_COST,
	DISTILL_ESSENCE_GAIN,
	ESSENCE_ON_STUDIED,
	ESSENCE_ON_KNOWN,
	FAVOR_BASE_TARGET,
	FAVOR_PER_KNOWN,
	FAVOR_DRIFT_PER_SEC,
	favorMultiplier,
	OFFLINE_CAP_SECONDS
} from './tuning';
import { load, save, wipe, type BookSave } from './persist';

// observation stages
export const STAGE_NOTICED = 0; // it has emerged; she has not looked yet
export const STAGE_OBSERVED = 1;
export const STAGE_STUDIED = 2;
export const STAGE_KNOWN = 3;

export const stageLabel = ['noticed', 'observed', 'studied', 'known'] as const;

export interface OfflineReport {
	seconds: number;
	insight: number;
	advanced: number; // stages crossed while away
}

// short number format — Insight grows, so fold it down (1.2k, 3.4m…)
export function fmt(n: number): string {
	if (n < 1000) return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toString();
	const units = ['', 'k', 'm', 'b', 't'];
	let i = 0;
	let v = n;
	while (v >= 1000 && i < units.length - 1) {
		v /= 1000;
		i++;
	}
	return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + units[i];
}

export class Book {
	// ── carried resources (will cross worlds, once prestige exists) ──────────
	essence = $state(6); // raw creative power — spent writing conditions
	knowing = $state(0); // lifetime understanding, every stage crossed

	// ── this-world resources ─────────────────────────────────────────────────
	insight = $state(0); // the world's idle currency
	favor = $state(60); // the world's relationship with her, 0..100

	// ── attention: the capacity that drives the idle tick ────────────────────
	attentionCapacity = $state(ATTENTION_START);
	attending = $state<string[]>([]); // life ids currently being watched
	study = $state<Record<string, number>>({}); // lifeId -> study-seconds banked

	// ── progress ─────────────────────────────────────────────────────────────
	writtenConditions = $state<string[]>([]);
	observation = $state<Record<string, number>>({}); // lifeId -> stage
	journalShown = $state<string[]>([]);
	worldIndex = $state(0);
	bookOpen = $state(false);

	mode = $state<'web' | 'world'>('web');

	// transient — surfaced once after a return, then dismissed
	offlineReport = $state<OfflineReport | null>(null);

	// ── reading room — "reading alongside Brianna" (a side feature) ──────────
	readingMsTowardNextPoint = $state(0);
	readingStarPoints = $state(0);
	readingCompletedStars = $state(0);
	readingCumulativeMs = $state(0);
	readingCumulativeWords = $state(0);

	static readonly READING_POINT_MS = 20 * 60 * 1000;
	static readonly READING_POINTS_PER_STAR = 5;

	// ── derived: the web ─────────────────────────────────────────────────────

	private writtenSet = $derived(new Set(this.writtenConditions));

	hasWritten(id: string): boolean {
		return this.writtenSet.has(id);
	}

	emergences = $derived(revealedEmergences(this.writtenSet));
	life = $derived(revealedLife(this.writtenSet));

	stageOf(lifeId: string): number {
		return this.observation[lifeId] ?? STAGE_NOTICED;
	}

	// ── derived: the idle engine ─────────────────────────────────────────────

	// raw Insight/sec from witnessed life, before the Favor multiplier
	private baseInsightRate = $derived.by(() => {
		let r = 0;
		for (const l of this.life) {
			r += l.insightWeight * (STAGE_INSIGHT_MULT[this.stageOf(l.id)] ?? 0);
		}
		return r;
	});

	favorMult = $derived(favorMultiplier(this.favor));
	insightPerSec = $derived(this.baseInsightRate * this.favorMult);

	attentionUsed = $derived(this.attending.length);
	attentionFree = $derived(this.attentionCapacity - this.attending.length);

	// cost to raise attention capacity by one, or null at the maximum
	attentionUpgradeCost = $derived.by(() => {
		const tier = this.attentionCapacity - ATTENTION_START;
		return tier < ATTENTION_COSTS.length ? ATTENTION_COSTS[tier] : null;
	});

	knownCount = $derived(
		world1Life.filter((l) => (this.observation[l.id] ?? 0) >= STAGE_KNOWN).length
	);

	// ── derived: world metrics & framing ─────────────────────────────────────

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

	title = $derived.by(() => {
		const tendedSomething = this.life.some(
			(l) => l.domain === 'plant' && this.stageOf(l.id) >= STAGE_OBSERVED
		);
		if (tendedSomething) return 'gardener';
		if (this.writtenConditions.length > 0) return 'dreamer';
		return 'witch';
	});

	pendingJournal = $derived.by(() => {
		const n = this.writtenConditions.length;
		const band = this.favorBand;
		const eligible = journalSeeds
			.filter((s) => s.atConditions <= n && (s.band === band || s.band === 'even'))
			.filter((s) => !this.journalShown.includes(s.id))
			.sort((a, b) => b.atConditions - a.atConditions);
		return eligible[0] ?? null;
	});

	// ── the Book ─────────────────────────────────────────────────────────────

	openBook() {
		this.bookOpen = true;
		this.persist();
	}

	closeBook() {
		this.bookOpen = false;
		this.persist();
	}

	// ── the Web (author mode) ────────────────────────────────────────────────

	canWrite(id: string): boolean {
		const c = conditionById(id);
		if (!c || this.hasWritten(id)) return false;
		return this.essence >= c.cost;
	}

	writeCondition(id: string) {
		const c = conditionById(id);
		if (!c || !this.canWrite(id)) return;
		this.essence -= c.cost;
		this.writtenConditions = [...this.writtenConditions, id];
		this.knowing += 1;
		this.persist();
	}

	// ── the World (witness mode) ─────────────────────────────────────────────

	isAttending(lifeId: string): boolean {
		return this.attending.includes(lifeId);
	}

	canAttend(lifeId: string): boolean {
		if (this.isAttending(lifeId)) return false;
		if (this.stageOf(lifeId) >= STAGE_KNOWN) return false;
		return this.attentionFree > 0;
	}

	attend(lifeId: string) {
		if (!this.canAttend(lifeId)) return;
		this.attending = [...this.attending, lifeId];
		this.persist();
	}

	unattend(lifeId: string) {
		if (!this.isAttending(lifeId)) return;
		this.attending = this.attending.filter((id) => id !== lifeId);
		this.persist();
	}

	// study-seconds needed for the attended life's next stage advance
	stageThreshold(lifeId: string): number {
		const next = this.stageOf(lifeId) + 1;
		return STAGE_SECONDS[next] ?? Infinity;
	}

	// 0..1 progress toward the next stage
	stageProgress(lifeId: string): number {
		const t = this.stageThreshold(lifeId);
		if (!isFinite(t)) return 1;
		return Math.min(1, (this.study[lifeId] ?? 0) / t);
	}

	// the clicker hook: nudge an attended life along by hand
	lookCloser(lifeId: string) {
		if (!this.isAttending(lifeId)) return;
		this.addStudy(lifeId, LOOK_CLOSER_SECONDS * (lifeById(lifeId)?.studyEase ?? 1));
	}

	private addStudy(lifeId: string, seconds: number) {
		const banked = (this.study[lifeId] ?? 0) + seconds;
		this.study = { ...this.study, [lifeId]: banked };
		this.settleStages(lifeId);
	}

	// advance as many stages as the banked study-seconds allow
	private settleStages(lifeId: string): number {
		let crossed = 0;
		let stage = this.stageOf(lifeId);
		let banked = this.study[lifeId] ?? 0;
		while (stage < STAGE_KNOWN) {
			const threshold = STAGE_SECONDS[stage + 1];
			if (banked < threshold) break;
			banked -= threshold;
			stage += 1;
			crossed += 1;
			this.observation = { ...this.observation, [lifeId]: stage };
			this.knowing += 1;
			if (stage === STAGE_STUDIED) this.essence += ESSENCE_ON_STUDIED;
			if (stage === STAGE_KNOWN) this.essence += ESSENCE_ON_KNOWN;
		}
		if (stage >= STAGE_KNOWN) {
			// fully known — it no longer needs watching; free the slot
			banked = 0;
			this.attending = this.attending.filter((id) => id !== lifeId);
		}
		this.study = { ...this.study, [lifeId]: banked };
		return crossed;
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

	// ── insight sinks ────────────────────────────────────────────────────────

	expandAttention() {
		const cost = this.attentionUpgradeCost;
		if (cost === null || this.insight < cost) return;
		this.insight -= cost;
		this.attentionCapacity += 1;
		this.persist();
	}

	canDistill(): boolean {
		return this.insight >= DISTILL_INSIGHT_COST;
	}

	distillEssence() {
		if (!this.canDistill()) return;
		this.insight -= DISTILL_INSIGHT_COST;
		this.essence += DISTILL_ESSENCE_GAIN;
		this.persist();
	}

	// ── the idle tick ────────────────────────────────────────────────────────

	tick(dt: number) {
		if (dt <= 0) return;
		// study accrual for everything she is attending to
		for (const id of [...this.attending]) {
			const life = lifeById(id);
			if (!life) continue;
			this.addStudy(id, dt * life.studyEase);
		}
		// the world yields Insight every second it is witnessed
		this.insight += this.insightPerSec * dt;
		// Favor eases toward the target set by how much she has Known.
		// Exponential approach stays stable for any dt (incl. offline jumps).
		const target = FAVOR_BASE_TARGET + FAVOR_PER_KNOWN * this.knownCount;
		const k = 1 - Math.exp(-FAVOR_DRIFT_PER_SEC * dt);
		this.favor = Math.max(0, Math.min(100, this.favor + (target - this.favor) * k));
	}

	// credit time away — replayed in coarse steps so rates stay honest as
	// stages advance and Favor drifts. Surfaces a one-shot report.
	private creditOffline(elapsedSec: number) {
		const seconds = Math.min(elapsedSec, OFFLINE_CAP_SECONDS);
		if (seconds < 5) return;
		const insightBefore = this.insight;
		const knowingBefore = this.knowing;
		let remaining = seconds;
		const step = 5;
		while (remaining > 0) {
			this.tick(Math.min(step, remaining));
			remaining -= step;
		}
		this.offlineReport = {
			seconds,
			insight: this.insight - insightBefore,
			advanced: this.knowing - knowingBefore
		};
	}

	dismissOfflineReport() {
		this.offlineReport = null;
	}

	// ── the journal ──────────────────────────────────────────────────────────

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
			attentionCapacity: this.attentionCapacity,
			attending: [...this.attending],
			study: { ...this.study },
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
			lastSeen: Date.now()
		};
	}

	fromSave(s: BookSave) {
		this.essence = s.essence;
		this.knowing = s.knowing;
		this.insight = s.insight;
		this.favor = s.favor;
		this.attentionCapacity = s.attentionCapacity;
		this.attending = [...s.attending];
		this.study = { ...s.study };
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
		if (s) {
			this.fromSave(s);
			if (s.lastSeen) this.creditOffline((Date.now() - s.lastSeen) / 1000);
		}
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
		this.attentionCapacity = ATTENTION_START;
		this.attending = [];
		this.study = {};
		this.writtenConditions = [];
		this.observation = {};
		this.journalShown = [];
		this.worldIndex = 0;
		this.bookOpen = false;
		this.mode = 'web';
		this.offlineReport = null;
		this.readingMsTowardNextPoint = 0;
		this.readingStarPoints = 0;
		this.readingCompletedStars = 0;
		this.readingCumulativeMs = 0;
		this.readingCumulativeWords = 0;
	}
}

export const book = new Book();

export const totalConditions = conditions.length;
