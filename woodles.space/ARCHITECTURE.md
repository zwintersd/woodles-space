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
- [REFACTORING.md](./REFACTORING.md) is the living consolidation log — code
  that exists in more than one place.
- [CONVERGENCE.md](./CONVERGENCE.md) is the product-shape counterpart: why
  spores, notebook, dev log, ologypedia and write overlap, and the plan for
  collapsing them into *one knowledge base, one writing surface, one front
  door*. all three rooms are built; its §5 table tracks which steps have
  landed and which remain. read it before reshaping any of those apps.
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
│   ├── handoff/             @woodles/handoff — passing a thought between apps
│   ├── persistence/         @woodles/persistence — versioned local storage mechanics
│   ├── sync/                @woodles/sync — the sync client
│   ├── spellcraft/          @woodles/spellcraft — the authoring brief + output contracts
│   └── text/                @woodles/text — HTML sanitizing, anchors, text helpers
└── apps/
    ├── landing/             static · the homepage
    ├── lab/                 static · future shelf for stub experiments
    ├── hygge/               static · design playground (fonts, palette, motifs, motion)
    ├── digits/              static · an SVG pen that writes the time
    ├── quiet-room/          static · an immersive three.js room of light
    ├── ologypedia/          static · a block system for textbook-style pages, and the pages it renders
    ├── letter/              static · echoes — the published-letter reader
    ├── animations/          Python · offline Manim scenes and curated web previews
    ├── write/               SvelteKit · the letter editor
    ├── marginalia/          SvelteKit · a witch writes worlds + a reading room
    ├── planner/             SvelteKit · carillon — calendar, schedule, and time
    ├── notebook/            SvelteKit · the front door — one stream of captures
    ├── bestiary/            SvelteKit · the witch's field guide, as playing cards
    ├── spores/              SvelteKit · the knowledge base — linked entries, gathered into spellbooks
    └── thinking-about/      SvelteKit · a board for what's being read, played, and watched
```

`animations/` is the Python/Manim authoring side of Hygge's motion workshop. it
has no `package.json` and isn't a member of the pnpm workspace; Manim renders to
an ignored scratch `media/` tree, while the catalog renderer copies deliberate,
checked-in previews to `exports/arcade/`. `vercel.json` serves those files and
the older free-form scene gallery directly. previews remain workshop studies,
not Marginalia runtime dependencies. `/hygge/motion/svg` is the adjacent,
ephemeral SVG Motion Bench: it exposes source anatomy, part groups, palette,
timeline, recipe JSON, and the exact offline render command without writing to
the repository or silently promoting an experiment into a game.

## the app manifest

`packages/app-manifest/src/index.js` is the canonical deployable-app inventory.
It owns the 16 app ids, names, public paths and aliases, app shape, source and
output locations, maturity, and landing visibility. It also owns the landing
tile order/copy, **band**, default pins, featured fallback, and Marginalia's
Reading Room sub-surface. A band is the *moment* a tile is for rather than the
thing it holds — `catch`, `write`, `tend`, `read`, `play` — and the start
menu's "all apps" section renders grouped under them (`landingAppsByBand`),
so the homepage stops presenting sixteen peers to choose between. That section
now lists every app, not just the unpinned remainder, because a band whose only
app is pinned would otherwise never show its name. The suite fails if a tile
lands in an unknown band, if grouping loses one, or if anything but `notebook`
appears in `catch`. See [CONVERGENCE.md](./CONVERGENCE.md).

The static landing page imports that browser-ready module directly;
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
`spores`, `thinking-about` — use Svelte 5 runes, Vite 7, and `@sveltejs/adapter-static`.
each builds to `apps/<name>/dist/` and consumes `shared/` through the `@shared`
Vite alias (`../../shared`). there is no SSR; every app ships as a static bundle.

`hygge` is the design playground — it holds the fonts, palette, motifs, and
motion showcases that used to be separate pages. `/hygge/motion` is the review
room for transparent Manim studies from `apps/animations/arcade-catalog.json`;
it tests scale, speed, background, repeat behavior, and reduced-motion stills
before any asset is promoted into a game. `/hygge/motion/svg` composes the small
versioned SVG recipe vocabulary in the browser, while Manim remains the final
renderer. `/fonts`, `/palette`, and `/motifs` all
rewrite to Hygge; `/scaffold` rewrites to `/write`. `lab` is the home for stub
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
ever chosen. De-duplication is by id, with a deliberate precedence: a
committed **published** page wins (it's the real public artifact); then a
**Textbook** entry wins over a **Studio draft** of the same slug — a live
entry owns its shelf card and opens the reader, so a leftover Studio draft
can't shadow it with an `add-page.html?open=…` card. A Studio draft whose
slug isn't a Textbook entry still shows as its own draft card, as before.
The reader also keeps the URL hash in step with the current entry
(`history.replaceState`), so reload/share/deep-link land on what you're
actually reading rather than a stale `#id`.

**Draft with a prompt** was the bridge between the Textbook's live editing
and `add-page.html`'s authoring workflow, brought *into* the reader rather
than sent out to the Studio. Facing an empty seed (or from the edit
toolbar on any entry), "✦ Draft it with a prompt" opens a sheet with a
ready-made authoring brief — the same voice/structure/etymology/bridges/
standing-lenses/conversions/reading-list spec as the Studio's prompt
(`add-page.html`'s `buildPrompt`), reused faithfully and inline per the
app's self-contained-file convention. The one difference is the OUTPUT
contract: the Studio asks for a complete `textbook-{slug}.html` file; the
Textbook asks for a **body fragment** (only `<p>/<h3>/<blockquote>/<ul>/
<li>/<strong>/<em>`, no masthead or CSS) with 3–8 key concepts wrapped in
`[[double brackets]]`. You paste the brief to any model, paste the answer
back, and `ingestDraft` strips code fences, accepts HTML *or* Markdown
(a small `markdownLite` fallback), converts `[[Concept]]` / `[[Concept|
display]]` into `entry-link`s — creating a seed entry for each new one and
reusing an existing entry when the title matches — sanitizes the result,
and drops it into the entry (replace, or append to existing prose). So one
AI draft both fills a blank seed *and* spawns a cluster of new linked
seeds, which is the whole stitching-together thesis, now assisted. An
optional diagnosis/health-condition toggle adds the Studio's four extra
sections to the brief. Nothing calls a model directly — the app stays
backend-free; the human carries the prompt and the answer across.

**Import from the Studio** closes the other direction: the pages you built
in `add-page.html` (the `ologypedia-studio-v1` shelf — each a full standalone
HTML page) become living Textbook entries. On load the reader auto-imports
any Studio entry that isn't already a Textbook entry, and the `⋮` menu has a
manual "Import from the Studio" (with a badge count) that pulls in anything
missing. Import is **additive and tracked** (`prefs.importedStudioSlugs`): it
never clobbers an entry you've since edited, and a deleted import won't
silently return on the next load — but the manual action can pull it back.
`studioBodyToFragment` reduces each full page to an editable body fragment via
`DOMParser`: it drops page chrome and the masthead (whose title/subtitle
duplicate the entry's own), strips `svg`/`canvas`/`img` (the block system's
charts have no Textbook CSS), rewrites `textbook-<slug>.html` and
`textbook.html#<slug>` links into `entry-link`s so the web of pages survives
the move, and sanitizes the rest — which now keeps `table`/`thead`/`tbody`/
`tr`/`td`/`th` (Studio `.compare` tables) alongside the prose, headings,
pull-quotes and lists. Because a Textbook entry uses the Studio slug as its
id, the imported entry then takes precedence on the bookcase (per the dedup
rule above), so its shelf card opens the reader rather than the Studio editor.

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

`notebook` is the reference localStorage adoption. It now stores one v3
workspace document of **captures**, carrying forward the v1 keys and the v2
document, validating stored and imported data, showing save/recovery failures
in the page, and exporting the same envelope that it imports.

Its v3 upgrade is deliberately **non-destructive**: it reads `notebook.workspace.v2`
for notes and ideas and leaves it in place, because Carillon reads the same key
for the tasks it took over (see below). That makes the two migrations
order-independent — whichever app you open first, neither reads data out from
under the other. `bestiary` remains IndexedDB-native because of its embedded image data;
it validates its collection, keeps a last-known-good shelf, and reports both
collection size and the browser origin's usage/quota in `SyncPanel`.

`packages/handoff` is the second adopter, and the first one that isn't an app:
each handoff queue is a versioned document in its own right.

This is intentionally incremental. Planner, Spores, Thinking About, Write, and
Marginalia keep their existing domain persistence until each is changed for a
product reason; adoption should migrate one store at a time rather than create
a central Woodles state service.

## the knowledge base

`spores` is where entries are tended. It absorbed the Dev Log (step 2) and the
Ologypedia Textbook (step 4); see [CONVERGENCE.md](./CONVERGENCE.md) for why.
Beyond spores/spellbooks/flights/tags, it now carries the Textbook's half:

**`[[wikilinks]]` in a plain-text body.** The Textbook stored links as
`<a class="entry-link" data-entry>` inside sanitized HTML. A spore body is
plain text, so the port uses bracket syntax — which is what the Textbook's own
"draft it with a prompt" already asked models to emit, so the authoring format
and the storage format now agree. `wikilinks.ts` turns a body into text and
link **segments**, which `SporeBody.svelte` renders directly: no `innerHTML`
anywhere on the read path, and therefore no sanitizer to get wrong. Links
resolve by title, case- and space-insensitively.

**Red links and sowing.** A link to a title nothing answers to is drawn dashed
with a `+`, and clicking it sows a seed rather than failing. Highlighting a
phrase while reading offers the same, planting the link where the phrase sat.
If the selection went stale and the phrase is no longer in the body, the seed
is still sown — losing the link is acceptable, losing the thought is not.

**Backlinks are derived, never stored** (`backlinksOf`), so they follow edits.
A rename therefore turns inbound links red rather than silently rewriting text
the person wrote; that is a deliberate choice, pinned by a test. They are shown
separately from `Flight`s, which are links you drew rather than wrote.

**Status and covers.** `seed → growing → grown`, forward-only, defaulting for
pre-merge spores by whether anything was written and never guessing "grown".
Covers need no design step — accent is a stable hash of the id, the emblem
defaults to ✦, the blurb is excerpted from the body with links read as their
display text — and `CoverEditor` only exists for the entry you care about.
Accents are stored as *names*, not hex, so a re-skin cannot strand them.

`SporeShelf.svelte` renders cover cards, toggled against the existing
archetype lists and persisted per-browser under `spores.spellbookView.v1` — a
view preference is about this screen on this device, so it stays out of the
synced blob.

`ologypedia` is now the publish target rather than a second editor:
`index.html` still shelves finished pages and `add-page.html` still builds
them, but `textbook.html` is a signpost that points at `/spores` and hands
back the original `ologypedia-textbook-v1` blob as a download. Nothing is
deleted on migration, so that page keeps working as an escape hatch.

## the front door

`notebook` holds one kind of thing. It used to hold three — notes, tasks, and
ideas — behind three mode tabs, so arriving with a thought meant answering
"which of these is it?" before you could type, which is exactly the decision a
front door exists to remove (CONVERGENCE.md §3).

**Tasks went to Carillon**, where time lives. `apps/planner/src/lib/notebookTasks.ts`
imports them once, flagged in planner settings. Carillon has no priority — it
organizes by domain and by time — so an off-normal priority is recorded in the
task's `notes` rather than invented as a field or dropped. Nothing ever maps to
Carillon's `dropped` state, which Notebook never had.

**Notes and ideas were always the same gesture at different lengths** and are
now both `Capture`s: title (which may be empty — a thought does not owe you
one), body, tags, and a `lane` (`spark` / `shape` / `later`). A lane is triage,
not status: where a thing sits in your head, not how finished it is. The
default filter is *everything*, because filtering is a choice; the number keys
filter rather than switch modes, and pressing the same one again clears it.

## the authoring brief

`packages/spellcraft` holds the prompt spec Z writes entries against — voice,
structure, etymology-as-semantic-drift, the metaphor sources, the standing
lenses, the conversions, the reading-list rule. **Nothing here calls a model.**
The human carries the prompt out and the answer back, which is what keeps every
app in this workspace backend-free.

The brief is the part that must not drift; what varies is only the **output
contract** — what shape the answer comes back in:

- `page` — one complete standalone file. Ologypedia's studio uses it, appending
  its own VISUAL SYSTEM as the trailer. That trailer is the app's page format,
  not part of the brief, which is why it stays in `add-page.html`.
- `fragment` — plain prose with `[[wikilinks]]`, which is exactly what a spore
  body already stores, so the authoring format and the storage format are the
  same thing. Spores' `DraftPanel` uses it.

`ingestDraft` takes the answer back in whatever shape it arrives — fenced,
HTML, markdown, or plain — and reduces it to that stored format. It takes
`htmlToText` as an argument rather than importing it, so the package needs no
DOM. In Spores, bringing a draft in also **sows a seed for every `[[link]]`
nothing answers to yet**, so one answer both fills the entry and spawns the
cluster around it.

Like `@woodles/app-manifest` and `@woodles/text`, this ships browser-ready
`.js` with a `.d.ts` sidecar, because `add-page.html` is static and has no
build step.

## the handoff spine

A third spine, alongside sync and the public read path, and the smallest of the
three: **moving one thought from the app that caught it to the app that can do
something with it.** The problem it exists for is written up in
[CONVERGENCE.md](./CONVERGENCE.md) §3 — four apps accept "a title and some
words", nothing routes between them, so the app you picked at capture time is
the app it stays in forever.

**`packages/handoff` (`@woodles/handoff`)** — `createHandoffQueue(target)` over
one versioned localStorage document per target (`woodles.handoff.<target>.v1`),
one queue each for the three apps that can receive: `notebook`, `spores`,
`write`. Read-only surfaces (echoes, ologypedia) are not targets. `send()`
appends, `drain()` empties, `peek()`/`count()` don't consume. The envelope is
`{ id, target, title, body, format, tags, source, createdAt }`, where `format`
is `text` or `html` and `source` carries the originating app for provenance.

Three deliberate choices, each tested:

- **a capture is never refused.** an empty draft, a corrupt queue, and a
  missing localStorage all still accept — the front door failing closed is
  worse than any data it could mangle.
- **duplicates beat losses.** `drain()` returns items even when it can't clear
  the queue, flagging `cleared: false`; receivers dedupe on id. nothing
  recovers a thought that was silently dropped.
- **queues are bounded** (`QUEUE_LIMIT`, 200, oldest dropped). a queue is a
  hallway, not a home.

**receivers** drain on load and announce it once: `notebook` turns each into a
note tagged `from:<app>`, `spores` plants each as a spore, `write` gives each
its own draft and opens the newest. HTML bodies are flattened for the two
plain-textarea apps and run through `sanitizeHtml` for `write` — a body may be
model output from two apps ago, and write's drafts can reach the public
publish path.

**senders** are `notebook` (per note and per idea, → spores / write) and
`spores` (per spore, → write). Everything can reach the front door; the front
door can reach everything.

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
the store's `rehydrate()`; `isNewer` is optionally provided (`bestiary` and
`thinking-about` use it). `marginalia` still has none of
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

the other six SvelteKit apps don't. each ships its own token file under
`src/lib/style/tokens.css`, namespaced so it never leaks: `marginalia`
redefines the bare names under `.marginalia-root`, `planner` uses `--p-*`,
`spores` uses `--g-*`, `bestiary` uses `--b-*`,
`notebook` defines `--nb-*` straight on `:root` (no
scoping class — each app is its own page, so there's nothing else in the DOM
for it to leak onto), and `thinking-about` uses `--ta-*` under
`.thinking-about-root`. `data-theme` and the eleven shared themes don't reach
any of them; they own their own look.

`spores` left the house style in week-11's convergence work: it now wears the
cream/rose/gold palette it inherited from the Ologypedia Textbook it is
absorbing (see [CONVERGENCE.md](./CONVERGENCE.md) step 3). the `--g-*` token
names and their roles are unchanged — only the values moved — plus four
tokens that had to be *added* because the old theme encoded them as literals
or conflated them with the accent: `--g-on-flight` (text on an accent fill,
hard-coded as the dark background in a dozen components), `--g-danger` and
`--g-danger-soft` (errors and destructive hovers, previously the accent pink
doing double duty), and `--g-scrim`. every token that carries text clears
4.5:1 against both `--g-bg` and `--g-surface`; the old muted and accent tones
did not, and re-valuing was the moment to fix that rather than port it
forward. `GraphRenderer`'s SVG node and edge palettes were re-valued too —
they are artwork tuned to their ground, and pastels that glowed on near-black
vanish on paper.

`thinking-about`'s look is a deliberate departure even from its SvelteKit
siblings' own house style: marginalia and bestiary still lean into the dark,
serif-display, jewel-toned "Twilight Webcore" (marginalia's own tokens.css
names it outright); `thinking-about` goes the other way on purpose — white/
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
- **text / HTML utilities** — consolidated into `@woodles/text`, with five
  consumers. it ships browser-ready `.js` plus a `.d.ts` sidecar (the
  `@woodles/app-manifest` shape) so `letter`, a static page with no build step,
  can import it directly. Two policies stayed *parameters* rather than being
  reconciled, because both sides already have stored data: whether a sanitize
  keeps `data-anchor` (`write` strips and re-stamps; `marginalia` and `letter`
  keep), and the anchor prefix (`write` stamps `a-`, the reading room `p-`).
  see [REFACTORING.md](./REFACTORING.md).
- **`EditorToolbar.svelte`** — `write` (89 lines) and `marginalia` (113).
  diverged, still moving.
- **`MarginNotes.svelte`** — `write` (204 lines) and `marginalia` (193).
  diverged, anchored to each app's own editor DOM.
- **`SelectionPopover.svelte` (write, 58 lines) / `SelectionBubble.svelte`
  (marginalia, 105)** — same idea, renamed, diverged.

the seven per-app `tokens.css` files play the same role but are deliberately
different palettes, so they aren't a consolidation target.

## the test suite

1108 tests total: 16 in `api/` (its own
root-level `vitest.config.ts`, covering `public.ts` and `sync.ts` — the one
part of the workspace that isn't a pnpm package, so it needs its own runner
instead of the recursive `pnpm -r test`), plus 1092 across thirteen pnpm
packages — `write` 72, `marginalia` 249, `planner` 298, `notebook` 28,
`spores` 140, `bestiary` 160, `packages/sync` 5,
`packages/persistence` 6, `packages/app-manifest` 11,
`packages/handoff` 15, `packages/text` 23, `packages/spellcraft` 16,
and `thinking-about` 69.
keep this inventory current when a suite changes; the root command is the
release contract, not the prose count.

each app's `test` runs `svelte-kit sync && vitest run`. the `sync` matters: a
SvelteKit app's `tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which
`svelte-kit sync` generates — run `vitest` without it on a fresh clone and it
can't resolve the tsconfig. because the scripts sync first, `pnpm test` works
straight from a clean checkout.

`write`, `marginalia`, `notebook`, and `spores` load the workspace-level
`vitest.setup.ts` to install a browser-like in-memory `localStorage` under
Node. planner keeps its own localStorage mock in `store.test.ts`; under the
current Node runtime that suite passes but may still print a
`--localstorage-file` warning.

`spores` gained its own `vitest.config.ts` for the same reason planner has one
— `garden.svelte.ts` builds a `$state` store at import time, so the Svelte
plugin has to compile it before the store tests can construct a `GardenStore`.

`planner`'s `vitest.config.ts` loads the SvelteKit plugin, and it has to:
`planner`'s store is a `.svelte.ts` module that uses `$state`, instantiated at
import time, and without the plugin compiling it vitest throws `$state is not
defined`. the apps that test rune modules either inherit the plugin from
`vite.config.ts` or don't construct a rune store at import. planner's sharp edges
are written up in [apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).

### browser integration tests

`e2e/` is the deliberately small Playwright layer above the unit suites. Its
local server reads `vercel.json` and applies the production rewrites, so route
coverage tests the paths people actually visit instead of eight unrelated Vite
ports. The suite covers every published entry route, Write → Echoes publishing,
Bestiary gallery/adopt/share and Marginalia consumption, an Arcade state change,
Ologypedia shelf export → publish script → indexed card, legacy localStorage
migration across reload, keyboard operation, and serious/critical WCAG A axe
findings.

Run it after installing Chromium once on the machine:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` builds all SvelteKit apps first. Ologypedia's publisher test
uses `--app-dir` with a temporary copy of the app, so it exercises the real
script without changing `apps/ologypedia/index.html` or adding a page to the
working tree.

## svelte-check

All seven SvelteKit apps currently pass with zero errors and zero warnings.
`pnpm -r check` runs all seven in turn. it stops at the first app that fails,
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
pnpm test               api/'s own vitest, then every pnpm package with a test script (1108 tests)
pnpm check              svelte-check in every app
pnpm build              build the seven SvelteKit apps
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
