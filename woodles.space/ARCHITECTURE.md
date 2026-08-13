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
  its §7 records the amendment — notebook retired into write, so the
  writing surface and the front door became the same room; its §8 records
  the second collapse — spores and ologypedia retired into write too, so
  the knowledge base joined them, and there is now one room. read it before
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
- [HANDOFF.md](./HANDOFF.md) is the pick-up-from-here note for the reference
  spine: what the six steps landed, the sharp edges to know before touching
  them, and a design for extending the same spine into Write — `#` to reach a
  piece of media, `@` to reach a day. It also carries two decisions not yet
  built: its §5 design for reaching this spine from Write with `#` and `@`.
  Its §3 (Echoes stops being public) and §4 (bestiary's card id onto
  `entityHref`) **are** built — see "the archive" and "the app manifest" here.
- [REFERENCES.md](./REFERENCES.md) is CONVERGENCE's mirror image, and
  **mostly still a proposal**: where convergence collapsed apps that
  should have been one app, this is about apps that stay separate and learn
  each other's names — one record pointing at a record in another app without
  copying it. its §1 surveys the four shapes the workspace already does this
  in (bloomforge's shared keys, marginalia's binding map, the public blobs'
  carried ids, spores' deliberately breakable title links); its §3 is a table
  of open questions bar two. **steps 1–3 are built** — the addressing layer
  under "the app manifest" above, and all three ledgers plus the two-way deep
  links under "cross-app ledgers" below. **all six steps are built**: an entry
  can be taken to the day, its scheduled time comes back, observing an interval
  offers to log the sitting on the day it happened, and a standing slot draws
  itself on the calendar. [HANDOFF.md](./HANDOFF.md) picks up from there.
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
│   ├── life-points/         @woodles/life-points — the cross-app currency, earned by being away
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
    ├── letter/              static · echoes — the private archive reader
    ├── animations/          Python · offline Manim scenes and curated web previews
    ├── write/               SvelteKit · the writing surface — letters, essays, stories, poems, notes, and lists that nest and move (Liquid); also the knowledge base now, in a small way (cross-draft references, backlinks, "draft it with a prompt")
    ├── marginalia/          SvelteKit · a witch writes worlds + a reading room
    ├── planner/             SvelteKit · carillon — self-observation, day piles, and reinforcement
    ├── bestiary/            SvelteKit · the witch's field guide, as playing cards
    ├── thinking-about/      SvelteKit · a board for what's being read, played, and watched — and, per entry, a structured record cast for it
    ├── whiteboard/          SvelteKit · a wide, tactile place for spatial thinking
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
It owns the 16 app ids, names, public paths and aliases, app shape, source and
output locations, maturity, and landing visibility. It also owns the landing
tile order/copy, **band**, default pins, featured fallback, and Marginalia's
Reading Room sub-surface. A band is the *moment* a tile is for rather than the
thing it holds — `write`, `tend`, `read`, `play` — and the start
menu's "all apps" section renders grouped under them (`landingAppsByBand`),
so the homepage stops presenting fourteen peers to choose between. That section
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
`thinking-about`, `whiteboard`, `bloomforge`, `bloomforge-player` — use Svelte
5 runes, Vite 7, and `@sveltejs/adapter-static`.
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

`ologypedia` and `spores` retired into `write` — see
[CONVERGENCE.md](./CONVERGENCE.md)'s second collapse. Ologypedia's own
self-contained block-page format had already been named, in that same doc,
as an invention that lives on as its own project outside this monorepo, so
nothing needed relocating from it; Spores' engine (wikilinks, backlinks,
status, the spell registry) is the half that had somewhere real to go, and
did — see "the writing surface" and "the board" below for where.
`/ologypedia` and `/spores` are now permanent redirects to `/write`.

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

This is intentionally incremental. Planner, Thinking About, Write, and
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

## the board

`thinking-about` is a board for what's being read, played, and watched —
columns, sections, one-tap sittings, the standing-slot and ledger machinery
documented under "cross-app ledgers" in "the sync layer" below rather than
here, so it isn't said twice.

**Casting a spell.** `apps/thinking-about/src/lib/spells/` is Spores' curated
category system (author, musician, filmmaker, actor, person, tv-series, film,
book, album, game, the anime relationship graph), moved here because its
categories already name almost exactly this app's `SectionKey` union — the
knowledge-base half of Spores worth keeping had nowhere better to go than the
app already organized around books, films and games. It is a different tool
from `@woodles/spellcraft` (see "the authoring brief" above): a category is a
field schema, not a voice, and casting one asks a model for a JSON record
rather than prose. `registry.ts` keeps the schemas; `assembler.ts` builds a
prompt that asks for every field a category knows, no per-cast field picker
the way Spores had one — a simplification, not a port; `parser.ts` is Spores'
own forgiving intake (fence-stripping, bounded truncation repair, unwrapping a
model's mistakenly-stringified arrays) essentially unchanged, because getting
JSON back from a model is the same problem regardless of what it describes.
`SpellPanel.svelte` opens from an entry's detail view, suggests a starting
category from the entry's `sectionKey` (`suggestedCategoryId`, a suggestion
never a restriction), and stores the result as `entry.spell: { categoryId,
data, castAt } | null` — optional, normalized like every other field an older
entry might not have. Spores' worldbuilding categories (creature, biome,
ability, stat, minigame, lore) did not come with it: they were the retired Dev
Log's content, and nothing in this workspace's four healthy apps is about
marginalia's world, so there was nowhere honest to put them.

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
is a letter in echoes, which is your own archive rather than an audience.

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

**Spores retired into Write too**, and brought a smaller version of its job
rather than a second knowledge base. `references.svelte.ts`'s `#`/`@` picker
already had a source registry — Thinking About entries, days — so a third
source, `DraftSource`, is a few lines: `#` now also reaches another draft,
resolved live against `listDrafts()` (same-origin, no ledger needed) and
inserted as the same `data-ref-*` anchor every other reference uses, through
`entityHref('write', 'draft', id)` now that Write declares `addressableBy:
['draft']` and reads `?draft=` on load. `backlinks.ts` answers "what
references this draft" by scanning stored bodies for those anchors — Spores'
`backlinksOf`, ported onto a mechanism Write already had rather than a second
link syntax; `[[wikilinks]]` did not come with it. What did: the seed →
growing → grown status (`status.ts`), optional and forward-only exactly as it
was in Spores and the Ologypedia Textbook before it, shown as a pill in the
drafts modal you click to advance. Covers and `Flight`s did not make the
trip — Write has no shelf of cards to put a cover on, and an edge with no
prose around it had nowhere to land; both are named in `sporesImport.ts` as
deliberate drops, not oversights.

**The migration** (`src/lib/sporesImport.ts`) runs once, flagged, on the
notebook-retirement pattern: reads `spores.spores.v1` and
`spores.spellbooks.v1` and leaves them in place. Each spore becomes a draft
of kind `note` under a deterministic id (`d-sp-<spore id>`), tagged
`from:spores` plus `spellbook:<title>` for each spellbook it belonged to.
`[[wikilinks]]` resolve into draft references against the titles in the same
export — built as a title index before any body renders, so a link can point
forward to a spore later in the array — and flatten to plain text when the
target isn't in the export, the same "cold reference" stance live references
take. A spore with no body (migrated from the old Dev Log, its fields
entirely in `data`) gets one synthesized from those fields, so a worldbuilding
record's words aren't stranded on an app that no longer exists.

**Draft it with a prompt.** `DraftPromptModal.svelte` is Write's own use of
`@woodles/spellcraft`'s brief (see "the authoring brief" below): assemble a
prompt from a topic, paste it into any model, paste the answer back, and it
lands in the foreground layer through `textToHtml` — appended to what's
already there, never a silent replace. The Ologypedia studio's and Spores'
Garden's versions of this gesture both retired here.

**Liquid** is the one kind that isn't prose. `kind: 'list'` (label "liquid")
swaps the three-layer editor for a board of lists that nest and move —
Trello's shape, a Notion-style outline inside each list — for the writing
that wants structure instead of sentences.

`apps/write/src/lib/liquid.ts` holds the whole model as plain data and pure
functions, no DOM, no runes: a `LiquidBoard` is `LiquidList[]`, each holding a tree of
`LiquidItem`s. Two primitives carry every mutation — `removeNode` (take an
item and its subtree out of the tree, wherever it's nested) and `insertNode`
(put it back somewhere else) — so indent, outdent, reordering, and moving an
item to a different list are all "remove, then insert at a different
address," not four separate code paths. The one sharp edge it exists to
avoid: computing a drop target's position *before* removing the dragged
node reads a stale index once the node started out earlier in the same list
— removal shifts every later sibling down by one. `moveItemRelativeTo`
locates the target *after* the remove, which fixes the off-by-one and, as a
side effect, is what makes "the drop target was inside the dragged subtree"
refuse itself for free: that target simply isn't there to find any more.

`Liquid.svelte` owns all the interactive state (drag tracking, hover zones)
and is the only thing that calls liquid.ts's mutators; `LiquidNode.svelte`
recursively renders one item and its children and is otherwise dumb, acting
only through callbacks. Structure has two independent controls, on purpose:
native HTML5 drag-and-drop (a row's left 20% nests as a child of the drop
target, the rest reorders as a sibling before/after it, by which half of the
row's height the pointer is over) for the fluid, visual "move things around"
feel, and Tab/Shift+Tab/Alt+↑/Alt+↓/Enter/Backspace for everyone who'd rather
not reach for the mouse. Neither is a fallback for the other.

A `kind: 'list'` draft is still a draft — same index, same drafts modal,
same autosave — with a `LiquidBoard` under `DraftBody.liquid` in place of
`layers`. The three prose layers stay mounted underneath it rather than
being unmounted (same reasoning as hiding a page in a spread with CSS: a
contenteditable's `innerHTML` is what `scheduleSave` reads, and unmounting
it before the debounced save fires would silently save it empty), so
switching a draft's kind to and from `list` costs nothing either direction.
It doesn't publish: Echoes is for finished prose, and flattening a board of
lists into a letter isn't a well-defined operation yet, so the publish
button is replaced with a plain statement of that rather than pretending.

## the authoring brief

`packages/spellcraft` holds the prompt spec Z writes against — voice,
structure, etymology-as-semantic-drift, the metaphor sources, the standing
lenses, the conversions, the reading-list rule. **Nothing here calls a model.**
The human carries the prompt out and the answer back, which is what keeps every
app in this workspace backend-free.

It used to carry two output contracts — a complete standalone page for
Ologypedia's studio, a body fragment with `[[wikilinks]]` for Spores' Garden —
because what varied between callers was only **what shape the answer came
back in**. Both apps retired into Write (see "the writing surface" above and
CONVERGENCE.md), and the brief came with them rather than going down with
either: `fragment` is now Write's own **draft it with a prompt** gesture
(`DraftPromptModal.svelte`), asking for plain prose rather than a document or
bracketed links, because that's what a draft's foreground layer already is.
`page` had exactly one consumer and that consumer is gone, so it wasn't
ported — the contract type is just `'fragment'` now.

`ingestDraft` takes the answer back in whatever shape it arrives — fenced,
HTML, markdown, or plain — and reduces it to the plain text `textToHtml`
turns into paragraphs. It takes `htmlToText` as an argument rather than
importing it, so the package needs no DOM.

Like `@woodles/app-manifest` and `@woodles/text`, this ships browser-ready
`.js` with a `.d.ts` sidecar, same shape as those two — not because anything
static consumes it today, but because nothing about the package needs a
build step either.

Thinking About's structured-record system (`apps/thinking-about/src/lib/
spells/`, see "the board" below) is a different tool with a similar shape —
Spores' curated category schemas and JSON-skeleton-prompt technique, not
Z's essay brief — and does not use this package. The two authoring pipelines
were always separate; only one of them is `@woodles/spellcraft`.

## the handoff spine

A third spine, alongside sync and the public read path, and the smallest of the
three: **moving one thought from the app that caught it to the app that can do
something with it.** The problem it exists for is written up in
[CONVERGENCE.md](./CONVERGENCE.md) §3 — four apps accept "a title and some
words", nothing routes between them, so the app you picked at capture time is
the app it stays in forever.

**`packages/handoff` (`@woodles/handoff`)** — `createHandoffQueue(target)` over
one versioned localStorage document per target (`woodles.handoff.<target>.v1`).
`write` is now the only app that can receive: `notebook` left the target list
when it retired into Write, and `spores` left it the same way when it retired
into Write in turn, so there is nothing left to route *between* — the handoff
spine still exists for whatever catches a thought next. Read-only surfaces
(echoes) are not targets. `send()`
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

**the receiver** drains on load and announces it once: `write` gives each
arrival its own draft (tags carried onto the index) and opens the newest.
HTML bodies run through `sanitizeHtml` — a body may be model output from
another app entirely, and write's drafts can reach the public publish path.

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
`BestiaryBlob`, `DevlogBlob`, `ThinkingAboutBlob`); `write()` calls
the store's `rehydrate()`; `isNewer` is optionally provided (`bestiary` and
`thinking-about` use it). Carillon's file is deliberately larger because it
owns the merge described above and coalesces queued instrument writes before
flushing. `marginalia` still has none of this — it never syncs privately.
`write`'s adapter used to be a pair of no-ops that existed only to borrow the
passphrase handling for a public publish. Echoes is private now, so it syncs
something real: **the archive** of finished letters, under app key `write`,
newest-archive-wins by the most recent `publishedAt`. Drafts stay out — they
are working state, already per-device, and an archive is a different thing
from a desk. Connecting the passphrase once, in any app, still connects it
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

The mechanics are shared: `createLedgerPublisher(app, matches)`,
`mirrorLedgerLocally`, `readLocalLedger` and `pullLedger` in
`packages/sync/src/ledger.ts`. Extracted when the second ledger needed the
identical version cache, deduplication and single retry — the workspace's
habit is to duplicate until two copies converge and then extract, and there
was nothing left to learn from writing it twice. What stays app-side is only
what differs: the key, and what counts as a change.

**Write publishes the archive.** The one shape here that is not a projection:
it is Write's own blob (`WriteArchiveBlob`, app key `write`, localStorage
`woodles_letters`), with the shape written down in `crossAppBlobs.ts` so
Echoes and Marginalia's reading room depend on a contract rather than on
Write's internals. That's the relationship bloomforge-player has to the
studio's project data, and Write is still the only writer. `apps/letter` is a
static page with no build step, so it hand-rolls the same request; a test in
`packages/sync` pins its key, app name and auth header against the constants,
and fails if it reaches for `/api/public` again.

**Thinking About publishes the shelf** — active,
titled entries as `{ id, title, columnKey, sectionKey, color, lastSessionDate }`
under sync key `thinking-about-shelf` and localStorage key
`thinking-about.shelf.v1`. Notes, session logs and archive state stay private.
Carillon reads it into the task composer, where picking one seeds the title and
stores `Task.thinkingAboutEntryId` — a *reference*, so a rename over there
can't leave the planner lying, and so a later observation on that block knows
exactly which entry it was.

It republishes **on load as well as on save**, which is not redundant: a
derived ledger means a board nobody has edited since this shipped holds entries
and no shelf at all, and the reader would then honestly report an empty picker
for a board plainly full of things. Publishing on mount is the migration, and
also repairs a shelf left by an older format.

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

**Carillon publishes commitments** — the answer to the shelf, and the reason
the one-writer rule earns its keep: rather than Carillon writing into Thinking
About's store, it publishes `{ entryId, taskId, title, date, time, blockTitle,
status }` under sync key `planner-commitments` and localStorage key
`planner.commitments.v1`, and Thinking About reads it. Each app still owns
everything it writes. Domains, notes, durations and day piles stay in Carillon
— a board about what you're reading has no use for them — and a `dropped` task
is filtered out rather than published, because "a thing you decided not to do"
is not an answer to "when am I doing this". An entry's detail then shows what's
scheduled and offers "find another time" instead of "find time for this".

**Carillon publishes sittings** — the third ledger, and the one that makes the
pair better than either alone. A Thinking About session carries a date and no
clock, and its one-tap log always means *today*, so "I read for an hour on
Sunday" could not be said on Tuesday. Carillon knows which day an observation
was about — including a stretch recalled days later through the catch-up card
— so a sitting logged from there lands on the day it happened.

Marking an interval whose block holds a linked task **offers** a sitting; it
never converts one. An observation is a fact about the day, and turning every
one into a session would be the instrument deciding on someone's behalf,
which is the stance it refuses everywhere else. One sitting per entry per day
(`session-<entryId>-<date>`), because a sitting is not a fifteen-minute sample
— eight bells across a reading evening are one sitting, not eight.

It stays a projection rather than a queue: a queue must be emptied by its
reader, and a reader that writes is what the one-writer rule forbids. Instead
Thinking About creates its session under the ledger's own id, so re-reading
can't double-log, and records which ids it has taken (`ingestedSittings`, in
its synced blob) so a deleted sitting stays deleted rather than returning on
the next load.

**Standing slots reach the calendar.** A Thinking About entry on the playing
or watching columns can carry an optional `standing` slot — weekdays plus a
time — beside its freeform `schedule` text. It rides the shelf, and Carillon
**derives** overlay blocks from it in `getBlocksForDate` (`overlay: 'standing'`,
id `ta-<entryId>`), so a Thursday watch date appears on the calendar with
nothing stored twice and no obligation created by hand. The freeform text is
never parsed into the slot: guessing "Tuesdays after work" wrong is worse than
leaving it as the note somebody wrote. `sequenceDayPile()` cannot reorder these
by construction — it only ever touches a pile's own blocks, and these are
synthesized on read.

All three ledgers rebuild on every write to their source (`#saveTasks`,
`#saveLoggedSessions`, `#persist`) and on load, for the reason under the shelf
above.

**Write publishes what it wrote about.** The edge that closes the loop:
`#` reaches a thing you're thinking about and `@` reaches a day, both stored
in the prose as `<a data-ref-*>` with **the words you typed as the element's
own text**. Strip the attributes and a sentence is still a sentence, which is
why a reference whose target is gone reads as prose rather than breaking — the
same asymmetry a Carillon task has with its title. `@woodles/text` owns the
vocabulary (`referenceHtml`, `readReferences`, `REFERENCE_SANITIZE_OPTIONS`)
because sanitizing is where it has to be understood, and because `apps/letter`
can import that package directly. Write binds the sanitize option once in
`htmlTools.ts` rather than at each call site — one site forgetting would
silently eat a reference on save.

The `write-mentions` ledger is derived from the archive by reading each
letter's own prose, so Carillon's Edition Review can show *"written about"*
beside a day's observations and Thinking About can show it beside an entry's
sittings. Pickers read from a **source registry** (`references.svelte.ts`)
rather than one source each: Thinking About entries and days today, and a
bestiary card is a few lines away now that `?card=` is addressable.

**The link runs both ways.** Each app declares itself addressable in the
manifest (see "the app manifest" above): Thinking About by `entry`, Carillon by
`thinking-about-entry` — a *foreign* record kind, which is the honest name for
it. Thinking About's entry detail carries "find time for this"; Carillon
answers by showing **what it already has scheduled** for that entry, offering
to add another time as a deliberate second step rather than opening a blank
form over a thing that is already on Thursday. Both apps read the parameter
once on load and then take it out of the address bar (`history.replaceState`),
so a reload lands on the app rather than re-enacting the visit. A reference to
an entry that has been archived, deleted, or simply not synced to this device
goes **cold**: the arrival still shows the tasks and says so, because the words
someone typed outlive the link.

See [REFERENCES.md](./REFERENCES.md), whose steps 2–4 this is.

**Landing publishes Life Points** — the first currency here, and the one
ledger whose shapes live outside `crossAppBlobs.ts`. Minted by the landing
page's screensaver: a break is time deliberately spent *away*, and Life Points
are what that time is worth. One point per whole minute, plus half the planned
length as a bonus for seeing a break through — the only lever that tells a
break from an interruption. Nothing rewards using an app harder.

It sits in **`@woodles/life-points`** rather than with the other ledgers for
the reason that put them there. `apps/landing` is a static page with no build
step and cannot import TypeScript, so a shape defined in `crossAppBlobs.ts`
would leave the *writer* hand-rolling the keys and the earning formula, pinned
by a test — the drift that file exists to prevent. Plain `.js` with a `.d.ts`
sidecar, the shape `@woodles/spellcraft` documents for exactly this case, means
the static writer and every built reader import one file and there is no second
copy. A comment in `crossAppBlobs.ts` points at it.

Both rules still hold, via a split. A currency is **authoritative** — throw it
away and it is gone, so there is no source to rebuild it from, and "derived,
never authoritative" would be a lie rather than an exception. So there are two
stores: the **wallet** (`woodles-life-points`), landing's own private record of
every break, which only landing touches; and the **ledger**
(`landing.lifePoints.v1`, sync key `landing-life-points`), a narrow projection
of it — totals, rank, the last twelve breaks — republished on every change and
safe to throw away. Readers get the ledger.

Minutes are credited **as they pass** rather than banked until the end: a
browser that dies twenty minutes into a walk should not cost the walk. Only the
completion bonus waits, because finishing is the only thing it is about. A
running break is never persisted, so a reload ends it — and keeps the minutes
already earned, which were genuinely spent.

Spending inverts the same way Carillon answers the shelf: an app that spends
does **not** write to landing's ledger, it publishes what it took under its own
key (`lifePointsSpendApp('marginalia')` → `marginalia-life-spend`), and
`lifePointsBalance` is the difference, floored at zero so a spend that reaches a
device before the earnings cannot show a negative wallet. Nothing spends yet;
the shape is settled because the one-writer rule decides it, and it is easier
to decide once. The landing page reads the balance back through the same helper
with an empty spender list, so the call site is already right.

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
`BestiaryPublicBlob` (`PublicCreature[]`). each publish is a curated,
explicit subset of what's stored privately — never a mirror of it. a creature
publishes exactly two assets (the rendered card image, and the isolated
sprite, or the plain upload as a fallback).

**echoes left this spine.** nobody was reading the public version, and the
part that worked — an archive you re-read, annotate and edit — is the
opposite of publishing. it shows nothing until a passphrase is connected, and
that is the intent rather than a cost: the archive stays shut until it knows
you. its letters moved onto the ordinary passphrase-gated
sync as `write`'s own blob (see "the archive" above), and `EchoesPublicBlob`,
`ECHOES_PUBLIC_SLUG`, `PublicLetter` and write's `publish.ts` are gone along
with the per-letter `public` opt-in. **bestiary is now the only tenant of
`/api/public`**, and nothing about its half changed — the 4 MB cap, the cache
headers and the `authed()` split all still matter for it.

**who publishes what, and who only ever reads:**

| app | publishes | reads (unauthenticated) |
| --- | --- | --- |
| `bestiary` | curated creatures, via `SyncPanel`'s publish section | its own gallery (`gallery.svelte.ts`) |
| `letter` | nothing (static, no editor) | nothing public any more — it reads the passphrase-gated archive instead |
| `marginalia` | nothing | the bestiary's creatures (diorama binding, `bestiaryDb.ts`). its reading room still reads letters, but authenticated now, from the archive |

every reader degrades the same way — `idle → loading → ready/empty →
error`, never a blank crash on a slow network or a down API. `bestiary`'s
`gallery.svelte.ts` and marginalia's `echoesLibrary.svelte.ts` share that
shape on purpose; `letter/index.html`'s hand-rolled fetch (a static page,
no `@woodles/sync` import possible in the browser) and `bestiaryDb.ts`'s
IndexedDB-backed fallback chain land in the same place by different means.

## shared design tokens

the design system is shared at the lowest level only, and not by every app.

**`shared/palette.css`** defines fifteen themes — `cream`, `dawn`, `dusk`,
`midnight`, `forest`, `terracotta`, `inkwell`, `typewriter`, `paper`,
`blossom`, `sugar`, `fog`, `glacier`, `signal`, `amber` — as CSS
custom properties, switched by setting `data-theme="<id>"`. all fifteen are
registered in `shared/library.js`'s `palettes` array, so every picker (Hygge,
Write, the `?palette=` handoff) can reach all of them — `blossom` and `sugar`
existed in this file but weren't registered for a while; that's fixed. role
tokens
(`--bg`, `--text`, `--accent`, `--rule`, …) carry the same meaning through every
theme, and concrete color names (`--lavender`, `--aqua`, `--peach`, `--lilac`,
`--plum`, `--lapis`, `--cream`) stay stable across them. `write` and the static
apps consume this.

the other four SvelteKit apps with a house style don't. each ships its own
token file under
`src/lib/style/tokens.css`, namespaced so it never leaks: `marginalia`
redefines the bare names under `.marginalia-root`, `planner` uses `--p-*`
for its inner surfaces and `--car-*` for the Carillon shell, `bestiary` uses
`--b-*`, and `thinking-about` uses `--ta-*` under
`.thinking-about-root`. `data-theme` and the eleven shared themes don't reach
any of them; they own their own look.

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

1832 tests total: 16 in `api/` (its own
root-level `vitest.config.ts`, covering `public.ts` and `sync.ts` — the one
part of the workspace that isn't a pnpm package, so it needs its own runner
instead of the recursive `pnpm -r test`), plus 1816 across sixteen pnpm
packages — `write` 223, `marginalia` 333, `planner` 539,
`bestiary` 162, `bloomforge` 83, `bloomforge-player` 22,
`packages/sync` 36, `packages/persistence` 6, `packages/app-manifest` 17,
`packages/handoff` 14, `packages/text` 30, `packages/spellcraft` 15,
`packages/emoji` 4, `packages/incremental-core` 191, `thinking-about` 131,
and `whiteboard` 10.
(Counted by running each suite, not by adding to the previous figure — keep
this inventory current when a suite changes; the root command is the release
contract, not the prose count.)
(Spores' 140 retired with the app. Write's suite grew by 28 — `sporesImport.ts`
(14), `backlinks.ts` (7), `status.ts` (7) — for the pieces of it that moved in;
Thinking About's grew by 13 for the spell registry's assembler and parser;
`packages/handoff` dropped one now-inapplicable test (a two-target isolation
check with only one target left); `packages/spellcraft` dropped one test for
the retired `page` contract. Write's suite grew a further 53 for Liquid —
all in `liquid.ts`'s pure tree logic, including the regression test for the
before/after-a-later-sibling indexing bug `moveItemRelativeTo` exists to
avoid; the drag-and-drop wiring and the keyboard shortcuts in `Liquid.svelte`
and `LiquidNode.svelte` are exercised by hand rather than by a unit suite —
no `.test.ts` for either, same as every other view-only Svelte component in
this app.)

each app's `test` runs `svelte-kit sync && vitest run`. the `sync` matters: a
SvelteKit app's `tsconfig.json` extends `./.svelte-kit/tsconfig.json`, which
`svelte-kit sync` generates — run `vitest` without it on a fresh clone and it
can't resolve the tsconfig. because the scripts sync first, `pnpm test` works
straight from a clean checkout.

`write` and `marginalia` load the workspace-level
`vitest.setup.ts` to install a browser-like in-memory `localStorage` under
Node. planner keeps its own localStorage mock in `store.test.ts`; under the
current Node runtime that suite passes but may still print a
`--localstorage-file` warning.

`thinking-about` gained the SvelteKit plugin in its `vitest.config.ts` for the
same reason, when its commitments reader became the app's first rune module
worth testing directly.

`planner`'s `vitest.config.ts` loads the SvelteKit plugin, and it has to:
`planner`'s store is a `.svelte.ts` module that uses `$state`, instantiated at
import time, and without the plugin compiling it vitest throws `$state is not
defined`. the apps that test rune modules either inherit the plugin from
`vite.config.ts` or don't construct a rune store at import. planner's sharp edges
are written up in [apps/planner/KNOWN_ISSUES.md](./apps/planner/KNOWN_ISSUES.md).

### browser integration tests

`e2e/` is the deliberately small Playwright layer above the unit suites. Its
local server reads `vercel.json` and applies the production rewrites, so route
coverage tests the paths people actually visit instead of seven unrelated Vite
ports. The suite covers every published entry route, Write → Echoes archiving,
Bestiary gallery/adopt/share and Marginalia consumption, an Arcade state change,
the Thinking About → Carillon round trip, back, and the sitting that returns
from it, legacy localStorage migration across reload,
keyboard operation, and serious/critical WCAG A axe findings.

The cross-app specs earn their cost in a way the route checks don't. The
Carillon ↔ Thinking About one caught a bug no unit test could have: the shelf
ledger is derived on save, so a board nobody had edited since the feature
shipped had entries and no shelf, and the picker read empty for a board full of
things. Both halves were individually correct — one about what it wrote, the
other about what it read — and still failed to meet. Keep an integration spec
per ledger for that reason. It stubs third-party webfonts with an empty 200
rather than aborting them, since an abort is itself a failed request and would
trip `expectNoPageErrors` on noise unrelated to the apps.

Run it after installing Chromium once on the machine:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` builds all SvelteKit apps first.

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
pnpm test               api/'s own vitest, then every pnpm package with a test script (1832 tests)
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
