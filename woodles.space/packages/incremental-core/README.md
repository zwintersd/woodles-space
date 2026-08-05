# @woodles/incremental-core

The schema, validator, and simulation engine behind [Bloomforge](../../apps/bloomforge) —
a studio for making incremental games, not an incremental game.

Zero runtime dependencies, no DOM. The editor imports it, the balance runner
imports it inside a Web Worker, and
[the player](../../apps/bloomforge-player/README.md) imports it too. None of
them import each other.

## the GameDef is the product

`GameDef` (in [`src/types.ts`](./src/types.ts)) is the one thing all three
layers agree on. It serializes to JSON without loss, every id is a stable slug,
and it carries `schemaVersion: 1`.

Two schema decisions are load-bearing and deliberate:

**Curves are structured, not expressions.** `base × growth^level` covers most
real incrementals, and a parser is a rabbit hole with a foot-gun at the end.
Every kind — `geometric`, `linear`, `polynomial`, `steps` — is normalized so
that **level 1 evaluates to exactly the base**, which is what lets the inspector
plot any two against each other and lets `baseRate` mean "output at level 1"
regardless of which kind is chosen. The union is open; an `{ kind: 'expression' }`
variant can land later without invalidating anything already authored.

**Conditions are structured predicates**, for the same reason: a condition you
can render as a form and reason about statically beats one you have to parse.

The schema goes past the build spec's literal `Condition` union in exactly one
place: `upgradeOwned` takes an optional `level`, so "requires Golden Touch level
10" — the spec's own worked example — is expressible. Omitting it still means
"owned at all".

**An owned upgrade isn't always an active one.** `SimState.upgrades[id].equipped`
(default `true`) gates whether its effects apply — the `equipUpgrade` /
`unequipUpgrade` actions flip it for free, any time, no cost beyond the one
already paid. That one bit is what let `Generator.populationBoost` exist in
the first place: a rate multiplier driven by a live count instead of a level,
and a matching `Condition` metric so an unlock or milestone can react to it
too. See [`apiaryOfBadDecisions`](./src/fixtures/apiary-of-bad-decisions.json)
— a generator whose output rewards owning upgrades you deliberately never
turned on.

**Production doesn't have to be one-directional.** `Generator.converts`
throttles a generator's output to whatever `fromCurrencyId` can actually
supply *this tick* — `baseRate` / `rateCurve` / every modifier still set the
ceiling, converting only ever produces less than that, never more. Nothing
has to feed it on purpose: `Currency.spendTax` mints a byproduct in another
currency the instant a wallet is debited, anywhere — a generator level, an
upgrade buy — so a converter can run on the exhaust of an economy that was
never built to feed it. See
[`confessionBooth`](./src/fixtures/confession-booth.json) — a generator that
consumes instead of produces, fed entirely by a tax on every other purchase
in the game.

**`populationBoost`'s first metric was one hardcoded count in a closed union
— honest about what it was, but not a real answer to "sum something across an
arbitrary, designer-defined set."** `taggedLevelSum` is: `Generator.tags`,
`Upgrade.tags` and `PrestigeLayer.tags` are free-text labels with no meaning
to the engine except as something this metric (and the matching `Condition`
metric) can sum by *level* — a generator's level, an upgrade's level, a
layer's reset count — across every entity carrying a tag, regardless of kind.
It's also the one metric that needs `def`, not just `state`, to answer at all
— which tag which entities carry is authoring data, so `evaluateCondition`
grew an optional third parameter for it, defaulting every existing call site
to unchanged behavior. See
[`choirOfUnspokenNames`](./src/fixtures/choir-of-unspoken-names.json) — a
generator whose rate sums a tag across a generator, an upgrade and a prestige
layer at once, carefully never itself.

## numbers

Every piece of arithmetic, including the comparisons, goes through
[`src/num.ts`](./src/num.ts). While the underlying type is `number` that looks
like ceremony, and it is — it's also the difference between swapping in
`break_eternity.js` being one file and being a codebase sweep. Formatting lives
there too, driven by `Currency.format`.

## the engine

Deterministic, fixed 100ms timestep, no wall-clock dependence, no `Math.random`.
**Same def + same policy + same seed ⇒ identical run, always.** That is what
makes a balance comparison mean anything, and it's why `simulate` refuses a def
carrying validation errors rather than producing numbers that look fine.

```ts
import { simulate, greedy, idlePolicy, cozyGarden, sampleIntervalFor } from '@woodles/incremental-core';

const result = simulate(cozyGarden, greedy, {
  duration: 36000,              // game-seconds
  sampleEvery: sampleIntervalFor(36000),
  seed: 1
});
result.summary.timeToMilestone['one-million'];  // → game-seconds, or null
```

For the live playtest dock, `createSim(def, policy, seed)` returns the same
object driven a frame at a time, so what you watch and what a balance run
reports can't drift apart:

```ts
const sim = createSim(def, greedy, 1);
const events = sim.step(deltaSeconds * speed);
sim.state();          // SimState
sim.rates();          // production per second, per currency
sim.nextCost(id);     // what the next level costs right now
```

### two policies

`idlePolicy` never buys; `greedyPolicy()` buys the cheapest affordable thing and
resets when a reset would beat what it already holds
(`prestigeAdvantageThreshold`, default 2). They bracket real play well enough to
balance against — nobody plays worse than idling, few play better than always
buying. `scriptedPolicy` replays fixed actions at fixed times, for reproducing a
specific opening.

Greedy is deliberately naive: cheapest-first, not return-on-investment. It's a
*bound*, not a model of a good player, and a naive bound is easier to reason
about when a balance chart surprises you.

### performance

Ten hours of game time (360,000 ticks, ~10 entities) simulates in **~150ms**,
against a 500ms budget — see the test in
[`src/fixtures/cozy-garden.test.ts`](./src/fixtures/cozy-garden.test.ts).

Getting there took two things worth knowing about if you touch the tick loop:

- **Rates and prices are cached behind one dirty flag.** A rate is a function of
  the generator's level, the owned upgrades, and the prestige multiplier; a
  price is a function of the level and the owned upgrades. Nothing else moves
  either — so buying and resetting are the *only* invalidation points. Without
  this, a greedy policy pricing every purchasable thing on every tick is two
  million `Math.pow` calls to answer a question whose answer changed a few
  hundred times all run.
- **Tick counts are integers.** Game time is derived as `ticks / 10`, never
  accumulated by adding 0.1, and `step()` derives its target tick from a running
  total rather than decrementing a remainder. Three hundred float subtractions
  of 0.1 lose a whole tick, which is how `step(30)` once ran 29.9 seconds.

## validation

`validateGameDef(def)` returns typed `ValidationIssue[]`. `error` means the
engine refuses to run it — dangling references, negative costs, broken curves,
gating loops where A can't unlock until B does and B can't unlock until A does.
`warning` means legal but almost certainly a mistake — a currency nothing
produces, a prestige layer that resets the very currency it awards.

`parseGameDef(unknown)` is the trust boundary for anything arriving from
localStorage, a file drop, or a fixture.

## the canvas graph

`deriveEdges(def)` computes the node graph from the def every time rather than
storing it alongside. There is no second copy of "what connects to what" that
could drift, so drawing an edge in the editor is a *gesture that edits the def*.
`connectionIntent(def, from, to)` says what a given drag would mean, so a drag
either performs a real, describable edit or is refused with a reason.

## saves

`captureSave(sim)` and `createSim(def, policy, seed, save)` move a run in and
out of JSON. Restoring is a **reconciliation against the current def**, not a
load: a save outlives the design, so entities the author deleted are dropped,
ones they added start at zero, levels past a newly-lowered cap are clamped, and
a save from a different game is refused.

The save carries the PRNG's state, not just its seed. Without that, reloading
replays the rolls the run made in its first second — and save-and-reload
becomes a way to reroll a bad crit.

## fixtures

`cozyGarden` is the garden from the mockup as a real project file
([`src/fixtures/cozy-garden.json`](./src/fixtures/cozy-garden.json)): two
currencies, two generators, four upgrades, one prestige layer, three unlocks,
four milestones.

`apiaryOfBadDecisions`
([`src/fixtures/apiary-of-bad-decisions.json`](./src/fixtures/apiary-of-bad-decisions.json))
is a stress test rather than a mockup: a Hive whose own curve is almost
nothing, carried instead by `populationBoost` reading how many of the game's
five upgrades the player owns but has left unequipped. Two milestones read the
matching `Condition` metric directly. Its own test file
([`src/fixtures/apiary-of-bad-decisions.test.ts`](./src/fixtures/apiary-of-bad-decisions.test.ts))
proves something the fixture itself makes obvious once you see it: neither
`idlePolicy` nor `greedyPolicy()` ever reaches those milestones, because
neither bot ever chooses to leave something it owns switched off. The strategy
is real, and it's invisible to both bounds — only a player, or a script, can
find it.

`confessionBooth`
([`src/fixtures/confession-booth.json`](./src/fixtures/confession-booth.json))
inverts the Apiary's proof: it's a stress test for `converts` and `spendTax`
rather than `equipped`, and unlike hoarding, nothing about it needs a
deliberate choice — spending is spending, so a naive `greedyPolicy()` funds
the whole loop, guilt, absolution, and an eventual prestige, purely by playing
normally. `idlePolicy` never spends a coin, so it mints zero guilt and never
sees the Booth at all — the cleanest possible contrast between the two bounds.

`choirOfUnspokenNames`
([`src/fixtures/choir-of-unspoken-names.json`](./src/fixtures/choir-of-unspoken-names.json))
is a third: the Choir's rate sums `"devotional"` across Penitent (a
generator), Whispered Vow (an upgrade) and The Unspoken Order (a prestige
layer's reset count) — none of them the Choir, which carries no tag and never
counts its own level. Writing its test caught a real bug: `buyGenerator`
never invalidated the modifier table, because until this fixture existed
nothing a generator purchase changed could ever have fed back into another
generator's rate. It does now, and `resolveModifiers` runs again after every
level bought, not just after every upgrade.

All three stress-test fixtures load through `parseGameDef` for the same
reason a user's import does — if any ever stops being valid, every test
leaning on it fails at load rather than quietly producing different numbers.

## tests

```bash
pnpm --filter @woodles/incremental-core test
```

191 tests. The ones that matter most: determinism (two runs, same seed, deep
equal), a golden master worked out by hand in a comment above the test, curve
behaviour per kind, the prestige round trip (resets wipe exactly `resets[]`,
lifetime counters outside it survive, the multiplier applies), the Apiary's
hand-computed rate swings as upgrades get equipped and unequipped, the
Confession Booth's hand-computed guilt tax and the moment its converter runs
dry, the Choir's hand-computed sum across three entity kinds at once, and
greedy out-earning idle on every fixture, plus the save round trip — a
resumed run has to produce byte-identical events to one that never stopped.

That last one is measured on **lifetime**, not on the balance. Greedy spends,
and a prestige zeroes what it holds, so the balance is not the invariant —
"played rather than idled produces more" is.
