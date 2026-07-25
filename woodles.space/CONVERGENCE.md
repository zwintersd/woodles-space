# convergence — spores, notebook, dev log, ologypedia, write

five surfaces in this workspace take text in and give text back. they were
built at different times for different reasons and none of them knows the
others exist. the symptom is not that they're broken — each one works — it's
that **choosing between them costs more than using any of them**, so none of
them gets used consistently.

this is a product-shape proposal, not a code-duplication log. the code-level
duplication log is [REFACTORING.md](./REFACTORING.md); this file is about what
the apps are *for*. read alongside [ARCHITECTURE.md](./ARCHITECTURE.md) for how
they're actually built.

**status: decided, and started.** option B below is the chosen shape — *one
knowledge base, one writing surface, one front door*. the six open questions
have been answered; see §0. §5 is the live plan, and marks what has shipped.

steps 0–2 are done: the landing page groups apps by the moment they're for
rather than listing sixteen peers, `@woodles/handoff` lets any app pass a
thought to any other instead of making you guess right the first time, and the
Dev Log has been folded into Spores and retired — **five surfaces are now
four.**

---

## 0. the decisions

| question | answer | consequence |
| --- | --- | --- |
| preserve dev log's chronological lens? | **no** | no dated view to port. the merge is a category pack, nothing more |
| move the devlog into marginalia? | **no** — makes Z nervous even if it's the tidier home | it goes into spores like everything else. marginalia stays a game |
| where do tasks belong? | **carillon** | notebook sheds tasks entirely and becomes captures-only |
| is ologypedia's self-containment worth keeping? | **no** — it was an invention Z liked, and it now lives as its own project outside this monorepo | the textbook can be absorbed without losing anything |
| which aesthetic wins? | **cream/rose/gold** | spores gets re-skinned. twilight webcore is deprioritized, not deleted |
| is write's flat drafts list a problem? | **unsure** | deferred. not in the plan; revisit after the editor extraction |

two of these change the plan materially. **tasks → carillon** means notebook
loses a third of its data model, which makes the "front door" simpler than
originally drafted. **cream/rose wins** means the knowledge-base merge carries a
re-skin of spores, not just a data migration — the surviving app wears the
absorbed app's clothes.

---

## 1. what each one actually is

stripped of its voice, here is the data model and the gesture each app owns.

### notebook — `/notebook` · sveltekit · growing

three modes over one localStorage document (`notebook.workspace.v2`):

| object | fields | organized by |
| --- | --- | --- |
| `Note` | title, body (plain textarea), tags[], created/updated | flat list, sorted by `updatedAt`, one search box |
| `NotebookTask` | title, status, priority, optional `noteId` | open / done |
| `Idea` | text, lane (`spark`/`shape`/`later`) | three lanes |

no links between notes. no sync. the **only** adopter of
`@woodles/persistence` among the five — versioned envelope, validation,
last-known-good recovery, export/import round trip. 14 tests.

### spores — `/spores` · sveltekit · growing

landing copy: *"a personal wikipedia, tended by hand."*

| object | fields |
| --- | --- |
| `Spore` | title, body (plain textarea), `data: Record<string, unknown>`, tags[], spellbookIds[], created/updated |
| `Spellbook` | title, archetype (`plain` / `diary` / `media` / custom) |
| `Flight` | from, to, optional label — a typed edge between two spores |

views: garden / spellbook / spore / tag / spell-wizard, plus a force graph
(`GraphRenderer.svelte`, 767 lines). **the spell system** is the interesting
part: `spells/registry.ts` holds twelve curated categories (author, musician,
filmmaker, actor, person, tv-series, film, book, album, game, anime-graph,
work) plus user-defined custom categories, each a schema of fields and child
levels. `assembler.ts` turns a chosen category into a prompt with a JSON
skeleton; `parser.ts` ingests the model's answer back into a `Spore`;
`promoteChild` turns any child record (an album, an episode) into its own spore
with a flight back to the parent. syncs via `@woodles/sync`. 46 tests.

### dev log — *retired, folded into spores (step 2)*

`/marginalia-devlog` now permanently redirects to `/spores`. what it was:

dated entries (`YYYY-MM-DD` + title) containing an ordered list of **typed
blocks**: `prose`, `creature`, `biome`, `ability`, `stat`, `minigame`, `lore`.
each non-prose block is a fixed form (a creature has lore fragment,
intervention behavior, visual notes, relationships…). `SmartLink` cross-
references another block by `{ kind, label }`. a font panel. syncs via
`@woodles/sync` under its own passphrase key. **no test script.**

scope: one subject — making marginalia's world.

### ologypedia — `/ologypedia` · static · growing

three surfaces in one directory, and the only one of the five that is really
three products:

1. **`index.html`** — the bookcase. cards for published pages, studio drafts,
   and textbook entries; search, subject filter, grid/spine toggle.
2. **`add-page.html`** — the studio. name a topic, get an assembled prompt,
   paste back a complete `textbook-{slug}.html`, preview it, download it;
   `scripts/publish.mjs` commits it into the deck.
3. **`textbook.html`** — the textbook. a personal, editable, interconnected
   reading room in one localStorage blob (`ologypedia-textbook-v1`). entries
   with HTML bodies, `<a class="entry-link">` cross-links with derived
   backlinks, a seed → growing → grown status, highlight-a-phrase-to-spawn-an-
   entry, wiki red-links, "draft it with a prompt" (topic → body fragment with
   `[[double brackets]]` that become linked seeds), import-from-studio, covers,
   focus mode, breadcrumbs, calm motion. no sync — export/import JSON is the
   stand-in.

### write — `/write` · sveltekit · **stable**

the letter editor, and by a distance the best text surface in the workspace: a
rich contenteditable with three composable layers (foreground / midground /
background), **pockets** (notes bound to a layer), **margin notes** anchored to
passages in the prose, a drafts index, theme / motif / font / template pickers,
and the public publish path to echoes. 65 tests.

organizationally it is a **flat list of drafts**. no tags, no links, no
collections.

---

## 2. the overlap, by job rather than by data

"they all hold text" is true and useless. the overlaps that matter are the
moments where two apps answer the same question.

### A. *capture a thought, right now* — four inboxes

notebook notes, notebook ideas, spores spores, dev log prose blocks. all four
accept "a title and some words," all four are the wrong answer some of the
time, and **you have to decide which before you can type**. that decision is
unanswerable at capture time, because whether a thought is a note, an idea, an
encyclopedia entry, or a devlog line is something you learn *later*, by what
happens to it.

nothing routes between them. a note that turns out to be an entry has to be
retyped.

### B. *build an interlinked personal knowledge base* — built twice

this is the big one. **spores and the ologypedia textbook are the same product.**

| | spores | ologypedia textbook |
| --- | --- | --- |
| unit | `Spore` (title, body, tags, data) | entry (title, HTML body, status) |
| links | `Flight` — explicit typed edges | `entry-link` anchors + derived backlinks |
| create-on-link | ✗ | ✓ (wiki red-links) |
| collections | spellbooks | the bookcase |
| overview | force graph, tag pages | grid / spine shelf, search, subject filter |
| body | plain textarea | sanitized HTML |
| lifecycle | none | seed → growing → grown |
| ai draft | spell wizard → JSON → parse | prompt sheet → fragment → `[[links]]` |
| sync | ✓ `@woodles/sync` | ✗ export/import JSON |
| tests | 46 | 0 (static, untestable as built) |

the tagline for one is "a personal wikipedia, tended by hand"; for the other,
"a textbook, grown one entry at a time." **each one has what the other is
missing**, and they cannot see each other's data.

### C. *ask a model for structured content and paste it back* — built three times

- `spores/src/lib/spells/` — registry → assembler → parser, in tested TS.
- `add-page.html`'s `buildPrompt()` — same idea, inline JS, output contract is
  a whole standalone HTML file.
- `textbook.html`'s draft sheet — the *same voice/structure/etymology/bridges/
  lenses/conversions/reading-list spec*, deliberately re-inlined, output
  contract is a body fragment with `[[brackets]]`.

the two ologypedia copies are duplicated on purpose (the self-contained-file
convention), which is a defensible call for the *page* files — but it means the
authoring spec now lives in three places and can silently drift in two of them.

### D. *write something long* — one good editor, four bad ones

write's contenteditable, layers, margin notes, and pockets are excellent, and
**nothing else can use any of it**. notebook and spores bodies are bare
`<textarea>`s. dev log prose blocks are their own thing. the textbook has a
third editor built inline.

meanwhile write, which has the best editing, has the worst organization — a
flat drafts list where every other app has tags, links, or collections.

### E. *typed records against a schema* — dev log is a spores category pack

dev log's seven block types are a hard-coded schema registry with a form per
type and a link type between them. spores' spell registry is a **data-driven,
user-extensible** schema registry with a form per category and a link type
(`Flight`) between records — and `Spellbook.archetype` already includes
`'diary'`, which is what a dated devlog *is*.

dev log is, structurally, one category pack and one diary spellbook that spores
could already hold. it has no tests and one subject.

### F. *annotate* — write and marginalia, nobody else

margin notes exist in write (204 lines) and marginalia's reading room (193),
already logged as diverged in REFACTORING.md. notebook, spores, and the
textbook can't annotate anything.

---

## 3. why they don't get used consistently

four causes, in descending order of how much they hurt.

**1. the routing tax.** every capture starts with a five-way decision that has
no cheap right answer and no cost to getting wrong *except* that the thought
ends up somewhere you won't look for it. the textbook's own design notes say it
was built low-friction for ADHD/autism specifically — seeds as a legitimate
finished state, breadcrumbs, forward-only status, one predictable page shape.
that care stops at the app boundary. **the workspace as a whole imposes exactly
the kind of upfront categorization decision that each app individually works
hard to remove.**

**2. no promotion path.** an idea can't become a note; a note can't become a
spore; a spore can't become a textbook entry; nothing can become a write draft.
so the initial guess is permanent, which makes the guess feel high-stakes,
which makes it harder — a loop that ends in not opening anything.

**3. split infrastructure.** three of the five sync (spores, dev log, write's
gating-only adapter); notebook and the textbook don't. one of five uses
`@woodles/persistence` (notebook). two have real test coverage. six different
localStorage key conventions (`spores.spores.v1`, `notebook.workspace.v2`,
`woodles_devlog`, `ologypedia-textbook-v1`, `ologypedia-studio-v1`, write's
`DRAFT_PREFIX` index). moving data between them is currently a manual JSON
export and a text editor.

**4. the landing page presents the decision.** five equal tiles at orders 2, 5,
8, 12, 13; write and notebook are default-pinned, spores, ologypedia and dev
log are not. the homepage's own information architecture says "these are five
peers, pick one," which is precisely the question that stalls.

### the counter-case, stated fairly

this is a personal playspace of hand-made things, and the five distinct looks
are *craft*, not accident — spores' and marginalia's tokens.css files name the
"twilight webcore" house style outright, ologypedia's cream/rose/gold is
deliberately its own, and thinking-about departs on purpose. consolidating
merges aesthetics as well as data, and some of the joy of this repo is that
each app got to be its own object.

so "merge everything" is the wrong instinct. the goal is to **remove the
routing decision without flattening the rooms.**

---

## 4. three options

### option A — connective tissue, keep all five

leave every app where it is. add:

- **one capture box**, reachable from anywhere, that always accepts text and
  files it later (a shared component + a shared inbox key).
- **promotion actions** — "send to spores", "open in write", "make an entry" —
  as one small `@woodles/handoff` package: a common `{ title, body, tags,
  source }` envelope written to a shared key that the target app drains on
  load.
- **one stated sentence per app**, in the manifest description and on the app
  itself, naming the *moment* it's for rather than the object it holds.
- **landing regrouped** into `capture · tend · write · read` bands instead of
  five peer tiles.

**cost:** small — one package, one component, five wiring changes, manifest
copy edits.
**buys:** kills the routing tax and the no-promotion-path problem, the two
biggest causes.
**doesn't fix:** spores and the textbook stay two knowledge bases; three prompt
pipelines stay three; write's editor stays unreachable; dev log stays untested.

### option B — converge to three products *(chosen)*

split by **what you're doing**, not by what the data is. three rooms, plus
ologypedia demoted from an app to an output format. amended below to match §0.

**1. one knowledge base — spores absorbs the textbook.**

spores keeps its engine (typed `data`, extensible categories, flights, tags,
graph, sync, 46 tests) and gains the textbook's *reading* experience:

- rich HTML bodies via the shared editor (see 3 below), replacing the textarea
- `[[wikilink]]` syntax that creates a seed spore on follow (red-links)
- derived backlinks alongside the existing explicit flights
- the seed → growing → grown lifecycle as a first-class spore field
- covers and a shelf view alongside the graph
- focus mode, breadcrumbs, calm-motion — ported wholesale, they're the
  accessibility work and it's the best part of the textbook
- **the cream/rose/gold palette** — per §0, the absorbed app's look wins.
  spores' twilight-webcore `--g-*` tokens get re-valued, not replaced; the
  variable names and their roles stay, so this is a token edit rather than a
  component rewrite.

**ologypedia becomes the publish target, not a second editor.** `index.html`
stays the public bookcase, `textbook-*.html` stay the published artifacts,
`add-page.html` stays the studio for authored pages. what goes away is
`textbook.html` as a *place you write* — the same content, tended in spores,
publishes out to ologypedia. this is exactly the split write ↔ echoes already
has, and it works there.

**2. dev log becomes a spores category pack.**

seven block types → seven categories in the registry, as a `worldbuilding`
pack. `SmartLink` → `Flight`. entries → a spellbook.

per §0 there is **no chronological view to port** — the date becomes an
ordinary field on the entry and nothing renders a timeline — and the devlog
**does not move into marginalia**, tidier though that would be. it lands in
spores like everything else, and marginalia stays a game.

this is the highest-confidence merge in the list: one subject, zero tests, and
a target that already models everything it needs.

**3. write becomes the writing surface, for everything.**

extract the editor — contenteditable, `EditorToolbar`, `SelectionPopover`,
`MarginNotes` — into `@woodles/editor`, and let spores open a long body in it.
REFACTORING.md already tracks these as diverged-and-still-moving against
marginalia's copies; a second consumer is the forcing function that settles the
API. write keeps letters and the public path as its own thing.

**4. notebook becomes the inbox.**

one stream that always accepts, plus promotion. `notes` and `ideas` collapse
into captures with a lane; each carries "promote to spore / promote to draft."

per §0, **tasks leave for carillon.** notebook drops the `NotebookTask` model
entirely and the mode tabs go from three to one. this is a net simplification
of the front door: it stops being a three-mode app you have to navigate and
becomes a single stream you type into.

**5. one prompt pipeline — `@woodles/spellcraft`.**

spores' `spells/` is already 90% of this and it's the tested copy. generalize
the output contract: JSON skeleton (spores today), body fragment with
`[[links]]` (the textbook's), full HTML page (the studio's). the static
ologypedia files can't import a package — so either stamp the spec into them at
build time, or accept that only the *studio* stays inline once the textbook
side moves into spores.

**cost:** large. weeks, not days. touches four apps and adds two packages.
**buys:** one place to tend knowledge, one place to write, one place to catch,
one place to publish. every cause in §3 addressed.

### option C — one app

fold all five into a single workspace with modes. rejected: it merges the five
aesthetics into one, throws away write's stability and marginalia-adjacency,
and the letter/publish path is genuinely a different product. the cost is a
rewrite and the payoff over option B is small.

---

## 5. recommended path

option B, staged so each step ships something usable and nothing depends on
finishing the next one. **option A's step 0 comes first regardless** — it's
cheap, it's most of the benefit, and it's not wasted work if B stalls.

| # | step | size | unblocks |
| --- | --- | --- | --- |
| 0 | ✅ **write the five sentences.** one line per app naming the *moment*, into the manifest descriptions. regroup the landing tiles into bands. | hours | everything — you can't merge what you can't describe |
| 1 | ✅ **`@woodles/handoff`.** shared envelope, drain-on-load, "send to…" actions between notebook, spores and write. | ~1 day | kills the routing tax immediately, survives every later step |
| 2 | ✅ **dev log → spores.** worldbuilding category pack + a migration for `woodles_devlog`. no dated view (§0). app retired, route redirected. | ~2 days | proves the category registry generalizes; removes an untested app |
| 3 | **spores re-skin.** re-value the `--g-*` tokens to cream/rose/gold (§0) *before* the textbook lands, so the port isn't restyled twice. | ~half a day | step 4 arrives into a room that already looks right |
| 4 | **textbook → spores.** wikilinks, backlinks, status, covers, focus mode, breadcrumbs. migrate `ologypedia-textbook-v1`. ologypedia keeps the bookcase and the studio. | ~1 week | the actual consolidation; makes one knowledge base real |
| 5 | **tasks → carillon.** move `NotebookTask` into planner, migrating from `notebook.workspace.v2`. | ~1 day | clears notebook for step 6 |
| 6 | **notebook → inbox.** merge notes and ideas into captures; promotion actions land against step 1's envelope. | ~1 day | one front door |
| 7 | **`@woodles/editor`.** extract from write, consume in spores; settle the API that REFACTORING.md has been waiting on. | ~1 week | rich bodies everywhere; unblocks the marginalia margin-notes merge too |
| 8 | **`@woodles/spellcraft`.** one prompt spec, three output contracts. | ~3 days | the authoring spec stops drifting |

if only one thing gets done: **steps 0 and 1.** they're a day and a half
together and they address the two causes that actually stop you from opening
an app. *(both have shipped — see "what landed" below.)*

two ordering notes. **step 3 goes before step 4** because re-skinning after the
port means restyling the ported components too — cheaper to land the tokens
first. **step 5 goes before step 6** because notebook's task model is entangled
with its workspace document; moving tasks out first leaves a smaller, cleaner
thing to reshape into the inbox.

### what landed in steps 0 and 1

**bands.** the manifest gained a `band` per landing tile — `catch`, `write`,
`tend`, `read`, `play` — plus `landingBands` and `landingAppsByBand`. the start
menu's "all apps" section renders grouped under them with a one-line blurb
naming the moment. it also now lists *every* app rather than the unpinned
remainder, because notebook is default-pinned and `catch` would otherwise never
show its name. the suite fails if a tile lands in an unknown band, if grouping
loses one, or if anything but notebook appears in `catch` — the last is a
tripwire against the routing decision growing back.

**sentences.** three of the five descriptions now name a moment instead of a
noun: notebook is "when a thought arrives and you don't want to decide where it
goes", spores is "when you want to be able to find it, and what it connects to,
later", write is "when a thought deserves to be written properly — and maybe
sent". ologypedia's became "finished entries, bound and shelved to be read",
which is what step 4 will make literally true. dev log's is untouched — it's
being retired in step 2.

**`@woodles/handoff`.** one versioned queue per receiving app. the full
contract is in ARCHITECTURE.md under "the handoff spine"; the three choices
worth restating here are that a capture is never refused (empty draft, corrupt
queue, absent localStorage all still accept), that duplicates beat losses
(`drain()` hands items back even when it can't clear, flagging it, and
receivers dedupe on id), and that queues are bounded at 200 with the oldest
dropped.

wired: notebook drains into notes tagged `from:<app>` and can send any note or
idea onward; spores plants arrivals as spores — *before* the first-run
onboarding check, so a garden that only looks empty doesn't open the tutorial
over the top of what just arrived — and can send a spore to write; write gives
each arrival its own draft and opens the newest, running HTML through
`sanitizeHtml` first, since a body may be model output from two apps ago and
write's drafts can reach the public publish path.

41 new tests (920 → 961). spores gained a `vitest.config.ts` on the way, for
the same rune-store reason planner has one.

### what landed in step 2

**the worldbuilding pack.** six categories in `spells/registry.ts` — creature,
biome, ability, stat, minigame, lore — carrying the Dev Log's own field names.
there's deliberately no `prose` category: prose was never a typed record, and a
Spore already has a body. the wizard grew a fourth group to show them, and
`Category.group` was widened to a real union in the process, which removed an
existing `'anime' as 'media'` cast.

**the import** (`devlogImport.ts`) runs once on first open, flagged in settings
so it can't double the Garden. one spellbook, one spore per entry with its
prose blocks as the body, one spore per typed block with its fields in `data`,
a flight from each entry to the blocks it held, and every `SmartLink` resolved
into a flight — resolved *after* every block exists, so a link can point
forward to a block defined in a later entry. a link naming a block that was
never exported is counted, not fatal.

one bug worth recording: the first cut treated every string field as a possible
link, so `type` and `id` counted as unresolved references. a SmartLink is
specifically `{ kind, label }`, and only that shape should be followed —
a bare string is a lore fragment, not a reference.

**the retirement.** app directory deleted, manifest entry removed, tile orders
renumbered to stay contiguous, dead icon artwork dropped, and `/marginalia-devlog`
turned from a rewrite into a permanent redirect.

961 → 979 tests.

### infrastructure that has to come along

- **notebook and the textbook need sync** before their data can merge with
  anything. `@woodles/sync` + `createAppSync` is ~30 lines per app.
- **spores should adopt `@woodles/persistence`** before it becomes the
  knowledge base — it's about to hold the union of three apps' data on four
  hand-rolled `save()` calls with silent `catch {}` on quota.
- **spores needs a versioned envelope**, not four v1 keys, for the same reason.
- ~~**dev log's zero tests** shouldn't be inherited.~~ done — the import is
  the best-tested thing that app ever had (16 tests).

---

## 6. what's still open

the six questions this doc opened with are answered in §0. what remains:

1. **write's flat drafts list** — undecided, and deliberately not in the plan.
   the honest read is that it can't be answered until step 7 exists: once
   spores and write share an editor, whether a letter wants tags and links
   becomes an observation rather than a guess. revisit then.
2. ~~what happens to the `/marginalia-devlog` route~~ — **resolved**: a
   permanent redirect to `/spores`, pinned by a manifest test so a retired
   route can't quietly start 404ing, plus a companion test that no live app's
   route is ever shadowed by a redirect.
3. **twilight webcore's fate.** §0 says deprioritized, not deleted — marginalia
   and bestiary still wear it and aren't in scope here. the question is only
   whether spores' `--g-*` values are re-pointed in place (recommended, one
   file) or kept switchable as a second theme (more code, unclear payoff).
4. **whether `@woodles/handoff` should become sync-aware.** step 1 ships it as
   a same-origin localStorage envelope, which is enough for one browser. making
   a capture on the phone show up on the laptop means putting it through
   `api/sync.ts`, which is a bigger ask than the routing problem needs today.
