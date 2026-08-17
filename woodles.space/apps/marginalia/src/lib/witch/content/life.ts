// World 1's life roster now lives in @woodles/witch-engine, bundled the same
// way the package bundles its own example fixtures. Re-exported here so
// every existing call site in this app keeps working unchanged.
export { world1Life, domainVerb, lifeById, revealedLife } from '@woodles/witch-engine';
export type { Life, LifeCategory, LifeDomain } from '@woodles/witch-engine';
