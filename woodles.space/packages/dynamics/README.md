# @woodles/dynamics

A palette of small, pure dynamical-system primitives — the recurring shapes
underneath a *living* system's stats (bounded stocks, memory that decays and
is restored, a lifetime tally that gates a rate), as opposed to the
currency/generator/upgrade/prestige shapes `@woodles/incremental-core`
already covers for a classic-incremental economy. Neither package is a
special case of the other; they're two different vocabularies for two
different kinds of game.

This package exists because Marginalia's Witch's Book (`apps/marginalia/src/lib/witch`)
turned out to need it: a dozen-plus named stats — insight, favor, three vital
signs, per-life recall and fluency, the restraint dividend — that read as a
dozen bespoke mechanics because each was hand-written inline in `tick.ts`'s
single seven-step pass over shared mutable state. Read against the
implementation rather than the design prose (BALANCE.md already caught
DESIGN.md being arithmetically wrong once), they resolve into **thirteen**
recurring shapes, most reused three or four times over. Eleven of the
thirteen are implemented here as small, independently testable functions.
The other two are documented below rather than faked into modules that would
only add indirection.

| Shape | Module | Marginalia instances |
| --- | --- | --- |
| A — Pool | `pool.ts` | insight, essence |
| B — Eased Stat | `easedStat.ts` | favor, vitality |
| C — Banded Stock | `bandedStock.ts` | nutrients, oxygen, moisture |
| D — Decay + Coupled Accumulator | `decayRestorePair.ts` | recall + fluency |
| E — Threshold Ladder | `thresholdLadder.ts` | study seconds → observation stage |
| F — Tally → Factor → Gated Accrual | `tallyFactorAccrual.ts` | interventionLoad → equilibriumFactor → equilibriumSeconds |
| G — Capacity + Roster | `capacityRoster.ts` | attentionCapacity + attending |
| H — Emergence Gate | `emergenceGate.ts` | written conditions → life.requires |
| I — Trigger → Grant / Override | `trigger.ts` | essence-on-stage, categoryMastered, metabolismScale |
| J — Manual Conversion | `manualConversion.ts` | distillEssence, expandAttention, intervene |
| K — Combo Meter | `comboMeter.ts` | focusStreak → focusMult |
| L — Edge Latch | `edgeLatch.ts` | wasSelfBalancing, wasQuiet |
| M — Pure Derived View | *(none — see below)* | stability, complexity, insightPerSec, outOfBand, quiet… |

Full formulas, feed/fed-by relationships, and the reasoning behind each shape
are in the field guide this package implements (published as an Artifact
during design — ask for the link if it isn't at hand).

## Why M has no module

A Pure Derived View is a discipline, not a piece of code to share: "compute
this fresh from other primitives on every read, and cache nothing." There's
no logic to factor out — `stability`, `complexity`, and the rest are each a
one-off formula over whichever of the other twelve primitives they read.
Writing a generic `derive()` wrapper here would be an abstraction with
nothing underneath it.

## Design notes

- **Every function is pure.** No primitive here reaches for a clock, a
  random source, or module-level state — `now`, `dt`, and every rate are
  arguments. That's what makes each one independently testable, and it's the
  same discipline `apps/marginalia/src/lib/witch/vitals.ts` and `focus.ts`
  already followed before this package existed; several functions here are
  those files' logic, generalized off Marginalia's specific constants.
- **Nothing here decides how state is stored.** `EasedStat` has no
  `EasedStat` type — it's just `ease(value, target, dt, rates)`, because the
  "value" might live on a per-life record, a world-level field, or a Svelte
  `$state` rune, and this package has no opinion on which.
- **Convex combinations, not clamps, do the heavy lifting.** `ease()` can
  never overshoot its target by construction — floor/ceiling exist only as a
  safety net for calling code that later moves the target. Read the
  docstring in `easedStat.ts` before reaching for a clamp that isn't needed.
- **A shape degrading to a simpler one shouldn't cost a rewrite.** Shape D
  (`decayRestorePair.ts`) with `companionGainRate: 0` is ordinary
  decay-with-restore; nothing needs deleting to use it that way.
