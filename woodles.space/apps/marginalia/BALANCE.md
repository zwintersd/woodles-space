# balance — what the numbers actually do

The first readings from the harness (`pnpm --filter marginalia balance`), taken
against `tuning.ts` as it stands. Re-run it after changing a constant; every
table here should move.

**Nothing in this file has been changed in the game.** These are findings, not
fixes — where a number is wrong the design decision about what it should be is
[DESIGN.md](./DESIGN.md)'s, not the harness's. The four headline problems are
pinned as assertions in `sim.test.ts` ("pacing, as it currently stands"), so
retuning tells you what it did rather than leaving you to notice.

Method: the `Witness` policy (attend whatever is closest to its next stage, buy
capacity, never intervene) against `Interventionist` (all of that, plus
intervene the moment anything Known can be afforded, and distill spare insight).
Both bounds are deliberately naive. Seed 1, fixed 100ms timestep.

---

## 1. the content is exhausted in four minutes

| | game time |
| --- | --- |
| first life reaches Known | **1.6 min** |
| all four visible life Known | **4.3 min** |
| all eleven, standing in the shallows | **7.1 min** |

`STAGE_SECONDS` is `[0, 8, 30, 95]` — 133 study-seconds to fully Know one life,
divided by `studyEase` (1.0–1.4), across two attention slots working in
parallel. The whole authored world of world 1 is 133 × 11 ≈ 24 minutes of
attention, and two slots halve it again.

After that the game has nothing left to show. A 24-hour run and a 5-minute run
end in the same state, differing only in the insight counter.

## 2. the vital signs never activate

Across every run — 1h, 6h, 24h, both policies, both worldspaces:

```
stressed share:      0.0%
equilibrium share:   100.0%
went quiet:          false
final vitality:      1.000
final stability:     100.0
final stocks:        N=49.5  O=56.0  M=50.0     (water)
                     N=56.0  O=62.0  M=64.5     (shallows)
```

The bands are `nutrients [40,80]`, `oxygen [45,85]`, `moisture [35,75]`. The
stocks settle 5–15 points *inside* the nearest edge and stay there. Nothing is
ever stressed, so vitality never drops, so nothing ever yields less or studies
slower, so `WORLD_QUIET_STABILITY` is unreachable and the soft-fail placeholder
can never fire.

The cause is the ratio between two constants. `STOCK_DRIFT_PER_SEC` is 0.02,
applied to the *whole distance* from the baseline — at 10 points out that is
0.2/sec of restoring force. The largest single metabolism in the game is the
algae bloom's `+0.20` oxygen, and most are 0.02–0.06. **The drift term is the
same order of magnitude as the entire world's metabolism**, so it pins every
stock near 50 no matter what lives there.

DESIGN.md §1.2 predicts the opposite: *"write only plants and oxygen climbs
while nutrients crash — until you allow returning and the decomposers close the
loop."* That lesson is currently unlearnable, because nothing crashes.

## 3. the restraint dividend cannot tell restraint from meddling

This is the one that matters, because it is the thesis.

| hours | policy | insight | favor | eq. share | equil. seconds | concepts |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 2 | Witness | 48,649 | 82.0 | 100.0% | 7,200 | 21 |
| 2 | Interventionist | 22 | 82.0 | 100.0% | 7,200 | 21 |
| 6 | Witness | 150,836 | 82.0 | 100.0% | 21,600 | 33 |
| 6 | Interventionist | 29 | 82.0 | 100.0% | 21,600 | 33 |
| 24 | Witness | 610,678 | 82.0 | 100.0% | 86,400 | 63 |
| 24 | Interventionist | 31 | 82.0 | 100.0% | 86,400 | 63 |

Read the right-hand columns. **Favor, equilibrium share, banked seconds and
minted concepts are identical to the digit.** The mechanic built to make the
light touch worth more (DESIGN.md §2.3) currently pays a meddler exactly what
it pays an ascetic.

Why: `interventionLoad` decays at 0.01/sec and interventions are one-shot per
life. With four visible life the most load that can ever exist is ~1.6, and
affordability spaces the acts far enough apart that it is back under the
`EQUILIBRIUM_MIN_FACTOR` threshold long before the next one. The dividend is
gated on a quantity that never gets high enough to gate anything.

The insight gap in the left column is *not* the dividend working — it is the
Interventionist going broke. It spends everything the moment it can, so it never
accumulates. That is a bound behaving correctly; it says nothing about restraint.

## 4. attention capacity is a trap, and mastery is trivially bought

**Capacity.** 6 hours, Witness, with and without buying capacity:

| | capacity | known | insight |
| --- | ---: | ---: | ---: |
| never expand | 2 | 4 | 151,923 |
| expand when affordable | 6 | 4 | 150,836 |

Buying every capacity upgrade (45 + 130 + 320 + 750 = 1,245 insight) knows
exactly the same number of life and ends **poorer**. With only four visible life,
finishing in four minutes, two slots were never the constraint. The one capacity
upgrade in the game is strictly negative.

**Mastery.** `CATEGORY_MASTERY_BONUS` (+12%, permanent, sticky) fires when every
*currently visible* life in a category is Known. Two consequences:

- Write only `holding` and one aquatic life is revealed. Know it, and the whole
  aquatic category is mastered forever — a permanent bonus for a two-minute
  opening, before the category has any other members.
- In a full 24-hour run with all eight conditions written, `categoryMastered` is
  `{"aquatic": true}` and nothing else — because terrestrial and atmospheric
  life aren't visible in the water worldspace, `inCategory.length === 0` returns
  early, and the two categories are unmasterable rather than unmastered.

## 5. the curve is flat from minute fifteen

```
     t │  insight │  ins/s │ favor │ known │ complexity
   5.0m│      470 │  6.676 │  74.2 │     4 │       37.5
  15.0m│     3943 │  7.096 │  82.0 │     4 │       37.5
   1.0h│    23103 │  7.096 │  82.0 │     4 │       37.5
   2.0h│    48650 │  7.096 │  82.0 │     4 │       37.5
```

Production rate, favor, known count and complexity are all constant from ~15
minutes to 24 hours; the rate moves by less than one part in ten thousand over
the following hour and three quarters. Insight is a straight line with nothing
to spend it on — the sinks (capacity, distilling, sediment) are all exhausted or
pointless well before the first hour.

---

## what this suggests, without deciding it

Ranked by how much each would change, in rough order of leverage:

1. **Lengthen `STAGE_SECONDS`, or make deepening cost something that runs out.**
   The content:time ratio is the root problem, and everything downstream of it
   (flat curve, useless capacity, unreachable sinks) is a symptom.
2. **Cut `STOCK_DRIFT_PER_SEC` by an order of magnitude, or make it proportional
   to how far *out of band* a stock is rather than how far from neutral.** Until
   the metabolism can actually move a stock past a band edge, half the design
   document is inert.
3. **Make `interventionLoad` decay slower than a run, or scale the dividend by
   how many interventions were *ever* made** rather than only recent ones. As it
   stands the load is a rate limit on clicking, not a measure of a heavy hand.
4. **Gate mastery on a category being complete in the authored world**, not in
   the current worldspace — and require more than one member.

Every one of those is a one-line change in `tuning.ts` or `world.ts`, and the
harness will tell you what it did in about a second per simulated day. That is
the whole point of it.
