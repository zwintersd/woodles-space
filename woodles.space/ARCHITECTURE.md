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
- [ROADMAP.md](./ROADMAP.md) is the 10-week plan for making marginalia and
  the bestiary public-facing — all ten weeks are marked `✅ shipped` in its
  own headers, week 4 (share links, save-as-image, adopt-a-card) having
  arrived via a separate effort that merged into this branch mid-week-10;
  per-card OG unfurl images stayed the one documented stretch goal.
- [`../AUDIT.md`](../AUDIT.md) is a dated audit snapshot, not live truth.
- `apps/*/*.md` files own app-specific design briefs, proposals, assets, and
  known issues — not every app has one. doc inventory, as of week 10:
  - `apps/marginalia/`: `DESIGN.md` (mechanics, the week-6 save-discipline
    policy, and a week-10 note on what it publishes vs. only reads),
    `PROPOSAL.md`, `ASSETS.md`, `static/diorama/README.md` (the world-canvas
    art's filenames and its graceful-degradation contract), and four docs
    under `src/lib/arcade/` — `ARCADE_ROADMAP.md` (the cabinet's own polish
    log, a separate week-numbering from this file's ROADMAP.md, don't
    conflate the two), `ARCADE_IMPLEMENTATION_PLAN.md` (the roadmap staged
    into a build sequence), `ARCADE_REUSE.md` (what's shared across games
    vs. kept deliberately local), and `ARCADE_REVIEW.md` (an older
    resource-sharing review, now stale on the game inventory per
    `ARCADE_ROADMAP.md`'s own note about it).
  - `apps/planner/`: `KNOWN_ISSUES.md` (the vitest/rune-store sharp edges
    under "the test suite" below).
  - `apps/write`, `apps/letter`, `apps/bestiary`: no doc file of their own
    — their publish/passphrase behavior is documented once, centrally, in
    "the public read path" below, rather than duplicated three times.

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
│   ├── palette.css          11 named themes, switched via [data-theme]
│   ├── fonts.css            --font-* custom properties
│   ├── motifs.css           ambient backdrops (class="motif-<id>")
│   └── library.js           palettes / motifs / fontPairs / templates — untyped
├── api/
│   ├── sync.ts              Neon edge function — single-user sync
│   └── schema.sql
├── packages/
│   ├── app-manifest/        @woodles/app-manifest — canonical app and route inventory
│   ├── persistence/         @woodles/persistence — versioned local storage mechanics
│   └── sync/                @woodles/sync — the sync client
└── apps/
    ├── landing/             static · the homepage
    ├── lab/                 static · future shelf for stub experiments
    ├── hygge/               static · design playground (fonts, palette, motifs)
    ├── digits/              static · an SVG pen that writes the time
    ├── quiet-room/          static · an immersive three.js room of light
    ├── ologypedia/          static · a block system for textbook-style pages, the pages it renders, and a personal editable Textbook that stitches entries together
    ├── letter/              static · echoes — the published-letter reader
    ├── animations/          Python · Manim playspace, outside the workspace
    ├── write/               SvelteKit · the letter editor
    ├── marginalia/          SvelteKit · a witch writes worlds + a reading room
    ├── planner/             SvelteKit · carillon — calendar, schedule, and time
    ├── notebook/            SvelteKit · notes, tasks, and ideas kept close
    ├── bestiary/            SvelteKit · the witch's field guide, as playing cards
    ├── spores/              SvelteKit · a garden of spores, gathered into spellbooks
    ├── marginalia-devlog/   SvelteKit · a devlog built from typed blocks
    └── thinking-about/      SvelteKit · a board for what's being read, played, and watched
```

`animations/` is a Python/Manim playspace. it has no `package.json` and isn't a
member of the pnpm workspace; `vercel.json` serves its `index.html` directly.

## the app manifest

`packages/app-manifest/src/index.js` is the canonical deployable-app inventory.
It owns the 17 app ids, names, public paths and aliases, app shape, source and
output locations, maturity, and landing visibility. It also owns the landing
tile order/copy, default pins, featured fallback, and Marginalia's Reading Room
sub-surface. The static landing page imports that browser-ready module directly;
its hand-drawn `ICONS` stay local because they are artwork, not deployment
metadata.

Vercel rewrites and each SvelteKit `paths.base` remain explicit in their native
configuration files, including Marginalia's special asset routes. The manifest
suite verifies that every primary route, alias, package name, output directory,
static entrypoint, and Svelte base agrees with the canonical record. It also
fails when a directory appears under `apps/` without a manifest entry. The
maintenance workflow is in
[`packages/app-manifest/README.md`](./packages/app-manifest/README.md).

## the two app shapes

**static apps** are one HTML file plus inline CSS and a little module JS. no
build step. `vercel.json` serves them as-is and rewrites the friendly path
(`/digits`) to the file (`/apps/digits/index.html`). they consume `shared/` at
runtime — `<link href="/shared/palette.css">` and `import … from
"/shared/library.js"`. `quiet-room` goes one step further: it pulls `three`
and its bloom post-processing addons from a CDN through a `<script
type="importmap">`, still with no build step.

**SvelteKit apps** — `write`, `marginalia`, `planner`, `notebook`, `bestiary`,
`spores`, `marginalia-devlog`, `thinking-about` — use Svelte 5 runes, Vite 7, and `@sveltejs/adapter-static`.
each builds to `apps/<name>/dist/` and consumes `shared/` through the `@shared`
Vite alias (`../../shared`). there is no SSR; every app ships as a static bundle.

`hygge` is the design playground — it holds the fonts, palette, and motifs
showcases that used to be separate pages. `/fonts`, `/palette`, and `/motifs` all
rewrite to it; `/scaffold` rewrites to `/write`. `lab` is the home for stub
experiments that should stay reachable without appearing as separate homepage
apps; it links out to `/digits` and `/animations`, whose direct routes still
work for old bookmarks.

`ologypedia` is a block system for textbook-style pages, not a single page —
four static HTML files (`index.html`, `textbook-chrome-blocks.html`,
`textbook-example-blocks.html`, one worked page per topic, starting with
`textbook-photosynthesis.html`) that each carry their own copy of the same
CSS tokens (`--paper`, `--ink`, `--rose-deep`, …) and block classes
(`.masthead`, `.figure-box`, `.ex-mechanism`, …) inline, by design — the whole
point is that the source of any one file is a complete, copy-paste-able spec
another model can read and replicate exactly, so nothing here is factored out
to a shared stylesheet the way `shared/fonts.css` is. It does pull
`shared/fonts.css` for the Cormorant Garamond / Lora pairing, but skips
`shared/palette.css` entirely — its cream/rose/gold palette is its own, same
pattern as the SvelteKit apps that own their own look, just on a static app
instead.

publishing an entry no longer means hand-pasting card markup into
`index.html`: `apps/ologypedia/scripts/publish.mjs <shelf-export.json>`
(the JSON from `add-page.html`'s "Export shelf as JSON") writes each
entry's `textbook-{slug}.html` and inserts or, for a slug already on the
shelf, in-place-replaces its card in `index.html`'s deck. Re-running it is
safe — a card is matched by `data-slug`, never duplicated. `--dry-run`
previews the change without writing. It's a plain Node script, no
dependencies, run directly (`node apps/ologypedia/scripts/publish.mjs …`)
rather than through pnpm, since the app itself has no `package.json` and
isn't a pnpm workspace member.

`add-page.html`'s validity checks also cross-reference the live deck now:
alongside the original three (complete document, loads the shared fonts,
uses a block class), it fetches `index.html` once on load to warn — next
to the Topic field, not blocking — when the slug you're about to
download or shelve is already published, plus three more pass/fail
checks on the pasted HTML (no leftover `{SLUG}`/`[TOPIC]` template text,
doesn't accidentally load `shared/palette.css`, no embedded `<script>`).

`index.html`'s deck also carries a search box, a subject filter, and a
Grid/Spine view toggle (the latter persisted per-browser under
`ologypedia-view`) — covering both shelved cards and the drafts injected
from `localStorage`, so the deck stays scannable as it grows past a
handful of entries.

`textbook.html` is the other half of the app, and the one that makes the
"a textbook, grown one entry at a time" tagline literal: a personal,
editable, interconnected reading room. Where `index.html` shows finished
covers and `add-page.html` runs the prompt-and-publish pipeline for
authored pages, `textbook.html` is where entries are *read, written, and
stitched together* directly in the browser, no backend and no build. Its
whole content lives in one versioned localStorage blob
(`ologypedia-textbook-v1` — `{ v, entries, order, last }`), deliberately
shaped as the unit you'd sync: stitching happens at the whole-blob level,
with cross-entry links stored inline in each entry's body as
`<a class="entry-link" data-entry="…">` and backlinks derived across the
set. The core gesture: highlight any phrase while reading, and the ✦ menu
turns it into a new entry (title pre-filled from the selection) with the
link planted where you found it — "new entry & open" to go build it out,
or "seed it & stay" to keep your place. Following a link to an entry that
doesn't exist yet creates it (wiki red-links). It's built to be
low-friction for ADHD/autism specifically: a breadcrumb trail so you
never lose your way back, seeds as a legitimate finished state (not a
nag), autosave with a visible saved state, resume-where-you-left-off,
forward-only status you don't have to manage, a Focus mode that quiets
the room to one page, a Calm-motion toggle, and one predictable page
shape throughout. Prefs persist under `ologypedia-textbook-prefs-v1`;
export/import JSON is the hands-on stand-in for sync. It shares
`shared/fonts.css` and the cream/rose token set inline, same pattern as
the rest of the app; its store is intentionally separate from
`add-page.html`'s `ologypedia-studio-v1` shelf so neither can corrupt the
other.

Textbook entries are also **first-class on the bookcase**: `index.html`
reads `ologypedia-textbook-v1` and renders each entry as a `.card63`
cover-card alongside the published cards and the studio drafts — grid and
spine views, search, and the subject filter all pick them up (they're
injected into `.deck` before `setupDeckControls` runs). Each card links
to `/ologypedia/textbook.html#<id>` (the reader deep-links on hash), is
tagged by status (Seed/Growing/Grown — seeds render dashed like drafts),
and carries a cover. Covers need no design step: accent is a stable hash
of the id, the emblem defaults to ✦, and the shelf blurb is auto-excerpted
from the entry's opening lines — but the Textbook's optional **Cover**
control (a small popover on each entry) lets you choose an accent, an
emblem, and a custom blurb, stored as `accent`/`glyph`/`blurb` on the
entry. The two files keep their derivation in step (same accent-hash,
same blurb rule) so a card looks identical whether or not a cover was
ever chosen. De-duplication is by id: a published slug or a studio draft
of the same id wins, so nothing doubles.

`marginalia` is the biggest app by built size (`dist/` ~3.1 MB, week 10
perf-sanity check) — but the number that actually matters, first-load
transfer, is a much healthier ~290 KB. the difference is the reading
room's two document-import paths — `pdf.ts` (and its 1.2 MB `pdfjs-dist`
worker) and `epub.ts` — both reached only via a dynamic `await import(...)`
from `Intake.svelte`'s own file-select handlers, so neither loads until a
visitor actually opens that one feature. confirmed by measuring real
network transfer against a `vite preview` build, not just `dist/`'s total
size.

## the local-first persistence layer

Domain stores remain app-owned. `packages/persistence` provides the narrower
mechanical contract they can opt into: versioned envelopes and migrations,
runtime validation, last-known-good recovery, explicit quota/write errors,
export/import round trips, and byte/storage estimates. The full adoption
contract and reference API live in
[`packages/persistence/README.md`](./packages/persistence/README.md).

`notebook` is the reference localStorage adoption. It migrates the former four
v1 keys into one v2 workspace document, validates stored and imported data,
shows save/recovery failures in the page, and exports the same envelope that it
imports. `bestiary` remains IndexedDB-native because of its embedded image data;
it validates its collection, keeps a last-known-good shelf, and reports both
collection size and the browser origin's usage/quota in `SyncPanel`.

This is intentionally incremental. Planner, Spores, Thinking About, Write, and
Marginalia keep their existing domain persistence until each is changed for a
product reason; adoption should migrate one store at a time rather than create
a central Woodles state service.

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
`BestiaryBlob`, `GardenBlob`, `DevlogBlob`, `ThinkingAboutBlob`); `write()` calls
the store's `rehydrate()`; `isNewer` is optionally provided (`bestiary`,
`marginalia-devlog`, `thinking-about` use it). `marginalia` still has none of
this — it never syncs privately.
`write` gained a file in week 7, but it has no private blob to sync at all;
its adapter's `read`/`write` are no-ops, kept only to reuse `createAppSync`'s
passphrase connect/disconnect/persistence for gating the public echoes
publish below — connecting the passphrase once, in any app, connects it
everywhere, same origin, same localStorage key.

### the public read path

a second, unrelated spine, added across ROADMAP.md's weeks 1–9: publishing a
curated snapshot for anyone to read, no passphrase required. `sync` above is
what keeps Z's own data following her between devices; this is what lets a
stranger's browser see any of it at all.

**`api/public.ts`** — a second Neon-backed edge function, over its own
`published` table (`api/schema.sql`), keyed `(app, slug)`, entirely separate
from `sync`'s table.

- `GET /api/public?app=<name>&slug=<slug>` — **no auth**, and the only
  cacheable response anywhere in `api/`: `cache-control: public,
  max-age=300, stale-while-revalidate=86400`. an unpublished slug returns
  `{ blob: null, version: 0, publishedAt: null }` with the same header — a
  200, not a 404, so a visitor's browser can always cache the answer
  either way.
- `POST` (upsert) and `DELETE` stay behind the same passphrase check as
  `sync` (`authed()`, shared from `_lib.ts`). every other response —
  `POST`/`DELETE` here, and all of `sync.ts` — stays `no-store`, the shared
  `json()` helper's default.
- republish is a whole-snapshot upsert, not a compare-and-swap: there's no
  concurrent editor racing a publish action the way `sync` has to guard
  against, so its "ask before clobber" dance doesn't apply here.
- a 4 MB cap on the POST body (week 10 hardening). the "~2-4 MB keeps the
  public GET fast" budget was a design decision from week 1's own planning
  notes, but nothing enforced it in code until now — a runaway or corrupted
  publish is rejected with `413` before it ever reaches the database,
  rather than becoming every subsequent visitor's slow unauthenticated GET.

**`packages/sync`** grows a second, parallel pair: `publish(app, slug,
blob)` and `pullPublic(app, slug)`. `pullPublic` never sends the
passphrase — its whole job is to be exactly what an unauthenticated
visitor's own fetch can see.

**the published shapes** (`packages/sync/src/publicBlobs.ts`):
`BestiaryPublicBlob` (`PublicCreature[]`) and `EchoesPublicBlob`
(`PublicLetter[]`). each publish is a curated, explicit subset of what's
stored privately — never a mirror of it. a creature publishes exactly two
assets (the rendered card image, and the isolated sprite, or the plain
upload as a fallback); a letter publishes only when its author marked it
`public: true` — filtered with `=== true`, never a truthy check, so
nothing ever leaks by accident.

**who publishes what, and who only ever reads:**

| app | publishes | reads (unauthenticated) |
| --- | --- | --- |
| `bestiary` | curated creatures, via `SyncPanel`'s publish section | its own gallery (`gallery.svelte.ts`) |
| `write` | letters explicitly marked `public: true` (`publish.ts`) | nothing — it's the private editor |
| `letter` | nothing (static, no editor) | the published echoes letters, for a visitor with no local copy of their own |
| `marginalia` | nothing | both: the bestiary's creatures (diorama binding, `bestiaryDb.ts`) and echoes' letters (reading room, `echoesLibrary.svelte.ts`) |

every reader degrades the same way — `idle → loading → ready/empty →
error`, never a blank crash on a slow network or a down API. `bestiary`'s
`gallery.svelte.ts` and marginalia's `echoesLibrary.svelte.ts` share that
shape on purpose; `letter/index.html`'s hand-rolled fetch (a static page,
no `@woodles/sync` import possible in the browser) and `bestiaryDb.ts`'s
IndexedDB-backed fallback chain land in the same place by different means.

## shared design tokens

the design system is shared at the lowest level only, and not by every app.

**`shared/palette.css`** defines eleven themes — `cream`, `dawn`, `dusk`,
`midnight`, `forest`, `terracotta`, `inkwell`, `typewriter`, `paper`,
`blossom`, `sugar` — as CSS
custom properties, switched by setting `data-theme="<id>"`. role tokens
(`--bg`, `--text`, `--accent`, `--rule`, …) carry the same meaning through every
theme, and concrete color names (`--lavender`, `--aqua`, `--peach`, `--lilac`,
`--plum`, `--lapis`, `--cream`) stay stable across them. `write` and the static
apps consume this.

the other seven SvelteKit apps don't. each ships its own token file under
`src/lib/style/tokens.css`, namespaced so it never leaks: `marginalia`
redefines the bare names under `.marginalia-root`, `planner` uses `--p-*`,
`spores` uses `--g-*`, `bestiary` uses `--b-*`, `marginalia-devlog` has its own
under `.devlog-root`, `notebook` defines `--nb-*` straight on `:root` (no
scoping class — each app is its own page, so there's nothing else in the DOM
for it to leak onto), and `thinking-about` uses `--ta-*` under
`.thinking-about-root`. `data-theme` and the eleven shared themes don't reach
any of them; they own their own look.

`thinking-about`'s look is a deliberate departure even from its SvelteKit
siblings' own house style: the rest lean into a dark, serif-display,
jewel-toned "Twilight Webcore" (marginalia and spores' own tokens.css files
name it outright); `thinking-about` goes the other way on purpose — white/
near-white chrome, thin gray rules, a plain sans (`--font-sans`, already in
`shared/fonts.css`), and color living only in the entries themselves as
calendar-event-style chips. Google Calendar light-mode logic, not another
Twilight Webcore variant.

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

the seven per-app `tokens.css` files play the same role but are deliberately
different palettes, so they aren't a consolidation target.

## the test suite

920 tests total: 16 in `api/` (its own
root-level `vitest.config.ts`, covering `public.ts` and `sync.ts` — the one
part of the workspace that isn't a pnpm package, so it needs its own runner
instead of the recursive `pnpm -r test`), plus 904 across ten pnpm
packages — `write` 65, `marginalia` 249, `planner` 283, `notebook` 14,
`spores` 46, `bestiary` 160, `packages/sync` 5,
`packages/persistence` 6, `packages/app-manifest` 7, and
`thinking-about` 69.
`marginalia-devlog` has no test script. keep this inventory current when a
suite changes; the root command is the release contract, not the prose count.

each app's `test` runs `svelte-kit sync && vitest run`. the `sync` matters: a
SvelteKit app's `tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which
`svelte-kit sync` generates — run `vitest` without it on a fresh clone and it
can't resolve the tsconfig. because the scripts sync first, `pnpm test` works
straight from a clean checkout.

`write`, `marginalia`, and `notebook` load the workspace-level
`vitest.setup.ts` to install a browser-like in-memory `localStorage` under
Node. planner keeps its own localStorage mock in `store.test.ts`; under the
current Node runtime that suite passes but may still print a
`--localstorage-file` warning.

`planner`'s `vitest.config.ts` loads the SvelteKit plugin, and it has to:
`planner`'s store is a `.svelte.ts` module that uses `$state`, instantiated at
import time, and without the plugin compiling it vitest throws `$state is not
defined`. the apps that test rune modules either inherit the plugin from
`vite.config.ts` or don't construct a rune store at import. planner's sharp edges
are written up in [apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).

## svelte-check

All eight SvelteKit apps currently pass with zero errors and zero warnings.
`pnpm -r check` runs all eight in turn. it stops at the first app that fails,
so when diagnosing a new break, run the app directly to see past it.

## continuous integration

The repository-level workflow at `../.github/workflows/quality.yml` runs on
pushes and pull requests with Node 22 and pnpm 10.32.1. It installs from the
lockfile, then runs `pnpm check`, `pnpm test`, and `pnpm build` from this
workspace. Keep the local root commands and that workflow identical so a green
checkout means the same thing locally and on GitHub.

## running things locally

from `woodles.space/`:

```
pnpm install            one install for the whole workspace
pnpm test               api/'s own vitest, then every pnpm package with a test script (920 tests)
pnpm check              svelte-check in every app
pnpm build              build the eight SvelteKit apps
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
