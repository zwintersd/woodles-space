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

nothing here is decided. it's a map, a diagnosis, three options, and a
recommendation.

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

### dev log — `/marginalia-devlog` · sveltekit · growing

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

### option B — converge to three products *(recommended)*

split by **what you're doing**, not by what the data is. three rooms, plus
ologypedia demoted from an app to an output format.

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

**ologypedia becomes the publish target, not a second editor.** `index.html`
stays the public bookcase, `textbook-*.html` stay the published artifacts,
`add-page.html` stays the studio for authored pages. what goes away is
`textbook.html` as a *place you write* — the same content, tended in spores,
publishes out to ologypedia. this is exactly the split write ↔ echoes already
has, and it works there.

**2. dev log becomes a spores category pack.**

seven block types → seven categories in the registry (or a `worldbuilding`
custom pack). `SmartLink` → `Flight`. dated entries → a spellbook with the
`diary` archetype, which already exists. retire the app; keep the route as a
filtered view if the dated framing is worth preserving, or fold it into
marginalia as a surface, since it's *about* marginalia.

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
into captures with a lane; each carries "promote to spore / draft / task."
tasks stay — a different object with a different lifecycle — though it's worth
asking whether they belong in carillon instead.

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
| 0 | **write the five sentences.** one line per app naming the *moment*, into the manifest descriptions and each app's header. regroup the landing tiles into bands. | hours | everything — you can't merge what you can't describe |
| 1 | **`@woodles/handoff` + one capture box.** shared envelope, drain-on-load, "send to…" actions between all five. | ~1 day | kills the routing tax immediately, survives every later step |
| 2 | **dev log → spores.** category pack + diary spellbook + a migration for `woodles_devlog`. retire or redirect the route. | ~2 days | proves the category registry generalizes; removes an untested app |
| 3 | **textbook → spores.** wikilinks, backlinks, status, covers, focus mode, breadcrumbs. migrate `ologypedia-textbook-v1`. ologypedia keeps the bookcase and the studio. | ~1 week | the actual consolidation; makes one knowledge base real |
| 4 | **notebook → inbox.** merge notes and ideas into captures; promotion actions land against step 1's envelope. | ~2 days | one front door |
| 5 | **`@woodles/editor`.** extract from write, consume in spores; settle the API that REFACTORING.md has been waiting on. | ~1 week | rich bodies everywhere; unblocks the marginalia margin-notes merge too |
| 6 | **`@woodles/spellcraft`.** one prompt spec, three output contracts. | ~3 days | the authoring spec stops drifting |

if only one thing gets done: **steps 0 and 1.** they're a day and a half
together and they address the two causes that actually stop you from opening
an app.

### infrastructure that has to come along

- **notebook and the textbook need sync** before their data can merge with
  anything. `@woodles/sync` + `createAppSync` is ~30 lines per app.
- **spores should adopt `@woodles/persistence`** before it becomes the
  knowledge base — it's about to hold the union of three apps' data on four
  hand-rolled `save()` calls with silent `catch {}` on quota.
- **spores needs a versioned envelope**, not four v1 keys, for the same reason.
- **dev log's zero tests** shouldn't be inherited. write the migration test
  before the migration.

---

## 6. open questions

these change the plan and only Z can answer them.

1. **is dev log's dated, chronological framing load-bearing?** if yes, it wants
   to be a *view* in spores, not just a spellbook. if no, step 2 is trivial.
2. **should the devlog live inside marginalia instead?** it's notes about
   making that world; marginalia is right there.
3. **do tasks belong in notebook or carillon?** notebook's tasks have priority
   and an optional note link; carillon owns time. a task with a date is
   carillon's; a task attached to a thought is notebook's — or they're one
   thing in the wrong place.
4. **is the ologypedia textbook's separateness the point?** it's the only one
   of the five that is deliberately, defensibly self-contained — a file another
   model can read and replicate exactly. absorbing it into spores trades that
   property for a shared engine. that's a real loss, and it might be the wrong
   trade.
5. **how much aesthetic merging is acceptable?** spores' twilight webcore and
   the textbook's cream/rose are both deliberate. step 3 has to pick one, or
   carry both as themes.
6. **is write's flat drafts list actually a problem**, or is a letter
   deliberately a thing without a filing system?
