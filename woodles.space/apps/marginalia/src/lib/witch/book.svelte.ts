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
	OFFLINE_CAP_SECONDS,
	STAGE_ACTIVITY,
	FAVOR_STRESS_PENALTY,
	WORLD_QUIET_STABILITY,
	TEND_BUMP,
	INVOKE_BUMP,
	SHAPE_BASELINE_RAISE,
	SHAPE_BASELINE_MAX,
	ENCOURAGE_STABILITY,
	ENCOURAGE_STABILITY_MAX,
	GUIDE_METABOLISM_SCALE,
	INTERVENTION_LOAD_WEIGHT,
	INTERVENTION_LOAD_DECAY,
	FAVOR_EQUILIBRIUM_BONUS,
	EQUILIBRIUM_MIN_FACTOR
} from './tuning';
import {
	type Stocks,
	STOCK_IDS,
	STOCK_BANDS,
	neutralStocks,
	severityFor,
	nextVitality,
	lifeStockRate,
	driftRate,
	focusStock,
	stabilityOf
} from './vitals';
import { interventionForDomain } from './content/interventions';
import { emptySave, load, save, wipe, type BookSave } from './persist';
import { getBestiaryCreatures, type BestiaryCreature } from './bestiaryDb';

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

	// ── vital signs: the world's metabolism ──────────────────────────────────
	// three stocks life produces and consumes; out-of-band stocks stress the
	// life that needs them. vitality is each life's health, 0..1.
	stocks = $state<Stocks>(neutralStocks());
	vitality = $state<Record<string, number>>({}); // lifeId -> 0..1 (default 1)

	vitalityOf(lifeId: string): number {
		return this.vitality[lifeId] ?? 1;
	}

	// ── interventions: the Known endgame ──────────────────────────────────────
	// lasting modifiers an intervention can set on the world…
	stockBaseline = $state<Stocks>(neutralStocks()); // shape raises a drift target
	stabilityBonus = $state(0); // encourage raises resilience
	metabolismScale = $state<Record<string, number>>({}); // guide eases an animal's draw
	// …and the bookkeeping: which life she has acted on (→ the line she spoke),
	// how heavy her hand has been lately, and how long the world has held itself.
	interventionsDone = $state<Record<string, number>>({}); // lifeId -> chosen line index
	interventionLoad = $state(0);
	equilibriumSeconds = $state(0);

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

	// ── bestiary integration ─────────────────────────────────────────────────
	// Cached snapshot of creatures from the Bestiary app (same-origin IndexedDB).
	// Refreshed on page focus so edits in Bestiary are reflected promptly.
	bestiaryCreatures = $state<BestiaryCreature[]>([]);
	// Maps Marginalia life ID → Bestiary creature ID. Persisted in the book save.
	spriteBindings = $state<Record<string, string>>({});

	async refreshBestiaryCreatures(): Promise<void> {
		this.bestiaryCreatures = await getBestiaryCreatures();
		// drop any bindings whose target creature has since been deleted
		const ids = new Set(this.bestiaryCreatures.map((c) => c.id));
		const cleaned: Record<string, string> = {};
		let changed = false;
		for (const [lifeId, creatureId] of Object.entries(this.spriteBindings)) {
			if (ids.has(creatureId)) {
				cleaned[lifeId] = creatureId;
			} else {
				changed = true;
			}
		}
		if (changed) {
			this.spriteBindings = cleaned;
			this.persist();
		}
	}

	setSpriteBinding(lifeId: string, creatureId: string | null): void {
		const next = { ...this.spriteBindings };
		if (creatureId === null) {
			delete next[lifeId];
		} else {
			next[lifeId] = creatureId;
		}
		this.spriteBindings = next;
		this.persist();
	}

	boundCreatureFor(lifeId: string): BestiaryCreature | null {
		const creatureId = this.spriteBindings[lifeId];
		if (!creatureId) return null;
		return this.bestiaryCreatures.find((c) => c.id === creatureId) ?? null;
	}

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

	// raw Insight/sec from witnessed life, before the Favor multiplier. A
	// stressed life (low vitality) shows her less.
	private baseInsightRate = $derived.by(() => {
		let r = 0;
		for (const l of this.life) {
			r += l.insightWeight * (STAGE_INSIGHT_MULT[this.stageOf(l.id)] ?? 0) * this.vitalityOf(l.id);
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

	// richness of the world — weighted by how deeply each life is witnessed,
	// plus what has emerged and what she has fully Known.
	complexity = $derived.by(() => {
		let c = 0;
		for (const l of this.life) c += 1 + this.stageOf(l.id);
		return c + 1.5 * this.emergences.length + 2 * this.knownCount;
	});

	private knownEcosystems = $derived(
		this.life.filter((l) => l.domain === 'ecosystem' && this.stageOf(l.id) >= STAGE_KNOWN).length
	);

	// 0..100 resilience — how close the three stocks sit to a balanced world,
	// lifted by the ecosystems she has come to Know and any encouragement.
	stability = $derived(
		Math.min(100, stabilityOf(this.stocks, this.knownEcosystems) + this.stabilityBonus)
	);

	// how stressed a life is right now: 0 (content) .. 1 (dire)
	severityOf(life: Life): number {
		return severityFor(life.needs, this.stocks);
	}

	// placeholder soft-fail signal — the world is "going quiet". The collapse
	// pass will give this consequences and a voice; for now it only surfaces.
	quiet = $derived(this.life.length > 0 && this.stability < WORLD_QUIET_STABILITY);

	// ── derived: the equilibrium dividend ─────────────────────────────────────
	// the world is balanced when every stock sits inside its healthy band.
	private allStocksInBand = $derived(
		STOCK_IDS.every((id) => {
			const [lo, hi] = STOCK_BANDS[id];
			return this.stocks[id] >= lo && this.stocks[id] <= hi;
		})
	);

	// a balanced world she is *not* propping up rewards her — the lighter her
	// recent hand (load), the larger the dividend. 0..1.
	equilibriumFactor = $derived(
		this.allStocksInBand ? Math.max(0, 1 - Math.min(1, this.interventionLoad)) : 0
	);

	selfBalancing = $derived(this.life.length > 0 && this.equilibriumFactor > EQUILIBRIUM_MIN_FACTOR);

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

	// ── interventions: act on a Known life, once, gently ──────────────────────

	hasIntervened(lifeId: string): boolean {
		return lifeId in this.interventionsDone;
	}

	interventionCostFor(lifeId: string): { insight: number; essence: number } {
		const life = lifeById(lifeId);
		return life ? interventionForDomain(life.domain).cost : { insight: 0, essence: 0 };
	}

	canIntervene(lifeId: string): boolean {
		if (this.stageOf(lifeId) < STAGE_KNOWN || this.hasIntervened(lifeId)) return false;
		const c = this.interventionCostFor(lifeId);
		return this.insight >= c.insight && this.essence >= c.essence;
	}

	// the line she spoke when she acted on this life (persisted), or null
	interventionLineFor(lifeId: string): string | null {
		const idx = this.interventionsDone[lifeId];
		const life = lifeById(lifeId);
		if (idx === undefined || !life) return null;
		return interventionForDomain(life.domain).lines[idx] ?? null;
	}

	intervene(lifeId: string) {
		if (!this.canIntervene(lifeId)) return;
		const life = lifeById(lifeId)!;
		const spec = interventionForDomain(life.domain);
		this.insight -= spec.cost.insight;
		this.essence -= spec.cost.essence;
		this.applyInterventionEffect(life);
		const idx = Math.floor(Math.random() * spec.lines.length);
		this.interventionsDone = { ...this.interventionsDone, [lifeId]: idx };
		this.interventionLoad += INTERVENTION_LOAD_WEIGHT[spec.permanence];
		this.persist();
	}

	// each verb does its own thing — see DESIGN.md §2.2.
	private applyInterventionEffect(life: Life) {
		const focus = focusStock(life.metabolism, life.needs);
		switch (life.domain) {
			case 'plant': {
				// tend: a small, temporary bump to the stock it lives by; drift fades it
				const s = { ...this.stocks };
				s[focus] = Math.min(100, s[focus] + TEND_BUMP);
				this.stocks = s;
				break;
			}
			case 'weather': {
				// invoke: a broad, uncertain moisture push — asked, never commanded
				const s = { ...this.stocks };
				s.moisture = Math.min(100, s.moisture + INVOKE_BUMP * (0.6 + Math.random() * 0.8));
				this.stocks = s;
				break;
			}
			case 'geology': {
				// shape: move a stock's baseline for good — monumental, slow
				const b = { ...this.stockBaseline };
				b[focus] = Math.min(SHAPE_BASELINE_MAX, b[focus] + SHAPE_BASELINE_RAISE);
				this.stockBaseline = b;
				break;
			}
			case 'ecosystem': {
				// encourage: raise the floor under everything
				this.stabilityBonus = Math.min(
					ENCOURAGE_STABILITY_MAX,
					this.stabilityBonus + ENCOURAGE_STABILITY
				);
				break;
			}
			case 'animal': {
				// guide: ease what it draws from the world
				this.metabolismScale = { ...this.metabolismScale, [life.id]: GUIDE_METABOLISM_SCALE };
				break;
			}
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
		const present = this.life;

		// 1) vitality eases with each life's stress, and a wilting life metabolises
		//    less — so a stressed world eases its own pressure. gather stock rates
		//    and the world's total stress in the same pass.
		const nextVit: Record<string, number> = { ...this.vitality };
		const rate: Stocks = { nutrients: 0, oxygen: 0, moisture: 0 };
		let stress = 0;
		for (const l of present) {
			const v = nextVitality(this.vitalityOf(l.id), this.severityOf(l), dt);
			nextVit[l.id] = v;
			stress += 1 - v;
			const scale = this.metabolismScale[l.id] ?? 1;
			const r = lifeStockRate(l.metabolism, (STAGE_ACTIVITY[this.stageOf(l.id)] ?? 0) * scale, v);
			for (const id of STOCK_IDS) rate[id] += r[id] ?? 0;
		}
		this.vitality = nextVit;

		// 2) study accrual for attended life, slowed when it is suffering.
		for (const id of [...this.attending]) {
			const life = lifeById(id);
			if (!life) continue;
			this.addStudy(id, dt * life.studyEase * this.vitalityOf(id));
		}

		// 3) stocks move by metabolism, then drift back toward neutral.
		const s = { ...this.stocks };
		for (const id of STOCK_IDS) {
			s[id] = Math.max(
				0,
				Math.min(100, s[id] + (rate[id] + driftRate(s[id], this.stockBaseline[id])) * dt)
			);
		}
		this.stocks = s;

		// 4) the world yields Insight every second it is witnessed.
		this.insight += this.insightPerSec * dt;

		// 5) her hand grows light again, and a balanced world she isn't propping up
		//    banks the equilibrium dividend.
		if (this.interventionLoad > 0) {
			this.interventionLoad = Math.max(0, this.interventionLoad - INTERVENTION_LOAD_DECAY * dt);
		}
		const eq = this.equilibriumFactor;
		if (eq > EQUILIBRIUM_MIN_FACTOR) this.equilibriumSeconds += dt;

		// 6) Favor eases toward a target set by how much she has Known, pulled down
		//    by the world's stress and lifted when it holds itself. Exponential
		//    approach stays stable for any dt (incl. offline jumps).
		const target = Math.max(
			0,
			FAVOR_BASE_TARGET +
				FAVOR_PER_KNOWN * this.knownCount -
				FAVOR_STRESS_PENALTY * stress +
				FAVOR_EQUILIBRIUM_BONUS * eq
		);
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
			stocks: { ...this.stocks },
			vitality: { ...this.vitality },
			stockBaseline: { ...this.stockBaseline },
			stabilityBonus: this.stabilityBonus,
			metabolismScale: { ...this.metabolismScale },
			interventionsDone: { ...this.interventionsDone },
			interventionLoad: this.interventionLoad,
			equilibriumSeconds: this.equilibriumSeconds,
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
			spriteBindings: { ...this.spriteBindings },
			lastSeen: Date.now()
		};
	}

	fromSave(s: BookSave) {
		this.essence = s.essence;
		this.knowing = s.knowing;
		this.insight = s.insight;
		this.favor = s.favor;
		this.stocks = { ...(s.stocks ?? neutralStocks()) };
		this.vitality = { ...(s.vitality ?? {}) };
		this.stockBaseline = { ...(s.stockBaseline ?? neutralStocks()) };
		this.stabilityBonus = s.stabilityBonus ?? 0;
		this.metabolismScale = { ...(s.metabolismScale ?? {}) };
		this.interventionsDone = { ...(s.interventionsDone ?? {}) };
		this.interventionLoad = s.interventionLoad ?? 0;
		this.equilibriumSeconds = s.equilibriumSeconds ?? 0;
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
		this.spriteBindings = { ...(s.spriteBindings ?? {}) };
	}

	hydrate() {
		const s = load();
		if (s) {
			this.fromSave(s);
			if (s.lastSeen) this.creditOffline((Date.now() - s.lastSeen) / 1000);
			// Return to the world, not the web, when life already exists.
			if (this.life.length > 0) this.mode = 'world';
		}
	}

	persist() {
		save(this.toSave());
	}

	resetIdleProgress() {
		const preservedBindings = { ...this.spriteBindings };
		const preservedBestiaryCreatures = this.bestiaryCreatures;
		this.fromSave({ ...emptySave(), spriteBindings: preservedBindings });
		this.mode = 'web';
		this.offlineReport = null;
		this.bestiaryCreatures = preservedBestiaryCreatures;
		this.persist();
	}

	hardReset() {
		wipe();
		this.resetIdleProgress();
	}
}

export const book = new Book();

export const totalConditions = conditions.length;
