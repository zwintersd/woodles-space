// The Witch's Book — the reactive view over the world.
//
// The mechanics do not live here. They live in `world.ts`, which is plain,
// rune-free, seeded and headless, so the balance harness (`sim.ts`) can run ten
// hours of it in the time this file takes to render one frame. **This class is
// a view**: it holds a `World`, exposes it through runes so Svelte can track
// it, and owns everything the economy shouldn't have to know about — the save
// file, the wall clock, offline credit, the bestiary bindings, the reading
// room, the field-note log and the gain popups.
//
// The public surface below is load-bearing: forty files across the app read
// `book.*`, so every member the app used before the world/Book split still
// exists here with the same name and the same meaning.
//
// Reactivity works through one `version` counter rather than per-field `$state`.
// Every getter reads it, and every mutation bumps it, so Svelte invalidates on
// any change to the world. That is coarser than tracking each field — and it is
// what lets the world underneath be plain objects that the harness can drive
// 360,000 times without paying for a proxy.

import { conditions, conditionById } from './content/conditions';
import { lifeById, type Life, type LifeCategory } from './content/life';
import { journalSeeds, type FavorBand } from './content/journal';
import { OFFLINE_CAP_SECONDS, DISTILL_INSIGHT_COST } from './tuning';
import { type Stocks, type StockId, STOCK_IDS, neutralStocks } from './vitals';
import { pushSample } from './history';
import { STOCK_HISTORY_SAMPLE_SEC, FIELD_NOTES_MAX } from './tuning';
import { emptySave, load, save, wipe, type BookSave, type FieldNote } from './persist';
import {
	getBestiaryCreatures,
	getWorldCreatures,
	type BestiaryCreature,
	type WorldCreature
} from './bestiaryDb';
import { announceGain } from './resourceGains.svelte';
import {
	World,
	createWorldState,
	STAGE_NOTICED,
	STAGE_OBSERVED,
	STAGE_STUDIED,
	STAGE_KNOWN,
	stageLabel,
	type WorldEvent,
	type WorldState
} from './world';
import {
	SEDIMENT_UNLOCK_COST,
	SEDIMENT_POUR_RATE,
	applySedimentPour,
	canPlaceCustomSpawnPoint as canPlaceCustomSpawnPointInShape,
	creaturePlacementStatus,
	customSpawnPointCost,
	emptyWorldShape,
	featurePlacementStatus,
	normalizeWorldShape,
	placeCreature as placeCreatureIntoShape,
	placeCustomSpawnPoint as placeCustomSpawnPointIntoShape,
	placeFeatureOnBestSediment,
	removeCustomSpawnPoint as removeCustomSpawnPointFromShape,
	sedimentCoverage as sedimentCoverageOf,
	unlockWorldspacesForCoverage,
	type CustomSpawnPointInput,
	type SpawnLayer,
	type SpawnRarity,
	type WorldFeatureId,
	type WorldShape,
	type Worldspace
} from './worldShape';

// Re-exported from world.ts, which now owns them — the app imports these from
// here in a dozen places and shouldn't have to care that they moved.
export { STAGE_NOTICED, STAGE_OBSERVED, STAGE_STUDIED, STAGE_KNOWN, stageLabel };

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
	/**
	 * The economy. Plain, seeded, rune-free — see world.ts. Everything the game
	 * *is* happens in here; this class only watches it and writes it down.
	 */
	readonly world = new World(createWorldState());

	/**
	 * Bumped on every mutation. Every derived getter reads it, so Svelte
	 * re-evaluates them when the world moves. One counter rather than a dozen
	 * `$state` fields is what keeps the world underneath a plain object.
	 */
	private version = $state(0);
	private touch() {
		this.version += 1;
	}
	/** Registers the dependency. Called at the top of every reactive read. */
	private get v(): number {
		return this.version;
	}

	// ── resources ────────────────────────────────────────────────────────────

	get essence(): number {
		return this.v, this.world.state.essence;
	}
	set essence(n: number) {
		this.world.state.essence = n;
		this.touch();
	}

	get knowing(): number {
		return this.v, this.world.state.knowing;
	}
	set knowing(n: number) {
		this.world.state.knowing = n;
		this.touch();
	}

	get insight(): number {
		return this.v, this.world.state.insight;
	}
	set insight(n: number) {
		this.world.state.insight = n;
		this.touch();
	}

	get favor(): number {
		return this.v, this.world.state.favor;
	}
	set favor(n: number) {
		this.world.state.favor = n;
		this.touch();
	}

	get stocks(): Stocks {
		return this.v, this.world.state.stocks;
	}
	set stocks(s: Stocks) {
		this.world.state.stocks = s;
		this.touch();
	}

	get vitality(): Record<string, number> {
		return this.v, this.world.state.vitality;
	}

	vitalityOf(lifeId: string): number {
		return this.v, this.world.vitalityOf(lifeId);
	}

	// ── interventions ────────────────────────────────────────────────────────

	get stockBaseline(): Stocks {
		return this.v, this.world.state.stockBaseline;
	}
	get stabilityBonus(): number {
		return this.v, this.world.state.stabilityBonus;
	}
	get metabolismScale(): Record<string, number> {
		return this.v, this.world.state.metabolismScale;
	}
	get interventionsDone(): Record<string, number> {
		return this.v, this.world.state.interventionsDone;
	}
	get interventionLoad(): number {
		return this.v, this.world.state.interventionLoad;
	}
	set interventionLoad(n: number) {
		this.world.state.interventionLoad = n;
		this.touch();
	}
	get equilibriumSeconds(): number {
		return this.v, this.world.state.equilibriumSeconds;
	}

	// ── attention ────────────────────────────────────────────────────────────

	get attentionCapacity(): number {
		return this.v, this.world.state.attentionCapacity;
	}
	set attentionCapacity(n: number) {
		this.world.state.attentionCapacity = n;
		this.touch();
	}
	get attending(): string[] {
		return this.v, this.world.state.attending;
	}
	get study(): Record<string, number> {
		return this.v, this.world.state.study;
	}
	get focusStreak(): number {
		return this.v, this.world.state.focusStreak;
	}

	// ── progress ─────────────────────────────────────────────────────────────

	get writtenConditions(): string[] {
		return this.v, this.world.state.writtenConditions;
	}
	get observation(): Record<string, number> {
		return this.v, this.world.state.observation;
	}
	get categoryMastered(): Record<string, boolean> {
		return this.v, this.world.state.categoryMastered;
	}

	journalShown = $state<string[]>([]);
	worldIndex = $state(0);
	bookOpen = $state(false);
	worldShape = $state<WorldShape>(emptyWorldShape());

	mode = $state<'web' | 'world'>('web');

	// ── vital-sign instrumentation: rolling history for the Ledger sparklines ─
	// transient — not persisted; rebuilds live through the session (and
	// backfills a little during the offline-credit replay).
	stockHistory = $state<Record<StockId, number[]>>({ nutrients: [], oxygen: [], moisture: [] });
	private historySampleAccum = 0;

	// ── field notes: the live observation log ─────────────────────────────────
	fieldNotes = $state<FieldNote[]>([]);

	// transient — surfaced once after a return, then dismissed
	offlineReport = $state<OfflineReport | null>(null);

	// true only while creditOffline() fast-forwards many ticks at once — the
	// offline report already summarizes that catch-up, so per-tick gain
	// popups would just be noise (and a lot of it, for a long absence).
	private suppressGainAnnouncements = false;

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
	// Guards refreshBestiaryCreatures against overlapping calls (mount + focus
	// can both fire in quick succession) — internal bookkeeping only, not
	// persisted or reactive.
	private refreshSeq = 0;

	async refreshBestiaryCreatures(): Promise<void> {
		const seq = ++this.refreshSeq;
		const local = await getBestiaryCreatures();
		const world = await getWorldCreatures(local);
		// a newer call started (and will finish its own commit + cleanup) —
		// applying this one's now-stale result could wipe a binding the newer
		// call's fresher local read would have kept
		if (seq !== this.refreshSeq) return;
		this.bestiaryCreatures = local;
		this.worldCreatures = world;
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

	hasWritten(id: string): boolean {
		return this.v, this.world.hasWritten(id);
	}

	get emergences() {
		return this.v, this.world.emergences;
	}
	get allRevealedLife(): Life[] {
		return this.v, this.world.allRevealedLife;
	}
	get life(): Life[] {
		return this.v, this.world.life;
	}

	stageOf(lifeId: string): number {
		return this.v, this.world.stageOf(lifeId);
	}

	// ── derived: the idle engine ─────────────────────────────────────────────

	get favorMult(): number {
		return this.v, this.world.favorMult;
	}
	get insightPerSec(): number {
		return this.v, this.world.insightPerSec;
	}
	get focusMult(): number {
		return this.v, this.world.focusMult;
	}
	get attentionUsed(): number {
		return this.v, this.world.attentionUsed;
	}
	get attentionFree(): number {
		return this.v, this.world.attentionFree;
	}
	get attentionUpgradeCost(): number | null {
		return this.v, this.world.attentionUpgradeCost;
	}
	get knownCount(): number {
		return this.v, this.world.knownCount;
	}

	// seconds until Insight covers a cost at the current rate, or null when
	// the rate can't get there (0/sec) — the UI reads this as "—".
	private etaSeconds(cost: number): number | null {
		const remaining = cost - this.insight;
		if (remaining <= 0) return 0;
		if (this.insightPerSec <= 0) return null;
		return remaining / this.insightPerSec;
	}

	get attentionUpgradeEtaSeconds(): number | null {
		const cost = this.attentionUpgradeCost;
		return cost === null ? null : this.etaSeconds(cost);
	}

	get distillEtaSeconds(): number | null {
		return this.etaSeconds(DISTILL_INSIGHT_COST);
	}

	// ── derived: world shaping ───────────────────────────────────────────────

	sedimentCoverage = $derived(sedimentCoverageOf(this.worldShape.sedimentGrid));
	sedimentUnlockCost = SEDIMENT_UNLOCK_COST;
	sedimentPourRate = SEDIMENT_POUR_RATE;

	get hasObservedAquaticLife(): boolean {
		return (
			this.v,
			this.world.allRevealedLife.some(
				(l) => l.category === 'aquatic' && this.world.stageOf(l.id) >= STAGE_OBSERVED
			)
		);
	}

	get canBuySediment(): boolean {
		return (
			!this.worldShape.sedimentUnlocked &&
			this.hasObservedAquaticLife &&
			this.insight >= SEDIMENT_UNLOCK_COST
		);
	}

	pendingWorldspaceUnlock = $derived.by(() => {
		const unlocked = this.worldShape.unlockedWorldspaces.find(
			(space) => space !== 'water' && !this.worldShape.seenUnlocks.includes(space)
		);
		return unlocked ?? null;
	});

	// ── derived: world metrics & framing ─────────────────────────────────────

	get complexity(): number {
		return this.v, this.world.complexity;
	}
	get stability(): number {
		return this.v, this.world.stability;
	}
	get quiet(): boolean {
		return this.v, this.world.quiet;
	}
	get equilibriumFactor(): number {
		return this.v, this.world.equilibriumFactor;
	}
	get selfBalancing(): boolean {
		return this.v, this.world.selfBalancing;
	}

	severityOf(life: Life): number {
		return this.v, this.world.severityOf(life);
	}

	get favorBand(): FavorBand {
		return this.favor >= 70 ? 'high' : this.favor <= 35 ? 'low' : 'even';
	}

	get title(): string {
		const tendedSomething = this.life.some(
			(l) => l.domain === 'plant' && this.stageOf(l.id) >= STAGE_OBSERVED
		);
		if (tendedSomething) return 'gardener';
		if (this.writtenConditions.length > 0) return 'dreamer';
		return 'witch';
	}

	pendingJournal = $derived.by(() => {
		const n = this.writtenConditions.length;
		const band = this.favorBand;
		const eligible = journalSeeds
			.filter((s) => s.atConditions <= n && (s.band === band || s.band === 'even'))
			.filter((s) => !this.journalShown.includes(s.id))
			.sort((a, b) => b.atConditions - a.atConditions);
		return eligible[0] ?? null;
	});

	// ── turning world events into what the UI shows ──────────────────────────

	/**
	 * The one place a `WorldEvent` becomes something a person sees. The world
	 * decides *that* something happened and what it would say; this decides
	 * whether now is a good moment to say it.
	 */
	private absorb(events: WorldEvent[]) {
		for (const e of events) {
			switch (e.kind) {
				case 'gain':
					if (!this.suppressGainAnnouncements) announceGain(e.resource, e.amount);
					break;
				case 'trickle':
					if (!this.suppressGainAnnouncements) announceGain('insight', e.amount, 'trickle');
					break;
				case 'stage':
				case 'mastery':
				case 'equilibrium':
				case 'quiet':
					if (e.note) this.pushFieldNote(e.note);
					break;
				case 'intervention':
					this.pushFieldNote(e.note);
					break;
			}
		}
		if (events.length) this.touch();
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
		return this.v, this.world.canWrite(id);
	}

	writeCondition(id: string) {
		if (!this.world.writeCondition(id)) return;
		this.touch();
		this.persist();
	}

	// ── the World (witness mode) ─────────────────────────────────────────────

	isAttending(lifeId: string): boolean {
		return this.v, this.world.isAttending(lifeId);
	}

	canAttend(lifeId: string): boolean {
		return this.v, this.world.canAttend(lifeId);
	}

	attend(lifeId: string) {
		if (!this.world.attend(lifeId)) return;
		this.touch();
		this.persist();
	}

	unattend(lifeId: string) {
		if (!this.world.unattend(lifeId)) return;
		this.touch();
		this.persist();
	}

	stageThreshold(lifeId: string): number {
		return this.v, this.world.stageThreshold(lifeId);
	}

	stageProgress(lifeId: string): number {
		return this.v, this.world.stageProgress(lifeId);
	}

	lookCloser(lifeId: string) {
		this.absorb(this.world.lookCloser(lifeId, Date.now()));
		this.touch();
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
		return this.v, this.world.hasIntervened(lifeId);
	}

	interventionCostFor(lifeId: string): { insight: number; essence: number } {
		return this.world.interventionCostFor(lifeId);
	}

	canIntervene(lifeId: string): boolean {
		return this.v, this.world.canIntervene(lifeId);
	}

	interventionLineFor(lifeId: string): string | null {
		return this.v, this.world.interventionLineFor(lifeId);
	}

	intervene(lifeId: string) {
		const events = this.world.intervene(lifeId);
		if (!events.length) return;
		this.absorb(events);
		this.touch();
		this.persist();
	}

	// ── insight sinks ────────────────────────────────────────────────────────

	expandAttention() {
		if (!this.world.expandAttention()) return;
		this.touch();
		this.persist();
	}

	canDistill(): boolean {
		return this.v, this.world.canDistill();
	}

	distillEssence() {
		const events = this.world.distillEssence();
		if (!events.length) return;
		this.absorb(events);
		this.touch();
		this.persist();
	}

	// ── world shaping: sediment, worldspaces, and feature cards ───────────────

	buySediment() {
		if (!this.canBuySediment) return;
		this.insight -= SEDIMENT_UNLOCK_COST;
		this.worldShape = { ...this.worldShape, sedimentUnlocked: true };
		this.persist();
	}

	canPourSediment(): boolean {
		return this.worldShape.sedimentUnlocked && this.insight > 0;
	}

	pourSedimentAt(x: number, y: number, dt: number): number {
		if (!this.canPourSediment() || dt <= 0) return 0;
		const spend = Math.min(this.insight, SEDIMENT_POUR_RATE * dt);
		const effectiveDt = spend / SEDIMENT_POUR_RATE;
		const nextGrid = applySedimentPour(this.worldShape.sedimentGrid, x, y, effectiveDt);
		this.insight -= spend;
		this.worldShape = unlockWorldspacesForCoverage({
			...this.worldShape,
			sedimentGrid: nextGrid
		});
		return spend;
	}

	finishPourSediment() {
		this.persist();
	}

	enterWorldspace(worldspace: Worldspace) {
		if (!this.worldShape.unlockedWorldspaces.includes(worldspace)) return;
		this.worldShape = {
			...this.worldShape,
			activeWorldspace: worldspace,
			seenUnlocks: Array.from(new Set([...this.worldShape.seenUnlocks, worldspace])).filter(
				(space) => space !== 'water'
			)
		};
		// the world gates what is visible on this, so it has to hear about it
		this.world.setWorldspace(worldspace);
		this.touch();
		this.persist();
	}

	markWorldspaceSeen(worldspace: Worldspace) {
		if (worldspace === 'water') return;
		this.worldShape = {
			...this.worldShape,
			seenUnlocks: Array.from(new Set([...this.worldShape.seenUnlocks, worldspace]))
		};
		this.persist();
	}

	canPlaceFeature(featureId: WorldFeatureId): boolean {
		return featurePlacementStatus(this.worldShape, featureId).ok;
	}

	featurePlacementReason(featureId: WorldFeatureId): string {
		return featurePlacementStatus(this.worldShape, featureId).reason;
	}

	placeFeature(featureId: WorldFeatureId) {
		const next = placeFeatureOnBestSediment(this.worldShape, featureId);
		if (next === this.worldShape) return;
		this.worldShape = next;
		this.persist();
	}

	// decorative shared creatures — no vitals/insight participation, see
	// CREATURE_SPECS in worldShape.ts. free and auto-placed, same shape as
	// the feature-placement trio above.
	canPlaceCreature(creatureId: string): boolean {
		return creaturePlacementStatus(this.worldShape, creatureId).ok;
	}

	creaturePlacementReason(creatureId: string): string {
		return creaturePlacementStatus(this.worldShape, creatureId).reason;
	}

	placeCreature(creatureId: string) {
		const next = placeCreatureIntoShape(this.worldShape, creatureId);
		if (next === this.worldShape) return;
		this.worldShape = next;
		this.persist();
	}

	// waymarks — spawn points she authors herself, in full: position, layer,
	// category, tags, weight, rarity. paid in Insight, capped, gated the same
	// way shore/air menagerie creatures are.
	canPlaceCustomSpawnPoint(layer: SpawnLayer): boolean {
		return canPlaceCustomSpawnPointInShape(this.worldShape, layer);
	}

	customSpawnPointCostFor(weight: number, rarity: SpawnRarity): number {
		return customSpawnPointCost(weight, rarity);
	}

	placeCustomSpawnPoint(input: CustomSpawnPointInput): boolean {
		if (!this.canPlaceCustomSpawnPoint(input.layer)) return false;
		const cost = this.customSpawnPointCostFor(input.weight, input.rarity);
		if (this.insight < cost) return false;
		const next = placeCustomSpawnPointIntoShape(this.worldShape, input);
		if (next === this.worldShape) return false;
		this.insight -= cost;
		this.worldShape = next;
		this.persist();
		return true;
	}

	removeCustomSpawnPoint(id: string) {
		const next = removeCustomSpawnPointFromShape(this.worldShape, id);
		if (next === this.worldShape) return;
		this.worldShape = next;
		this.persist();
	}

	// ── the idle tick ────────────────────────────────────────────────────────

	tick(dt: number) {
		if (dt <= 0) return;
		this.absorb(this.world.tick(dt));

		// sample the stocks every few sim-seconds for the Ledger sparklines — an
		// instrument reading, not every-frame noise. Presentation, so it stays
		// here rather than in the world.
		this.historySampleAccum += dt;
		if (this.historySampleAccum >= STOCK_HISTORY_SAMPLE_SEC) {
			this.historySampleAccum -= STOCK_HISTORY_SAMPLE_SEC;
			const h = { ...this.stockHistory };
			for (const id of STOCK_IDS) h[id] = pushSample(h[id], this.world.state.stocks[id]);
			this.stockHistory = h;
		}

		this.touch();
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
		this.suppressGainAnnouncements = true;
		this.world.quietAnnouncements = true;
		try {
			while (remaining > 0) {
				this.tick(Math.min(step, remaining));
				remaining -= step;
			}
		} finally {
			this.suppressGainAnnouncements = false;
			this.world.quietAnnouncements = false;
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
		const w = this.world.state;
		return {
			v: 1,
			essence: w.essence,
			knowing: w.knowing,
			insight: w.insight,
			favor: w.favor,
			stocks: { ...w.stocks },
			vitality: { ...w.vitality },
			stockBaseline: { ...w.stockBaseline },
			stabilityBonus: w.stabilityBonus,
			metabolismScale: { ...w.metabolismScale },
			interventionsDone: { ...w.interventionsDone },
			interventionLoad: w.interventionLoad,
			equilibriumSeconds: w.equilibriumSeconds,
			attentionCapacity: w.attentionCapacity,
			attending: [...w.attending],
			study: { ...w.study },
			writtenConditions: [...w.writtenConditions],
			observation: { ...w.observation },
			journalShown: this.journalShown,
			worldIndex: this.worldIndex,
			bookOpen: this.bookOpen,
			worldShape: normalizeWorldShape(this.worldShape),
			readingMsTowardNextPoint: this.readingMsTowardNextPoint,
			readingStarPoints: this.readingStarPoints,
			readingCompletedStars: this.readingCompletedStars,
			readingCumulativeMs: this.readingCumulativeMs,
			readingCumulativeWords: this.readingCumulativeWords,
			spriteBindings: { ...this.spriteBindings },
			fieldNotes: this.fieldNotes.map((n) => ({ ...n })),
			categoryMastered: { ...w.categoryMastered },
			lastSeen: Date.now()
		};
	}

	fromSave(s: BookSave) {
		const shape = normalizeWorldShape(s.worldShape);
		const state: WorldState = {
			...createWorldState(),
			essence: s.essence,
			knowing: s.knowing,
			insight: s.insight,
			favor: s.favor,
			stocks: { ...(s.stocks ?? neutralStocks()) },
			vitality: { ...(s.vitality ?? {}) },
			stockBaseline: { ...(s.stockBaseline ?? neutralStocks()) },
			stabilityBonus: s.stabilityBonus ?? 0,
			metabolismScale: { ...(s.metabolismScale ?? {}) },
			interventionsDone: { ...(s.interventionsDone ?? {}) },
			interventionLoad: s.interventionLoad ?? 0,
			equilibriumSeconds: s.equilibriumSeconds ?? 0,
			attentionCapacity: s.attentionCapacity,
			attending: [...s.attending],
			study: { ...s.study },
			writtenConditions: [...s.writtenConditions],
			observation: { ...s.observation },
			categoryMastered: { ...(s.categoryMastered ?? {}) },
			activeWorldspace: shape.activeWorldspace
			// the session-only fields (focus streak, trickle batching) come from
			// createWorldState() above: a fresh load starts cold rather than
			// trying to replay a streak that lived in one sitting of clicking.
		};
		this.world.replace(state);

		this.journalShown = [...s.journalShown];
		this.worldIndex = s.worldIndex;
		this.bookOpen = s.bookOpen;
		this.worldShape = shape;
		this.readingMsTowardNextPoint = s.readingMsTowardNextPoint;
		this.readingStarPoints = s.readingStarPoints;
		this.readingCompletedStars = s.readingCompletedStars;
		this.readingCumulativeMs = s.readingCumulativeMs;
		this.readingCumulativeWords = s.readingCumulativeWords;
		this.spriteBindings = { ...(s.spriteBindings ?? {}) };
		this.fieldNotes = [...(s.fieldNotes ?? [])];
		this.stockHistory = { nutrients: [], oxygen: [], moisture: [] };
		this.historySampleAccum = 0;
		this.touch();
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
