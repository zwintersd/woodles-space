# balance — what the numbers actually do

Readings from the harness (`pnpm --filter marginalia balance`), plus the
parameter sweeps behind the retune (`sweep.report.ts`). Re-run both after
changing a constant; every table here should move.

**Two things have been changed in the game since the first pass** — the
content-to-time ratio and the stock-drift model, plus the two passive sinks
DESIGN.md already names in prose. §1 and §2 record what that did. §3–5 are the
findings that remain open; none of them has been touched, because each is a
design decision rather than a bug.

Method: the `Witness` policy (attend whatever is closest to its next stage, buy
capacity, never intervene) against `Interventionist` (all of that, plus
intervene the moment anything Known can be afforded, and distill spare insight).
Both bounds are deliberately naive. Seed 1, fixed 100ms timestep.

---

## 1. pacing — fixed

`STAGE_SECONDS` went from `[0, 8, 30, 95]` to `[0, 30, 210, 1100]`. Steeply
increasing on purpose: a 21-second first beat so something happens immediately,
and a long final commitment so Knowing a thing is a real one.

| | before | after |
| --- | ---: | ---: |
| first stage (Observed) | 6s | 21s |
| first life reaches Known | 1.6 min | **16.0 min** |
| all four visible life Known | 4.3 min | **34.4 min** |
| all eleven, in the shallows | 7.1 min | **57.5 min** |

The sweep that picked it, for when you want a different answer:

```
  curve                        │ total │ 1st Known │ all four │ Observed
  shipped      [0,8,30,95]     │   133 │      1.6m │     4.3m │      6s
  x4           [0,32,120,380]  │   532 │      6.3m │    14.9m │     23s
  steeper      [0,20,150,700]  │   870 │     10.4m │    22.9m │     14s
  steeper+     [0,30,210,1100] │  1340 │     16.0m │    34.4m │     21s   ← chosen
  long tail    [0,30,240,1800] │  2070 │     24.6m │    51.8m │     21s
```

**The curve has a shape now.** It used to be flat from minute fifteen; the
first forty minutes now climb, and favor has a real dip and recovery in the
opening quarter hour rather than pinning at 82 forever:

```
     t │  insight │  ins/s │ favor │ known │ complexity
     0s│        0 │  0.000 │  60.0 │     0 │       17.5
  10.0m│      310 │  2.891 │  50.4 │     0 │       25.5
  20.0m│     1367 │  3.255 │  55.7 │     1 │       28.5
  30.0m│     3682 │  4.684 │  63.7 │     3 │       34.5
  35.0m│     5183 │  6.452 │  70.0 │     4 │       37.5
  45.0m│     9165 │  6.666 │  74.0 │     4 │       37.5   ← flat from here
```

It still flattens, and that is now an honest signal rather than a bug: at 35
minutes the water worldspace is *finished*. The next thing to happen has to be
the shallows.

## 2. the vital signs — fixed, and the design doc was arithmetically wrong

Two changes. **Drift is now proportional to distance out of band** rather than
distance from neutral: inside its band a stock feels no restoring force at all,
and only gets pulled back once it goes somewhere extreme. `STOCK_DRIFT_PER_SEC`
came down from 0.02 to 0.005 to match.

That alone was not enough, and finding out why was the interesting part.
**The authored metabolism is net-positive on all three stocks:**

```
  nutrients  net +0.12/sec
  oxygen     net +0.24/sec
  moisture   net +0.29/sec
```

That table *is* DESIGN.md §1.2's own, verbatim. And every `needs` band in the
game was a lower bound — `[30,100]`, `[45,100]`, `[40,100]` — so nothing could
be harmed by too *much* of anything. Which means the old pull-toward-neutral
was not a flavour term. It was the only thing balancing the world, and removing
it sent every stock to its ceiling: N=100, O=100, M=100, stability 22.

The design already named the missing pieces and nobody had implemented them.
§1.1 says moisture "evaporates". §1.2's salt-deposit row says it "reduces
nutrient **leach**". So `STOCK_LEAK` now applies a passive loss per stock, on
whatever sits above the band floor, sized so the complete world settles
mid-band. And the needs bands got their upper halves back — the ceiling on
`moss` is waterlogging, on `lichen` sustained wet, on `soft_swimmer`
supersaturation. §2.2's *"invoke can overshoot into flood-stress"* is reachable
now; it was not before.

**The complete world is balanced.** All eleven life in the shallows, 24h:

```
  stocks N=60.0 O=65.0 M=55.0   stability=100.0   vitality=1.000
  equilibrium share 98.6%   stressed 2.1%
```

**And §1.2's lesson actually happens.** Writing the web one condition at a time:

```
  written                  │    N │    O │    M │ stressed │ vitality │ stability
  flow+reaching (algae)    │   30 │  100 │   35 │      93% │    0.833 │        87
  + holding (salt)         │   42 │  100 │   31 │       0% │    1.000 │        98
  + returning (fungal net) │   66 │  100 │   31 │     100% │    0.842 │       100
  + boundary               │   66 │  100 │   38 │     100% │    0.881 │       100
  the whole web            │   60 │   65 │   55 │       8% │    1.000 │       100
```

Plants alone crash nutrients to **exactly 30** — the algae's own need floor —
and stop there, because as it wilts it metabolises less and the world eases the
very pressure that was hurting it. That is the equilibrium loop working, and it
holds the life at the boundary rather than driving it to zero. Allowing
`returning` brings the decomposer and the loop closes. The middle steps teach
the second lesson nobody wrote down: fix nutrients and you discover you have no
water.

An empty world still holds still — it now dries to the floor of its bands
(40 / 45 / 35) and stops there, which is inside the band, so stability stays
100.

---

## 3. the restraint dividend — still broken, and now inverted

The one that matters, because it is the thesis. It used to pay a meddler and an
ascetic *identically*. It no longer does — it pays the meddler **more**.

| hours | policy | insight | eq. share | equil. seconds | concepts |
| ---: | --- | ---: | ---: | ---: | ---: |
| 2 | Witness | 39,162 | 6.0% | 435 | 8 |
| 2 | Interventionist | 55 | 9.2% | **660** | **9** |
| 24 | Witness | 567,128 | 0.5% | 435 | 8 |
| 24 | Interventionist | 21 | 0.8% | **660** | **9** |

Why the retune made it worse rather than better: now that a world can genuinely
leave its band, intervening *repairs* it. `shape` lifts the nutrient baseline,
`tend` bumps the stock a life lives by — and being in band is exactly what the
dividend rewards. `interventionLoad` decays at 0.01/sec, so a permanent act's
0.5 is gone in under a minute, long before it can offset the repair.

BALANCE.md's original suggestion stands and is now more urgent: make the load
decay slower than a run, or scale the dividend by interventions *ever* made
rather than only recent ones. As it stands the load is a rate limit on clicking,
not a measure of a heavy hand.

(The insight column is not the dividend working. The Interventionist spends
everything the moment it can, so it never accumulates — a bound behaving
correctly, and it says nothing about restraint.)

## 4. attention capacity is still a trap

6 hours, Witness, with and without buying capacity:

| | capacity | known | insight |
| --- | ---: | ---: | ---: |
| never expand | 2 | 4 | 132,225 |
| expand when affordable | 6 | 4 | 135,156 |

Marginally positive now rather than negative, but it still knows exactly the
same four life and still does not change time-to-first-Known. Four visible life
against two slots was never the constraint. This needs either more life in the
opening worldspace or a reason to hold attention on something already Known.

## 5. category mastery still fires trivially

Unchanged. Write only `holding`, and one aquatic life is revealed; Know it, and
the whole aquatic category is mastered forever (+12%, sticky) before the
category has any other members. And in a full 24-hour run with all eight
conditions written, `categoryMastered` is `{"aquatic": true}` and nothing
else — terrestrial and atmospheric life aren't visible from the water
worldspace, so `inCategory.length === 0` returns early and they are
*unmasterable* rather than unmastered.

## 6. new: the opening worldspace can never self-balance

A consequence of the retune worth deciding about. The water worldspace holds
four aquatic life whose nutrient metabolism nets to −0.01/sec, so nutrients
settle at **38** — two points below the band floor of 40. Stability reads 100
(38 is well inside the falloff), but `allStocksInBand` is false, so the
equilibrium dividend stops banking once the opening minutes are over:

```
   1h run → self-balancing 12.1% of the run
   6h run → 2.0%
  24h run → 0.5%
```

Read generously this is good progression: the opening act is nutrient-poor, and
opening the shallows is what closes the loop. Read harshly, the restraint
mechanic is unreachable during the only part of the game a new player will see.
Nudging one aquatic nutrient source up by ~0.01/sec would put it in band; that
is a design call, not a fix.

---

## what is still open

1. **The restraint dividend (§3)** — now actively inverted. The highest-leverage
   remaining fix, and the one the thesis depends on.
2. **Attention capacity (§4)** and **mastery scope (§5)** — unchanged from the
   first pass.
3. **Whether the water worldspace should be able to balance (§6)** — new, and a
   direct consequence of the retune.

Each is a one-line change, and the harness will tell you what it did in about a
second per simulated day.
