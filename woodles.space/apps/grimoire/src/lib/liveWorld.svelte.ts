// The proof of pipeline: drive a `World` on animation frames, in the
// browser, off nothing but `@woodles/witch-engine`. Deliberately bare —
// no chart, no policy, no editing. Its only job is showing that a tick
// actually moves numbers here the same way it does in apps/marginalia's
// own tests.

import { World, createWorldState, tuningFromDef, type MarginaliaDef } from '@woodles/witch-engine';

export class LiveWorld {
	world: World;
	running = $state(false);
	elapsed = $state(0);
	insight = $state(0);
	insightPerSec = $state(0);
	favor = $state(0);
	stocks = $state<Record<string, number>>({});

	#frame: number | null = null;
	#lastFrame = 0;
	/** `WorldState` doesn't track its own elapsed time — the caller does, same as sim.ts's tick counting. */
	#elapsedSeconds = 0;

	constructor(def: MarginaliaDef) {
		this.world = new World(def, createWorldState(def), 1, undefined, tuningFromDef(def));
		this.#readout();
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
		this.#readout();

		this.#frame = requestAnimationFrame((next) => this.#onFrame(next));
	}

	#readout(): void {
		this.elapsed = this.#elapsedSeconds;
		this.insight = this.world.state.insight;
		this.insightPerSec = this.world.insightPerSec;
		this.favor = this.world.state.favor;
		this.stocks = { ...this.world.state.stocks };
	}
}
