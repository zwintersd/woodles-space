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
  spores, notebook, dev log, ologypedia and write overlapped, and the plan
  that collapsed them into *one knowledge base, one writing surface, one
  front door*. its §5 table tracks the eight original steps (all landed);
  its §7 records the later amendment — notebook retired into write, so the
  writing surface and the front door are now the same room. read it before
  reshaping any of those apps.
- [ABSTRACTION.md](./ABSTRACTION.md) is about simulating marginalia fast
  enough to tune its feel, and argues explicitly *against* porting it onto
  `@woodles/incremental-core` — the model stays marginalia's own; only the
  harness is shared. **§3–5 are built** (see the marginalia section below);
  its §6 lists what the `GameDef` schema can't express, for the separate
  question of authoring marginalia-like games in bloomforge.
- [`apps/marginalia/BALANCE.md`](./apps/marginalia/BALANCE.md) is what the
  harness found when it was pointed at the shipped numbers, and what was
  changed as a result. Two fixes landed: the content-to-time ratio (the
  opening worldspace took four minutes; it now takes thirty-four) and the
  stock-drift model, which acts on distance out of band rather than from
  neutral. That second one exposed a real error in DESIGN.md — its own
  metabolism table is net-positive on all three stocks, so the drift term was
  doing all the balancing — fixed by implementing the two passive sinks the
  design names in prose and never had. Three findings remain open and
  deliberately untouched, the restraint dividend chief among them.
- [REFERENCES.md](./REFERENCES.md) is CONVERGENCE's mirror image, and
  **mostly still a proposal**: where convergence collapsed apps that
  should have been one app, this is about apps that stay separate and learn
  each other's names — one record pointing at a record in another app without
  copying it. its §1 surveys the four shapes the workspace already does this
  in (bloomforge's shared keys, marginalia's binding map, the public blobs'
  carried ids, spores' deliberately breakable title links); its §3 is a table
  of open questions bar one. **steps 1 and 2 are built** — the addressing
  layer under "the app manifest" above, and the shelf ledger under "cross-app
  ledgers" below; steps 3–6 are unstarted, so the Carillon ↔ Thinking About
  connection currently runs one way only.
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
    `BALANCE.md` (what the sim harness found when pointed at those
    mechanics, and the two retunes it prompted), `WORLDS.md` (the route
    through DESIGN.md's remaining phases D/E/F — open questions, candidate
    answers, and the order to take them in),
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
│   ├── incremental-core/    @woodles/incremental-core — GameDef schema, validator, sim engine
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
    ├── write/               SvelteKit · the writing surface — letters, essays, stories, poems, notes
    ├── marginalia/          SvelteKit · a witch writes worlds + a reading room
    ├── planner/             SvelteKit · carillon — self-observation, day piles, and reinforcement
    ├── bestiary/            SvelteKit · the witch's field guide, as playing cards
    ├── spores/              SvelteKit · the knowledge base — linked entries, gathered into spellbooks
    ├── thinking-about/      SvelteKit · a board for what's being read, played, and watched
    ├── bloomforge/          SvelteKit · a studio for making incremental games
    └── bloomforge-player/   SvelteKit · the runtime that makes those games playable
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
It owns the 17 app ids, names, public paths and aliases, app shape, source and
output locations, maturity, and landing visibility. It also owns the landing
tile order/copy, **band**, default pins, featured fallback, and Marginalia's
Reading Room sub-surface. A band is the *moment* a tile is for rather than the
thing it holds — `write`, `tend`, `read`, `play` — and the start
menu's "all apps" section renders grouped under them (`landingAppsByBand`),
so the homepage stops presenting fifteen peers to choose between. That section
lists every app, not just the unpinned remainder, because a band whose only
app is pinned would otherwise never show its name. There is no `catch` band
anymore: Notebook, the app it existed for, retired into Write (CONVERGENCE.md
§7), and catching a thought is the write band's job now. The suite fails if a
tile lands in an unknown band, if grouping loses one, if a `catch` band grows
back, or if a second app joins `write`. See [CONVERGENCE.md](./CONVERGENCE.md).

The static landing page imports that browser-ready module directly;
its hand-drawn `ICONS` stay local because they are artwork, not deployment
metadata.

It also owns **addressing**: `primaryDestination(app)` answers "where does this
app live", and `entityHref(appId, kind, id)` answers "where does *this thing*
live", returning `<publicPath>?<kind>=<id>`. An app opts in by listing the
record kinds it answers to in `addressableBy` — only `bloomforge-player`
(`['game']`) does today — and `entityHref` throws on an unknown app or an
undeclared kind, because the manifest is static data so neither is a runtime
condition a caller could recover from. `canAddress(appId, kind)` is the
non-throwing check for callers that can't know the pair at author time.

The point is that a link between apps resolves through the record that owns
the path instead of being a hardcoded string: the studio's "Play it" used to
write the literal `/play?game=`, and `HandoffSource.href` is documented as a
deep link back and populated once, with an app root. A contract test asserts
every declared kind is a parameter the target app **actually reads**, the same
stance the route tests take toward `vercel.json` and each `svelte.config.js` —
the two sides don't import each other, they're asserted to agree. Query
parameters rather than path segments or hashes, so every app stays a
prerendered static bundle with no router change. See
[REFERENCES.md](./REFERENCES.md), whose step 1 this is.

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

**SvelteKit apps** — `write`, `marginalia`, `planner`, `bestiary`,
`spores`, `thinking-about`, `bloomforge`, `bloomforge-player` — use Svelte 5 runes,
Vite 7, and `@sveltejs/adapter-static`.
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

**the game loop and its reactivity are separate, on purpose.**
`witch/world.ts` holds every mechanic — the tick, the stages, the metabolism,
the interventions — as a plain `World` over a plain `WorldState`, with no
runes, no DOM, no `Date.now()` and no `Math.random()`; every roll goes through
a seeded RNG. `witch/book.svelte.ts` is a *view* over it: it owns a `World`,
and keeps persistence, the wall clock, offline credit, the bestiary bindings,
the reading room and the gain popups. Its public surface is unchanged from
before the split, because forty files read `book.*`.

Reactivity runs through one `version` counter rather than per-field `$state` —
every getter reads it, every mutation bumps it. Coarser than tracking each
field, and the reason the world underneath can be plain objects that
`witch/sim.ts` drives 360,000 times without paying for a proxy. Ten hours of
game time went from ~33.5s through the runes to ~1.3s through `World`; the
app's own suite dropped from 14.6s to 3.6s as a side effect.

`witch/sim.ts` is the balance harness — a fixed 100ms timestep, integer tick
counting and `createRng` all borrowed from `@woodles/incremental-core`, which
is the *only* thing marginalia takes from bloomforge's package. It is not a
`GameDef` and is not meant to become one; see
[ABSTRACTION.md](./ABSTRACTION.md). Its two policies bracket play on
marginalia's own axis — `witnessOnly` against `interventionist`, restraint
against meddling — because the core's idle/greedy pair brackets *purchasing*
and marginalia's scarce resource is attention. `pnpm --filter marginalia
balance` prints the report; findings live in
[`apps/marginalia/BALANCE.md`](./apps/marginalia/BALANCE.md).

## bloomforge, the incremental studio

`bloomforge` is a tool for *making* incremental games, not an incremental game.
It is the first app here built on a package rather than beside one, and the
split is the point:
[`packages/incremental-core`](./packages/incremental-core/README.md) owns the
`GameDef` schema, the validator and a deterministic simulation engine, with zero
runtime dependencies and no DOM. The editor edits a `GameDef`, the engine
simulates one, and a player runtime (not built) would run one. None of the three
imports another except through the core's types.

**The schema is the product.** Two decisions in it are load-bearing. Curves are
a structured union — `geometric`, `linear`, `polynomial`, `steps` — rather than
an expression language, because `base × growth^level` covers most real
incrementals and a parser is a rabbit hole with a foot-gun at the end. Every
kind is normalized so **level 1 evaluates to exactly the base**, which is what
lets the inspector plot any two curves against each other and lets `baseRate`
mean "output at level 1" whichever kind is chosen. Conditions are structured
predicates for the same reason: a predicate you can render as a form beats one
you have to parse, and the condition editor is the payoff.

**The engine is deterministic.** Fixed 100ms timestep, no wall-clock, no
`Math.random` — same def + same policy + same seed produces an identical run.
That is the whole basis for trusting a balance comparison, and it is why
`simulate` refuses a def carrying validation errors rather than producing
numbers that look fine and mean nothing. Ten hours of game time runs in ~150ms
against a 500ms budget; getting there needed rates and prices cached behind one
dirty flag (they can only change on a purchase or a reset) and integer tick
counting, because accumulating 0.1 three hundred times loses a whole tick.

**Edges are derived, never stored.** `deriveEdges(def)` computes the canvas
graph from the def every time, so there is no second copy of "what connects to
what" that could drift. Drawing an edge is therefore a *gesture that edits the
def* — `connectionIntent` says what a given drag would mean, and a drag that
wouldn't mean anything is refused with a reason instead of leaving a dangling
line.

The editor is Svelte Flow (`@xyflow/svelte`) for pan/zoom/drag, a runes store
holding `{ def, selection }` with whole-def snapshot undo (cheap and correct at
this data size), and a bottom dock: live Playtest stepping `createSim` on
animation frames at 1×/10×/100× game time, a Balance tab that fast-forwards
Idle against Greedy in a Web Worker and reports time-to-milestone, plus Log and
Notes. Persistence is `localStorage` through `@woodles/persistence` with JSON
export/import; `@woodles/sync` is deliberately not wired in yet.

**First run is a tour, not a manual.** A visitor lands on the example garden
behind a one-time welcome offering two doors: take the tour, or poke at the
example. The tour opens a genuinely blank project and walks six steps —
currency, generator, press play, tune the curve, add an upgrade, fast-forward —
and every step completes by *observing the def and the running simulation*,
never by a "next" button. That constraint is what keeps it honest: the tour
cannot claim you did something you didn't, it can't drift out of step with the
app, and it credits you for doing the thing by a route the hint never mentioned.
It also caught two bugs that only a first-timer would have hit — a new
generator that started unowned (so a from-scratch game could never produce
anything and pressing play showed zeroes forever) and a playtest that kept
running the def it was built from, so edits were invisible until you found the
reset button.

**`bloomforge-player` is the third consumer of the schema**, and the one that
proves the split was worth making. It takes a `GameDef` and renders a game: buy
buttons, an upgrade shop, prestige, milestones. It drives the same `createSim`
the studio's playtest dock does, differing in exactly two ways — 1× real time,
and `idlePolicy`, because the engine must buy *nothing* when every purchase is
a person deciding to make it. The buttons dispatch the same `Action`s a policy
would have returned.

The studio's "Play it" hands over `?game=<project id>` rather than a definition
in the URL: both apps sit on one origin, so the player reads the same
localStorage entries the studio writes, and a link can't go stale against an
edited game. The key names and blob shapes live in the core
(`library.ts`) rather than in either app, which is what stops the two drifting.

**Saves are reconciled, not trusted.** A save outlives the design — the author
keeps editing after people have started playing — so restoring one starts from
a fresh state for the *current* def and lays the saved numbers over the top
where both agree. Entities the author deleted are dropped, entities they added
start at zero, levels past a newly-lowered cap are clamped. A save also records
where the random stream had got to; without that, reloading replays the crit
rolls of the first second, and save-and-reload becomes a way to reroll a bad
one.

**Sync moves the whole shelf.** The blob is the project index plus every
definition, because syncing only the open project would quietly lose the rest.
The merge is per project, newest wins, and deliberately order-independent —
`createAppSync` retries a merged snapshot against the version it just observed,
and an order-dependent merge would ping-pong instead of settling. Editing a
different game on each device leaves you holding both.

Still out of scope, and named here so nobody goes looking: offline progress
(the player clamps a backgrounded tab's frame delta rather than paying it out,
because offline earnings are a design decision, not an accident of rAF) and the
art/audio/localization resource panels the mockup showed. The schema leaves
room for the latter (`Currency.symbol` as a sprite reference) but nothing is
built.

## the local-first persistence layer

Domain stores remain app-owned. `packages/persistence` provides the narrower
mechanical contract they can opt into: versioned envelopes and migrations,
runtime validation, last-known-good recovery, explicit quota/write errors,
export/import round trips, and byte/storage estimates. The full adoption
contract and reference API live in
[`packages/persistence/README.md`](./packages/persistence/README.md).

`notebook` was the reference localStorage adoption before it retired into
Write (CONVERGENCE.md §7). Its stored envelopes outlive it, on purpose: the
v3 captures document stays in localStorage, Write's one-time capture import
(`apps/write/src/lib/notebookImport.ts`) reads it — primary, then backup —
and leaves it in place, and Carillon still reads `notebook.workspace.v2` for
the tasks it took over. Both migrations remain order-independent and
non-destructive; nothing reads data out from under anything else.
`bestiary` remains IndexedDB-native because of its embedded image data;
it validates its collection, keeps a last-known-good shelf, and reports both
collection size and the browser origin's usage/quota in `SyncPanel`.

`packages/handoff` is now the reference adopter, and the first one that isn't
an app: each handoff queue is a versioned document in its own right.
`bloomforge` persists its project shelf through the same contract.

This is intentionally incremental. Planner, Spores, Thinking About, Write, and
Marginalia keep their existing domain persistence until each is changed for a
product reason; adoption should migrate one store at a time rather than create
a central Woodles state service.

## carillon, the self-observation instrument

`apps/planner` is Carillon. Its schedule is a hypothesis shown beside
momentary time-sampling data, not a compliance ledger. `buildDayIntervals()`
expands the configured wake/sleep anchors into intervals (15 minutes by
default); the bell asks what is actually happening in the current interval.
Past intervals only become editable when paper-entry mode is on or through
the catch-up card's recalled stretches. Paper-entry's date picker can reopen
any earlier sheet, and those marks keep `source: "paper"` so a later clipboard
transcription never poses as a live sample. Correcting an existing live sample
preserves its original provenance. A blank interval is unobserved, not failed.

Carillon's surface runs on two clocks' worth of color. `dayCycle.ts` has
always interpolated the `--p-*` daydream palette across the day; it now also
produces the `--car-*` **chrome** — the ground the instrument sits on, the text
and hairlines drawn straight onto it, the graph rule, the corner washes — via
`getChromeForTime()`, applied alongside the palette in `+layout.svelte`. The
chrome has two families, paper by day and the night instrument after ~21:15,
and the crossing between them is a switch rather than a blend: interpolating a
light ground toward a dark one passes through a mid-tone that reads as mud
under either text color. Hues still move freely *within* a family. The paper
tokens (`--car-paper`, `--car-ink`, `--car-ink-soft`, `--car-pink-dark`) stay
outside the cycle — a field sheet is paper at every hour, only the desk beneath
it changes. `dayCycle.test.ts` samples every 15 minutes and holds the chrome to
AA body text, AA-Large accents, and never landing on a mid-tone ground.

Each observation has the deterministic identity
`observation-<date>@<startTime>`, stores both its observed kind/label and the
pile's `plannedLabel`, and carries `capturedAt`/`updatedAt`. Correcting a mark
updates that record without editing the plan or manufacturing another sample;
its capture-time plan label, interval duration, and source provenance remain
fixed. The seven observation kinds are clinic, writing, build, movement, care,
rest, and elsewhere.

**Catch-up and recalled stretches** serve the opener who visits once or twice
a day instead of living with the bell. `findCatchUpGaps()` scans today's rows
for contiguous past, unobserved runs of at least an hour, and the Today screen
offers to sketch each hollow stretch in broad strokes. A sketch is one
observation with `source: "recall"` whose `intervalMinutes` spans the stretch —
one memory is one sample and earns one Spore however many bells it covers, so
backfilling can never out-earn live sampling. `buildDayIntervals()` spreads a
recall mark across every row it covers while an exact sample inside the
stretch keeps its own row; the ledger renders covered rows as labeled
continuations, and Edition Review shows the stretch as a single time range
with its own provenance commentary and a "recalled stretches" count in the
extras. Declining is first-class — "leave this stretch hollow" dismisses the
card because unobserved is an honest answer. The same card carries quiet
nudge chips for other logging worth catching up on: routines practiced within
the last two weeks but unmarked today, and captured Surge drafts from an
earlier session that are ready to review.

**Prompt-fading routines** begin as full task analyses. A dated practice records
each step as `independent`, `prompted`, or `missed` and derives an independence
ratio. At least 80% on each of the latest three days moves the routine to
`faded`, where only its opening and closing prompts are shown; a second
adjacent three-day window at the same criterion moves it to `mastered`, rendered
as one quiet chip. Faded and mastered routines always offer the full steps on
request. Practice ids are routine-plus-date, so correcting today's data replaces
today's record rather than pretending it was another day.

**Onboarding and refresh.** First setup is a six-step wizard (`OnboardingStore`,
`onboarding.store.svelte.ts`) — anchors, obligations, rituals, domains, week
rhythm, voice — that mutates the planner directly as each step is answered
rather than staging changes to commit at the end, so "finish later" is always
safe: `settings.onboardingStep` checkpoints exactly which question was live,
and a reload resumes there. Once `onboardingComplete` is true, though, that
same six-step machinery had been the *only* way back into any of those
questions — changing one setting meant "restart the wizard," which looks and
feels like wiping progress even though the underlying data was untouched.
**Refresh** is a second, independent entry point into the identical step
components: `startRefresh([steps])` opens directly on whichever section(s)
were picked from the Binder's sync tab, in that order, over the running app
rather than in place of it — a fixed-position overlay layered above the
Carillon shell, not a swap of `+page.svelte`'s top-level branch. Refresh
never reads or writes `onboardingComplete`/`onboardingStep`; `mode` and its
own `refreshSteps` queue are the only state involved, so a refresh session
can never stub out a genuinely unfinished first-run checkpoint, and closing
it (Escape, the backdrop-free "done for now," or completing the last chosen
section) simply unmounts the overlay. The steps themselves needed no
changes — they already read current settings/domains/etc. as their starting
values, so revisiting one is inherently non-destructive. The original
full-wizard reset (`resetOnboarding()`) still exists as a clearly separate,
still-confirmed action for a genuine do-over, demoted beneath Refresh rather
than removed.

**Capacity** is a morning read of how much room today has, shown at the top of
Today — before the sampler, so it lands before the day itself does. It is
built entirely from what's already true rather than a form to fill out:
sleep quality (a same-day `SleepLog`, one per date), how independently this
morning's routines went (today's `RoutinePractice.independence`, already
recorded for Prompt-fading routines above), and the ongoing `signals.ts`
reads below. `capacityRead()` folds these into a level — `low`, `steady`,
`open` — but the level is never shown alone: every input that moved it
appears beside it as a plain-language reason, because a hypothesis you can't
see the working for is exactly the "compliance ledger" feel Carillon's plan
already refuses elsewhere. An active illness overrides the level to `low`
outright rather than just subtracting from a score — it shouldn't take a bad
night on top of it to read as low, and a good one shouldn't wash it out.
`capacityNudges()` turns the level into suggestions, never actions taken on
your behalf: `open` nudges toward adding an errand or an evening stretch
session (both just open the ordinary task composer, pre-dated to today —
nothing is created without a name typed in), `low` nudges toward protecting
rest and catching up rather than taking more on. A day with nothing logged
yet reads as `steady` with no reasons, not an error.

**Ongoing signals** (`signals.ts`) are the slower-moving context beside a
single day — where in a cycle, how far to payday, whether an illness is
still running — logged as one flat `SignalEntry[]` rather than three
separate mechanisms, the same "derive, don't store current state" stance
Carillon already takes toward observations and Echo's traits. `cycleRead()`
derives cycle length from the gap between logged period-start dates (an
average once there are two or more; a 28-day guess, marked `estimated`, from
just one) rather than asking for a length up front. `paydayRead()` only
ever reports a payday actually logged for today or later — never inferred
from a schedule, so it says nothing rather than guessing wrong. `illnessRead()`
treats a missing `endDate` as still ongoing, since an unknown recovery date
is the normal case for being sick; closing the Capacity card's "recovered"
chip sets `endDate` to today, which still counts today as a sick day and
clears starting tomorrow. A fourth kind, `custom`, is the flexible-tracking
escape hatch everything else on this page is deliberately not: any label,
logged as a single day or a span via the same optional `endDate` — but
unlike illness, no `endDate` there means only that one day, since most
custom notes ("started new medication") are a point in time, not a stretch.
Custom entries always appear in Capacity's reasons list, but never move its
score — Carillon has no way to know a custom entry's valence, and guessing
would be exactly the black-box behavior the reasons list exists to avoid.

**Day piles** are complete reusable day shapes rather than schedules assigned
in advance to dates. The starter rack has five: office, maker, out, recovery,
and writing. `weekPattern` supplies one suggested pile per weekday while a
`DayInstance` is an explicit one-day override, so choosing today's pile does
not silently rewrite every future Thursday. Blocks are rated `easy`, `steady`,
or `stretch`; `sequenceDayPile()` puts high-probability on-ramps before the
lower-probability work while preserving the authored time slots. Obligations
and rituals are overlays and are never reordered by that operation.

**Surge drafts** separate capture from commitment. Every draft stores its
creation timestamp and the `PlannerStore` session id that created it.
`canPromoteSurgeDraft()` refuses promotion while that same app session is
alive; a later session may promote it, but promotion only creates an
unscheduled task in loose pieces, never a block or a calendar commitment.
The original body, drafted-at time, promoted-at time, and resulting task id
stay attached as provenance. The resulting task id is deterministic per draft,
so two devices cannot manufacture duplicate loose pieces; the loose piece opens
the ordinary task editor for scheduling. Archiving a draft never touches the
plan and remains reversible from the closed-draft shelf.

**Spores and Echo** are the reinforcement layer. One honest observation creates
one deterministic, amount-1 `SporeEvent`; correcting the observation updates
the same Spore's kind instead of double-paying it. Echo's seven visible traits
grow from lifetime totals by observation kind, while the last seven days only
decide whether the creature is awake or taking an ordinary nap — there is no
streak penalty. `buildEchoesExport()` emits the stable
`carillon-spores` version-1 JSON ledger, which is the narrow surface Echoes can
consume without importing Carillon's private planner blob.

**Print-first evenings and edition review** close the paper loop. The Today
screen always carries a print-only sheet for tomorrow's chosen pile: a
letter-portrait, two-column interval ledger with the plan beside an empty mark,
the cream/print-pink inversion, and VT323 timestamps under `@media print`.
Paper marks come back through the explicitly labeled, date-addressable
paper-entry mode. `EditionReview` only offers days with observations and builds
each historical row from the observation's stored interval duration and
`plannedLabel`; changing today's pile or sampling interval cannot rewrite the
old edition. It can overlay pop-up commentary for repeated weekday/interval
changes and Surge provenance. The commentary is a pattern-finding bonus track,
not an audit, and the same view exports the Spores JSON.

Carillon remains local-first: its domain records live in app-owned localStorage
keys and `PlannerBlob` treats the instrument fields as optional so older synced
blobs still hydrate. When passphrase sync is connected, `@woodles/sync` mirrors
one whole `PlannerBlob` into Neon's `sync.blob` JSONB column. Carillon opts into
the deterministic merge path: id-keyed collections are unioned; an observation
collision takes the later `updatedAt`, a routine-practice collision the later
`recordedAt`, mutable piles/tasks/routines/day choices — and sleep logs and
signal entries alongside them — take the later `updatedAt`, and a Surge
collision takes its later update with status precedence as a tie-break. The
Spore ledger is then reconciled against the merged observations so kind,
date, and amount stay canonical. Legacy settings and
overlay collections remain remote-winning. A compare-and-swap conflict merges
against each returned server version for up to three total pushes; persistent
contention remains safe locally and surfaces as not-yet-synced instead of a
false success. See "the sync layer" below for the transport contract.

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

## the writing surface

`write` is where words go — every kind of them. It began as the letter editor
and stayed the best text surface in the workspace (the rich contenteditable
with three composable layers, pockets, margin notes, the publish path to
echoes); it is now also the front door, because `notebook` retired into it
(CONVERGENCE.md §7). The routing question a front door exists to remove —
"which app does this thought belong in?" — is answered once, at the homepage:
words go to Write.

**Kinds.** Every draft has a `WritingKind` — `letter`, `essay`, `story`,
`poem`, `note` (`src/lib/kinds.ts`). A kind is a lens, not a cage: switching
costs nothing and loses nothing. The editor dresses itself for the kind — the
untitled fallback, and all three layers' placeholders, so the midground reads
"characters, places, threads" under a story and "evidence, sources, the
counterargument you owe an answer" under an essay. A stored draft with no
`kind` field reads as `letter`, so nothing written before kinds existed ever
needed rewriting. Publishing is unchanged: whatever the kind, what publishes
is a letter in echoes, and only when explicitly made public.

**Word goals.** A draft can carry an optional `goal` (the bottom bar's word
count is the control). Progress is reported, never scolded — fiction gets to
50,000 the same way an essay stays under 2,000, by being able to see where it
stands.

**The open notebook.** `src/lib/spread.ts` owns a second view: two facing
pages instead of one page at a time. This is what the three layers were
always for — the working notes stay open on the left while the prose grows on
the right, rather than being a tab switch away. `page` view is unchanged and
one click away; `spread` is the default for a browser that has not chosen.

Four things are load-bearing:

- **The layers are never unmounted.** Each contenteditable *is* the storage
  for its content between saves (`fgEl.innerHTML` is what `scheduleSave`
  reads), so a page is hidden and reordered with CSS — `display: none` and
  grid `order` — never added to or removed from the DOM. Remounting would
  silently empty a layer. Both pages sit inside always-present `.page`
  wrappers for the same reason.
- **verso ≠ recto, by construction.** One element cannot be in two places, so
  asking a page for the layer the other one holds **swaps them** rather than
  duplicating it (`assignLayer`), and `coerceViewPrefs` repairs a stored set
  that ever lost the invariant. Both are pinned by tests.
- **Focus decides what is "active".** The toolbar, the word count, and the
  publish button follow the page your cursor is in. But *visible* and
  *focused* are now different questions: margin notes and publishing key off
  `foregroundVisible`, so writing in the midground beside the prose doesn't
  hide the notes or take publish away.
- **One ruling across the spread.** Ruled paper draws with a
  `repeating-linear-gradient` whose step is the line box exactly, so a rule
  lands under every line whatever font the template picked. In a spread all
  three layers share one line box (`1.995rem`) so both pages rule to the same
  rhythm across the spine — the layers keep their own type sizes, like
  different handwriting on the same paper. Page view keeps each layer's own
  tighter leading, since there is no facing page to agree with.

View preferences — mode, ruling, and which layer is on which page — are a
**device preference, not document content**: they live in
`woodles_write_view` beside the pockets order, never in a draft body. Below
1100px the notebook lies flat: pages stack, the spine goes away, and the
verso/recto mirroring stops.

**The drafts list earns its size.** Index entries carry `kind` and `tags`;
the drafts modal searches title + tags and filters by the kinds actually
present. This answers CONVERGENCE.md §6.1 (write's flat drafts list),
which became urgent the moment notebook's captures arrived in it.

**The capture import** (`src/lib/notebookImport.ts`) runs once on load,
flagged, like Carillon's task takeover. Each capture becomes its own draft of
kind `note` under a deterministic id (`d-nb-<capture id>`), tags carried,
body through `textToHtml`; the untouched starter capture is skipped; the
stranded `woodles.handoff.notebook.v1` queue is drained into drafts and that
key alone removed. The notebook document itself is left in place. Unlike a
live handoff, an arriving archive does not steal the opening slot — it is
announced once, and whatever you were writing stays open.

Notebook's other half had already left before the retirement: **tasks went to
Carillon**, where time lives. `apps/planner/src/lib/notebookTasks.ts` still
imports them once from `notebook.workspace.v2`, flagged in planner settings —
that key outlives the app, so the takeover works whether or not it ran before
the retirement.

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
one queue each for the apps that can receive: `spores` and `write`. (`notebook`
left the target list when it retired into Write; its stranded queue is drained
by Write's capture import rather than by a receiver.) Read-only surfaces
(echoes, ologypedia) are not targets. `send()`
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

**receivers** drain on load and announce it once: `spores` plants each as a
spore, `write` gives each its own draft (tags carried onto the index) and
opens the newest. HTML bodies are flattened for spores' plain textarea and run
through `sanitizeHtml` for `write` — a body may be model output from two apps
ago, and write's drafts can reach the public publish path.

**senders**: `spores` hands a spore that wants real prose to `write`. The
other direction — a write draft that turns out to be knowledge-base material —
is still a copy-paste; wire it when it hurts.

## the sync layer

a single-user sync spine that a few apps opt into. localStorage stays the source
of truth on each device; sync mirrors it to a server so the same data follows you
between machines.

**`api/sync.ts`** — a Vercel edge function over a Neon Postgres table whose
`blob` column is JSONB. `GET /api/sync?app=<name>` returns `{ blob, version }`;
`POST` with `{ app, blob, baseVersion }` is a compare-and-swap — it writes only
if the version still matches what you read, and answers
`409 { conflict, server }` when the server moved first. auth is one passphrase,
sent as `Authorization: Bearer …`. the server never stores it — only its
SHA-256, compared in constant time against the `SYNC_PASS_HASH` env var.
`DATABASE_URL` comes from the Neon integration.

**`packages/sync` (`@woodles/sync`)** — the client half. `pull(app)` and
`push(app, blob, baseVersion)` wrap the endpoint; `createSyncedStore(adapter)`
owns the version bookkeeping. Ordinary adapters keep the "ask before clobber"
decision — `onConflict` returns `mine`, `theirs`, or `cancel`. An append-like
adapter may instead provide a deterministic `merge(local, remote)`: hydration
applies and, when needed, flushes the merged blob; a compare-and-swap conflict
merges against the server snapshot, adopts that returned version, and retries
the push once. The active passphrase lives in module memory, while
`createAppSync` also caches it under the shared `woodles_sync_passphrase`
localStorage key so apps can reconnect after a reload; disconnect removes that
bearer credential. the last-seen version is cached in localStorage too.

**`apps/*/src/lib/sync.svelte.ts`** — the per-app glue. Most are small:
a `SyncState` class with `$state` fields, its instantiation, and a call to
`createAppSync` (from `@woodles/sync`) that wires up the app-specific adapter.
the adapter's `read()` maps the store into the blob type (`PlannerBlob`,
`BestiaryBlob`, `GardenBlob`, `DevlogBlob`, `ThinkingAboutBlob`); `write()` calls
the store's `rehydrate()`; `isNewer` is optionally provided (`bestiary` and
`thinking-about` use it). Carillon's file is deliberately larger because it
owns the merge described above and coalesces queued instrument writes before
flushing. `marginalia` still has none of this — it never syncs privately.
`write` gained a file in week 7, but it has no private blob to sync at all;
its adapter's `read`/`write` are no-ops, kept only to reuse `createAppSync`'s
passphrase connect/disconnect/persistence for gating the public echoes
publish below — connecting the passphrase once, in any app, connects it
everywhere, same origin, same localStorage key.

### cross-app ledgers

A third use of the sync spine, alongside each app's own blob and the public
read path below. A **ledger** is the narrow surface one app publishes for
*another app* to read — private data following one person between their own
devices, so it rides `/api/sync` behind the same passphrase rather than
`/api/public`. The shapes and both keys live in
`packages/sync/src/crossAppBlobs.ts`, next to `publicBlobs.ts` and for the same
reason: defined in neither app, so writer and reader cannot drift.

Two rules hold for every ledger. **One writer** — the app that owns the data
publishes it, and a reader that needs to send something back gets its own
ledger in the other direction rather than writing to this one. **Derived,
never authoritative** — a ledger is rebuilt from the writer's own store on
every save, so it is always safe to throw away, and it is never hydrated back
into the app that produced it. That second rule is why publishing is a bare
`push` rather than a `createAppSync` adapter: hydrating would be backwards.

One ledger exists today. **Thinking About publishes the shelf** — active,
titled entries as `{ id, title, columnKey, sectionKey, color, lastSessionDate }`
under sync key `thinking-about-shelf` and localStorage key
`thinking-about.shelf.v1`. Notes, session logs and archive state stay private.
Carillon reads it into the task composer, where picking one seeds the title and
stores `Task.thinkingAboutEntryId` — a *reference*, so a rename over there
can't leave the planner lying, and so a later observation on that block knows
exactly which entry it was.

Local-first is not weakened by this riding sync: the writer mirrors every save
to localStorage, the reader looks there first (synchronous, same origin,
instant), and the server is only what carries the ledger to a device where the
other app has never been opened. The reader degrades through the same
`idle → loading → ready/empty → error` shape every other reader here uses, and
a stale local shelf always beats an error — no shelf simply means no picker,
never a broken composer.

Two consequences worth stating. A publish is **deduplicated against the last
one this session**, because most saves change a note or a session date, which
the shelf doesn't carry — without that, every flush would spend a round trip
rewriting identical bytes. And a compare-and-swap rejection is answered by
re-pushing the same derivation against the version the server just reported,
not by merging: two devices publishing a projection of their own entries are
not in conflict about anything a person typed, and the entries underneath
converge through Thinking About's own sync.

See [REFERENCES.md](./REFERENCES.md), whose step 2 this is.

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

the other five SvelteKit apps with a house style don't. each ships its own
token file under
`src/lib/style/tokens.css`, namespaced so it never leaks: `marginalia`
redefines the bare names under `.marginalia-root`, `planner` uses `--p-*`
for its inner surfaces and `--car-*` for the Carillon shell,
`spores` uses `--g-*`, `bestiary` uses `--b-*`,
and `thinking-about` uses `--ta-*` under
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

1749 tests total: 16 in `api/` (its own
root-level `vitest.config.ts`, covering `public.ts` and `sync.ts` — the one
part of the workspace that isn't a pnpm package, so it needs its own runner
instead of the recursive `pnpm -r test`), plus 1733 across sixteen pnpm
packages — `write` 122, `marginalia` 333, `planner` 499,
`spores` 140, `bestiary` 162, `bloomforge` 83, `bloomforge-player` 22,
`packages/sync` 15, `packages/persistence` 6, `packages/app-manifest` 16,
`packages/handoff` 15, `packages/text` 23, `packages/spellcraft` 16,
`packages/emoji` 4, `packages/incremental-core` 191, and `thinking-about` 86.
(Counted by running each suite, not by adding to the previous figure — the
inventory had drifted: the headline said 1644 against a body summing to 1700,
and marginalia's balance-harness work landed 333 tests recorded as 325. Two
of marginalia's are currently failing on `main` — timeouts in `sim.test.ts`,
unrelated to this count.)
(`notebook`'s 28 retired with the app; write's suite grew to cover kinds,
the drafts filter, the capture import, and the spread's view model.)
keep this inventory current when a suite changes; the root command is the
release contract, not the prose count.

each app's `test` runs `svelte-kit sync && vitest run`. the `sync` matters: a
SvelteKit app's `tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which
`svelte-kit sync` generates — run `vitest` without it on a fresh clone and it
can't resolve the tsconfig. because the scripts sync first, `pnpm test` works
straight from a clean checkout.

`write`, `marginalia`, and `spores` load the workspace-level
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
pnpm test               api/'s own vitest, then every pnpm package with a test script (1644 tests)
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
