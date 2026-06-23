# woodles.space

a personal monorepo of small, hand-made web apps — typefaces and letters,
palettes and quiet timers — all living at [woodles.space](https://woodles.space).

everything is in [`woodles.space/`](./woodles.space/); this wrapper holds only
the repo-level orientation.

## source of truth

start with [`woodles.space/ARCHITECTURE.md`](./woodles.space/ARCHITECTURE.md).
it is the current source of truth for:

- repo layout and app inventory
- which apps are static vs SvelteKit
- shared design tokens and sync architecture
- current test/check/build expectations
- how to run the workspace locally

[`woodles.space/README.md`](./woodles.space/README.md) is the deployment
reference. [`woodles.space/REFACTORING.md`](./woodles.space/REFACTORING.md) is
the living consolidation log. app-level docs belong with their app.

[`AUDIT.md`](./AUDIT.md) is a dated audit snapshot, not live truth. use it for
historical context and re-check anything important against `ARCHITECTURE.md` and
the code.
