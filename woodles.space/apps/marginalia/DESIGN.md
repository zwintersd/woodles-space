# marginalia — design spec: vital signs, interventions, prestige

the build-ready half of [PROPOSAL.md](./PROPOSAL.md). this covers the three systems
we settled the framing on: **vital signs** (the world's metabolism), **interventions**
(the *Known* endgame), and **prestige** (the between-worlds loop). numbers here are
tunable defaults, not gospel — they're written so the loop is legible and balanceable
by inspection, the way `tuning.ts` already is.

> **balanceable by simulation now.** `pnpm --filter marginalia balance` runs the
> shipped numbers through the harness in `witch/sim.ts`; read
> [BALANCE.md](./BALANCE.md) before tuning anything here.
>
> **two numbers below have moved since this was written.** §1.4's stage costs
> are now `[0, 30, 210, 1100]` — the opening worldspace took four minutes at the
> old ones. And §1.2's `baseDrift` is no longer `0.02 · (50 − stock)`: it acts on
> distance *out of band*, not from neutral, because at the old form it was the
> same order of magnitude as the entire world's metabolism and nothing could ever
> leave the middle.
>
> that change exposed something this document gets wrong. **§1.2's metabolism
> table is net-positive on all three stocks** (+0.12 / +0.24 / +0.29 per second),
> so the loops do not in fact "fall out naturally" — the drift term was doing all
> the balancing. the two sinks named in prose here but never implemented are what
> close them: moisture "evaporates" (§1.1) and salt deposits "reduce nutrient
> leach" (§1.2). both are live now as `STOCK_LEAK`, and needs bands got their
> upper halves back, which is also what makes §2.2's "invoke can overshoot into
> flood-stress" reachable. §1.2's worked lesson now actually happens; there is a
> test for it.
>
> **§2.3's restraint dividend is still wrong, and now inverted** — it pays a
> meddler *more* than an ascetic. untouched deliberately: what
> `interventionLoad` should mean is this document's call, not the harness's.
>
> **the code has moved out from under this document.** every mechanic described
> here still runs, and every path named here still resolves, but most of them are
> now re-export shims over shared packages. see "where the code lives" below.

three things carry through every decision:

- **the thesis.** reward attention and restraint; never optimise them away. the design
  makes *witnessing a self-balancing world* the highest-value play, mechanically.
- **equilibrium over maximum.** the goal state is a self-sustaining oscillation, not a
  frozen peak. loss is relational — a death that feeds the soil is the system working,
  not failing.
- **lean typical-incremental.** prestige is a standard "earn a meta-currency, spend it
  on permanent upgrades, go faster next time" loop, dressed in the witch's voice.

lines marked **✍️ you** are voice/copy I want you to write — collected at the end.
decisions marked **⚖️ fork** are the ones I want you to rule on; I've recommended a
default for each so nothing blocks.

---

## where the code lives

this document was written when all of it sat in `apps/marginalia/src/lib/witch`.
it doesn't any more. nothing described here changed behaviour in the move — the
balance report's numbers are identical either side of it — but a reader looking
for the implementation should know where to look.

| what | where | note |
| --- | --- | --- |
| the recurring *shapes* | `@woodles/dynamics` | thirteen shapes — banded stock, eased stat, decay-with-restore, threshold ladder… — twelve of them as small pure functions, the thirteenth a discipline with no code to share. no content, no Marginalia. `SHAPES` there is the taxonomy as data; the README explains each. |
| the engine | `@woodles/witch-engine` | `World` and its tick, `vitals.ts`, the `MarginaliaDef` schema, and the `sim.ts` balance harness. knows nothing about World 1 specifically. |
| World 1 itself | `@woodles/witch-engine/world1` | the life roster, conditions, interventions, emergences, field notes, and every number in `tuning.ts` — assembled into `world1Def`. bundled beside the engine the way `@woodles/incremental-core` bundles its own fixtures, so a tool other than this app has something real to point at. |
| this app | `apps/marginalia/src/lib/witch` | the Svelte-facing half: `book.svelte.ts` (runes over the engine's `World`), the components, saves, and the arcade. the files this document names — `tuning.ts`, `content/*.ts`, `def.ts`, `world.ts`, `sim.ts` — still exist at those paths as re-export shims (`world.ts` and `sim.ts` also bake `world1Def` in, so existing call sites pass no def), so nothing here is a dead reference. |

two consequences worth knowing before editing:

- **numbers live in the package now.** changing a stage cost or a leak rate means
  editing `packages/witch-engine/src/world1/tuning.ts`, not this app. the shim in
  `apps/marginalia/src/lib/witch/tuning.ts` only re-exports.
- **`MarginaliaDef` is plain, serializable data on purpose** — favor's multiplier
  is `{base, perPoint}` rather than a function so a def can cross a worker
  boundary. anything added to it should stay that way.

[Grimoire](../grimoire) is the tuning instrument built on all of this: it edits
`world1Def`'s numbers live, names the shape each group of them instantiates, and
runs Witness against Interventionist on whatever you've changed.

---

## 1. vital signs — the world's metabolism

today `complexity`, `nutrients`, `oxygen`, `stability` are `$derived` on the Book and
rendered nowhere (`$derived` getters on the Book). this replaces them with a live system that
life both depends on and changes, and that **gates** what can live.

### 1.1 the five signs

| sign | kind | range | what it is |
| --- | --- | --- | --- |
| **nutrients** | stock | 0–100 | fertility of soil and water. plants draw it down; decomposers and decay return it. |
| **oxygen** | stock | 0–100 | breathable atmosphere. plants produce it; animals burn it. |
| **moisture** | stock | 0–100 | water available to the land. weather produces it; land plants drink it; it evaporates. |
| **stability** | index | 0–100 | resilience. how close the three stocks sit to their healthy bands, lifted by interconnection. gates how hard stress bites. |
| **complexity** | score | unbounded | richness of the world. a weighted count of life, depth, and emergence. the soft prestige meter and content-unlock gate. |

> moisture is the one genuinely new field; nutrients/oxygen/stability/complexity already
> exist as names. the three **stocks** are the cycling metabolism; the two **derived**
> values summarise it.

### 1.2 the stocks cycle (per-second dynamics)

each stock starts at **50** (neutral) and updates each tick:

```
net(stock) = Σ_life  metabolism[stock] · activity(stage) · alive
           + baseDrift               // 0.02 · (50 − stock), pulls an empty world to neutral
stock = clamp(stock + net · dt, 0, 100)
```

`activity(stage) = [0, 0.3, 0.7, 1.0]` — deeper-witnessed life is more metabolically
present. dead/declined life contributes nothing.

**proposed metabolism for world 1** (per second at *Known*, `+` produces / `−` consumes;
new `metabolism` + `needs` fields on `Life`):

| life | domain | oxygen | nutrients | moisture | needs (healthy band) |
| --- | --- | --- | --- | --- | --- |
| algae_bloom | plant (aq) | +0.20 | −0.06 | — | nutrients ≥ 35 |
| moss | plant (terr) | +0.10 | −0.04 | −0.05 | moisture ≥ 45 |
| lichen | plant (terr) | +0.05 | +0.02 | −0.02 | — (hardy) |
| fungal_net | ecosystem (terr) | −0.03 | +0.15 | — | nutrients any; +interconnection |
| tidal_pool | ecosystem (aq) | +0.02 | +0.02 | — | +interconnection |
| soft_swimmer | animal (aq) | −0.10 | — | — | **oxygen ≥ 45** |
| salt_deposit | geology (aq) | — | +0.03* | — | — (*reduces nutrient leach) |
| spring | geology (terr) | — | — | +0.06 | — |
| cloud | weather (atm) | — | — | +0.05 | — |
| rain | weather (atm) | — | — | +0.18 | — |
| mist | weather (atm) | — | — | +0.07 | — |

the loops fall out naturally: plants make oxygen and eat nutrients; the fungal net and
salt make nutrients back; animals burn oxygen; weather and springs supply the moisture
land plants need. write only plants and oxygen climbs while nutrients crash — until you
allow *returning* and the decomposers close the loop. **that** is the lesson the journal
already gestures at, made mechanical.

### 1.3 the derived signs

```
bandHealth(s, lo, hi) = 100            if lo ≤ s ≤ hi
                      = 100·max(0, 1 − dist/25)   otherwise   // dist to nearest edge
                      // bands: nutrients [40,80] · oxygen [45,85] · moisture [35,75]

stability  = mean(bandHealth over the 3 stocks) · (1 + 0.04·knownEcosystems), clamp 100
complexity = Σ_life (1 + stage) + 1.5·|emergences| + 2·knownCount
```

### 1.4 stress, decline, and the meal

a life is **stressed** when a stock it *needs* falls out of band.

```
severity   = 1 − min(bandHealth of needed stocks)/100      // 0 = fine, 1 = dire
yield ×    = 1 − 0.6·severity                              // stressed life shows her less
favor pull = − 4·Σ severity                                // a hurting world trusts less
```

sustained stress, in a fragile world, is loss — and loss feeds the cycle:

```
stressTimer += severity·dt   while stressed   (decays otherwise)
if stressTimer > 60 and stability < 40:  decline one stage; reset timer
on decline below Noticed:  the life dies → nutrients += 12 (a pulse), attention freed,
                           a journal beat fires
```

a death is a nutrient pulse that often relieves the very stress that caused it — the
world oscillates back toward balance on its own. **this is the system working.** ✍️ you:
the death/decline micro-copy (see §4).

### 1.5 what the signs gate

- **oxygen** gates **animals** — below band-low they can't emerge, and existing ones
  stress and decline. (animals arrive only after the world breathes.)
- **moisture** gates **terrestrial plants** — low moisture stresses land life.
- **nutrients** scales plant **deepening speed** (effective `studyEase ×= nutrients
  health`) — a starved world is slow to know.
- **stability** gates **how fast stress turns to decline** (§1.4) and **event severity**
  (favor weather, a later pass).
- **complexity** gates **content**: when to offer higher condition tiers, the per-world
  creature-cap reveal, and **prestige availability** (you can close the Book once
  complexity ≥ a threshold, so never on turn one).

### 1.6 the canvas

a side-on **biome diorama** — sky band over a land/water cross-section — that fills and
animates from the signs, rather than a row of gauges. moisture thickens the clouds and
draws rain; oxygen tints the sky; nutrients darken the soil; stressed life dims; bound
**Bestiary sprites** stand in for the creatures so the canvas reuses art you already
make there. a small gauge cluster sits in the corner for the exact numbers.

**asset list** is in [§5](#5-asset-list-for-you). canvas is **phase B** — the sign math
(phase A) ships first as numbers in the Ledger, so nothing waits on art.

---

## 2. interventions — the *Known* endgame

today *Known* is a dead end: the card says *"(intervention arrives in a later pass.)"*
and the life drops to a passive yield. interventions turn *Known* into a **choice**:
act — gently, at a cost — or witness and leave it be. `domainVerb` (tend / guide /
encourage / shape / invoke) finally does something.

### 2.1 the shape

- unlocked per life at **Known**. **one-shot** per life per world (the *action* is spent;
  its *effect* may persist). this keeps her from drumming on one lever.
- effect: **ease a life's needs / nudge the stocks toward harmony**, which lifts favor.
- **cost ↔ reach** is the core dial, exactly as you framed it:

```
cost  ∝  breadth × magnitude × permanence
        cheap  = broad, low-magnitude, temporary
        dear   = narrow, high-magnitude, lasting
```

cost is paid in **Insight**; the monumental geology ones also cost **Essence**.

### 2.2 the five verbs, each its own thing

| domain · verb | reach | effect | feel |
| --- | --- | --- | --- |
| **plant · tend** | broad, cheap, decaying | nudges the stock this plant governs toward band for its whole category; or permanently shaves its own need | patient. "mostly to wait." |
| **animal · guide** | targeted, medium | redirects the animal's consumption (e.g. soft_swimmer off a stressed prey), relieving a hotspot — managing loss, not preventing it | a hand on the shoulder. |
| **ecosystem · encourage** | medium, lasting | permanent +stability / +interconnection — raises the floor under everything | trust in the unseen. |
| **geology · shape** | narrow, dear, permanent | moves a stock's **baseline** (spring → +moisture floor; salt → +nutrient retention) | monumental, slow. |
| **weather · invoke** | broad, cheap, temporary, **uncertain** | spikes moisture world-wide for a while — but with variance; can overshoot into flood-stress | asked, never commanded. |

these map onto the flavor already written into each life's `know` text — shape/spring,
invoke/weather, and encourage/fungal-net are almost verbatim.

### 2.3 restraint, rewarded

this is the thesis made mechanical. a hidden **intervention load** rises with each act
and decays slowly:

```
load += weight(intervention)      // 0.1 cheap … 0.5 dear
load -= 0.01 · dt                 // forgets, slowly

equilibriumFactor = inBand(all stocks) · (1 − clamp(load, 0, 1))
favor target      = 50 + 6·knownCount − 4·Σseverity + 8·equilibriumFactor
equilibriumSeconds += dt   while equilibriumFactor > 0.5   // banked for prestige (§3)
```

so a world she **props up** with constant intervention has high `load`, which *caps*
the favor it can reach — a propped world depends, it doesn't trust. a world she nudges
**rarely and precisely**, then lets settle, banks `equilibriumSeconds` that pay out at
prestige. the golden path is the light touch. ✍️ you: the line for the moment a world
first self-balances (the rewarded beat), and the line for *choosing not to* intervene.

✅ **resolved — intervention currency: Insight (+ Essence for the geology verb).**

---

## 3. prestige — closing the Book

a standard incremental loop: finish a world, mint a meta-currency from how richly and
how *gently* you grew it, spend it on permanent upgrades, open a new world that goes
further. `worldIndex` (on the Book, currently inert) becomes the run counter.

### 3.1 the loop

```
            ┌──────────────────────────────────────────────┐
            │  choose an ASSUMPTION loadout  (seeds world)  │
            └───────────────────────┬──────────────────────┘
                                    ▼
        write conditions → witness life → reach KNOWN → intervene / restrain
                                    ▼
        complexity climbs ──► prestige unlocks ──► "close the Book"
                                    ▼
        mint CONCEPTS  ∝  f(complexity, known, equilibrium)
                                    ▼
        spend CONCEPTS on the meta-tree ──► open the next Book ──┐
            ▲                                                     │
            └─────────────────────────────────────────────────────┘
```

### 3.2 what carries, what resets

leaning typical-incremental:

| carries across worlds | resets each world |
| --- | --- |
| **Knowing** (lifetime stat) | Insight, Favor, vital signs |
| **Concepts** + everything bought | written conditions, observation, attending, study |
| unlocked **assumptions** | the (procedural) life set, intervention load |
| unlocked **condition tiers / domains** | **Essence** → back to meta-upgradable base |
| **creature-cap** level | **attention capacity** → back to meta-upgradable base |
| reading-room stars, titles | |

✅ **resolved — Essence and attention reset to meta-upgradable baselines** each world;
Knowing stays the carried lifetime stat. (the old "carried" comments will be updated
when prestige lands.)

### 3.3 minting concepts

```
concepts = floor( 0.5·√complexityPeak  +  0.3·knownCount  +  0.2·√equilibriumSeconds )
```

√-scaling = diminishing returns, the genre standard: longer/richer runs pay more, but
sublinearly, so there's always a reason to reset. the `equilibriumSeconds` term is the
restraint dividend from §2.3 — **the gentlest worlds are worth the most.**

### 3.4 the meta-tree (concepts sinks)

permanent, between-worlds upgrades — bought in **the Study** (the book-closed screen,
which currently does nothing but greet you):

- **+ base Essence** / **+ base attention capacity** (your starting footing)
- **+ creature cap** — early worlds cap low (start **~12**), climbing toward the **40**
  ceiling as you invest. a full 40-life world is a late-game sight.
- **assumption slots** — unlock the *ability to change* assumptions (see §3.5)
- **condition tiers / new domains** — widen what can be written
- the usual idle multipliers: offline cap, insight rate, study speed, favor floor

✍️ you: names + one-line descriptions for the tree, or I draft and you edit.

### 3.5 assumptions as world-seeds

the foreshadow in `content/assumptions.ts` — *"the first prestige reveals they were
assumptions all along"* — pays off here. assumptions are **chosen before a world and
fixed for its lifetime** (they shape it at genesis, as you said).

- **world 1** runs the canonical set (all current assumptions true) — the hand-authored
  tutorial world, exactly today's 12 life.
- **after the first prestige**, the Study lets you swap unlocked assumptions, and each
  swap re-seeds the **procedural generator** (§3.6): which conditions/emergences/life
  are possible, and the starting stock baselines. e.g. *things can end* OFF → no
  decomposers, nutrients never recycle (a harsh, alien equilibrium); *energy from a star*
  OFF → chemosynthesis, life clusters at vents not shallows.

✍️ you: how she *feels* turning an assumption from true to chosen — the existing line
("*true* and *chosen* were never very far apart") is a perfect seed.

### 3.6 procedural worlds (phase E)

world 1 stays authored. from world 2, generate a world from the assumption loadout:

- draw a **life pool** ≤ creature-cap from templates keyed to allowed domains/biomes
- sample `insightWeight`, `studyEase`, `metabolism`, `needs` within assumption-set bands
- generate names with a small **binomial Latin generator** (the `scientificName` field
  is begging for it) + a common-name table
- author the four stage-texts from **templates per domain** (✍️ you: the template
  phrasings; procedural prose should still sound like her)

### 3.7 the soft fail

idle games rarely hard-fail. **collapse is a state, not a game-over**: if stability
sits very low too long, the world "goes quiet" — yields floor, life thins, and the only
move is to close the Book, which still pays a **guaranteed concepts floor** plus a unique
bittersweet journal beat and title. honors "loss is relational" without punishing.

✅ **resolved — placeholder now, full pass later.** phase A ships a `book.quiet` signal
(stability below `WORLD_QUIET_STABILITY`, surfaced as a quiet line in the Ledger) so the
state exists and is visible; its consequences and voice land with the collapse pass (F).

---

## 4. the voice lines I need (✍️ you)

collected so you can write them in one sitting. ✅ = already provided; the rest are
still open. all optional-to-draft — say the word and I'll rough any in Brianna's
register for you to redline.

1. ✅ **prestige currency — Concepts.** (still nice to have: one line of what they *are*
   to her.)
2. **closing the Book** — what she says/does when she lets a finished world go (the
   prestige action; distinct from the plain "close the book" toggle that exists now).
3. ✅ **the five interventions** — your lines are captured in
   `content/interventions.ts` (four each for tend / guide / encourage / shape / invoke).
4. **restraint beats** — a line for *choosing not to intervene*, and a line for the
   moment a world **first self-balances** (the rewarded equilibrium).
5. **loss** — reusable micro-copy for a life **declining** and for one **dying-as-meal**
   (per-domain if you're inspired; one each is enough to start).
6. ✅ **the vital signs — nutrients / oxygen / moisture** (plain names chosen). the
   Ledger tooltips are functional placeholders; reword them in her voice anytime.
7. **assumptions becoming choices** — the framing when prestige unlocks changing one.
8. **collapse** — the journal beat + title for a world that goes quiet (cf. the golden
   "The Witness"). the `book.quiet` placeholder is live and waiting for this.
9. **new journal seeds** — for: first intervention, first death, first equilibrium, first
   close-the-Book, first changed assumption. (extends `content/journal.ts`.)
10. **meta-tree copy** — §3.4 upgrade names/descriptions (or I draft).

---

## 5. asset list (for you)

moved to a dedicated brief with palette hexes and delivery conventions:
**[ASSETS.md](./ASSETS.md)**. its original P1 (the image-layer diorama environment) is
retired — the canvas paints sky/weather/water/sediment procedurally instead, see
[DIORAMA_ROADMAP.md](./DIORAMA_ROADMAP.md). P2/P3 there are still open, unbuilt
richness. creatures come from Bestiary bindings, so you don't draw those.

---

## 6. build order

each phase is shippable on its own and unblocks the next.

| phase | what | depends on | status |
| --- | --- | --- | --- |
| **A** | vital-signs math — stocks, bands, stress, vitality, gating; the `quiet` placeholder; surfaced as numbers in the Ledger | — | ✅ shipped |
| **B** | the canvas diorama (environment + creatures), **+ visible decline/death** (loss made legible alongside the art) | A | ✅ scaffold shipped (decline/death still pending) |
| **C** | interventions — the five verbs, intervention load, equilibrium dividend | A | ✅ shipped |
| **D** | prestige — close the Book, Concepts, the Study meta-tree, Essence/attention reset | A, C | — |
| **E** | procedural worlds — generator, name-gen, creature-cap scaling, worlds 2+ | D | — |
| **F** | collapse/soft-fail + favor weather events | A, D | — |

**the route through D, E and F is [WORLDS.md](./WORLDS.md)** — the open
questions each phase forces, candidate answers for each, and a sequence. Two
things it establishes that change the order given here: the restraint dividend
(§2.3) has to be fixed *before* D, because the mint reads `equilibriumSeconds`
and spent Concepts can't be un-spent; and E needs the world's content to be
data rather than module state, which is cheap and safe to do now and expensive
later.

**phase A is in.** the three stocks live and cycle, life metabolises and is stressed by
what it lacks, vitality mediates yield/study/favor, stability and complexity are real,
and the Ledger shows it all. **decline and death moved to phase B**: a creature wilting
or dying shouldn't happen before the canvas can show *why* — so in A, vitality floors
(dormant, recoverable) rather than removing life. next natural step is **B** (needs the
[ASSETS.md](./ASSETS.md) art) or **C** (interventions, no art required).

---

## 7. save discipline (ROADMAP.md week 6)

`../ROADMAP.md`'s public-facing arc means a stranger, not just Z, can start a
save today — there's no account and no server copy, so a save that fails to
load is gone. From week 6 on this is a hard rule, not a nice-to-have:

- **every `BookSave` shape change ships with a migration in `persist.ts` and
  a `persist.test.ts` case.** the common case — a new field — is already
  free: `load()`/`importSave()` both merge onto `emptySave()`
  (`{ ...emptySave(), ...parsed }`), so an older save missing the field just
  gets its default. a renamed field, a changed type, or a default that
  depends on other saved values needs an explicit step (see
  `inheritReadingFromLegacy` for the shape of one) — write the test against
  an old-shaped blob, not just the new one.
- **`v` stays `1`** for any change the merge-onto-`emptySave()` pattern
  covers. only bump it for a break too large to migrate, and decide
  deliberately what happens to existing `v: 1` saves when you do.
- see `persist.ts`'s own header comment for the same rule, kept next to the
  code it governs.

## 8. what this app publishes, and what it only reads (ROADMAP.md week 10)

marginalia publishes nothing of its own to `/api/public` — no passphrase
gate lives in this app, and nothing here has ever needed one. its part in
the public read path (see `../ARCHITECTURE.md`'s "the public read path")
is entirely on the reading side:

- **the bestiary's creatures**, read in `witch/bestiaryDb.ts` and bound
  into the diorama (`isolatedSprite ?? sprite`) — a fallback chain, never
  a hard dependency: local IndexedDB first, the published snapshot next,
  the unbound placeholders last. losing the network never empties the
  world.
- **echoes' published letters**, read in `reading/echoesLibrary.svelte.ts`
  and offered in the reading room alongside pasting your own text — never
  in place of it. the same `idle → loading → ready/empty → error` shape as
  the bestiary gallery's own store, on purpose.

both reads are unauthenticated `pullPublic()` calls — the same fetch any
stranger's browser could make. if a "publish from marginalia" feature is
ever added (there's no such plan today), it needs the same explicit,
per-item opt-in write/bestiary already enforce — nothing here should ever
become public by drifting into a snapshot unasked.
