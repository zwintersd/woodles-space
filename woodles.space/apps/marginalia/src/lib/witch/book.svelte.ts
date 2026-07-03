// The Witch's Book — game state. Svelte 5 runes.
//
// This build adds the idle layer: the World lives on its own clock. Life she
// is attending to deepens through the observation stages over time; witnessed
// life yields Insight every second; Favor drifts; and time away is credited.

import { conditions, conditionById } from './content/conditions';
import { revealedEmergences } from './content/emergences';
import { revealedLife, lifeById, world1Life, type Life, type LifeCategory } from './content/life';
import { journalSeeds, type FavorBand } from './content/journal';
import {
	stageFieldNoteOptions,
	fillTemplate,
	pickLine,
	equilibriumFieldNotes,
	quietFieldNotes,
	categoryMasteryFieldNotes
} from './content/fieldNoteTemplates';
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
	EQUILIBRIUM_MIN_FACTOR,
	STOCK_HISTORY_SAMPLE_SEC,
	FIELD_NOTES_MAX,
	CATEGORY_MASTERY_BONUS
} from './tuning';
import {
	type Stocks,
	type StockId,
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
import { nextFocusStreak, focusMultiplier } from './focus';
import { pushSample } from './history';
import { interventionForDomain } from './content/interventions';
import { emptySave, load, save, wipe, type BookSave, type FieldNote } from './persist';
import { getBestiaryCreatures, getWorldCreatures, type BestiaryCreature, type WorldCreature } from './bestiaryDb';

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

// a rough ETA readout — "how long at this rate", the classic idle-game hook.
// null/negative/non-finite reads as "—": nothing to project from a 0 rate.
export function humanizeSeconds(s: number | null): string {
	if (s === null || !isFinite(s) || s < 0) return '—';
	if (s < 1) return 'any moment';
	if (s < 60) return `~${Math.ceil(s)}s`;
	if (s < 3600) return `~${Math.ceil(s / 60)}m`;
	return `~${Math.ceil(s / 3600)}h`;
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

	// ── focus: consecutive "look closer" clicks build a bounded streak ───────
	// transient — not persisted; a fresh session starts cold, which is fine,
	// the streak lives on the timescale of one sitting of clicking.
	focusStreak = $state(0);
	private lastLookCloserAt = 0; // ms epoch, plain field: internal bookkeeping only

	// ── vital-sign instrumentation: rolling history for the Ledger sparklines ─
	// transient — not persisted; rebuilds live through the session (and
	// backfills a little during the offline-credit replay).
	stockHistory = $state<Record<StockId, number[]>>({ nutrients: [], oxygen: [], moisture: [] });
	private historySampleAccum = 0;

	// ── field notes: the live observation log ─────────────────────────────────
	fieldNotes = $state<FieldNote[]>([]);
	private wasSelfBalancing = false;
	private wasQuiet = false;

	// ── category mastery: a completion bonus, sticky once earned ─────────────
	categoryMastered = $state<Record<string, boolean>>({});

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
	// Refreshed on page focus so edits in Bestiary are reflected promptly. Local
	// only — the arcade's companion picker and the hex-stage dev preview stay
	// deliberately scoped to what's actually on this device.
	bestiaryCreatures = $state<BestiaryCreature[]>([]);
	// The world's binding pool (ROADMAP.md week 5): local creatures first, the
	// published bestiary gallery filling in the rest, so the world isn't empty
	// just because a visitor hasn't drawn anything of their own yet.
	worldCreatures = $state<WorldCreature[]>([]);
	// Maps Marginalia life ID → Bestiary creature ID (local or published).
	// Persisted in the book save.
	spriteBindings = $state<Record<string, string>>({});

	async refreshBestiaryCreatures(): Promise<void> {
		const local = await getBestiaryCreatures();
		this.bestiaryCreatures = local;
		this.worldCreatures = await getWorldCreatures(local);
		// drop any bindings whose target creature no longer resolves — deleted
		// locally, or dropped from a re-published snapshot
		const ids = new Set(this.worldCreatures.map((c) => c.id));
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

	boundCreatureFor(lifeId: string): WorldCreature | null {
		const creatureId = this.spriteBindings[lifeId];
		if (!creatureId) return null;
		return this.worldCreatures.find((c) => c.id === creatureId) ?? null;
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
	// stressed life (low vitality) shows her less; a category she has come
	// to fully Know pays a permanent bonus (see categoryMastered).
	private baseInsightRate = $derived.by(() => {
		let r = 0;
		for (const l of this.life) {
			const mastery = this.categoryMastered[l.category] ? 1 + CATEGORY_MASTERY_BONUS : 1;
			r +=
				l.insightWeight * (STAGE_INSIGHT_MULT[this.stageOf(l.id)] ?? 0) * this.vitalityOf(l.id) * mastery;
		}
		return r;
	});

	favorMult = $derived(favorMultiplier(this.favor));
	insightPerSec = $derived(this.baseInsightRate * this.favorMult);

	// the multiplier the next "look closer" click will land at, given her
	// current streak — read by the UI to show the bonus before it's spent.
	focusMult = $derived(focusMultiplier(this.focusStreak));

	// seconds until Insight covers a cost at the current rate, or null when
	// the rate can't get there (0/sec) — the UI reads this as "—".
	private etaSeconds(cost: number): number | null {
		const remaining = cost - this.insight;
		if (remaining <= 0) return 0;
		if (this.insightPerSec <= 0) return null;
		return remaining / this.insightPerSec;
	}

	attentionUpgradeEtaSeconds = $derived.by(() => {
		const cost = this.attentionUpgradeCost;
		return cost === null ? null : this.etaSeconds(cost);
	});

	distillEtaSeconds = $derived(this.etaSeconds(DISTILL_INSIGHT_COST));

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

	// the clicker hook: nudge an attended life along by hand. Consecutive
	// clicks build a bounded focus streak that boosts the seconds granted.
	lookCloser(lifeId: string) {
		if (!this.isAttending(lifeId)) return;
		const now = Date.now();
		this.focusStreak = nextFocusStreak(this.focusStreak, this.lastLookCloserAt, now);
		this.lastLookCloserAt = now;
		const seconds = LOOK_CLOSER_SECONDS * (lifeById(lifeId)?.studyEase ?? 1) * this.focusMult;
		this.addStudy(lifeId, seconds);
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
		const life = lifeById(lifeId);
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
			if (life) {
				const line = pickLine(stageFieldNoteOptions(life.domain, stage), Math.random());
				if (line) this.pushFieldNote(fillTemplate(line, life.name));
				if (stage === STAGE_KNOWN) this.checkCategoryMastery(life.category);
			}
		}
		if (stage >= STAGE_KNOWN) {
			// fully known — it no longer needs watching; free the slot
			banked = 0;
			this.attending = this.attending.filter((id) => id !== lifeId);
		}
		this.study = { ...this.study, [lifeId]: banked };
		return crossed;
	}

	// append to the observation log, newest first, capped.
	private pushFieldNote(text: string) {
		const note: FieldNote = {
			id: `fn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			t: Date.now(),
			text
		};
		this.fieldNotes = [note, ...this.fieldNotes].slice(0, FIELD_NOTES_MAX);
	}

	// a category is mastered the moment its last un-Known life reaches Known —
	// so this only ever needs checking right after a Known crossing. sticky:
	// once true, later-emerging life in the category can't revoke it.
	private checkCategoryMastery(category: LifeCategory) {
		if (this.categoryMastered[category]) return;
		const inCategory = this.life.filter((l) => l.category === category);
		if (inCategory.length === 0 || !inCategory.every((l) => this.stageOf(l.id) >= STAGE_KNOWN)) {
			return;
		}
		this.categoryMastered = { ...this.categoryMastered, [category]: true };
		const line = pickLine(categoryMasteryFieldNotes[category], Math.random());
		if (line) this.pushFieldNote(line);
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
		this.pushFieldNote(`${life.name}: "${spec.lines[idx]}"`);
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

		// 3b) sample the stocks every few sim-seconds for the Ledger sparklines —
		//     an instrument reading, not every-frame noise.
		this.historySampleAccum += dt;
		if (this.historySampleAccum >= STOCK_HISTORY_SAMPLE_SEC) {
			this.historySampleAccum -= STOCK_HISTORY_SAMPLE_SEC;
			const h = { ...this.stockHistory };
			for (const id of STOCK_IDS) h[id] = pushSample(h[id], this.stocks[id]);
			this.stockHistory = h;
		}

		// 4) the world yields Insight every second it is witnessed.
		this.insight += this.insightPerSec * dt;

		// 5) her hand grows light again, and a balanced world she isn't propping up
		//    banks the equilibrium dividend.
		if (this.interventionLoad > 0) {
			this.interventionLoad = Math.max(0, this.interventionLoad - INTERVENTION_LOAD_DECAY * dt);
		}
		const eq = this.equilibriumFactor;
		if (eq > EQUILIBRIUM_MIN_FACTOR) this.equilibriumSeconds += dt;

		// 5b) a field note the first time this world settles into balance, or
		//     the first time it goes quiet — a beat, not a repeating alarm.
		const balancingNow = this.selfBalancing;
		if (balancingNow && !this.wasSelfBalancing) {
			const line = pickLine(equilibriumFieldNotes, Math.random());
			if (line) this.pushFieldNote(line);
		}
		this.wasSelfBalancing = balancingNow;

		const quietNow = this.quiet;
		if (quietNow && !this.wasQuiet) {
			const line = pickLine(quietFieldNotes, Math.random());
			if (line) this.pushFieldNote(line);
		}
		this.wasQuiet = quietNow;

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
			fieldNotes: this.fieldNotes.map((n) => ({ ...n })),
			categoryMastered: { ...this.categoryMastered },
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
		this.fieldNotes = [...(s.fieldNotes ?? [])];
		this.categoryMastered = { ...(s.categoryMastered ?? {}) };
		// transient state (focus streak, stock history) is session-only —
		// a fresh load starts cold rather than trying to replay it.
		this.focusStreak = 0;
		this.lastLookCloserAt = 0;
		this.stockHistory = { nutrients: [], oxygen: [], moisture: [] };
		this.historySampleAccum = 0;
		this.wasSelfBalancing = false;
		this.wasQuiet = false;
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
		const preservedWorldCreatures = this.worldCreatures;
		this.fromSave({ ...emptySave(), spriteBindings: preservedBindings });
		this.mode = 'web';
		this.offlineReport = null;
		this.bestiaryCreatures = preservedBestiaryCreatures;
		this.worldCreatures = preservedWorldCreatures;
		this.persist();
	}

	hardReset() {
		wipe();
		this.resetIdleProgress();
	}
}

export const book = new Book();

export const totalConditions = conditions.length;
