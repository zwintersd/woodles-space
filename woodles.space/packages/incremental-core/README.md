# @woodles/incremental-core

The schema, validator, and simulation engine behind [Bloomforge](../../apps/bloomforge) —
a studio for making incremental games, not an incremental game.

Zero runtime dependencies, no DOM. The editor imports it, the balance runner
imports it inside a Web Worker, and a player runtime would import it too. None
of them import each other.

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

## fixture

`cozyGarden` is the garden from the mockup as a real project file
([`src/fixtures/cozy-garden.json`](./src/fixtures/cozy-garden.json)): two
currencies, two generators, four upgrades, one prestige layer, three unlocks,
four milestones. It loads through `parseGameDef` for the same reason a user's
import does — if it ever stops being valid, every test leaning on it fails at
load rather than quietly producing different numbers.

## tests

```bash
pnpm --filter @woodles/incremental-core test
```

125 tests. The ones that matter most: determinism (two runs, same seed, deep
equal), a golden master worked out by hand in a comment above the test, curve
behaviour per kind, the prestige round trip (resets wipe exactly `resets[]`,
lifetime counters outside it survive, the multiplier applies), and greedy
out-earning idle on every fixture.

That last one is measured on **lifetime**, not on the balance. Greedy spends,
and a prestige zeroes what it holds, so the balance is not the invariant —
"played rather than idled produces more" is.
