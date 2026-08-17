// World 1's interventions now live in @woodles/witch-engine, bundled the
// same way the package bundles its own example fixtures. Re-exported here
// so every existing call site in this app keeps working unchanged.
export { interventions, interventionForDomain } from '@woodles/witch-engine';
export type { Intervention } from '@woodles/witch-engine';
