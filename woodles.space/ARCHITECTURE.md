# architecture

how the woodles.space workspace fits together, for someone working in it.

one repo, all the things, kept close. apps reach across `apps/` for each
other's code when they need to, and the shared design system sits at the same
depth so nothing is "above" anything else.

## source of truth

this file is the current source of truth for the workspace. keep it in sync when
the app inventory, shared systems, deployment shape, test/check/build behavior,
or local workflow changes.

other docs have narrower jobs:

- [README.md](./README.md) is the deployment reference.
- [REFACTORING.md](./REFACTORING.md) is the living consolidation log.
- `apps/*/*.md` files own app-specific design briefs, proposals, assets, and
  known issues.
- [`../AUDIT.md`](../AUDIT.md) is a dated audit snapshot, not live truth.

## repo layout

```
woodles.space/
├── package.json            workspace root — test / check / build fan out
├── pnpm-workspace.yaml      apps/* and packages/*
├── vercel.json              rewrites every app to its path
├── tsconfig.json            covers api/
├── .env.example             DATABASE_URL, SYNC_PASS_HASH
├── ARCHITECTURE.md          you are here
├── README.md                deployment reference
├── REFACTORING.md           consolidation log
├── shared/                  cross-app design system + data registry
│   ├── palette.css          9 named themes, switched via [data-theme]
│   ├── fonts.css            --font-* custom properties
│   ├── motifs.css           ambient backdrops (class="motif-<id>")
│   └── library.js           palettes / motifs / fontPairs / templates — untyped
├── api/
│   ├── sync.ts              Neon edge function — single-user sync
│   └── schema.sql
├── packages/
│   └── sync/                @woodles/sync — the sync client
└── apps/
    ├── landing/             static · the homepage
    ├── lab/                 static · future shelf for stub experiments
    ├── hygge/               static · design playground (fonts, palette, motifs)
    ├── digits/              static · an SVG pen that writes the time
    ├── quiet-room/          React/Vite · an immersive three.js room of light
    ├── letter/              static · echoes — the published-letter reader
    ├── animations/          Python · Manim playspace, outside the workspace
    ├── write/               SvelteKit · the letter editor
    ├── marginalia/          SvelteKit · a witch writes worlds + a reading room
    ├── planner/             SvelteKit · carillon — calendar, schedule, and time
    ├── notebook/            SvelteKit · notes, tasks, and ideas kept close
    ├── bestiary/            SvelteKit · the witch's field guide, as playing cards
    ├── spores/              SvelteKit · a garden of spores, gathered into spellbooks
    └── marginalia-devlog/   SvelteKit · a devlog built from typed blocks
```

`animations/` is a Python/Manim playspace. it has no `package.json` and isn't a
member of the pnpm workspace; `vercel.json` serves its `index.html` directly.

## the app shapes

**static apps** are one HTML file plus inline CSS and a little module JS. no
build step. `vercel.json` serves them as-is and rewrites the friendly path
(`/digits`) to the file (`/apps/digits/index.html`). they consume `shared/` at
runtime — `<link href="/shared/palette.css">` and `import … from
"/shared/library.js"`.

**Quiet Room** (`quiet-room`) is React 19 on Vite 7. it keeps the immersive
three.js engine local to the app, uses `@paper-design/shaders-react` for the
Paper Shaders wash, and builds to `apps/quiet-room/dist/` with
`base: "/quiet-room/"`. it still consumes `/shared/fonts.css` and
`/shared/palette.css`; its Vite config serves those shared root assets during
local dev and preview.

**SvelteKit apps** — `write`, `marginalia`, `planner`, `notebook`, `bestiary`,
`spores`, `marginalia-devlog` — use Svelte 5 runes, Vite 7, and `@sveltejs/adapter-static`.
each builds to `apps/<name>/dist/` and consumes `shared/` through the `@shared`
Vite alias (`../../shared`). there is no SSR; every app ships as a static bundle.

`hygge` is the design playground — it holds the fonts, palette, and motifs
showcases that used to be separate pages. `/fonts`, `/palette`, and `/motifs` all
rewrite to it; `/scaffold` rewrites to `/write`. `lab` is the home for stub
experiments that should stay reachable without appearing as separate homepage
apps; it links out to `/digits` and `/animations`, whose direct routes still
work for old bookmarks.

## the sync layer

a single-user sync spine that a few apps opt into. localStorage stays the source
of truth on each device; sync mirrors it to a server so the same data follows you
between machines.

**`api/sync.ts`** — a Vercel edge function over a Neon Postgres table. `GET
/api/sync?app=<name>` returns `{ blob, version }`; `POST` with `{ app, blob,
baseVersion }` is a compare-and-swap — it writes only if the version still
matches what you read, and answers `409 { conflict, server }` when the server
moved first. auth is one passphrase, sent as `Authorization: Bearer …`. the
server never stores it — only its SHA-256, compared in constant time against the
`SYNC_PASS_HASH` env var. `DATABASE_URL` comes from the Neon integration.

**`packages/sync` (`@woodles/sync`)** — the client half. `pull(app)` and
`push(app, blob, baseVersion)` wrap the endpoint; `createSyncedStore(adapter)`
owns the version bookkeeping and the "ask before clobber" decision — its
`onConflict` returns `mine`, `theirs`, or `cancel`. the passphrase lives in
memory for the session; the last-seen version is cached in localStorage.

**`apps/*/src/lib/sync.svelte.ts`** — the per-app glue. each file is ~30 lines:
a `SyncState` class with `$state` fields, its instantiation, and a call to
`createAppSync` (from `@woodles/sync`) that wires up the app-specific adapter.
the adapter's `read()` maps the store into the blob type (`PlannerBlob`,
`BestiaryBlob`, `GardenBlob`, `DevlogBlob`); `write()` calls the store's
`rehydrate()`; `isNewer` is optionally provided (`bestiary`, `marginalia-devlog`
use it). `write` and `marginalia` don't sync at all.

## shared design tokens

the design system is shared at the lowest level only, and not by every app.

**`shared/palette.css`** defines nine themes — `cream`, `dawn`, `dusk`,
`midnight`, `forest`, `terracotta`, `inkwell`, `typewriter`, `paper` — as CSS
custom properties, switched by setting `data-theme="<id>"`. role tokens
(`--bg`, `--text`, `--accent`, `--rule`, …) carry the same meaning through every
theme, and concrete color names (`--lavender`, `--aqua`, `--peach`, `--lilac`,
`--plum`, `--lapis`, `--cream`) stay stable across them. `write` and the static
apps consume this.

the other five SvelteKit apps don't. each ships its own root-scoped token file
under `src/lib/style/tokens.css`, namespaced so it never leaks: `marginalia`
redefines the bare names under `.marginalia-root`, `planner` uses `--p-*`,
`spores` uses `--g-*`, `bestiary` uses `--b-*`, `marginalia-devlog` has its own
under `.devlog-root`. `data-theme` and the nine shared themes don't reach them;
they own their own look.

**`shared/fonts.css`** is the `--font-*` variable layer — `--font-display`,
`--font-body`, `--font-mono`, and named alternates. the `@font-face` sources are
Google Fonts, loaded per app. most apps pull this in even when they don't use the
palette.

**`shared/library.js`** is the named-things registry: `palettes`, `motifs`,
`fontPairs`, `templates`, and `find*` helpers. `write` and the static apps
(`hygge`, `letter`) read it for picker data and `?template=` loading. it is plain
JS with no types — a SvelteKit app importing from `@shared/library.js` gets
inferred structural types only, no real type safety. a `library.d.ts` sidecar
would fix that without breaking the static apps, which import the `.js` straight
in the browser.

**motifs** apply via `class="motif-<id>"` on the surface element, with the
blob/grain scaffold divs underneath — not a `data-motif` attribute. the five
motifs are `blobs`, `aurora`, `mist`, `paper`, `clean`.

## cross-app duplication

the habit: duplicate until two apps have built the same thing and converged on
its shape, then extract the shared version. premature sharing freezes an API
before the copies have stopped moving. some of these have settled; some are still
in motion. the full log is in [REFACTORING.md](./REFACTORING.md); the shape of it:

- **`sync.svelte.ts`** — consolidated. `createAppSync` in `@woodles/sync` now
  owns the passphrase lifecycle, connect/disconnect, and status tracking. each
  app's file is ~30 lines of adapter wiring. see [REFACTORING.md](./REFACTORING.md).
- **text / HTML utilities** — `sanitize`, `isEmptyHtml`, `stripTags`,
  `countWords`, `previewText`, and anchor stamping. they live in
  `write/src/lib/htmlTools.ts`, are mirrored in `marginalia/src/lib/reading/text.ts`,
  and are reimplemented inline in `letter/index.html` as a third copy. the
  contract has converged across all three; `write`'s and `marginalia`'s copies
  are tested, `letter`'s inline one isn't.
- **`EditorToolbar.svelte`** — `write` (89 lines) and `marginalia` (113).
  diverged, still moving.
- **`MarginNotes.svelte`** — `write` (204 lines) and `marginalia` (193).
  diverged, anchored to each app's own editor DOM.
- **`SelectionPopover.svelte` (write, 58 lines) / `SelectionBubble.svelte`
  (marginalia, 105)** — same idea, renamed, diverged.

the five per-app `tokens.css` files play the same role but are deliberately
different palettes, so they aren't a consolidation target.

## the test suite

620 tests across five apps — `write` 52, `marginalia` 114, `planner` 283,
`spores` 46, `bestiary` 125. `marginalia-devlog` has no test script.

each app's `test` runs `svelte-kit sync && vitest run`. the `sync` matters: a
SvelteKit app's `tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which
`svelte-kit sync` generates — run `vitest` without it on a fresh clone and it
can't resolve the tsconfig. because the scripts sync first, `pnpm test` works
straight from a clean checkout.

`write` and `marginalia` load the workspace-level `vitest.setup.ts` to install a
browser-like in-memory `localStorage` under Node. planner keeps its own
localStorage mock in `store.test.ts`; under the current Node runtime that suite
passes but may still print a `--localstorage-file` warning.

`planner`'s `vitest.config.ts` loads the SvelteKit plugin, and it has to:
`planner`'s store is a `.svelte.ts` module that uses `$state`, instantiated at
import time, and without the plugin compiling it vitest throws `$state is not
defined`. the apps that test rune modules either inherit the plugin from
`vite.config.ts` or don't construct a rune store at import. planner's sharp edges
are written up in [apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).

## svelte-check

| app                 | status                                  |
| ------------------- | --------------------------------------- |
| `write`             | clean                                   |
| `marginalia`        | clean                                   |
| `planner`           | clean                                   |
| `bestiary`          | clean                                   |
| `spores`            | 4 warnings — `autofocus` a11y           |
| `marginalia-devlog` | 1 warning — `line-clamp` in `EntryList` |

`pnpm -r check` runs all seven in turn and reaches every one. it stops at the
first app that fails, though, so if you break an early one, run the app you care
about directly to see past it.

## running things locally

from `woodles.space/`:

```
pnpm install            one install for the whole workspace
pnpm test               vitest in every SvelteKit app with a test script (620 tests)
pnpm check              svelte-check in every app
pnpm build              build the seven SvelteKit apps plus Quiet Room
```

both `test` and `check` generate `.svelte-kit/` themselves on a fresh clone, so
order doesn't matter. to work on one app — and to step around the
stop-on-first-failure of the recursive scripts — filter to it:

```
pnpm --filter planner test
pnpm --filter planner check
pnpm --filter planner dev
```

static apps need serving (not opened as `file://`) for the `/shared/*` imports to
resolve:

```
python3 -m http.server 8000     then visit /apps/<name>/index.html
```

Quiet Room has its own Vite dev server:

```
pnpm --filter quiet-room dev
```
