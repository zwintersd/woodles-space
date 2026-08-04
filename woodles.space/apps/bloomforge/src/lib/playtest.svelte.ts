import {
	createSim,
	greedyPolicy,
	hasErrors,
	idlePolicy,
	validateGameDef,
	type GameDef,
	type SimEvent,
	type Simulation
} from '@woodles/incremental-core';

/**
 * The live playtest. Drives `createSim` on animation frames — the same object a
 * balance run drives to completion, so what you watch and what the Balance tab
 * reports can't disagree.
 *
 * Playtest state is throwaway and never touches the def. Watching a run must
 * not edit the game.
 */

export type PolicyName = 'idle' | 'greedy';

/**
 * Real time is the wrong default. The point of the tool is feeling a curve,
 * and a curve that takes an afternoon can't be felt.
 */
export const SPEEDS = [1, 10, 100] as const;
const MAX_LOG = 300;
const MAX_POINTS = 600;

export interface ChartPoint {
	t: number;
	value: number;
}

export class Playtest {
	running = $state(false);
	speed = $state<number>(10);
	policyName = $state<PolicyName>('greedy');
	seed = $state(1);

	elapsed = $state(0);
	amounts = $state<Record<string, number>>({});
	lifetimes = $state<Record<string, number>>({});
	rates = $state<Record<string, number>>({});
	generatorLevels = $state<Record<string, number>>({});
	generatorRates = $state<Record<string, number>>({});
	upgradeLevels = $state<Record<string, number>>({});
	nextCosts = $state<Record<string, number | null>>({});
	unlocked = $state<Set<string>>(new Set());
	prestigeCounts = $state<Record<string, number>>({});
	prestigeMultiplier = $state(1);

	log = $state<SimEvent[]>([]);
	/** Sampled history of the currency the chart is showing. */
	history = $state<ChartPoint[]>([]);
	chartCurrencyId = $state<string | null>(null);
	/** Why the run can't start, when it can't. */
	blocked = $state<string | null>(null);

	#sim: Simulation | null = null;
	#frame: number | null = null;
	#lastFrame = 0;
	#sampleAt = 0;

	get active(): boolean {
		return this.#sim !== null;
	}

	/**
	 * Whether the canvas should show live numbers. A simulation exists from the
	 * moment a project opens — that's what fills the readout and the chart's
	 * currency picker — but a run that hasn't advanced has nothing to say, and
	 * flipping every node to a row of zeroes would be worse than showing the
	 * design-time values.
	 */
	get showLive(): boolean {
		return this.running || this.elapsed > 0;
	}

	/** Rebuilds the run from scratch against the current def. */
	reset(def: GameDef): void {
		this.stop();

		const issues = validateGameDef(def);
		if (hasErrors(issues)) {
			this.#sim = null;
			this.blocked = issues.find((issue) => issue.severity === 'error')?.message ?? 'this game has errors';
			this.#clearReadout();
			return;
		}

		this.blocked = null;
		// Snapshotted, so edits made while a run is going don't quietly change
		// the rules underneath it — restarting is how you pick up an edit. It
		// goes through `$state.snapshot` first because the def handed in is a
		// rune proxy, and `structuredClone` refuses to clone one.
		this.#sim = createSim(structuredClone($state.snapshot(def)) as GameDef, this.#policy(), this.seed);
		this.chartCurrencyId ??= def.currencies[0]?.id ?? null;
		if (!def.currencies.some((currency) => currency.id === this.chartCurrencyId)) {
			this.chartCurrencyId = def.currencies[0]?.id ?? null;
		}
		this.log = [];
		this.history = [];
		this.#sampleAt = 0;
		this.#readout();
	}

	start(def: GameDef): void {
		if (!this.#sim) this.reset(def);
		if (!this.#sim) return;
		if (this.running) return;

		this.running = true;
		this.#lastFrame = performance.now();
		this.#frame = requestAnimationFrame((now) => this.#onFrame(now));
	}

	pause(): void {
		this.running = false;
		if (this.#frame !== null) cancelAnimationFrame(this.#frame);
		this.#frame = null;
	}

	stop(): void {
		this.pause();
		this.elapsed = 0;
	}

	toggle(def: GameDef): void {
		if (this.running) this.pause();
		else this.start(def);
	}

	setPolicy(name: PolicyName, def: GameDef): void {
		this.policyName = name;
		// A policy is baked into the run at construction, so changing it means a
		// new run — quietly continuing under the old one would be a lie.
		this.reset(def);
	}

	setSeed(seed: number, def: GameDef): void {
		this.seed = seed;
		this.reset(def);
	}

	#policy() {
		return this.policyName === 'idle' ? idlePolicy : greedyPolicy();
	}

	#onFrame(now: number): void {
		if (!this.running || !this.#sim) return;

		// Clamped: a backgrounded tab hands back a delta of many seconds, and
		// 100× of that is a multi-minute freeze while the loop catches up.
		const deltaSeconds = Math.min((now - this.#lastFrame) / 1000, 0.25);
		this.#lastFrame = now;

		const events = this.#sim.step(deltaSeconds * this.speed);
		if (events.length) this.log = [...events.reverse(), ...this.log].slice(0, MAX_LOG);
		this.#readout();

		this.#frame = requestAnimationFrame((next) => this.#onFrame(next));
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

		const prestige: Record<string, number> = {};
		for (const [id, layer] of Object.entries(state.prestige)) prestige[id] = layer.count;
		this.prestigeCounts = prestige;

		const costs: Record<string, number | null> = {};
		for (const generator of sim.def.generators) costs[generator.id] = sim.nextCost(generator.id);
		for (const upgrade of sim.def.upgrades) costs[upgrade.id] = sim.nextCost(upgrade.id);
		this.nextCosts = costs;

		this.unlocked = new Set(state.unlocked);

		this.#sample(state.gameTime);
	}

	/**
	 * Samples on a stride that widens as the run gets long, so the chart keeps a
	 * fixed point budget instead of growing without bound over a 100× run.
	 */
	#sample(t: number): void {
		if (!this.chartCurrencyId) return;
		if (t < this.#sampleAt) return;

		const value = this.amounts[this.chartCurrencyId] ?? 0;
		const next = [...this.history, { t, value }];
		if (next.length > MAX_POINTS) {
			// Halve the resolution rather than dropping the beginning: the shape
			// of the early game is the thing you are usually looking at.
			this.history = next.filter((_, index) => index % 2 === 0);
			this.#stride *= 2;
		} else {
			this.history = next;
		}
		this.#sampleAt = t + this.#stride;
	}

	#stride = 1;

	#clearReadout(): void {
		this.elapsed = 0;
		this.amounts = {};
		this.lifetimes = {};
		this.rates = {};
		this.generatorLevels = {};
		this.generatorRates = {};
		this.upgradeLevels = {};
		this.nextCosts = {};
		this.unlocked = new Set();
		this.prestigeCounts = {};
		this.prestigeMultiplier = 1;
		this.log = [];
		this.history = [];
		this.#stride = 1;
	}
}

export const playtest = new Playtest();

/** `mm:ss` for the elapsed readout, `h:mm:ss` once a run gets long. */
export function formatDuration(seconds: number): string {
	const whole = Math.floor(seconds);
	const hours = Math.floor(whole / 3600);
	const minutes = Math.floor((whole % 3600) / 60);
	const secs = whole % 60;
	const pad = (value: number) => String(value).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}
