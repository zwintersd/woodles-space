// Drives a `World` on animation frames, in the browser, off nothing but
// `@woodles/witch-engine` — the same tick an app or the balance harness
// runs. This is the tuning instrument's Playtest dock: a world with every
// condition already written (mirroring sim.ts's own `createWorld` default),
// played by `witnessOnly` — the thesis's ideal player, and the same baseline
// BALANCE.md's own numbers are read against — so life actually advances
// instead of sitting at Noticed forever. `World.tick` only ever *moves* what
// is attended; deciding what to attend is a policy's job, not the engine's.

import {
	World,
	createWorldState,
	tuningFromDef,
	witnessOnly,
	applyPolicyAction,
	type MarginaliaDef,
	type WorldPolicy,
	type Worldspace
} from '@woodles/witch-engine';

/** Essence enough to write every World 1 condition up front; matches sim.ts's own headroom for the same reason. */
const STARTING_ESSENCE = 10_000;

function openWorld(def: MarginaliaDef, worldspace: Worldspace): World {
	const state = createWorldState(def);
	state.essence = STARTING_ESSENCE;
	state.activeWorldspace = worldspace;
	const world = new World(def, state, 1, undefined, tuningFromDef(def));
	for (const c of def.conditions) world.writeCondition(c.id);
	return world;
}

export class LiveWorld {
	world: World;
	running = $state(false);
	elapsed = $state(0);
	insight = $state(0);
	insightPerSec = $state(0);
	favor = $state(0);
	stocks = $state<Record<string, number>>({});
	/** Life visible from where the world stands — the worldspace's whole effect, in one number. */
	visibleLife = $state(0);
	knownLife = $state(0);

	#frame: number | null = null;
	#lastFrame = 0;
	/** `WorldState` doesn't track its own elapsed time — the caller does, same as sim.ts's tick counting. */
	#elapsedSeconds = 0;
	#policy: WorldPolicy = witnessOnly();

	constructor(def: MarginaliaDef, worldspace: Worldspace) {
		this.world = openWorld(def, worldspace);
		this.#readout();
	}

	/**
	 * Rebuild against new numbers or a new worldspace — a fresh world, not a
	 * re-tuned old one, so nothing carries over that shouldn't. Changing a
	 * stage length under a world that has already banked study-seconds against
	 * the old one would report a state no real playthrough could reach.
	 */
	rebuild(def: MarginaliaDef, worldspace: Worldspace): void {
		const wasRunning = this.running;
		this.pause();
		this.world = openWorld(def, worldspace);
		this.#elapsedSeconds = 0;
		this.#readout();
		if (wasRunning) this.start();
	}

	start(): void {
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

	#onFrame(now: number): void {
		if (!this.running) return;
		// Clamped: a backgrounded tab hands back a delta of many seconds.
		const deltaSeconds = Math.min((now - this.#lastFrame) / 1000, 0.25);
		this.#lastFrame = now;

		const step = deltaSeconds * 10; // 10x, same default apps/bloomforge's playtest uses
		this.world.tick(step);
		this.#elapsedSeconds += step;
		for (const action of this.#policy.decide({ t: this.#elapsedSeconds, world: this.world })) {
			applyPolicyAction(this.world, action, this.#elapsedSeconds);
		}
		this.#readout();

		this.#frame = requestAnimationFrame((next) => this.#onFrame(next));
	}

	#readout(): void {
		this.elapsed = this.#elapsedSeconds;
		this.insight = this.world.state.insight;
		this.insightPerSec = this.world.insightPerSec;
		this.favor = this.world.state.favor;
		this.stocks = { ...this.world.state.stocks };
		this.visibleLife = this.world.life.length;
		this.knownLife = this.world.knownCount;
	}
}
