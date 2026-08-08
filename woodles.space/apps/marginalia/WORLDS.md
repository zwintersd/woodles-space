# worlds — the open questions, and the road to the second

[DESIGN.md](./DESIGN.md) §6's build order has phases **D** (prestige), **E**
(procedural worlds) and **F** (collapse) still open. This is the route through
them, written after the balance harness landed and changed what a few of the
answers should be.

Two things to read first: [BALANCE.md](./BALANCE.md) for what the numbers
currently do, and DESIGN.md §3 for the loop this is building toward.

The ✅ marks are recommendations. **Three of them are now shipped** — the
lifetime dividend (1.1), recall and fluency (1.2), and the legible opening
worldspace (1.4) — and 1.6's generator answer is decided but unbuilt. 1.3 and
the phase-D/E questions are still proposals.

---

# part 1 — the open questions

## 1.1 the restraint dividend is inverted

**The state.** `equilibriumFactor = inBand × (1 − load)`. Load rises 0.1/0.3/0.5
per act and decays at 0.01/sec, so a permanent intervention's cost is gone in
under a minute. Meanwhile intervening *repairs* a world — `shape` lifts a
nutrient baseline, `tend` bumps a stock — and being in band is exactly what the
dividend rewards. Measured: Interventionist banks 660 equilibrium-seconds
against Witness's 435.

**This blocks phase D**, which is the important part. The mint is
`0.5·√complexityPeak + 0.3·knownCount + 0.2·√equilibriumSeconds`. Ship prestige
on top of an inverted dividend and the inversion becomes permanent progression —
and once people have spent concepts, retuning the mint is a save-migration
problem instead of a one-line change.

| candidate | what it does | cost |
| --- | --- | --- |
| **(a) lifetime load** ✅ **— shipped** | dividend scales by every intervention *ever* made, not recent ones: `inBand × (1 − clamp(Σweight / K))` | one field, one formula |
| (b) slow the decay | `INTERVENTION_LOAD_DECAY` 0.01 → 0.0005, so a 0.5 act takes ~17 minutes to clear | one constant |
| (c) split the concepts | keep load as a rate limit; add a separate `untouchedSeconds` that banks only while a world has *no* interventions at all | a second accumulator |

✅ **(a).** §2.3's own text is a lifetime statement — *"a world she props up has
high load, which caps the favor it can reach — a propped world depends, it
doesn't trust."* A world meddled with early and left alone late should not read
as untouched, and under (b) it does. (a) is also the only one that still means
something across a prestige boundary, which matters given §1.1's whole point.

**Shipped, and it needed a second change nobody had spotted:** the dividend was
*gated* on the factor (`if (eq > 0.5) equilibriumSeconds += dt`) rather than
banked in proportion to it, so any load short of the threshold cost exactly
nothing. With both fixed, Witness banks 20,391 equilibrium-seconds against
Interventionist's 1,836 in the shallows — elevenfold, and 36 concepts against
16. See BALANCE.md §3.

## 1.2 attention capacity is a trap

**The state.** Four visible life, finished in 34 minutes, against two slots.
Buying all four upgrades (1,245 insight) knows the same four life and doesn't
move time-to-first-Known.

| candidate | what it does |
| --- | --- |
| (a) more life in the opening worldspace | content work; fixes the symptom, not the shape |
| **(b) attention keeps mattering after Known** ✅ **— shipped** | a Known life yields at a *remembered* rate unless attended, so slots stay valuable for the whole run |
| (c) capacity gates concurrent intervention upkeep | ties two under-used systems together, but invents upkeep |
| (d) make capacity cheaper and earlier | a real early choice instead of a late irrelevance; doesn't fix the endgame |

✅ **(b), shipped as `recall` and `fluency`** — Bjork's two strengths, which the
observation stages were already halfway to. Storage never decays (a Known life
stays Known); retrieval does. Returning to something that had slipped builds
permanent fluency, which slows future forgetting *and* pays above full recall —
the testing effect. Capacity went from −2% to **+69%** insight over six hours.

One claim in it is not yet demonstrated: that patience beats grinding. With six
slots against eleven life everyone is forced to be patient, so the policies
barely differ. See BALANCE.md §4.

## 1.3 category mastery fires trivially and is then unreachable

**The state.** `checkCategoryMastery` computes `inCategory` over *visible* life.
Write only `holding`, know the one aquatic life it reveals, and the whole
aquatic category is mastered forever. Conversely, terrestrial and atmospheric
are *unmasterable* from the water worldspace — `inCategory.length === 0` returns
early.

✅ **Compute over the authored world, require at least two members.** Three
lines, no design tension, ungameable: mastery means "you came to Know every
$category thing this world has", which is what the copy already claims.

## 1.4 the opening worldspace can never self-balance

**The state.** Four aquatic life net −0.01/sec on nutrients, so nutrients settle
at 38 — two points below the band floor. Stability still reads 100, but
`allStocksInBand` is false, so the dividend stops banking after the first
minutes (12.1% of a 1h run, 0.5% of a 24h one).

| candidate | what it does |
| --- | --- |
| (a) nudge an aquatic nutrient source +0.01/sec | water balances; the shallows loses some of its pull |
| **(b) leave it, make it legible** ✅ **— shipped** | the opening act is nutrient-poor *on purpose*, and opening the shallows is what closes the loop |
| (c) per-worldspace bands | most flexible, most machinery |

✅ **(b)** — it is good progression and it gives the sediment/shallows unlock a
reason to exist beyond "more content". But it needs the Ledger to *say so*,
or a new player reads a permanent "not balanced" as a bug. And it interacts
with §1.1: if the mint leans on `equilibriumSeconds`, a player who never opens
the shallows banks nearly none, so either the shallows must precede prestige
(see 2.3) or the mint needs a floor.

## 1.5 what phase D has to decide before it can start

- **Peak complexity isn't tracked.** `complexity` is derived and never
  remembered; the mint needs `complexityPeak`. One `WorldState` field, one save
  field, updated in `tick`. Additive, so the merge-onto-`emptySave()` pattern
  covers it for free (DESIGN.md §7).
- **What happens to `worldShape` on prestige?** §3.2 lists what carries and what
  resets and doesn't mention it. Sediment, worldspaces and placements are
  per-world artifacts, so they should reset — but the *creature cap* carries, and
  waymarks are authored by the player and cost insight. ✅ reset the terrain,
  carry the cap, and keep custom spawn points as a carried "notebook" the next
  world can re-place from.
- **When does prestige unlock?** §1.5 says complexity ≥ a threshold, "so never
  on turn one". The numbers answer this. Measured, six-hour Witness runs:

  | worldspace | peak complexity | known | equilibrium sec | concepts |
  | --- | ---: | ---: | ---: | ---: |
  | water | **37.5** | 4 | 435 | 8 |
  | shallows | **79.5** | 11 | 20,391 | **36** |

  ✅ set the threshold above 37.5 — 50 is a clean number — and opening the
  shallows becomes structurally required before the Book can close, which also
  resolves 1.4's caveat. Note the 47× gap in banked equilibrium seconds: under
  the current mint that is most of the difference between 8 concepts and 36, so
  §1.1's fix and this threshold need picking together.
- **Meta-tree copy** — §3.4's upgrade names and one-line descriptions are still
  on the ✍️ list.

## 1.6 what phase E has to decide before it can start

**The generator cannot sample metabolism independently.** This is the finding
that most changes the plan, and it comes straight out of the retune: world 1's
hand-authored metabolism summed to **+0.12 / +0.24 / +0.29** per second across
the three stocks, and it only ever looked balanced because the old drift term
was strong enough to hide it. §3.6 proposes sampling `metabolism` "within
assumption-set bands" — do that per-life and independently, and roughly every
generated world will be net-positive or net-negative on every stock, i.e. pinned
at 100 or at 0. A world that floods is not a hard failure; it is just never
interesting again.

| candidate | what it does |
| --- | --- |
| (a) constrain the sum | sample, then rescale so Σmetabolism per stock lands in a target band |
| **(b) derive the leak per world** ✅ **— decided** | generate freely, then *solve* `STOCK_LEAK` for the surplus each stock actually has, so the world settles mid-band by construction |

✅ **(b).** It is one line of algebra per stock (`leak = surplus / (target − floor)`),
it never rejects a generated world, and it makes the world's own physics a
property of that world — which is exactly what an assumption loadout is supposed
to change. (a) fights the generator; (b) lets it run.

**Also open for E:**

- **World-1 content is module state, not data.** `revealedLife`, `lifeById`,
  `conditionById` and `revealedEmergences` all close over module-level arrays,
  and `World.knownCount` reads `world1Life` directly. Nothing can hold two
  worlds until that changes. See 2.2 — it is the cheapest step on this list and
  the one that unblocks everything else.
- **Save keys collide.** `observation`, `study`, `vitality` and
  `interventionsDone` are keyed by life id. Generated ids must be namespaced by
  world (`w2:…`) even though §3.2 resets those maps, because a half-migrated
  save is exactly the case the discipline exists for.
- **Generated prose.** §3.6 wants stage texts from per-domain templates.
  `content/fieldNoteTemplates.ts` already proves the pattern. One consequence of
  the determinism work is worth naming: the RNG is seeded and its stream
  position is saved, so a generated world reads *the same on every load* — which
  it would not have done under `Math.random()`.

---

# part 2 — the roadmap

## 2.0 what makes it graceful

Four invariants. Each step below is shaped by them.

1. **One `World`, different data.** World 2 must never be a second code path.
   If a step would fork the tick, the step is wrong.
2. **Every step ships playable.** No step leaves the game in a state where
   something is half-visible or half-mechanical.
3. **The harness is the gate.** Each step names a measurable "done" that
   `pnpm --filter marginalia balance` or a test can answer. Procedural worlds in
   particular cannot be hand-playtested — see 2.6.
4. **No save is ever broken.** DESIGN.md §7's discipline: additive fields ride
   the merge onto `emptySave()`; anything else ships a migration and a
   `persist.test.ts` case against an old-shaped blob.

## 2.1 fix the dividend — ✅ done

Shipped. Witness banks 20,391 equilibrium-seconds against Interventionist's
1,836 in the shallows, and mints 36 concepts against 16. The step that was
blocking phase D is clear.

## 2.2 make the world take its content as data

**Why second:** nothing can hold two worlds until it does, it is invisible to
players, and it is *safe right now* in a way it won't be later — 327 tests pin
current behaviour exactly, so the refactor is provably behaviour-preserving.
Doing it after prestige means doing it while the save shape is also moving.

**The shape:**

```ts
export interface WorldContent {
  conditions: Condition[];
  emergences: Emergence[];
  life: Life[];
}
export const world1Content: WorldContent = { conditions, emergences, life: world1Life };
```

`World` takes one; `revealedLife`/`lifeById`/`conditionById`/`revealedEmergences`
take it as a parameter; `knownCount` counts against `content.life` rather than
the imported `world1Life`. No behaviour changes.

**Done when:** all tests pass untouched, and `world1Content` is the only
construction site outside tests.

## 2.3 track what prestige will mint

**Why third:** it is two fields and it makes the mint *measurable before the
feature exists* — `conceptsFor()` is already in `sim.ts`, so the harness can
report what a run would be worth and you can tune the formula against real runs
rather than against intuition.

Add `complexityPeak` to `WorldState` and `BookSave`; pick the unlock threshold
(✅ 50, per §1.5). Nothing player-visible yet.

**Done when:** the balance report prints concepts-per-run for both policies at
2/6/12/24h, and the shallows is provably required to clear the threshold.

## 2.4 close the Book

The first player-visible prestige step: the action, the reset, the carry.

- reset exactly §3.2's list; carry Knowing, Concepts, unlocked assumptions,
  creature cap, reading stars and titles
- Essence and attention return to their meta-upgradable baselines
- `worldIndex` finally increments — it is already persisted and already seeds
  the canvas's visual noise, so a new world will *look* different for free
- one migration + one `persist.test.ts` case

**Done when:** the harness can run a two-world sequence end to end, and a save
written before this step still loads.

## 2.5 the Study, and the meta-tree

Concepts get somewhere to go (§3.4). This is where the copy debt comes due.

**Done when:** a simulated second run reaches its first Known measurably faster
than the first did — which is the whole promise of a prestige loop, and is
exactly the kind of claim the harness exists to check.

## 2.6 assumptions become mechanical, then the generator

These are one step in two halves, because an assumption that changes nothing is
just a label and a generator with nothing to vary is just world 1.

**First:** make the assumption loadout an *input* to content selection while the
content is still hand-authored — e.g. `endings` OFF removes the decomposer from
the pool. World 1 remains the canonical loadout, so nothing regresses.

**Then:** the generator (§3.6), with the leak derived per world (§1.6).

**Done when — and this is the important one:** a *generation constraint suite*
passes over N seeds. Procedural content cannot be playtested by hand; it can be
simulated. For every generated world, assert:

- every life is reachable to Known inside a sane budget (nothing unstudiable)
- no stock pins at 0 or 100 at steady state (nothing dead on arrival)
- the complete world satisfies `allStocksInBand` (it can be finished)
- at least one partial web produces real stress (it can still teach §1.2's lesson)
- two runs at the same seed are identical (the world is a place, not a shuffle)

That suite is the deliverable that makes phase E safe, and it is only possible
because the tick is headless, seeded and fast. Ten hours of a generated world
costs about a second; a hundred candidate worlds is a coffee.

## 2.7 collapse

Phase F last, because it is the one system that wants every other number
settled first — `WORLD_QUIET_STABILITY` is currently unreachable, and what
"going quiet" should cost only means something once there is a prestige floor to
fall back to (§3.7's guaranteed concepts).

---

## the order, in one line

**dividend → content-as-data → mint tracking → close the Book → the Study →
assumptions → generator → collapse.**

The first two are cheap, invisible and unblock everything; the last two are the
ones that need every number above them settled. Steps 2.1–2.3 could all land in
one pass.
