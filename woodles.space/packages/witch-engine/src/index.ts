// A living-system engine: `MarginaliaDef` describes a world (content plus
// tuning, in @woodles/dynamics primitive terms), `World` simulates one. An
// app supplies its own def — see apps/marginalia/src/lib/witch/def.ts for
// World 1's — and gets an identical simulation whether it's driven one
// animation frame at a time or ten hours in a balance harness.

export * from './types.js';
export * from './def.js';
export * from './vitals.js';
export * from './text.js';
export * from './world.js';
export * from './sim.js';

export * from './world1/life.js';
export * from './world1/conditions.js';
export * from './world1/interventions.js';
export * from './world1/emergences.js';
export * from './world1/fieldNotes.js';
export * from './world1/tuning.js';
export * from './world1/def.js';
