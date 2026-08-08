# references — one thing, many renderings

carillon and thinking about hold two halves of the same evening. thinking
about knows *what* you sat down with and nothing about when; carillon knows
*when* you were doing something and nothing about what. connecting them is
the immediate goal, but the mechanism they need — **a record in one app
pointing at a record in another, without copying it** — is something this
workspace has now built three times, three different ways, and never named.

this file names it, surveys what already exists, and proposes the smallest
spine that serves the whole repo rather than just this one pair.

**status: steps 1–4 built, steps 5–6 proposed.** two of §3's rows are
answered: the ledgers ride `api/sync.ts` *and* localStorage, and a cold
reference goes cold rather than being dropped. the rest are still open.
read alongside [ARCHITECTURE.md](./ARCHITECTURE.md) for how
the apps are actually wired and [CONVERGENCE.md](./CONVERGENCE.md) for why
five text surfaces became two — this file is that document's mirror image.
convergence was about apps that should have been one app. this is about apps
that should stay separate and learn each other's names.

---

## 1. what the workspace already does

identity-across-renderings is not new here. it exists in four distinct
shapes, none of which knows about the others.

### A. shared key names, one app reads another's live store

`bloomforge` → `bloomforge-player`. the studio's "play it" opens
`/play?game=<project id>` (`apps/bloomforge/src/routes/+page.svelte:198`) and
the player reads the same localStorage the studio wrote. the key names and
blob shapes live in `packages/incremental-core/src/library.ts:11`
(`PROJECT_INDEX_KEY`, `projectKey(id)`) — deliberately in neither app, which
ARCHITECTURE names outright as the thing that stops the two drifting.

this is the closest existing thing to what carillon and thinking about need,
and **the only place in the workspace that hands an identity across in a
URL**. it is also the only one of the four with a real handover gesture
rather than a background read.

### B. a stored reference map, resolved against a pool that may not be there

`marginalia` → `bestiary`. marginalia stores
`spriteBindings: Record<lifeId, creatureId>` (`book.svelte.ts:287`) — a map
from its own records into bestiary's id space, persisted in the book save.
those ids resolve against `worldCreatures`, a pool that unions the local
IndexedDB creatures with the *published* gallery snapshot
(`witch/bestiaryDb.ts:129`), refreshed on focus, guarded against overlapping
refreshes by a sequence number.

the part worth stealing is the cleanup: a binding whose target no longer
resolves is **dropped**, and the drop is deliberate rather than incidental
(`book.svelte.ts:303`). a reference into a store you do not own is a
reference that can go stale, and the app that holds it owns deciding what
stale means.

marginalia is more nuanced about that than "drop it" suggests, and the nuance
supports §3's leaning: `resetIdleProgress()` (`book.svelte.ts:942`) wipes the
game and deliberately carries `spriteBindings` across intact. an unresolvable
binding goes, but the map itself outlives the state around it — it is treated
as something the person built, not as derived cache.

### C. identity carried across the private → public boundary

`packages/sync/src/publicBlobs.ts`. `PublicCreature` and `PublicLetter` each
keep the private record's `id`, so a creature is the same creature whether
it's in bestiary's IndexedDB, in the published gallery blob, or bound into
marginalia's diorama. the slugs those snapshots live under are shared
constants (`BESTIARY_PUBLIC_SLUG`, `ECHOES_PUBLIC_SLUG`) precisely so no
consumer hardcodes the string separately.

carillon already has a private version of this: `buildEchoesExport()`
(`apps/planner/src/lib/instrument.ts:286`) emits the `carillon-spores` v1
ledger, which ARCHITECTURE describes as "the narrow surface Echoes can
consume without importing Carillon's private planner blob." **that sentence
is the design principle this whole file is an application of.**

### D. identity by derived key, deliberately not by stored id

spores resolves `[[wikilinks]]` by `normalizeTitle` (`wikilinks.ts:38`), not
by id, and ologypedia's shelf dedupes by slug with an explicit precedence
order — published page beats textbook entry beats studio draft
(`apps/ologypedia/index.html:367`).

this is the deliberate counter-example, and it matters for §3: spores chose a
*breakable* link on purpose. a rename turns inbound links red rather than
silently rewriting text a person wrote, and that choice is pinned by a test.
not every reference should survive its target changing.

### the cross-cutting habit: deterministic ids

`observation-<date>@<startTime>`, `carillon-spore-<id>`, `sleep-<date>`,
practice ids of routine-plus-date, write's `d-nb-<capture id>` for an
imported notebook capture. identity computed from content rather than
minted, so two devices — or two runs of the same migration — cannot
manufacture a duplicate. any new reference should be able to lean on this
rather than invent a registry.

---

## 2. the three gaps

### 2.1 nothing deep-links to a record

`primaryDestination(app)` (`packages/app-manifest/src/index.js:292`) returns
an app's entry file. the manifest owns every app's `publicPath` and aliases.
but there is no vocabulary anywhere for "open *this specific thing* in that
app," and the two places that try, hardcode it: bloomforge writes the literal
string `/play?game=` rather than resolving `bloomforge-player`'s publicPath
through the manifest that owns it, and marginalia's `#reading-room` check
(`+page.svelte:38`) is the only hash handling in the entire workspace.

neither carillon nor thinking about reads a URL parameter at all. thinking
about's `view` and `activeEntryId` are explicitly transient — "never
persisted, always starts on the board."

**this is the actual missing piece, and it is a workspace-level gap rather
than a carillon↔thinking-about one.** it is also the gesture the google-suite
feel depends on entirely: moving from inbox to calendar to drive is nothing
but following a link to a specific thing.

### 2.2 the field for it already exists, unused

`HandoffSource` (`packages/handoff/src/index.ts`) carries
`{ app, label?, href? }`. `href` is documented as "optional deep link back to
where it came from." it is populated in exactly one place in the workspace —
`apps/spores/src/lib/garden.svelte.ts:626` — with the hardcoded string
`'/spores'`, which is the app root, not the spore.

the need was anticipated when the handoff spine was designed and never built
out. that is a strong signal about what to build, and a warning about how
easy it is to leave a link field pointing at nothing in particular.

### 2.3 every cross-app read is bespoke

four mechanisms, no shared contract: shared key constants (bloomforge), a
hand-rolled IndexedDB module with a public-API fallback chain (marginalia),
one-off flagged importers reading a retired app's keys (write, carillon,
spores), and the handoff queue. the importers are genuinely one-shot and
should stay that way. the other three are live reads and have converged more
than they look.

---

## 3. the decisions — open

| question | options | leaning |
| --- | --- | --- |
| does a carillon task pointing at an archived/deleted thinking-about entry go cold, or get dropped? | marginalia **drops** stale bindings (§1B); spores lets links go **red** (§1D) | **decided: cold, not dropped** — a sprite binding with no sprite renders nothing, so dropping is right there; a scheduled task still holds words you typed, so it keeps its own title and loses only the link. built in step 3: the arrival still lists the tasks and says the entry isn't on the shelf any more |
| does observing a linked block log a thinking-about session, or offer to? | auto / offer | **offer** — carillon's stated stance is that nudges are suggestions, never actions taken on your behalf |
| do the ledgers ride sync, or stay same-origin localStorage? | localStorage only / through `api/sync.ts` | **decided: sync** — and it turned out to be *both*, not either. localStorage stays the fast path on one device and the server carries the ledger to the next, which is the same local-first shape the rest of the workspace already has. this also answers CONVERGENCE.md §6.4 for ledgers, though not for handoff queues, which remain same-origin |
| does thinking about's freeform `schedule` gain structure? | keep freeform / optional weekday+time | **optional structure, freeform preserved** — it's what lets a standing thursday watch date render on the calendar |
| who owns the link record? | carillon's task / thinking about's entry / a third store | **carillon's task** — "i scheduled this" is carillon's sentence; thinking about should not grow a field about time |
| extract a reference package now, or build it locally first? | package / local | **split — see §4.3** |

---

## 4. the design

### 4.1 the reference

a thinking-about entry id becomes the shared identity. carillon's `Task`
gains one optional field, `thinkingAboutEntryId`. that is the entire
connection; everything below is a surface built on it.

it must be a reference rather than a copied title, for the same reason
marginalia stores a `creatureId` rather than a sprite: rename the book in
thinking about and the planner follows instead of lying, archive it and
carillon can stop offering it without deleting anything, and — the part that
actually matters — **marking a block observed tells carillon exactly which
entry it was**, so the session it offers to log is precise rather than
matched by date.

`Task` is already optional-tolerant through sync (`mergeById` with
`latestMutable`), so an older blob missing the field hydrates unchanged.

### 4.2 two ledgers, one writer each

neither app reads the other's private store. each publishes a narrow
versioned ledger — pattern §1C, the one this repo already argues for in
prose.

- **thinking about publishes the shelf**: active entries, as id, title,
  column, section, color, last session date. enough for carillon to offer a
  picker and render a chip; nothing about time.
- **carillon publishes commitments**: for each task or block carrying an
  entry reference, the entryId, date, time and status. enough for thinking
  about to say "next: thursday 20:00"; nothing about the plan around it.

one writer per store means no write conflicts and no third source of truth.
it also means the loop-closing gesture (§4.4, item 4) cannot have carillon
writing into `thinking-about.entries.v1` directly — thinking about's
whole-blob `isNewer` sync would be free to clobber a foreign write on its
next push. carillon queues; thinking about drains on load and dedupes on id,
the same drain-on-load shape already proven three times here.

`@woodles/handoff` is the wrong vehicle despite the resemblance: its envelope
is `{ title, body, format, tags }`, thought-shaped rather than event-shaped,
and its targets are the apps that receive *words*. this is a sibling queue,
not a reuse.

### 4.3 destinations — the part worth extracting now

the repo's rule is duplicate until two copies converge, then extract, and
premature sharing freezes an API before the copies have stopped moving. that
rule cuts two ways here, so this proposal splits:

**extract now: the destination vocabulary.** something small enough to state
in a sentence — given an app id, a record kind and a record id, produce the
URL that opens it — resolving through `appById`/`publicPath` rather than
hardcoding paths. it belongs in `@woodles/app-manifest`, which already owns
every app's public path and aliases and already has a contract test suite
that fails when a route drifts. it has three consumers on day one: the two
new surfaces below, bloomforge's `/play?game=` (which should stop
hardcoding), and `HandoffSource.href`, which finally gets to mean something —
"sent from *this spore*" becomes clickable in write.

**do not extract yet: the reference-resolution mechanics.** the pool, the
refresh, the stale-target cleanup. carillon↔thinking-about would be the
*second* copy of marginalia↔bestiary's binding pattern, not the third. build
it locally in carillon, deliberately shaped like marginalia's so the seams
line up, and let a third consumer force the extraction — the way
`@woodles/text` waited for five copies and a converged contract.

### 4.4 the four surfaces

1. **carillon pulls in what you're engaging with.** a strip of thinking
   about's active shelf, grouped by column, in the composer or the today
   dock. tapping one calls `startCompose({ title, thinkingAboutEntryId })`.
   `startCompose` (`store.svelte.ts:328`) already accepts a `Partial<Task>`;
   `TaskEditDrawer` currently blanks the title in composing mode
   (`localTitle = ''`), so honoring a supplied title is a one-line change.

2. **thinking about sends you to find time.** on `EntryDetail`, a control
   that opens carillon's composer on that entry, through §4.3's destination
   rather than a hardcoded path. new work in both apps: neither reads a URL
   parameter today.

3. **the return trip.** thinking about's entry detail renders the commitments
   ledger inline. without this it is a one-way export and will not feel
   connected — this is the surface that makes it drive-showing-you-the-event
   rather than an import button.

4. **the loop closes.** observing an interval whose block carries an entry
   reference offers to log the thinking-about session. this is the only part
   that makes the pair better than either alone: **carillon's clock supplies
   the `when` a thinking-about session has never had** — `Session` is
   `{ id, date, note }`, no time, no duration.

### 4.5 the schedule overlay

once entries are referenceable, thinking about's `schedule` (freeform, only
meaningful on playing/watching) can gain optional weekday+time structure, and
carillon can *derive* obligation-shaped overlay blocks from it — a standing
thursday watch date appearing on the calendar with nothing stored twice and
no obligation created by hand. the existing invariant that
`sequenceDayPile()` never reorders obligations and rituals already covers the
derived blocks.

this is the piece that most directly answers "from thinking about, find the
time to prioritize the things i care about."

---

## 5. the staged plan

each step ships something usable and nothing depends on finishing the next.

| # | step | size | unblocks |
| --- | --- | --- | --- |
| 1 | ✅ **destinations in `@woodles/app-manifest`.** app id + kind + record id → URL, with contract tests beside the existing route tests. rewired bloomforge's hardcoded `/play?game=`. | ~half a day | everything below, plus `HandoffSource.href` finally meaning something |
| 2 | ✅ **thinking about publishes the shelf**, and carillon reads it into a picker on the composer. the "pull it in" half. | ~1–2 days | the reference exists and is useful before any deep link works |
| 3 | ✅ **deep links both ways** — thinking about opens on `?entry=`, carillon on `?thinking-about-entry=`, both over step 1's destinations. *not* `compose=`: that named an action rather than a record, which the addressing vocabulary doesn't model. arriving shows what's already scheduled. | ~1 day | the navigation feel; the thing the google-suite comparison is actually about |
| 4 | ✅ **carillon publishes commitments**, thinking about renders them in entry detail. the return trip. | ~1 day | the connection stops being one-way |
| 5 | **session logging from an observation**, via a queue carillon writes and thinking about drains. | ~1 day | the loop; the clock finally reaches the sessions |
| 6 | **structured `schedule` → derived overlay.** | ~1–2 days | standing dates land on the calendar |

if only one thing gets done: **steps 1 and 2.** step 1 is the workspace-level
gap and pays for itself across three existing consumers; step 2 is the
smallest version of the thing that started this.

---

## 6. what this deliberately does not do

- **no eighth `IntervalKind`.** `sporeStats` has a fixed seven-key record,
  echo's seven visible traits each bind to a body part via `echoPart`, and
  the print sheet and edition review both key off the list — against a
  486-test suite. `elsewhere` plus a label already carries a title, and
  `CatchUp`'s custom-label path already does exactly this.
- **no spores from a thinking-about session.** one honest observation makes
  one spore; a linked observation is still one observation. the recall design
  already guards against backfilling out-earning live sampling and this must
  not reopen it.
- **no merged blob.** the two apps sync under separate app keys with
  genuinely different merge strategies — thinking about uses whole-blob
  `isNewer`, carillon a per-collection deterministic merge — and merging
  would hand thinking about carillon's merge complexity for nothing.
- **no shared look.** ARCHITECTURE documents thinking about's white/thin-rule
  departure from its siblings as deliberate. a connection is not a re-skin.
- **no new capture inbox.** CONVERGENCE spent eight steps removing the
  routing tax; a reference between two existing records is not a fifth place
  to put a thought.

---

## 6a. what step 3 turned up

two things worth recording, because neither was visible from the plan.

**`compose=` was the wrong name.** §4.4 originally had thinking about linking
to `/planner?compose=<entryId>`. that doesn't fit step 1's vocabulary at all:
`?<kind>=<id>` addresses *a record an app is addressable by*, and `compose`
names an action. carillon is now addressable by `thinking-about-entry` — a
foreign record kind, which is the honest description — and what it does on
arrival is carillon's business rather than something the URL dictates.

**a derived ledger needs publishing on load, not only on save.** the e2e round
trip caught this and nothing else would have: a board nobody has edited since
step 2 shipped holds entries and no shelf, so the picker reads empty for a
board plainly full of things. every unit test passed throughout — each half
was correct about what it wrote and what it read, and the two still failed to
meet. that is the specific failure mode a cross-app integration test exists
for, and the argument for keeping one per ledger as steps 4–6 add them.

## 6b. what step 4 settled

**the "one writer" rule paid for itself.** the obvious way to show a
scheduled time on the board is for carillon to write into thinking about's
store. it publishes a second ledger instead, in the opposite direction, and
thinking about reads it — so neither app ever writes where it isn't the
owner, and thinking about's whole-blob `isNewer` sync can't clobber a foreign
write on its next push. the rule was written in step 2 on principle; step 4
is the case it was for.

**the mechanics extracted, the readers didn't.** writing the version cache,
the deduplication and the single retry a second time would have taught
nothing, so `createLedgerPublisher` moved into `@woodles/sync` — the second
consumer earning the extraction, exactly as §4.3 predicted for the mechanics
it *declined* to extract early. the readers stayed app-side: they are `$state`
rune classes, which can't live in a plain TS package, and only their
non-reactive halves (`readLocalLedger`, `pullLedger`) were worth sharing.

## 7. risks

- **sync skew is the real one.** two blobs, two merge strategies, no ordering
  guarantee. every surface has to degrade to "no ledger yet" rather than show
  something wrong, and §3's open sync question decides how often that state is
  visible. marginalia's `getPublishedCreatures()` already models the honest
  version of this: never throws, falls back to cache, and an empty pool reads
  the same as "nothing published."
- **a link field that points at nothing in particular.** `HandoffSource.href`
  is the cautionary tale in-repo — a reference vocabulary is only worth
  building if the destinations resolve through the manifest that owns them.
- **overlapping refreshes.** marginalia needed a sequence guard because mount
  and focus both fire; a carillon picker reading a shelf on the same triggers
  will need the same, and the failure mode there was silently wiping live
  bindings.
- **scope creep into a general entity graph.** the temptation, once two apps
  can point at each other, is to make everything point at everything. §4.3's
  split is the guard: extract the addressing, leave the mechanics local until
  a third consumer earns them.
