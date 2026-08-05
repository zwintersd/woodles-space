/**
 * `@woodles/incremental-core` — the schema, the validator, and the simulation
 * engine for Bloomforge.
 *
 * Zero runtime dependencies and no DOM: the editor, the balance runner (in a
 * Web Worker), and eventually the player all import this same module, and none
 * of them import each other.
 */

export * from './types.js';
export * from './state.js';
export * from './num.js';
export * from './rng.js';
export * from './curves.js';
export * from './conditions.js';
export * from './modifiers.js';
export * from './entities.js';
export * from './validate.js';
export * from './serialize.js';
export * from './savegame.js';
export * from './library.js';
export * from './engine.js';
export * from './policies.js';
export * from './graph.js';
export { cozyGarden, apiaryOfBadDecisions } from './fixtures/index.js';
