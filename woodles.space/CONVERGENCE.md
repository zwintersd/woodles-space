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

**status: decided, and mostly built.** option B below is the chosen shape —
*one knowledge base, one writing surface, one front door*. the six open
questions have been answered; see §0. §5 is the live plan, and marks what has
shipped.

**all eight steps are done.** all three rooms are real: the landing page groups
apps by the moment they're for rather than listing sixteen peers;
`@woodles/handoff` lets any app pass a thought to any other instead of making
you guess right the first time; the Dev Log has been folded into Spores and
retired; Spores wears the cream/rose/gold it will keep; and the Ologypedia
Textbook has moved across too. Notebook has shed its tasks to
Carillon and become one stream you type into. **five surfaces are now three,
plus a publish target.**

**amended since: three rooms became two, then one.** living with the built
plan showed that the front door and the writing surface wanted to be the same
room — Notebook retired into Write, which now handles every kind of writing.
the what and the why are in **§7**; the step-8 world it amends is preserved
below as written. later still, the knowledge base followed: Z's verdict was
that Ologypedia hadn't been a useful app and Spores' job — an interlinked
personal knowledge base — was smaller than the room it had. **§8** records
that second collapse. *five surfaces are now one* — the publish target has
folded in too.

what else is left is in §6 — a handful of things deliberately left
duplicated, and one question that is still open.

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

### notebook — `/notebook` · sveltekit · *now the front door*

after steps 5–6 it holds one kind of thing — a `Capture` (title, body, tags,
lane) in `notebook.workspace.v3`. what it was: three modes over one
localStorage document (`notebook.workspace.v2`):

| object | fields | organized by |
| --- | --- | --- |
| `Note` | title, body (plain textarea), tags[], created/updated | flat list, sorted by `updatedAt`, one search box |
| `NotebookTask` | title, status, priority, optional `noteId` | open / done |
| `Idea` | text, lane (`spark`/`shape`/`later`) | three lanes |

no links between notes. no sync. the **only** adopter of
`@woodles/persistence` among the five — versioned envelope, validation,
last-known-good recovery, export/import round trip. 14 tests.

### spores — `/spores` · sveltekit · *now the knowledge base*

after steps 2–4 it also carries the Dev Log's worldbuilding records and the
Textbook's wikilinks, backlinks, status and covers. what it was:

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

### ologypedia — `/ologypedia` · static · *now the publish target*

three surfaces in one directory. after step 4, `textbook.html` is a signpost
pointing at `/spores` (and a download button for the original blob, so nothing
is stranded); the other two are unchanged. what it was:

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
| 3 | ✅ **spores re-skin.** re-valued the `--g-*` tokens to cream/rose/gold (§0) *before* the textbook lands, so the port isn't restyled twice. | ~half a day | step 4 arrives into a room that already looks right |
| 4 | ✅ **textbook → spores.** wikilinks, backlinks, status, covers, the sowing gesture. migrated `ologypedia-textbook-v1`. ologypedia keeps the bookcase and the studio. | ~1 week | the actual consolidation; makes one knowledge base real |
| 5 | ✅ **tasks → carillon.** moved `NotebookTask` into planner, migrating from `notebook.workspace.v2`. | ~1 day | clears notebook for step 6 |
| 6 | ✅ **notebook → inbox.** notes and ideas merged into captures; promotion actions land against step 1's envelope. | ~1 day | one front door |
| 7 | ✅ **`@woodles/text`** — *not* `@woodles/editor`; see below. extracted the converged utilities from write, marginalia and letter. | ~2 days | one sanitizer, one anchor scheme, five consumers |
| 8 | ✅ **`@woodles/spellcraft`.** one brief, two output contracts — and the Textbook gesture step 4 missed. | ~2 days | the authoring spec stops drifting |

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

### what landed in step 3

the re-skin was billed as one token file. it was mostly that — every `--g-*`
name and role survived, so no component logic changed — but three things made
it bigger than a find-and-replace, and all three were the theme *inverting*
rather than shifting hue.

**literals that encoded the old ground.** a dozen components hard-coded the
near-black background as the text colour on top of an accent fill. that's a
real role, and it flips with the theme, so it became `--g-on-flight`. two more
followed: `--g-danger` (+ `--g-danger-soft`), because error text and
destructive hovers had been reusing the accent pink — which only worked
because pink reads as a warning on near-black, and on paper the accent *is*
rose; and `--g-scrim`, because a near-black wash over cream is a hole rather
than a dimming.

**contrast.** the old `--g-muted` and both accent tones failed 4.5:1 on the new
ground, and two of them carry text. re-valuing was the moment to fix that
rather than port it forward, so the palette was chosen against measured ratios:
everything that carries text now clears 4.5:1 on both `--g-bg` and
`--g-surface`.

**the graph.** `GraphRenderer`'s node and edge palettes are SVG literals, not
tokens — artwork tuned to its ground. the pastels that glowed on near-black are
invisible on paper, so both sets were deepened; the faction palette kept its
length of ten so the existing hash still maps the same way. its three label
fills moved onto tokens, which is where they should have been.

verified in a browser across the garden, a spellbook, a spore, the relationship
graph, and a form. no console errors, and the test/check/build numbers are
unchanged — this step touched no behaviour.

### what landed in step 4

split across two commits — the model first, then the UI onto a model already
tested.

**`[[wikilinks]]` instead of HTML.** the Textbook stored links as
`<a class="entry-link" data-entry>` inside sanitized HTML. a spore body is
plain text, so the port uses bracket syntax — and that turned out to be a
convergence rather than a compromise: it's exactly what the Textbook's own
"draft it with a prompt" already asked models to emit, so the authoring format
and the storage format finally agree. rendering became *segments* (text runs
and links) rather than `innerHTML`, so the read path has no sanitizer to get
wrong at all.

**red links and the sowing gesture.** a link to a title nothing answers to is
drawn dashed with a `+`, and clicking sows a seed. highlighting a phrase while
reading offers the same, planting the link where the phrase sat — no mode to
enter first. if the selection went stale and the phrase is gone from the body,
the seed is *still* sown: losing the link is acceptable, losing the thought is
not.

**backlinks derived, never stored**, so they follow edits — which means a
rename turns inbound links red rather than silently rewriting text the person
wrote. that is a choice, not an oversight, so it's pinned by a test. they're
shown apart from flights: a flight is a link you drew, a backlink is one you
wrote.

**status and covers** ported whole. accents are stored as *names* rather than
hex, which is the detail that would have bitten later — step 3's re-skin would
have stranded stored hex values.

**the migration** rewrites `data-entry` links to `[[Title]]` by looking titles
up in the export, and runs on regex rather than `DOMParser` so it's testable
under Node. HTML→text is deliberately lossy: what survives is what a person
wrote, what goes is markup they never typed. one bug caught by looking at it in
a browser rather than by a test — list items were being separated like
paragraphs, so a list stopped reading as a list.

**ologypedia demoted, not deleted.** `textbook.html` became a signpost with a
download button; the migration leaves `ologypedia-textbook-v1` in place, so
that page and the bookcase's textbook cards keep working as an escape hatch.

979 → 1048 tests. verified in a browser end to end: migration, link following,
backlinks, red-link sowing, and the shelf.

### what landed in steps 5 and 6

**the ordering problem, and its answer.** these two migrations both read
Notebook's v2 document — Carillon for the tasks, Notebook for the notes and
ideas — so whichever ran first could have read the data out from under the
other. rather than force an order, Notebook's v3 upgrade writes to a *new key*
and leaves v2 untouched. both migrations are now order-independent and
non-destructive, which is the same stance taken with the Textbook in step 4.
pinned by a test on each side.

**what Carillon would not take.** it has no priority — it organizes by domain
and by time — so an off-normal priority is written into the task's `notes`
rather than invented as a field or silently dropped. nothing maps to Carillon's
`dropped` state, which Notebook never had, and a task with no title is skipped
rather than created empty.

**notebook got smaller, which was the point.** three modes became one stream;
`Note` and `Idea` became `Capture`. a lane is triage rather than status —
where a thing sits in your head, not how finished it is — the default filter is
*everything*, and the number keys now filter rather than switch modes. removing
the task and idea panes left 25 dead CSS rules and 10 stale selectors inside
live ones; both were cleared, so the app still passes at zero warnings.

1048 → 1069 tests. verified in a browser across both apps in sequence: notes
and ideas became captures, v2 survived untouched, no task leaked into the
inbox, and Carillon then took both tasks with the high priority preserved in
its notes.

### what landed in step 7, and why it isn't what was planned

this step was drafted as "**`@woodles/editor`** — extract write's rich editor,
consume it in spores." that premise expired in step 4. spore bodies are now
**plain text** with `[[wikilinks]]`, and rendering them as segments rather than
`innerHTML` is a property worth keeping — putting a rich contenteditable in
spores would undo that and force HTML back into the store. so the editor was
not extracted, and spores does not consume one.

what *was* ready is what REFACTORING.md had already flagged as the workspace's
strongest candidate and been waiting on: the **text/HTML utilities**, in three
copies with a converged contract, only two of them tested. the handoff spine
added two more copies of `htmlToText`, making five. that is the extraction the
repo's own habit — duplicate until converged, then extract — was asking for.

`@woodles/text` now has five consumers. it ships browser-ready `.js` with a
`.d.ts` sidecar so `letter`, a static page, can import it directly; its inline
untested third copy is gone.

**two divergences the copies had been hiding**, both now parameters:
whether a sanitize keeps `data-anchor` (write strips and re-stamps; marginalia
and letter keep, because they display what they're given and a strip would
orphan every margin note), and the anchor prefix (`a-` vs `p-`, both already in
stored documents). picking a winner on either would have silently broken one
app's notes.

the first was caught by **write's existing test suite** — the shared sanitizer's
first version changed write's semantics and a test asserting the strip failed.
that is the extraction working as intended.

what stays duplicated, per the log's own rule: `EditorToolbar`, `MarginNotes`,
and `SelectionPopover`/`SelectionBubble` are all still marked *diverged*, and
extracting them now would freeze an API before the copies have stopped moving.
`SelectionPopover` is closest — spores' sow-bar is arguably a third consumer of
the same idea — and is the natural next one when it settles.

1069 → 1092 tests.

### what landed in step 8

this step's premise had expired too, and for a reason worth recording: it was
drafted as "one prompt spec, **three** output contracts," but one of the three
lived in `textbook.html`, which step 4 replaced with a signpost. that left the
brief in exactly *one* place — and extracting something with one consumer is
premature by this repo's own rule.

chasing that turned up a real gap instead. the Textbook's **"draft it with a
prompt"** was listed in §1 among the things being ported, and step 4 ported
everything else — wikilinks, backlinks, status, covers, sowing — but not that.
step 4's own notes even cite the gesture as the reason `[[brackets]]` were the
right syntax, without ever building it.

so step 8 became: extract the brief **because a second consumer now genuinely
needs it**, and build that consumer. `@woodles/spellcraft` holds the spec; the
studio asks for a `page` and appends its own VISUAL SYSTEM, the Garden asks for
a `fragment` of prose with `[[links]]`. two consumers, two contracts, one brief.

the Garden's panel closes the loop the syntax choice opened: paste an answer in
any shape — fenced, HTML, markdown, plain — and `ingestDraft` reduces it to a
body, then **every `[[link]]` nothing answers to yet becomes a seed**. one
answer fills the entry and sows the cluster around it.

one bug the tests caught: `\s` in a multiline regex crosses newlines, so
stripping markdown bullets was eating the blank line before a list and
collapsing two paragraphs into one.

1092 → 1108 tests.

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

1. ~~**write's flat drafts list**~~ — **resolved by §7.** the retirement of
   notebook forced the question this item was waiting on: once captures
   landed in write's drafts, the flat list had to earn its size. index
   entries now carry `kind` and `tags`, and the drafts modal searches and
   filters. links between drafts remain unbuilt — that is spores' job, not
   write's.
2. ~~what happens to the `/marginalia-devlog` route~~ — **resolved**: a
   permanent redirect to `/spores`, pinned by a manifest test so a retired
   route can't quietly start 404ing, plus a companion test that no live app's
   route is ever shadowed by a redirect.
3. ~~twilight webcore's fate~~ — **resolved**: spores' `--g-*` values were
   re-pointed in place rather than kept switchable, so there is one palette,
   not a theme toggle. marginalia and bestiary still wear twilight webcore and
   were not in scope.
4. **whether `@woodles/handoff` should become sync-aware.** step 1 ships it as
   a same-origin localStorage envelope, which is enough for one browser. making
   a capture on the phone show up on the laptop means putting it through
   `api/sync.ts`, which is a bigger ask than the routing problem needs today.

---

## 7. the amendment — notebook retires into write

*added after the eight steps above had all shipped. everything below §0's
table and above this line describes the world as steps 0–8 left it; this
section records how that world changed.*

### the decision

Z's verdict, living with the built plan: **notebook is not a good app.** it
was the thinnest room in the house — a bare textarea with lanes — and its one
real job, *always accepting*, is a property, not a product. so:

| question | answer | consequence |
| --- | --- | --- |
| keep notebook as the front door? | **no** — kill it, unclutter the desktop | the app retires the way the dev log did: data migrated, route redirected, tile removed |
| where do words go now? | **write** | write becomes the writing surface *and* the front door — two of the three rooms turn out to be one room |
| what about fiction and nonfiction? | **write handles every kind** | drafts gain a `kind` — letter, essay, story, poem, note — and the editor dresses for it |

steps 5–6 were not wasted work, and this is worth saying plainly: shedding
tasks to Carillon and collapsing three modes into captures is exactly what
made notebook small enough to fold into a drafts list. the step-6 app was the
*preparation* for this step, visible only in hindsight.

### what landed

**the retirement**, on the dev-log pattern (step 2): app directory deleted,
manifest entry removed, tile orders renumbered, dead icon artwork dropped,
`/notebook` turned into a permanent redirect to `/write`, and the `catch`
band retired with its only tenant — the write band's blurb now names the
catching job. the manifest suite pins all of it: the redirect can't quietly
404, a `catch` band can't grow back, and a second app can't join `write`.

**the capture import** (`apps/write/src/lib/notebookImport.ts`), on the
Carillon-takeover pattern: runs once, flagged, **non-destructive** — the v3
document (primary, then backup) is read and left in place, same stance as
every other migration here. each capture becomes its own draft of kind
`note` under a deterministic id, so even a lost flag can't double one. the
stranded `woodles.handoff.notebook.v1` queue drains into drafts too, and that
key alone is removed — a queue is a hallway, not a home. an arriving archive
does not steal the opening slot the way a live handoff deliberately does.

**write, empowered for fiction and nonfiction:**

- **kinds** (`src/lib/kinds.ts`): `letter`, `essay`, `story`, `poem`, `note`.
  a kind is a lens, not a cage — switchable any time, from a chip row above
  the title. all three layers' placeholders follow it, which is the
  three-layer metaphor generalizing: under a story the midground is
  "characters, places, threads"; under an essay it is "evidence, sources,
  the counterargument you owe an answer". a draft stored before kinds
  existed has no `kind` field and reads as `letter` — nothing rewritten.
- **word goals**: an optional per-draft `goal`, set from the bottom bar's
  word count. progress reported, never scolded.
- **the drafts list earns its size**: index entries carry `kind` and `tags`
  (handoff tags now survive onto the index too); the modal searches title +
  tags and filters by the kinds actually present.
- **templates know their kind**: the shared library's templates each carry
  one, and two new ones ship — an `opening-scene` (fiction) and an `essay`
  scaffold — so /scaffold now seeds more than letters.
- **publishing is unchanged**: whatever the kind, what publishes is a letter
  in echoes, only when explicitly public. `notebook` also left
  `HANDOFF_TARGETS` — spores → write was the one wired handoff, until §8
  retired spores too and left write the only target standing.

**what was deliberately not done:** no lanes port (a capture's `spark`/
`shape`/`later` triage dies with the app — `kind: note` plus tags is enough
structure for an inbox that now sits inside a real editor); no tag *editor*
in write (tags are carried and searchable, not yet authorable); no sync for
drafts (unchanged from before); no rich editor extraction (step 7's reversal
stands).

**the doc trail**: ARCHITECTURE.md's "the front door" section became "the
writing surface"; the persistence README's reference adopter is now
`@woodles/handoff`; this file's §6.1 is resolved. the sentences in §5's
"what landed in steps 0 and 1" describing notebook's tile are now history
rather than description, which is what this section exists to say.

---

## 8. the second collapse — spores and ologypedia retire into write

*added after §7 had shipped. everything above describes the world §0–§7 left
it in; this section records how that world changed again.*

### the decision

Z's verdict: **Ologypedia hadn't been a useful app.** Write, Carillon,
Thinking About and Echoes were forming real, healthy connections — the
reference spine in REFERENCES.md and HANDOFF.md, the cross-app ledgers, live
`#`/`@` references that resolve against a manifest — and Ologypedia and
Spores were not part of any of it. The call was to strip both for parts:
remove them as apps entirely, and keep, refactor, or repurpose whatever in
them was interesting or effective into the four apps that were already
working.

| question | answer | consequence |
| --- | --- | --- |
| is Ologypedia's remaining bookcase/studio/publish pipeline worth relocating? | **no** — §0 of this very file already recorded that its self-containment "now lives as its own project outside this monorepo" | delete it outright; nothing to port |
| does Spores' `[[wikilink]]` syntax get ported into Write? | **no** — Write already has a live `#`/`@` reference spine with a source registry | extend that registry with a `DraftSource` instead of inventing a second link syntax |
| does the spell system (registry/assembler/parser) get a new home? | **yes — Thinking About** | its curated categories already name almost exactly Thinking About's `SectionKey` union |
| do the worldbuilding categories (creature/biome/ability/stat/minigame/lore) come along? | **no** | they were the retired Dev Log's content; marginalia stays a game (§0's original ruling), and none of the four healthy apps is about its world |
| does `@woodles/spellcraft` retire with its last consumer? | **no** — it gets a new one | Write's own "draft it with a prompt", the `fragment` contract generalized off `[[wikilinks]]` |
| does the Textbook's focus mode / calm motion get recovered? | **yes, into Echoes** | it was planned in step 4 (§5) but never actually shipped once Spores absorbed the Textbook — the accessibility work is real and worth having, and Echoes (the private re-reading archive) is where it belongs now |
| do Flights, covers, and per-field modifiers come along? | **no** | each named explicitly below — no natural home, no forced port |

### what landed

**Write gained a third `#` source.** `references.svelte.ts` already had a
source registry — Thinking About's shelf, days — built for exactly this kind
of extension (REFERENCES.md §4.3). `DraftSource` resolves `#` against
`listDrafts()`, no ledger needed since it's the same origin, same app; a
reference is stored as the same `data-ref-app="write" data-ref-kind="draft"`
anchor every other reference already uses. `write` now declares
`addressableBy: ['draft']` in the manifest and reads `?draft=` on load, so a
reference is a real, resolvable link, not a name with nowhere to go.
`backlinks.ts` derives "what references this draft" by scanning stored bodies
for those same anchors — Spores' `backlinksOf`, arrived at by reusing a
mechanism Write already had rather than porting `wikilinks.ts`'s bracket
parser. The status lifecycle came the same way it reached Spores from the
Textbook before it: `seed → growing → grown`, optional, forward-only,
inferred from whether a draft has words when nothing was chosen explicitly
(`status.ts`).

**The data moved, not just the code.** `sporesImport.ts` runs once, flagged,
non-destructive — the `spores.spores.v1` and `spores.spellbooks.v1` keys are
read and left in place, same shape as `notebookImport.ts` before it. Each
spore becomes a draft of kind `note`, tagged `from:spores` and
`spellbook:<title>` for each spellbook it belonged to; `[[wikilinks]]`
resolve into draft references against the titles in the same export, and
flatten to plain text — not a broken link — when the target isn't in it. A
spore with no body (the retired Dev Log's worldbuilding records, migrated
into Spores in step 2, whose fields lived entirely in typed `data`) gets a
body synthesized from those fields, so the words in it survive even though
the category itself did not get a new home.

**Thinking About gained a structured-record system.** Spores' `spells/` —
twelve curated categories, a JSON-skeleton-prompt assembler, and a forgiving
parser built to survive real model output (fenced answers, truncation,
stringified arrays) — moved to `apps/thinking-about/src/lib/spells/`, minus
the worldbuilding pack and minus the per-cast field picker and modifiers
Spores had. Casting a spell is simpler here on purpose: every field a
category knows about, no picker, because the picker was the part fighting for
UI space, not the part doing the work. An entry's optional `spell: {
categoryId, data, castAt } | null` is normalized like every other field an
older synced entry might not carry.

**Echoes gained focus mode and calm motion.** Neither one was actually built
before this — step 4's plan (§5) said "focus mode, breadcrumbs, calm-motion —
ported wholesale," but the "what landed" log for that step only ever mentions
wikilinks, backlinks, status and covers; the accessibility half of the plan
quietly didn't happen. Rather than let a real, documented idea disappear with
its last two homes, it's built fresh in `apps/letter/index.html`: two topbar
toggles, `echoes_focus_mode` and `echoes_calm_motion` in localStorage — a
device preference, same stance as Write's view prefs — defaulting calm motion
on when `prefers-reduced-motion` already says so and nothing has been chosen
explicitly. Breadcrumbs did not come along: Echoes has no multi-page reading
path the way the Textbook did, so there is nothing for a breadcrumb to trail
through yet.

**`@woodles/spellcraft` kept its brief and lost a contract.** `page` (one
complete standalone file, Ologypedia's studio) had exactly one consumer and
that consumer is gone, so it wasn't ported. `fragment` (a body, not a
document) is now Write's own "draft it with a prompt" (`DraftPromptModal.svelte`)
— the `[[double brackets]]` instruction is gone from its OUTPUT text, since
Write has no wikilink syntax for a model to target; what's left is Z's actual
brief — voice, structure, etymology-as-semantic-drift, the standing lenses,
the conversions, the reading-list rule — unchanged, because that was always
the part that must not drift regardless of who's asking for it.

**What was dropped, and why, all named rather than silently lost:**

- **`Flight`s** (explicit typed edges between spores) — an edge with no prose
  around it had no home in a body that's read as text and references.
- **Covers** (accent/glyph/blurb) — Write has no shelf of cards to put one on.
- **The worldbuilding category pack** (creature/biome/ability/stat/minigame/lore)
  — the retired Dev Log's content; no home among the four apps that stayed.
- **Per-cast field selection and modifiers** (citations, timeline detail,
  air-date detail, voice-actor detail) — a real simplification of the spell
  system, not an oversight; Thinking About's version always asks for
  everything a category knows.
- **Custom, user-defined categories** — Thinking About ships the curated set
  only.
- **Breadcrumbs** — no multi-page reading path in Echoes yet for one to trail.

**the redirects.** `/ologypedia` and `/spores` both now point at `/write`,
permanent, pinned by the same manifest contract test that already guarded
`/marginalia-devlog` and `/notebook`. `/marginalia-devlog` was updated to
point straight at `/write` too rather than chain through the now-gone
`/spores`, since a redirect that resolves through a second redirect is a
worse bookmark than one that doesn't.

**the numbers.** Spores' 140 tests retired with the app. Write's suite grew
by 28 (`sporesImport.ts` 14, `backlinks.ts` 7, `status.ts` 7); Thinking
About's grew by 13 (the spell registry's assembler and parser); the app
manifest, handoff, and spellcraft suites each lost or gained a test or two
reflecting the narrower reality. 1769 tests total, all seven remaining
SvelteKit apps building and checking clean. See ARCHITECTURE.md's "the test
suite" for the current breakdown.

**the doc trail**: ARCHITECTURE.md's "the knowledge base" section (Spores)
is gone; "the board" (Thinking About) is new; "the writing surface" and "the
authoring brief" both grew a subsection; "the handoff spine" and "shared
design tokens" lost their Spores paragraphs. `packages/app-manifest`'s doc
comments and `packages/spellcraft`'s header comment were rewritten in place
rather than left describing a plan that no longer matches the code — the
thing AUDIT.md flagged, twice, as this repo's most persistent failure mode.
