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
