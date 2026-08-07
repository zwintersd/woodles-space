# abstraction — simulating marginalia

the goal is a **simulator you can tune feel with**: fast-forward marginalia's
economy, watch the curves, sweep a constant in `tuning.ts` and see what it did
to time-to-first-Known. not a port, not a schema, nothing that limits what
marginalia is allowed to become.

that turns out to be a much smaller job than it looks, and the obstacle is not
where you'd expect. **the schema is not in the way. marginalia's own
reactivity is.**

> **status: built.** §3's split shipped — `world.ts` holds the mechanics with
> nothing reactive in them, `book.svelte.ts` is a view over it, and `sim.ts` is
> the harness with the two policies §5 asks for. ten hours of game time went
> from ~33.5s to **1.3s**, the whole game loop went from zero test coverage to
> covered, and the first readings are in
> [`apps/marginalia/BALANCE.md`](./apps/marginalia/BALANCE.md) — they are not
> comfortable. §6 is still open and still not the plan.

read alongside [`apps/marginalia/DESIGN.md`](./apps/marginalia/DESIGN.md) for
the mechanics, [`apps/marginalia/BALANCE.md`](./apps/marginalia/BALANCE.md) for
what the harness found, and
[`packages/incremental-core/README.md`](./packages/incremental-core/README.md)
for the harness this borrows from. §6 answers a different, secondary
question — what bloomforge *authors* can't yet express — and is kept because
it's true, not because it's the plan.

---

## 1. what "simulate for feel" actually needs

feel questions are pacing questions, and every one of them is answered by
running the economy faster than real time and looking at the curve:

- how long to the first *Known*? to all of them?
- does the world ever self-balance without her, or does the drift term always
  win?
- what does the insight curve look like in the first hour at attention 2, vs.
  3, vs. 4 — and is there a dead stretch where nothing is affordable?
- does restraint actually pay? `equilibriumSeconds` is supposed to make the
  light touch worth more. is it, at the current numbers?
- what happens to the stocks over ten hours with every life at *Known* — does
  the metabolism close, or does something crash?

to answer those you need five things: a headless tick, determinism, speed,
sampling, and two policies to bracket play between. marginalia has the first,
nearly has the second, badly lacks the third, and has neither of the last two.

---

## 2. what's actually in the way — measured

all numbers below are from running the real `Book` against the real
`content/life.ts`, 11 life revealed, in vitest under the app's existing config.

### 2.1 the Book already runs headless

`book.test.ts` says, twice, that it can't:

> *Constants from book.svelte (duplicated here to avoid importing the Book
> class which uses Svelte 5 $state runes that can't be instantiated in test
> context)*

**this is false.** `new Book()` works. `$derived` and `$derived.by` resolve.
`writeCondition` reveals life, `attend` fills a slot, `tick(dt)` advances
stages and accrues insight — all under the app's current vitest setup, which
already loads the svelte plugin. the Book uses `$state` and `$derived` and
never `$effect`, and only `$effect` needs a component context.

the cost of believing otherwise is the real damage: **the entire game loop has
no test coverage.** `book.test.ts` copy-pastes `fmt` and the stage constants to
avoid the import, and so tests a duplicate of the formatter instead of the
economy. every number in `tuning.ts` is currently unverified by anything.

### 2.2 it is already deterministic, except the prose

two identical runs — same construction, same actions, 3,000 ticks — produced
**bit-identical** insight, favor and stocks. the only divergence was the field
notes: `pickLine(..., Math.random())` and `Math.random()` in `intervene`'s line
choice and `invoke`'s ±40% variance.

so determinism is nearly free. seed the line picker and the invoke roll and it
is total — and `incremental-core/src/rng.ts` is already a small seeded PRNG
that saves its stream position, built for exactly this.

### 2.3 it is ~180× too slow to tune with

| what | 10h of game time | vs. budget |
| --- | --- | --- |
| `Book.tick()` as it stands | **~33,500 ms** | 67× over |
| same arithmetic, plain objects, no runes | 1,348 ms | 2.7× over |
| same arithmetic, flat arrays, no allocation in the loop | **189 ms** | **inside** |

the budget is incremental-core's own: 500 ms for ten hours, which it hits with
~150 ms. and the three rows produce the **same number** — `insight=658597` in
both the plain and flat versions, so this is optimization, not approximation.

the 33.5 seconds breaks down cleanly, and neither part is algorithmic:

**~21× is svelte reactivity.** every tick reassigns four `$state` containers
(`this.study = {...this.study, [id]: banked}`, `this.vitality = nextVit`,
`this.stocks = s`, `this.stockHistory = {...}`), and each one invalidates a
`$derived` chain — `life` → `visibleLifeForWorldspace`, `baseInsightRate` over
every life, `complexity`, `stability`, `equilibriumFactor`. an **empty world
with no life at all** still costs 33 µs per tick, which is pure bookkeeping.
that's fine at 60fps and ruinous at 360,000 ticks.

**~7× is allocation in the hot loop.** `lifeStockRate` returns a fresh
`StockVector` per life per tick — 11 × 360,000 = **4 million short-lived
objects** — and `severityFor` walks `STOCK_IDS` with a sparse record lookup for
each. denormalizing life into `Float64Array`s once, up front, and accumulating
in place takes 1,348 ms to 189 ms.

one hypothesis that did **not** pan out, recorded so nobody re-tries it: hoisting
the constant exponentials (`1 − exp(−k·dt)` is fixed at a fixed timestep for
the recovery and favor-drift cases) saves 8%. `Math.exp` is not the problem;
garbage is.

---

## 3. the fix: split the model from the reactivity

marginalia's own codebase already believes in this seam and states it twice —
`vitals.ts` and `focus.ts` both open with *"pure and rune-free so it can be
unit-tested directly — the Book holds the `$state` and calls into this."* the
split just stops short of the tick.

carried the rest of the way, this is what shipped:

- **`world.ts`** — `World`, a plain class with `tick(dt)` and the actions
  (`writeCondition`, `attend`, `lookCloser`, `intervene`, `distillEssence`, …)
  over a plain `WorldState`, and a seeded RNG. no runes, no `Date.now()`, no
  `localStorage`, no `Math.random()`. **every mechanic lives here, and it is
  marginalia's own** — no schema, no `GameDef`, nothing it has to be
  expressible in. things worth telling a player about come back as
  `WorldEvent`s; it renders nothing itself.
- **`book.svelte.ts`** — the runes class, reduced to a view. it owns a `World`
  and keeps persistence, the wall clock, offline credit, the bestiary bindings,
  the reading room, the field-note log and the gain popups. its public surface
  is unchanged, because forty files read `book.*`.

reactivity runs through **one `version` counter** rather than per-field
`$state`: every getter reads it, every mutation bumps it. that is coarser than
tracking each field, and it is what lets the world underneath be plain objects
the harness can drive 360,000 times without paying for a proxy. it also turned
out to be *faster for the UI too* — one counter bump per tick beats four
container reassignments, and the app's own test suite dropped from 14.6s to
3.6s on the strength of it.

the numbers, measured after:

| | 10h of game time |
| --- | --- |
| before, through the Book's runes | ~33,500 ms |
| after, through `World` | **~1,300 ms** |

flattening to typed arrays (§2.3) remains a separate, unbuilt step. it would
buy another ~7×, and 1.3 s per ten-hour run has not yet been the thing that
hurts — a full simulated day costs about three seconds.

the safety net that made this safe to do: `characterization.test.ts` pins the
Book's behaviour to exact golden numbers, written *before* the extraction and
passing unchanged after it. thirty cases covering the tick order, the stage
thresholds, the metabolism, the sinks, the interventions, the equilibrium
dividend and the save round trip.

---

## 4. from bloomforge, take the harness — not the schema

this is the part worth being precise about, because "use incremental-core"
sounds like "become a `GameDef`" and it doesn't have to.

`incremental-core`'s `Simulation` is welded to `GameDef`, but most of what
makes it *useful* isn't:

| genuinely generic | `GameDef`-specific |
| --- | --- |
| fixed 100 ms timestep, integer tick counting, partial-tick carry in `step()` | `produce()` |
| seeded RNG that saves its stream position (`rng.ts`) | curves, conditions, modifiers |
| `SeriesSample` / `sampleIntervalFor` sampling | unlocks, milestones, prestige |
| the policy interface, and bracketing play between two naive bounds | `idlePolicy` / `greedyPolicy` themselves |
| the Web Worker balance runner and the time-to-milestone summary | — |
| the playtest dock's 1×/10×/100× stepping and its charts | — |

the left column is generic over *"a thing that ticks and reports numbers."*
a `WorldModel` satisfies that. the smallest useful move is a narrow interface —
`step(seconds)`, `sample()`, a named-events stream — that both `Simulation` and
`WorldModel` implement, so marginalia can drive the same worker and the same
charts without inheriting a single schema constraint.

two details from the core worth stealing outright even if nothing is shared:
**integer tick counting** (three hundred float subtractions of 0.1 lose a whole
tick, which is how `step(30)` once ran 29.9 seconds) and **saving the RNG's
stream position, not just its seed** (without it, reload replays the first
second's rolls and save-scumming a bad `invoke` becomes free). marginalia's
`invoke` variance makes the second one a live bug the moment it seeds its RNG.

---

## 5. marginalia needs its own policies

`idlePolicy` and `greedyPolicy` do not transfer, and it's worth knowing why:
they bracket **purchasing**, and marginalia's scarce resource is **attention**.
"buy the cheapest affordable thing" is not a strategy in a game whose central
decision is which two of eleven things to watch.

the *pattern* transfers exactly, though — bracket real play between two naive
bounds and trust anything that feels good under both. marginalia's bounds are:

- **witness-only** — attend whatever is closest to its next stage, never
  intervene, never distill. the floor, and the thesis's ideal player.
- **interventionist** — intervene the instant any life reaches *Known* and can
  be afforded, distill aggressively. the ceiling on meddling.

the gap between those two *is* the answer to "does restraint pay?", which is
the one balance question the whole design rests on. that comparison was the
reason to build any of this.

**both shipped, and the answer is no.** across 2, 6, 12 and 24 hours, Witness
and Interventionist bank *identical* favor, equilibrium share, equilibrium
seconds and minted concepts — to the digit. the mechanic built to make the
light touch worth more currently cannot tell the two apart. that finding, and
three more like it, are in
[`apps/marginalia/BALANCE.md`](./apps/marginalia/BALANCE.md); the four are
pinned as assertions in `sim.test.ts` so retuning says what it changed.

run them with `pnpm --filter marginalia balance`. it takes about forty seconds
and is deliberately outside the default test glob, because a suite that slow
stops being run.

a third bound, `attention-thrash` (re-attend every tick to whatever has the
highest marginal yield), would bound the min-maxer the design explicitly does
not want to reward. not built — on the current numbers it would have nothing to
optimise, since the whole visible world is Known inside five minutes.

---

## 6. the other question: what the schema can't say

kept because it's accurate, demoted because it answers *"could bloomforge
author a marginalia-like game?"* — a real question, but not this one, and not
a prerequisite for anything in §1–5.

| # | marginalia does | the schema can't | smallest change |
| --- | --- | --- | --- |
| 1 | rate depends on a **currency level** (stock → band health → vitality → yield) | `PopulationBoost` reads entity levels only. `Condition` *can* gate on `currencyAmount`; nothing can *scale* on it | a `currencyAmount` / `currencyBand` `PopulationBoost` variant — but it breaks the per-purchase dirty-flag cache, so it needs measuring |
| 2 | **bounded, two-way, drifting** stocks (0–100, consumed as well as produced, pulled toward a baseline) | no bounds; `baseRate < 0` is a hard validation error | `Currency.bounds` + `Currency.drift`; extend `converts` to a vector for signed metabolism |
| 3 | three quantities that **lag** (favor, vitality, stocks) toward a weighted-sum target | everything is instantaneous; there is no weighted-sum-of-metrics node anywhere | a bounded `{metric, weight}[]` sum node — strictly less than an expression language |
| 4 | stages advance on **accumulated time**, consuming a threshold, paying nothing | levels only rise via `buyGenerator`, which debits a wallet | `Generator.progress?: { fromCurrencyId, threshold: Curve }` |
| 5 | essence on reaching Studied/Known; category mastery pays +12% | `Milestone` has "no mechanical effect" by design; `Unlock` can only reveal | `Milestone.grants` / `Milestone.effects` — **cheapest real capability on this list** |
| 6 | `lookCloser`, plus a 2.2 s streak window | no click action, no click power, no transient state | `GameDef.clickers` + a `click` action + a `clickPower` stat — *and* a `clickerPolicy`, or the balance tab silently under-reports every def that has one |
| 7 | attention is **capped** at 2, bought up `[45,130,320,750]` | `equipped` is free and uncapped | `GameDef.equipSlots` + an `equipSlots` stat |
| 8 | `interventionLoad` rises per act, decays, and **caps** the favor bonus | monotone by construction; `perUnit` is validated non-negative | mostly **composes** out of 1+2 plus `spendTax`, which already mints a byproduct on every debit — see the `confessionBooth` fixture |
| 9 | geology interventions cost insight **and** essence | `Price.currencyId` is exactly one | `cost: Price[]` — one-line schema change, wide engine diff (`nextCost` returns one number; greedy's cheapest-first has no meaning across two currencies) |
| 10 | `0.5√complexityPeak + 0.3·known + 0.2√equilibriumSeconds` | `PrestigeGain` is one currency, one exponent; no peak tracking, no time-in-state | `gainFormula[]` + `CurrencyState.peak` + a **timer primitive** ("bank seconds while this `Condition` holds") that generalizes well past marginalia |
| 11 | 8 h offline cap, replayed in 5 s steps so rates stay honest | a named non-goal ("offline earnings are a design decision, not an accident of rAF") | `offline?: { capSeconds, replayStepSeconds }` — the engine needs nothing; the fixed timestep already makes replay exact |

the shape of that list: **the schema describes an economy** — monotone,
unbounded, every action helps, the only question is ordering. **marginalia is a
simulation** — bounded, oscillating, negative feedback, where the winning move
is often to do nothing. two genres of idle game, and the schema currently
commits to one.

two of the eleven are worth doing whether or not marginalia is ever the reason:
**milestones that pay out** (#5) and **a click** (#6). a studio for making
incremental games can't currently express a cookie you click.

---

## 7. what shouldn't move

- **the prose.** four stage paragraphs per life, journal seeds keyed to favor
  bands, field-note templates, titles.
- **the world shaping.** sediment painting, worldspaces, spawn points
  (`worldShape.ts`, 824 lines) — a spatial editor bolted to a resource sink.
  the simulator can ignore it entirely by seeding a worldspace directly; note
  that `visibleLifeForWorldspace` means an un-poured world shows only 4 of 11
  life, so any harness has to be able to *set up* a world state rather than
  only play into one.
- **the bestiary binding, the diorama, the reading room.**
- **and marginalia's freedom to grow.** nothing in §3–5 constrains what it can
  become. prestige (DESIGN.md §3), procedural worlds (§3.6) and collapse (§6F)
  are all unbuilt and all outside what the schema could express today — which
  is exactly why the model stays marginalia's own and only the *driver* is
  shared.
