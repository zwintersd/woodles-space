// World 1's emergences now live in @woodles/witch-engine, bundled the same
// way the package bundles its own example fixtures. Re-exported here so
// every existing call site in this app keeps working unchanged.
export { emergences, revealedEmergences } from '@woodles/witch-engine';
export type { Emergence } from '@woodles/witch-engine';
