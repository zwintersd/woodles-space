import {
	captureSave,
	countUnequippedUpgrades,
	createSim,
	evaluateCondition,
	hasErrors,
	idlePolicy,
	prestigeGain,
	upgradeMaxLevel,
	validateGameDef,
	type GameDef,
	type SimEvent,
	type Simulation
} from '@woodles/incremental-core';
import { clearSave, forgetLastPlayed, loadSave, rememberLastPlayed, writeSave } from './library.js';

/**
 * A game being played.
 *
 * The same `createSim` the studio's playtest dock drives, with two differences
 * that make it a game rather than a simulation of one: it runs at 1× real time,
 * and the policy is `idlePolicy` — the engine buys *nothing*, because every
 * purchase is a person deciding to make it. The buttons in the UI dispatch the
 * very same `Action`s a policy would have returned.
 *
 * Progress autosaves and survives a reload, including the random stream, so
 * closing the tab is never a way to reroll a bad crit.
 */

const AUTOSAVE_EVERY_MS = 10_000;
const MAX_LOG = 200;

export interface Purchasable {
	id: string;
	name: string;
	description?: string;
	level: number;
	maxLevel: number | null;
	cost: number | null;
	costCurrencyId: string;
	affordable: boolean;
	locked: boolean;
	/** Why it can't be bought yet, when it can't. */
	blockedBy: string | null;
	/** Owned upgrades only — whether it's contributing its effects right now. Absent for generators. */
	equipped?: boolean;
}

export class Game {
	def = $state<GameDef | null>(null);
	/** Set when the def can't be played at all. */
	fault = $state<string | null>(null);
	running = $state(false);
	elapsed = $state(0);
	savedAt = $state<string | null>(null);

	amounts = $state<Record<string, number>>({});
	lifetimes = $state<Record<string, number>>({});
	rates = $state<Record<string, number>>({});
	generatorLevels = $state<Record<string, number>>({});
	generatorRates = $state<Record<string, number>>({});
	upgradeLevels = $state<Record<string, number>>({});
	/** Owned upgrades currently left unequipped, across the whole def. */
	unequippedUpgradeCount = $state(0);
	nextCosts = $state<Record<string, number | null>>({});
	unlocked = $state<Set<string>>(new Set());
	prestigeCounts = $state<Record<string, number>>({});
	prestigeGains = $state<Record<string, number>>({});
	prestigeMultiplier = $state(1);
	reachedMilestones = $state<Set<string>>(new Set());

	log = $state<SimEvent[]>([]);

	#sim: Simulation | null = null;
	#frame: number | null = null;
	#lastFrame = 0;
	#lastSave = 0;
	#gated = new Set<string>();

	/** Loads a definition, resuming a save for it if one exists. */
	open(def: GameDef, options: { fresh?: boolean } = {}): void {
		this.stop();

		const issues = validateGameDef(def);
		if (hasErrors(issues)) {
			this.def = def;
			this.#sim = null;
			this.fault = issues.find((issue) => issue.severity === 'error')?.message ?? 'this game has errors';
			return;
		}

		this.def = def;
		this.fault = null;
		this.#gated = new Set(def.unlocks.flatMap((unlock) => unlock.reveals));

		const save = options.fresh ? null : loadSave(def.meta.id);
		// A seed per save, so two players of the same game don't share a run of
		// luck — but a *resumed* save keeps the one it was born with.
		const seed = save?.seed ?? Math.floor(Math.random() * 0xffffffff);
		this.#sim = createSim(def, idlePolicy, seed, save ?? undefined);
		this.savedAt = save?.savedAt ?? null;
		this.log = [];
		rememberLastPlayed(def);
		this.#readout();
		this.start();
	}

	start(): void {
		if (!this.#sim || this.running) return;
		// No animation clock means no loop to start — a headless test, or a
		// server render. Time still advances through `step`, which is the
		// primitive the loop is only a clock for.
		if (typeof requestAnimationFrame === 'undefined') return;
		this.running = true;
		this.#lastFrame = performance.now();
		this.#lastSave = performance.now();
		this.#frame = requestAnimationFrame((now) => this.#onFrame(now));
	}

	pause(): void {
		this.running = false;
		if (this.#frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.#frame);
		this.#frame = null;
	}

	stop(): void {
		this.pause();
		this.elapsed = 0;
	}

	/** Back to the shelf. Progress stays saved — this is not a reset. */
	close(): void {
		this.save();
		this.stop();
		forgetLastPlayed();
		this.def = null;
		this.fault = null;
		this.log = [];
	}

	/** Wipes progress and starts the same game over. */
	restart(): void {
		const def = this.def;
		if (!def) return;
		clearSave(def.meta.id);
		this.open(def, { fresh: true });
	}

	/**
	 * Advances the game by hand. The animation loop is a clock wired to this;
	 * having it as its own method is what lets a test play a game without one.
	 */
	step(seconds: number): void {
		if (!this.#sim) return;
		this.#record(this.#sim.step(seconds));
		this.#readout();
	}

	// ── what the player can do ───────────────────────────────────────────

	buyGenerator(id: string, count = 1): void {
		this.#act({ type: 'buyGenerator', id, count });
	}

	buyUpgrade(id: string): void {
		this.#act({ type: 'buyUpgrade', id });
	}

	/** Free and instant — a loadout choice, not a purchase. */
	equipUpgrade(id: string): void {
		this.#act({ type: 'equipUpgrade', id });
	}

	unequipUpgrade(id: string): void {
		this.#act({ type: 'unequipUpgrade', id });
	}

	prestige(layerId: string): void {
		this.#act({ type: 'prestige', layerId });
	}

	#act(action: Parameters<Simulation['apply']>[0]): void {
		if (!this.#sim) return;
		const events: SimEvent[] = [];
		if (!this.#sim.apply(action, events)) return;
		this.#record(events);
		this.#readout();
		this.save();
	}

	// ── views the UI needs ───────────────────────────────────────────────

	/** Generators as the shop sees them, hidden ones filtered out. */
	get generators(): Purchasable[] {
		const def = this.def;
		if (!def) return [];
		return def.generators
			.filter((generator) => this.#visible(generator.id))
			.map((generator) => {
				const level = this.generatorLevels[generator.id] ?? 0;
				const cost = this.nextCosts[generator.id] ?? null;
				const max = generator.maxLevel ?? null;
				return {
					id: generator.id,
					name: generator.name,
					level,
					maxLevel: max,
					cost,
					costCurrencyId: generator.cost.currencyId,
					affordable: cost !== null && (this.amounts[generator.cost.currencyId] ?? 0) >= cost,
					locked: false,
					blockedBy: cost === null && max !== null && level >= max ? 'fully grown' : null
				};
			});
	}

	get upgrades(): Purchasable[] {
		const def = this.def;
		if (!def || !this.#sim) return [];
		const state = this.#sim.state();

		return def.upgrades
			.filter((upgrade) => this.#visible(upgrade.id))
			// `visibleWhen` is the author saying "don't show this yet" — distinct
			// from `purchasableWhen`, which shows it and explains why not.
			.filter((upgrade) => !upgrade.visibleWhen || evaluateCondition(upgrade.visibleWhen, state))
			.map((upgrade) => {
				const level = this.upgradeLevels[upgrade.id] ?? 0;
				const max = upgradeMaxLevel(upgrade);
				const cost = this.nextCosts[upgrade.id] ?? null;
				const gated = !!upgrade.purchasableWhen && !evaluateCondition(upgrade.purchasableWhen, state);
				return {
					id: upgrade.id,
					name: upgrade.name,
					description: upgrade.description,
					level,
					maxLevel: max,
					cost,
					costCurrencyId: upgrade.cost.currencyId,
					affordable:
						!gated && cost !== null && (this.amounts[upgrade.cost.currencyId] ?? 0) >= cost && level < max,
					locked: gated,
					blockedBy: level >= max ? 'fully grown' : gated ? 'locked' : null,
					equipped: level > 0 ? (state.upgrades[upgrade.id]?.equipped ?? true) : undefined
				};
			});
	}

	/** Prestige layers the player can see, with what a reset would pay. */
	get prestigeLayers() {
		const def = this.def;
		if (!def || !this.#sim) return [];
		const state = this.#sim.state();

		return def.prestigeLayers
			.filter((layer) => this.#visible(layer.id))
			.map((layer) => {
				const available = !layer.availableWhen || evaluateCondition(layer.availableWhen, state);
				const gain = available ? prestigeGain(layer, state) : 0;
				return {
					id: layer.id,
					name: layer.name,
					currencyId: layer.currencyId,
					held: this.amounts[layer.currencyId] ?? 0,
					multiplier: 1 + layer.multiplier.perUnit * (this.amounts[layer.currencyId] ?? 0),
					count: this.prestigeCounts[layer.id] ?? 0,
					gain,
					ready: gain >= 1
				};
			});
	}

	/** Currencies worth showing: hidden ones and ones never yet earned stay out. */
	get visibleCurrencies() {
		const def = this.def;
		if (!def) return [];
		return def.currencies.filter(
			(currency) => this.#visible(currency.id) && ((this.lifetimes[currency.id] ?? 0) > 0 || this.#produced(currency.id))
		);
	}

	// ── saving ───────────────────────────────────────────────────────────

	save(): void {
		if (!this.#sim || !this.def) return;
		const save = captureSave(this.#sim);
		if (writeSave(this.def.meta.id, save)) this.savedAt = save.savedAt;
	}

	// ── internals ────────────────────────────────────────────────────────

	#visible(id: string): boolean {
		return !this.#gated.has(id) || this.unlocked.has(id);
	}

	/** Whether any visible generator pays into this currency. */
	#produced(currencyId: string): boolean {
		return (this.def?.generators ?? []).some(
			(generator) => generator.producesCurrencyId === currencyId && this.#visible(generator.id)
		);
	}

	#onFrame(now: number): void {
		if (!this.running || !this.#sim) return;

		// Clamped. A backgrounded tab hands back a delta of minutes, and paying
		// that out at once would look like a bug even though the arithmetic is
		// right — offline progress is a design decision, not an accident of rAF.
		const deltaSeconds = Math.min((now - this.#lastFrame) / 1000, 1);
		this.#lastFrame = now;

		this.step(deltaSeconds);

		if (now - this.#lastSave > AUTOSAVE_EVERY_MS) {
			this.#lastSave = now;
			this.save();
		}

		this.#frame = requestAnimationFrame((next) => this.#onFrame(next));
	}

	#record(events: SimEvent[]): void {
		if (!events.length) return;
		this.log = [...[...events].reverse(), ...this.log].slice(0, MAX_LOG);
	}

	#readout(): void {
		const sim = this.#sim;
		if (!sim) return;

		const state = sim.state();
		this.elapsed = state.gameTime;

		const amounts: Record<string, number> = {};
		const lifetimes: Record<string, number> = {};
		for (const [id, currency] of Object.entries(state.currencies)) {
			amounts[id] = currency.amount;
			lifetimes[id] = currency.lifetime;
		}
		this.amounts = amounts;
		this.lifetimes = lifetimes;
		this.rates = sim.rates();
		this.generatorRates = sim.generatorRates();
		this.prestigeMultiplier = sim.prestigeMultiplier();

		const levels: Record<string, number> = {};
		for (const [id, generator] of Object.entries(state.generators)) levels[id] = generator.level;
		this.generatorLevels = levels;

		const upgrades: Record<string, number> = {};
		for (const [id, upgrade] of Object.entries(state.upgrades)) upgrades[id] = upgrade.level;
		this.upgradeLevels = upgrades;
		this.unequippedUpgradeCount = countUnequippedUpgrades(state);

		const prestige: Record<string, number> = {};
		for (const [id, layer] of Object.entries(state.prestige)) prestige[id] = layer.count;
		this.prestigeCounts = prestige;

		const costs: Record<string, number | null> = {};
		for (const generator of sim.def.generators) costs[generator.id] = sim.nextCost(generator.id);
		for (const upgrade of sim.def.upgrades) costs[upgrade.id] = sim.nextCost(upgrade.id);
		this.nextCosts = costs;

		this.unlocked = new Set(state.unlocked);

		const reached = new Set<string>();
		for (const [id, at] of Object.entries(sim.milestoneTimeline)) if (at !== null) reached.add(id);
		this.reachedMilestones = reached;
	}
}

export const game = new Game();

/** `1:02:03` once a session gets long, `02:03` before that. */
export function formatDuration(seconds: number): string {
	const whole = Math.floor(seconds);
	const hours = Math.floor(whole / 3600);
	const minutes = Math.floor((whole % 3600) / 60);
	const secs = whole % 60;
	const pad = (value: number) => String(value).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}
