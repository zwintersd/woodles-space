// The balance harness now lives in @woodles/witch-engine, fully def-driven —
// see that package's sim.ts for the policies, the run loop, and the reasoning
// behind the Witness/Interventionist/Patient bracket. This file is the same
// seam world.ts is: `createWorld`/`simulate`/`compare`/`allLifeIds` all take
// a `def` as their first argument there, so this app's own versions bake in
// `world1Def` and keep every existing call site (`createWorld(opts)`,
// `simulate(policy, opts)`, ...) working unchanged.

import {
	createWorld as engineCreateWorld,
	simulate as engineSimulate,
	compare as engineCompare,
	allLifeIds as engineAllLifeIds,
	witnessOnly,
	interventionist,
	patient,
	doNothing,
	conceptsFor,
	TICK_MS,
	TICKS_PER_SECOND,
	type World,
	type WorldPolicy,
	type PolicyContext,
	type PolicyAction,
	type WitnessOptions,
	type SimOptions,
	type SeriesSample,
	type SimSummary,
	type SimResult,
	type TimedEvent
} from '@woodles/witch-engine';
import { world1Def } from './def';

export {
	witnessOnly,
	interventionist,
	patient,
	doNothing,
	conceptsFor,
	TICK_MS,
	TICKS_PER_SECOND
};
export type { WorldPolicy, PolicyContext, PolicyAction, WitnessOptions, SimOptions, SeriesSample, SimSummary, SimResult, TimedEvent };

export function createWorld(opts: SimOptions = { duration: 0 }): World {
	return engineCreateWorld(world1Def, opts);
}

export function simulate(policy: WorldPolicy, opts: SimOptions): SimResult {
	return engineSimulate(world1Def, policy, opts);
}

export function compare(policies: WorldPolicy[], opts: SimOptions): SimResult[] {
	return engineCompare(world1Def, policies, opts);
}

/** Every life World 1 contains, for tests and readouts. */
export const allLifeIds: string[] = engineAllLifeIds(world1Def);
