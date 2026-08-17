// `world1Def` — everything about World 1, in the `MarginaliaDef` shape
// `@woodles/witch-engine` defines. World 1's content and tuning now live
// in that package's `world1/` directory, bundled the same way the package
// bundles its own example fixtures; this file re-exports the assembled def
// so every existing call site in this app keeps working unchanged.
export { world1Def } from '@woodles/witch-engine';
