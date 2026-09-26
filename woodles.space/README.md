# woodles.space

a pnpm workspace, deployed as one Vercel project. for how the code fits
together, read [ARCHITECTURE.md](./ARCHITECTURE.md). this file is the
deployment reference.

## docs map

the docs have one owner each:

| doc | owns |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | current repo layout, app inventory, shared systems, tests, checks, local workflow |
| this README | deployment and Vercel routing notes |
| [CHANGELOG.md](./CHANGELOG.md) | what shipped, session to session — the log a reader can follow without cloning the repo |
| [LORE.md](./LORE.md) | marginalia's story, curated for reading rather than building |
| [REFACTORING.md](./REFACTORING.md) | living list of duplicated code and consolidation candidates |
| [ABSTRACTION.md](./ABSTRACTION.md) | simulating marginalia fast enough to tune its feel — what's in the way, measured, and what to borrow from bloomforge |
| `apps/*/*.md` | app-specific design briefs, proposals, assets, and known issues |
| [`../AUDIT.md`](../AUDIT.md) | dated audit snapshot only; not the current source of truth |

`CHANGELOG.md`, `LORE.md`, and `ARCHITECTURE.md` are also hosted pages —
`/changelog`, `/lore`, and `/architecture` — rendered from the markdown
file itself at runtime by `shared/docPage.js`; see "how it ships" below.

when docs disagree, treat `ARCHITECTURE.md` and the code as current. update this
README only for deployment details.

## how it ships

the static apps go up as-is — one HTML file each, no build step. the
SvelteKit apps (`homesuite`, `write`, `marginalia`, `planner`, `bestiary`,
`thinking-about`, `whiteboard`, `bloomforge`, `bloomforge-player`,
`grimoire`) build to `apps/<name>/dist/`. `vercel.json` rewrites each
friendly path to the right file: `/write` → `/apps/write/dist/index.html`,
`/lab` → `/apps/lab/index.html`, `/digits` → `/apps/digits/index.html`, and so
on. `lab` is the homepage-facing shelf for stub experiments; the direct
experiment paths still exist for links and bookmarks.

`/changelog`, `/lore`, and `/architecture` are the same static-app shape,
minus even a hand-written body: each app (`apps/changelog`,
`apps/lore`, `apps/architecture`) is one `index.html` whose only job is to
`fetch()` its root markdown file (`CHANGELOG.md`, `LORE.md`,
`ARCHITECTURE.md`) and render it client-side with `shared/docPage.js`. no
build step, and no copy of the doc to keep in sync — the page reads the
same file a contributor reads in an editor.

`vercel.json`'s `buildCommand` is just `pnpm build`, the root `package.json`
script (`pnpm -r --if-present build`) — it used to be one `--filter <app>
build` per SvelteKit app, chained with `&&`, but that string hit Vercel's
256-character cap on `buildCommand` the moment an eighth app joined the
chain. `--if-present` is what makes the recursive form safe: the static
apps and `packages/sync` have no `build` script, so pnpm skips them rather
than failing, and Vercel just serves the static apps straight from their
directory.

## the settings that matter

three of these are non-obvious, and getting them wrong is the usual cause of a
deploy that 404s everything.

| setting          | value           | why                                                                       |
| ---------------- | --------------- | ------------------------------------------------------------------------- |
| Root Directory   | `woodles.space` | the repo nests one level deep; without this, Vercel never reads `vercel.json`. |
| Framework Preset | Other / None    | auto-detect sees SvelteKit and drops the static apps.                     |
| Output Directory | `.`             | `vercel.json` ships everything from the root; nothing to build up top.    |

`vercel.json` also declares `framework: null` and empty build/install overrides,
but those only take hold once Vercel finds the file — which needs the Root
Directory above.

## when a path 404s

work it in this order:

1. **the rewrite.** is the path in `vercel.json`? `/fonts`, `/palette`, and
   `/motifs` all rewrite to `hygge`; `/scaffold` rewrites to `/write`.
2. **`paths.base`.** in the app's `svelte.config.js`, does it match the sub-path
   the rewrite serves? a mismatch builds clean and breaks every asset link in
   production.
3. **the output dir.** does the app write to `dist/`? the rewrite points at
   `/apps/<name>/dist/`; the adapter has to agree.

`/schedules` is a private, static link tree outside the homepage catalogue.
Its dated pages have explicit rewrites too; add each new dated page to
`vercel.json` so its friendly URL resolves to the matching `index.html`.

## a note on the recursive scripts

`pnpm -r check` and `pnpm -r test` stop at the first app that fails, so a break
early in the run hides the apps after it. when something fails, run the one app
directly — `pnpm --filter <name> check` or `pnpm --filter <name> test` — to see
the rest. planner's test and check setup has a few sharp edges worth knowing
before you touch it; they're in
[apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).
