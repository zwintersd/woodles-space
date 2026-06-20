# marginalia — a proposal for expanding scope

a working proposal for where the witch's book could grow, read against the code
in `apps/marginalia/src` as it stands today. each section ends with **what i need
from you** — the decisions that block design, not busywork. answer as much or as
little as you like; the open questions are the point of the doc.

read alongside [ARCHITECTURE.md](../../ARCHITECTURE.md) for how the app fits the
workspace.

## the thesis to protect

the footer says it plainly: *"a game about writing worlds into being, and learning
that witnessing them is enough."* the golden-ending title is **The Witness**
(`content/titles.ts`), and the journal already distrusts taking — *"I took what I
needed quickly. The world gave it. It also went a little quiet."*

so the one rule every feature below is measured against: **reward attention and
restraint; never optimize them away.** an expansion that turns witnessing into a
spreadsheet would be bigger and worse.

## how this is organized

- **part i** finishes promises the UI already makes — these are the most coherent
  expansions because the code already gestures at them.
- **part ii** opens genuinely new pillars.
- **part iii** is texture: smaller, optional.

---

## part 0 — framing (answer these first; they reshape everything below)

- **is this a roadmap or an exploration?** do you intend to build toward a finished
  arc, or feel out directions? it changes how hard I lock down save formats and APIs.
- **who plays it?** just you, or public players at woodles.space? that decides how
  much onboarding, difficulty tuning, and save-migration care each feature needs.
- **how big is one pass?** are you after a single focused feature, or a multi-feature
  arc I sequence over several commits?
- **save compatibility.** the save is `v: 1` with a real migration path
  (`persist.ts`, plus the legacy-marginalia inheritance). must existing localStorage
  saves keep working, or is a clean break acceptable for a big version bump?
- **prose budget.** how much of the new in-world writing (journal seeds, stage text,
  titles) do you want to write yourself, versus have me draft in Brianna's voice for
  you to edit?

---

## part i — close the dangling threads

### 1. intervention — the *Known* endgame

**the hole.** the whole loop builds toward *knowing* a life well enough to help it —
and then nothing happens. once a life hits `STAGE_KNOWN`, `TheWorld.svelte` shows
*"she knows it now — enough to {verb} it kindly"* followed by *"(intervention arrives
in a later pass.)"*, and the life drops out of attention into a passive yield.
`domainVerb` (tend / guide / encourage / shape / invoke, `content/life.ts:9`) exists
for exactly this and is used nowhere else. this is the single most-promised,
least-built mechanic.

**the sketch.** make *Known* a choice rather than a dead end: act on a life — gently,
at a cost — or witness it and leave it be. the theme wants *not acting* to sometimes
be the better play, so intervention should carry risk to favor or a chance of loss,
not be a pure upgrade.

**what i need from you:**
- what does intervention *do*? change a life's yield, shift favor, unlock new
  life/emergences, move the world's metrics — or is it mostly narrative (new stage
  text, a journal page)?
- one-shot, reversible, or an ongoing toggle?
- should restraint be mechanically rewarded — i.e., is *not* intervening sometimes
  optimal, to honor the thesis?
- do the five domain verbs behave differently, or are they flavor over one shared
  mechanic?
- what does it cost — insight, essence, attention, favor, or a new resource?
- can it *harm*? the assumptions list already admits *"things can end"* and
  *"information can be lost"* — is loss on the table?

### 2. prestige & many worlds

**the hole.** the long arc is fully storyboarded in content and entirely unbuilt.
`worldIndex` is defined, saved, and reset but never incremented or read
(`book.svelte.ts:75`). essence and knowing are commented *"will cross worlds, once
prestige exists"* (`book.svelte.ts:58`). the assumptions tier is introduced as *"the
first prestige reveals they were assumptions all along"* (`content/assumptions.ts`).
the Mother and Witness titles are gated *"not yet — not in this world."*

**the sketch.** "close the book, open a new one." a prestige carries Essence/Knowing
forward, resets the world, and — the interesting part — makes the **assumptions**
editable, so world two runs on different physics and grows different life. this is
the real scope multiplier; everything else is one world's worth of polish.

**what i need from you:**
- what triggers prestige? fully Knowing the world, a favor threshold, an
  Essence/Knowing target, or a deliberate "she chooses to close it"?
- confirm the carry set: Essence + Knowing across, everything else (Insight, Favor,
  observation, written conditions) reset?
- when an assumption is changed, does it map to concrete content swaps (e.g. remove
  "things can end" → returning-based life vanishes), or is it narrative-first to start
  and mechanical later?
- how many worlds — a small authored handful, or procedural variation?
- do Mother / Witness correspond to specific prestige milestones you already picture?
- how much should prestige answer the standing question the journal keeps asking —
  *why is she here at all?*

### 3. the world's vital signs

**the hole.** `complexity`, `nutrients`, `oxygen`, `stability` are all `$derived`
on the Book (`book.svelte.ts:180–189`) and rendered in **zero** components. the
numbers that would make the world feel alive are computed every tick and thrown away.

**the sketch.** the cheapest high-impact change in the doc: a small "vital signs"
readout, or a minimal planet visual that breathes with them.

**what i need from you:**
- readout only, or should these *gate* things (oxygen enabling animal life, stability
  resisting the favor-events in §9)?
- a literal planet visual (SVG/canvas), or a tasteful numeric panel to start?
- are the current formulas (`oxygen = plants × 12`, etc.) canonical, or placeholders
  I should redesign?

### 4. the reading room, joined to the book

**the hole.** `readingCumulativeMs` / `readingCumulativeWords` are tracked, saved,
and migrated from legacy saves (`book.svelte.ts:130–131`) — and displayed nowhere.
stars don't feed the economy, yet the arcade's locked hints already treat reading
stars as a currency. the room is mechanically an island.

**the sketch.** let reading *sharpen her attention* — a finished star grants a little
clarity/essence — and surface the lifetime totals. keep it light so the "quiet side
room" never becomes the dominant faucet.

**what i need from you:**
- should reading *reward* the book, or stay deliberately separate and merely be
  *shown*?
- if it rewards: what, how much, and capped how, so reading can't out-earn witnessing?
- thematic link — parallel ("she reads while you read"), or does what you read touch
  her world? how literal?
- keep stars as the unit, or rethink the whole reward shape?

### 5. an honest arcade

**the hole.** six of seven game cards are unbuilt, and the note *"rewards drift back
into the main book"* (`Arcade.svelte:131–134`) is wired to nothing — the arcade never
references `book`. the locked cards' unlock conditions ("after writing 8 conditions",
"after earning 3 reading stars", "after witnessing a full lifecycle") already point at
real Book state.

**the sketch.** minimum: make 2048 actually drip a prize so the note stops being a
lie. better: build one more game whose unlock is already authored.

**what i need from you:**
- minimum honest fix, or build out a second game — which scope this pass?
- prizes: trivial flavor, or a real faucet (insight? essence?)?
- keep the authored unlock-conditions as the spec, or revise them?
- the arcade is deliberately Solarized-light, a different *place* — keep that tonal
  separation, or fold it into the witch aesthetic?

---

## part ii — new pillars

### 6. the web, drawn as a web

**the hole.** it's named *the Web* and described as *"the web revealing its own
depth"* — but `TheWeb.svelte` renders a vertical list. conditions imply emergences
imply life, and none of that structure is visible.

**the sketch.** a node-graph constellation: conditions → emergences → life, with
locked nodes shown as hints of the unwritten. strong fit with the name and the
margins-and-annotation aesthetic.

**what i need from you:**
- visual upgrade only, or interactive (pan/zoom, click a node to write it)?
- show locked/future nodes as hints, or only what's unlocked?
- the repo prizes dependency-light, no-build code — okay to add a small SVG layout
  helper, or keep it hand-rolled and dependency-free?

### 7. marginalia — make the player an annotator

**the idea.** right now the reading room and the witch's book are thematically
adjacent but mechanically unrelated tabs. the app's *name* is the unifier — marginalia
are notes in the margin. the margin-note editor already exists
(`components/reading/MarginNotes.svelte`); reuse it to let the player annotate **life
cards** and co-write the witch's **field journal**. witnessing becomes active without
becoming extractive — the most on-theme way to add a pillar. the sibling
`marginalia-devlog` app already defines typed `CreatureBlock` / `BiomeBlock` /
`LoreBlock` blocks, a possible content pipeline.

**what i need from you:**
- is reusing the margin editor on life cards appealing, or should the reading room
  stay its own thing?
- are player annotations purely personal (a scrapbook), or do they feed mechanics
  (annotating deepens study)?
- any relationship to `marginalia-devlog`'s blocks — pull content from there, or keep
  them separate?

### 8. deeper content (and a second tier of *written* conditions)

**the idea.** the data layer (`content/*.ts`) is clean and additive: 8 conditions,
9 emergences, 12 life, 5 journal seeds, one world. low-risk volume. the structural
addition worth considering: Tier-II *written* conditions that require an emergence as
a prerequisite, deepening the tree past its current two flat layers.

**what i need from you:**
- are you writing the new prose, or do you want me to draft in-voice for your edit?
- yes to Tier-II written conditions (require an emergence), or keep conditions flat?
- any specific biomes / worlds / life you already have in mind?

---

## part iii — texture (smaller, optional)

### 9. favor with weather
favor is currently a silent 0.5–1.5× multiplier easing toward a target
(`tuning.ts:44`). light events driven off the §3 metrics — a drought, a bloom — would
give it stakes.
- **need from you:** appetite for randomness at all? and may events be *losses*
  (drought), or only gains — given the theme cuts both ways?

### 10. sync opt-in
the repo has a single-user sync spine; ARCHITECTURE notes *"write and marginalia don't
sync at all."* opting in makes the world follow you across devices.
- **need from you:** worth wiring, or intentionally keep marginalia device-local?

### 11. a field-guide page to keep
a shareable/printable page per life, echoing the Bestiary card look.
- **need from you:** interested in shareable artifacts at all? static image, or just
  print CSS?

---

## what i'd build first

if the goal is to expand *scope*, **§1 (intervention)** and **§2 (prestige/worlds)**
are the two halves of the arc the code already storyboards — together they turn the
game's dead state into its second and third acts. **§3** and **§4** are cheap,
high-leverage finishing work to ride alongside. **§7** is the boldest *on-brand*
new pillar if you'd rather grow sideways than forward.

**the one decision that unblocks the most:** *is this pass about completing the single
world (intervention, vital signs, reading/arcade wiring), or about opening the arc
beyond it (prestige and a second world)?* tell me that and I can turn the matching
sections into a real spec.
