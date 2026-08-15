// `World` itself now lives in @woodles/witch-engine, fully def-driven — see
// that package's world.ts for the tick, the primitive-shape wiring, and the
// reasoning behind `WorldTuning` staying separate from `MarginaliaDef`.
//
// This file is the seam: the package's `World` takes a `def: MarginaliaDef`
// as its first, required argument — an engine defaulting to one app's
// content wouldn't be much of an engine — so this app's own `World`
// subclasses it with `world1Def` baked in, and `createWorldState`/
// `defaultTuning` get the same treatment. Every existing call site in this
// app (`new World(state, seed, ...)`, `createWorldState()`,
// `import { defaultTuning }`) keeps working exactly as it did before the
// extraction.

import {
	World as EngineWorld,
	createWorldState as engineCreateWorldState,
	tuningFromDef,
	STAGE_NOTICED,
	STAGE_OBSERVED,
	STAGE_STUDIED,
	STAGE_KNOWN,
	stageLabel,
	type WorldEvent,
	type WorldState,
	type WorldTuning
} from '@woodles/witch-engine';
import { world1Def } from './def';

export { STAGE_NOTICED, STAGE_OBSERVED, STAGE_STUDIED, STAGE_KNOWN, stageLabel };
export type { WorldEvent, WorldState, WorldTuning };

export function createWorldState(): WorldState {
	return engineCreateWorldState(world1Def);
}

export const defaultTuning: WorldTuning = tuningFromDef(world1Def);

export class World extends EngineWorld {
	constructor(
		state: WorldState = createWorldState(),
		seed = 1,
		resumeRngFrom?: number,
		tuning: WorldTuning = defaultTuning
	) {
		super(world1Def, state, seed, resumeRngFrom, tuning);
	}
}

/** A copy of World 1's tuning with some values overridden, for a sweep. */
export function tunedWorld1(overrides: Partial<WorldTuning> = {}): WorldTuning {
	return EngineWorld.tuned(world1Def, overrides);
}
