// World 1's conditions now live in @woodles/witch-engine, bundled the same
// way the package bundles its own example fixtures. Re-exported here so
// every existing call site in this app keeps working unchanged.
export { conditions, conditionById } from '@woodles/witch-engine';
export type { Condition } from '@woodles/witch-engine';
