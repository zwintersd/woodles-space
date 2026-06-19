# woodles.space

a pnpm workspace, deployed as one Vercel project. for how the code fits
together, read [ARCHITECTURE.md](./ARCHITECTURE.md). this file is the
deployment reference.

## how it ships

the static apps go up as-is — one HTML file each, no build step. the six
SvelteKit apps (`write`, `marginalia`, `planner`, `bestiary`, `spores`,
`marginalia-devlog`) build to `apps/<name>/dist/`. `vercel.json` rewrites each
friendly path to the right file: `/write` → `/apps/write/dist/index.html`,
`/digits` → `/apps/digits/index.html`, and so on.

the build command is one filter per SvelteKit app, chained:

```
pnpm --filter write build && pnpm --filter marginalia build && …
```

the static apps aren't in it. they have nothing to build, so Vercel just
serves them from the directory.

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

## a note on the recursive scripts

`pnpm -r check` and `pnpm -r test` stop at the first app that fails, so a break
early in the run hides the apps after it. when something fails, run the one app
directly — `pnpm --filter <name> check` — to see the rest. planner's test and
check setup has a few sharp edges worth knowing before you touch it; they're in
[apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).
