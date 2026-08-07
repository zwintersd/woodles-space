# abstraction — marginalia's idle layer against the GameDef schema

marginalia is a working idle game. `@woodles/incremental-core` is a schema for
describing idle games, and bloomforge is the studio that authors one. they were
built two years of commits apart and neither knows the other exists. this file
asks the obvious question — *could the schema say marginalia?* — and answers it
honestly: **most of it, yes; the part that makes it marginalia, no.**

read alongside [`packages/incremental-core/README.md`](./packages/incremental-core/README.md)
for what the schema commits to and why, and
[`apps/marginalia/DESIGN.md`](./apps/marginalia/DESIGN.md) for the mechanics
this measures. this is a gap analysis, not a plan — nothing here is scheduled.

## the two readings of the question

**"port marginalia onto incremental-core"** is the wrong goal and this document
does not recommend it. marginalia's value is its texture: four hand-written
paragraphs per creature, a journal that watches your favor band, a diorama that
paints sky from a moisture number, bestiary sprites bound in from another app's
IndexedDB. none of that is schema-shaped, and a `GameDef` that carried it would
stop being a schema.

**"teach the schema marginalia's vocabulary"** is the useful one. bloomforge
can currently author cookie clickers without the cookie. marginalia is the
best available specification of the *other* genre of idle game — the bounded,
oscillating, negative-feedback kind — and reading the schema against it turns
up eleven concrete things an author cannot yet say. that list is §3.

---

## 1. what marginalia's idle layer is made of

stripped of voice, the whole game is in `apps/marginalia/src/lib/witch/`.

### resources

| thing | shape | notes |
| --- | --- | --- |
| `insight` | unbounded accumulator | the idle currency. `Σ life (insightWeight × stageMult × vitality × mastery) × favorMult` |
| `essence` | unbounded accumulator | spent writing conditions; granted on reaching Studied and Known; distilled from insight 60→1 |
| `knowing` | lifetime counter | never spent, never reset |
| `favor` | **bounded 0..100, lagging** | eases exponentially toward a target derived from four state metrics; multiplies *all* insight ×0.5..×1.5 |
| `stocks` × 3 | **bounded 0..100, two-way, drifting** | nutrients / oxygen / moisture. life produces *and consumes* them; each drifts back toward a baseline |
| `vitality[lifeId]` | **bounded 0..1, per-entity, lagging** | health. eases toward 0 under stress, toward 1 when met |
| `interventionLoad` | **decaying counter** | rises 0.1–0.5 per act, decays 0.01/s |
| `equilibriumSeconds` | **time-in-state accumulator** | banks dt only while a predicate holds |
| `complexity`, `stability` | pure derived | weighted sums over entity state and stock band-health |
| `focusStreak` | transient combo | session-only, not persisted |

five of those eleven are shapes the `GameDef` has no word for.

### entities

`Life` (`content/life.ts`) is the generator analogue: `insightWeight` is a base
rate, `studyEase` is a progress rate, `requires: string[]` is an unlock
predicate over written conditions, `category`/`domain` are tags, and
`metabolism` is a **signed vector** of per-second effects across three stocks
with `needs` as healthy bands on the stocks it depends on.

a life's "level" is its `stage` (0–3: noticed / observed / studied / known).
crucially, **stage is not bought** — it accrues from time attended.

### actions

| action | shape |
| --- | --- |
| `writeCondition` | pay essence → reveal life. a one-shot upgrade whose effect is an unlock |
| `attend` / `unattend` | **capacity-limited** toggle (starts at 2 slots) |
| `lookCloser` | **a click.** adds study-seconds × `studyEase` × a streak multiplier |
| `expandAttention` | pay insight → +1 slot, tiered `[45, 130, 320, 750]` |
| `distillEssence` | **a manual exchange**: 60 insight → 1 essence, on demand |
| `intervene` | one-shot per life, **costs two currencies**, domain-specific persistent effect, raises load |
| `pourSediment` | **held, continuous spend** filling a grid; coverage ≥ 0.6 unlocks a worldspace |

### the tick

`book.svelte.ts:815–919`, in order: vitality eases per life from severity →
attended life accrues study (scaled by vitality) → stocks move by summed
metabolism plus drift, clamped → insight accrues → load decays and equilibrium
banks → favor eases toward its derived target. everything that lags uses
`1 − exp(−k·dt)` so it is stable at any step size — which is what lets
`creditOffline` replay eight hours in coarse 5-second chunks and stay honest.

---

## 2. what the schema already says

this is most of the app, and it is a good result for a schema that was never
designed with marginalia in mind.

- **insight as a `Currency`, life as `Generator`s.** `insightWeight` is exactly
  `baseRate`.
- **the four observation stages as generator levels**, `maxLevel: 3`. the
  non-uniform yield ramp `[0, 0.2, 0.6, 1.0]` is a `steps` curve with base
  `0.2 × insightWeight` and breakpoints at levels 2 and 3 — and level 0
  producing nothing is already the engine's rule ("an unowned generator is not
  a slow generator", `curves.ts`).
- **`requires: string[]` → `Unlock`.** written conditions become one-shot
  `Upgrade`s costing essence; each life gets an `Unlock` whose `when` is an
  `{ all: [...] }` of `upgradeOwned`. this maps exactly, including the sticky
  reveal semantics.
- **the attention cost table `[45, 130, 320, 750]`** is a `steps` cost curve.
  awkward to author, but expressible.
- **`knowing`** is `currencyLifetime`, or `taggedLevelSum` over a tag hung on
  everything.
- **`distillEssence`'s 60→1** is `Generator.converts` — as an automatic drip
  rather than an on-demand exchange, but the economics are identical.
- **the save discipline matches.** marginalia merges an old save onto
  `emptySave()`; the core reconciles a save against the current def. same
  problem, same answer, arrived at independently.

---

## 3. the gaps

ranked by how much of marginalia each one blocks. every entry names the
smallest schema change that would close it, because "add an expression
language" closes all of them and is the wrong answer — the schema's refusal to
parse expressions is load-bearing and should survive this list.

### 3.1 production can't read a currency

**the mechanic.** a stock out of band stresses the life that needs it
(`vitals.ts:50`), stress drains vitality (`vitals.ts:63`), and vitality scales
both that life's insight yield and its own metabolism (`book.svelte.ts:304`,
`826`). rate is a function of *how much of a resource exists*. that feedback
loop is the entire ecology.

**why it doesn't fit.** `PopulationBoost` has two metrics —
`unequippedUpgrades` and `taggedLevelSum` — and both read *entity levels*
(`types.ts:115`). `Effect` values are constants. so no generator's rate can
depend on a currency amount. note the asymmetry: `Condition` *does* have
`currencyAmount` with comparisons, so the schema can already **gate** on a
resource level; it just can't **scale** on one.

**smallest change.** a third `PopulationBoost` variant:

```ts
| { metric: 'currencyAmount'; currencyId: string; perUnit: number }
```

that buys linear dependence. marginalia's is a band — a plateau inside
`[lo, hi]` falling linearly to zero 25 points outside — so the faithful version
is a second variant returning 0..1:

```ts
| { metric: 'currencyBand'; currencyId: string; lo: number; hi: number; falloff: number }
```

**cost.** the schema half is trivial. the engine half is not free: `Modifiers`
is cached behind one dirty flag on the explicit premise that "buying, and
resetting, are the only invalidation points there are" (`engine.ts`). a
currency-driven boost changes every tick, so any def using one has to
recompute `resolveModifiers` per tick — which is precisely the two-million-
`Math.pow` case the cache exists to avoid. the fix is to mark defs that use the
metric and only re-resolve those, but it needs measuring against the 500ms/10h
budget rather than assuming.

### 3.2 currencies are unbounded and one-way

**the mechanic.** stocks are clamped to `[0, 100]`, are *consumed* as well as
produced (algae eats nutrients, swimmers burn oxygen), and drift back toward a
baseline at `0.02 × (baseline − value)` per second so an untouched world sits
still (`vitals.ts:91`, `book.svelte.ts:848`).

**why it doesn't fit.** `Currency` has no bounds. `baseRate < 0` is a hard
validation error — "base rate cannot be negative" (`validate.ts:135`). the only
ways a balance falls are a purchase and a `converts` draw. there is no drift,
no upkeep, no ceiling.

**smallest change.** `Currency.bounds?: { min, max }` and
`Currency.drift?: { toward: number, rate: number }`. signed production is the
harder half — `Generator.converts` is already the engine's precedent for "a
generator that consumes", and extending it to a *vector* of currencies rather
than one would cover metabolism directly.

**cost.** a max means production can be wasted, and every rate readout in the
studio currently promises it won't be. `converts` already solved the same
honesty problem for throttled output (`throttledRate` returns a snapshot, not
a promise), so there's a pattern to follow. `lifetime` stays monotone either
way, so prestige is unaffected.

### 3.3 nothing in the schema has inertia

**the mechanic.** favor, vitality and the stocks all *lag*. favor eases toward
`50 + 6·known − 4·Σseverity + 8·equilibrium` (`book.svelte.ts:910`) — a
weighted sum of four different state metrics — and it multiplies every insight
gain in the game.

**why it doesn't fit.** every quantity in a `GameDef` is an instantaneous
function of state. more pointedly: **there is no weighted-sum-of-metrics node
anywhere in the schema.** conditions compose with `all`/`any` (booleans);
curves take one base and one shape; `populationBoost` takes one metric and one
`perUnit`.

**this is the gap that tests the schema's central decision.** "structured, not
expressions" is right for curves and right for conditions. a target formula
with four weighted terms is where it starts to bite. the containable version is
a bounded sum node — a list of `{ metric, weight }` with a constant offset,
which is strictly less than an expression language and covers both this and
`complexity` — rather than a parser.

### 3.4 progress can only be bought

**the mechanic.** `study[lifeId]` accrues at `dt × studyEase × vitality` while
attended; crossing `STAGE_SECONDS[next]` **consumes** the threshold, advances
the stage, and grants essence (`book.svelte.ts:517–558`). nothing is paid. the
currency is time and attention.

**why it doesn't fit.** a generator's level only rises via `buyGenerator`,
which debits a wallet. there is no automatic level-up and no per-entity
progress. the workaround — make study a currency and each stage an upgrade —
fails twice: a policy has to *choose* to buy it (so `idlePolicy` never
advances, and the idle bound stops being a bound), and the cost is global where
the progress is per-entity.

**smallest change.** `Generator.progress?: { fromCurrencyId, threshold: Curve }`
— a generator that levels *itself* by draining a currency at a threshold. it
sits naturally beside `converts`, reuses `Price`'s curve, and needs no new
action.

### 3.5 milestones can't pay out

**the mechanic.** essence on reaching Studied and Known (`book.svelte.ts:537`).
category mastery: every life in a category at Known permanently lifts that
category's yield by 12%, sticky once earned (`book.svelte.ts:573`).

**why it doesn't fit.** `Milestone` says so in its own doc comment: *"no
mechanical effect in the MVP. it exists so the log has celebration points."*
`Unlock` can only reveal, and a revealed upgrade still has to be bought.

**smallest change.** `Milestone.grants?: { currencyId, amount }[]` and
`Milestone.effects?: Effect[]`. this is the highest value-per-line item on the
list — it closes level-up rewards, set-completion bonuses, and the whole
category of "reaching X does something" — and it costs nothing structurally,
because `checkMilestones` already runs every tick and already compacts its
pending list.

### 3.6 there is no click

**the mechanic.** `lookCloser` (`book.svelte.ts:508`) plus a streak: clicks
within 2.2 seconds of each other compound a capped +9%-per-step multiplier
(`focus.ts`).

**why it doesn't fit.** `Action` is `buyGenerator | buyUpgrade | equipUpgrade |
unequipUpgrade | prestige` (`state.ts:35`). there is no manual production
action, no click power, and no transient session state.

**worth stating plainly: a studio for making incremental games cannot currently
express a cookie you click.** the genre opens with one.

**smallest change.** `GameDef.clickers: { id, name, producesCurrencyId,
baseAmount, rateCurve? }[]`, an `{ type: 'click'; id }` action, and a
`clickPower` `EffectStat` so upgrades can scale it. the streak is a separate,
optional layer and can wait.

**the catch is balance, not schema.** `idlePolicy` and `greedyPolicy` bracket
*purchasing*. neither clicks. add clickers without a third policy and the
balance tab silently under-reports every def that has one — so this lands with
a `clickerPolicy(clicksPerSecond)` or it lands broken.

### 3.7 activation is free and unlimited

**the mechanic.** `attentionCapacity` starts at 2 and is bought up
`[45, 130, 320, 750]`. only that many lives can be attended at once, and
reaching Known auto-frees the slot (`book.svelte.ts:551`). choosing what *not*
to watch is the core minute-to-minute decision.

**why it doesn't fit.** `equipped` exists and is exactly the right primitive,
but it is free and uncapped — "no cost beyond the one already paid". the Apiary
fixture is built entirely on hoarding *unequipped* upgrades, so the concept is
already load-bearing; there is just no scarcity in it.

**smallest change.** `GameDef.equipSlots?: number` plus an `equipSlots`
`EffectStat`. small, self-contained, and it converts `equipped` from a
curiosity into a real decision — which would also give `greedyPolicy`
something interesting to be bad at, the way the Apiary already proves it is.

### 3.8 nothing punishes acting

**the mechanic.** `interventionLoad` rises 0.1/0.3/0.5 per act by permanence
and decays at 0.01/s. `equilibriumFactor = inBand × (1 − load)` caps the favor
bonus and gates whether `equilibriumSeconds` bank at all (`tuning.ts:99`,
`book.svelte.ts:410`). a world she props up cannot reach the favor a world she
leaves alone can. this is marginalia's thesis made mechanical.

**why it doesn't fit.** the schema is monotone by construction. every action is
a purchase and every purchase helps; `populationBoost.perUnit` is validated
non-negative (`validate.ts:151`).

**but this one mostly composes out of the others**, which is the useful
finding. `Currency.spendTax` already mints a byproduct on every debit anywhere,
and `confessionBooth` is a working fixture of an economy running on guilt. so:
a `load` currency taxed on every purchase, drifting back toward zero (§3.2),
feeding a negative-`perUnit` currency boost (§3.1) — three additions already on
this list, plus relaxing one validation rule. what looked like a missing stance
is a missing composition.

### 3.9 prices are single-currency

geology interventions cost insight **and** essence (`content/interventions.ts`).
`Price.currencyId` and `Upgrade.cost.currencyId` are each exactly one
(`types.ts:72`, `176`).

`cost: Price | Price[]` is a one-line schema change and a wide engine diff:
affordability checks, `nextCost` (which returns a single `number | null`), the
cost cache keyed one-per-entity, and greedy's cheapest-first ordering — which
has no meaning across two currencies without a policy for comparing them.
small field, wide blast radius; worth doing deliberately or not at all.

### 3.10 prestige is one term over one currency

marginalia's design (DESIGN.md §3.3) mints
`floor(0.5·√complexityPeak + 0.3·knownCount + 0.2·√equilibriumSeconds)` —
three terms, over three different *kinds* of quantity.

`PrestigeGain` is `{ sourceCurrencyId, threshold, exponent }` (`types.ts:211`).
missing: multi-term sums, **peak tracking** (`CurrencyState` records `amount`
and `lifetime`, never a high-water mark), and a **time-in-state accumulator**.

`gainFormula: PrestigeGain[]`, summed, plus `CurrencyState.peak`, plus a timer
primitive. the timer is the interesting one and generalizes well past
marginalia — *"bank seconds while this `Condition` holds"* also gives you
`equilibriumSeconds`, "survive N minutes", and any streak or uptime mechanic.
it is a small entity kind with a `when` and a currency to bank into, and it
would ride the `checkMilestones` loop that already evaluates conditions each
tick.

### 3.11 offline progress

`creditOffline` (`book.svelte.ts:923`) credits at most 8 hours, replayed in
5-second steps *so rates stay honest as stages advance and favor drifts*, and
surfaces a one-shot report.

this is already a **named** non-goal for bloomforge: the player "clamps a
backgrounded tab's frame delta rather than paying it out, because offline
earnings are a design decision, not an accident of rAF" (ARCHITECTURE.md). that
reasoning is right, and marginalia is the argument for making it an *authored*
decision rather than a refused one — it has the honest implementation already,
and coarse replay rather than `rate × elapsed` is exactly what a schema-level
`offline?: { capSeconds, replayStepSeconds }` would have to specify. the engine
needs nothing: the fixed timestep makes replay exact and `step()` already
carries partial ticks.

---

## 4. what shouldn't move

naming these so nobody reads §3 as a to-do list that ends in a port.

- **the prose.** four stage paragraphs per life, journal seeds keyed to favor
  bands, field-note templates, titles. content, not mechanics.
- **the world shaping.** sediment painting, worldspaces, spawn points, feature
  placement (`worldShape.ts`, 824 lines). a spatial editor bolted to a resource
  sink. the schema's job is economies, not level layout — the only part worth
  generalizing is the *shape* of `pourSediment`, "a sink with a continuous rate
  and a completion threshold that unlocks something", and that is nearly
  `converts` + `Unlock` already.
- **the bestiary binding, the diorama, the reading room.** cross-app reads and
  a second game entirely.
- **`Math.random()` in the line pickers.** the engine's determinism contract
  exists so that *balance comparisons* mean something. marginalia never
  compares runs; it is played, not measured. it does not need the contract and
  should not pay for it.

---

## 5. the finding

the eleven gaps are not eleven missing features. they are one difference,
showing up eleven times.

**bloomforge's schema describes an economy: monotone, unbounded, where every
action helps and the only question is ordering. marginalia is a simulation:
bounded, oscillating, with negative feedback and an equilibrium attractor,
where the winning move is frequently to do nothing.** those are two genres of
idle game, and the schema currently commits to one of them.

five additions would let it hold both — bounded currencies with drift (§3.2),
production that reads a currency (§3.1), payouts on a condition (§3.5), the
time-in-state timer (§3.10), and signed/vector production (§3.2 again). the
rest of the list is convenience.

and two of them are worth doing regardless of whether marginalia is ever the
reason: **milestones that pay out** (§3.5) is the cheapest real capability in
the schema's future, and **a click** (§3.6) is a hole in a tool for making
incremental games that no amount of curve editing fills.
