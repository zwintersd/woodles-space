# balance — what the numbers actually do

Readings from the harness (`pnpm --filter marginalia balance`), plus the
parameter sweeps behind the retune (`sweep.report.ts`). Re-run both after
changing a constant; every table here should move.

**Four of the six findings are now fixed.** §1 pacing, §2 the vital signs, §3
the restraint dividend, §4 attention capacity. §6 was decided rather than
fixed — the opening worldspace stays unbalanceable on purpose, and now says so.
§5 is still open, along with one unproven claim inside §4.

Method: three policies. `Witness` attends whatever is closest to its next stage,
returns to Known life as it slips, and buys capacity, but never intervenes.
`Interventionist` does all of that and intervenes the moment anything Known can
be afforded. `Patient(n)` is Witness but lets a thing fall to `n` recall before
returning to it. All are deliberately naive bounds. Seed 1, fixed 100ms
timestep.

The harness and the policies now live in `@woodles/witch-engine` (`sim.ts`), and
the numbers they read live beside them in `world1/tuning.ts`; `pnpm --filter
marginalia balance` and the report scripts are unchanged, and every table below
was re-confirmed identical across that move. [Grimoire](../grimoire) runs the
same two bracketing policies in the browser against numbers you can edit, and
shows the delta from the shipped ones — useful for asking "what would this
change?" before committing to a re-run of the tables here.

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

## 3. the restraint dividend — fixed

This was the one that mattered, because it is the thesis. It first paid a
meddler and an ascetic *identically*; after the drift retune it paid the meddler
**more**, because a world that can leave its band is one that intervening
repairs, and repair is what the dividend rewards.

Two changes fixed it, and both were needed:

- **Load is a lifetime measure.** It used to forget at 0.01/sec, so a permanent
  act's 0.5 was gone inside a minute. §2.3's own framing is a lifetime claim — a
  world meddled with early and left alone late is still a propped world.
- **The dividend banks in proportion to the factor, not gated on it.** This was
  the deeper bug. `if (eq > 0.5) equilibriumSeconds += dt` meant any load short
  of the threshold cost *exactly nothing*, so a light hand and a fairly heavy one
  banked identically no matter what the load term said.

Measured at 6 hours:

| worldspace | policy | equil. sec | eq. share | load | concepts |
| --- | --- | ---: | ---: | ---: | ---: |
| shallows | **Witness** | **20,391** | 94.4% | 0.00 | **36** |
| shallows | Interventionist | 1,836 | 13.0% | 0.90 | 16 |
| water | Witness | 435 | 2.0% | 0.00 | 8 |
| water | Interventionist | 641 | 3.1% | 0.40 | 9 |

**In a world that can balance, restraint out-earns meddling elevenfold** and
more than doubles the mint. The opening water worldspace is the exception, and
for a reason that is content rather than tuning: it is nutrient-poor by design
(§6), so restraint *cannot* produce equilibrium there and intervening is the
only route into band at all. Both numbers are near zero — 2% against 3% of a
six-hour run — so it is a rounding difference between two failures, not a
strategy. Worth knowing; not worth tuning around.

## 4. attention capacity — fixed, by giving the Known endgame something to do

Capacity was strictly negative to buy: four visible life, finished in half an
hour, against two slots. The fix is a mechanic rather than a number, and it
leans on the learning sciences the observation stages were already halfway to.

**Bjork's two strengths.** *Storage* is how deeply she has come to know a thing;
*retrieval* is how readily it comes to her now. Storage never decays — a Known
life stays Known, and nothing is ever lost. Retrieval does. So a Known life
still yields, but yields more when it is fresh in her mind, and returning to it
is what freshens it. That is what attention is for once the stages are done.

**And the desirable difficulty.** Retrieving something you had nearly forgotten
is worth more than topping up something you never let slip, so `fluency` accrues
in proportion to how far a thing had slipped. It is permanent, it slows all
future forgetting, and it pays *above* full recall — because durable knowledge
is worth more than merely fresh knowledge, and without a ceiling to exceed,
letting anything fade would be pure loss.

6 hours in the shallows, with and without buying capacity:

| | insight | recall | fluency |
| --- | ---: | ---: | ---: |
| never expand | 263,401 | 0.658 | 17.05 |
| expand when affordable | **445,572** | 0.969 | 23.68 |

Capacity is now worth **69% more insight**. It used to be worth −2%.

**What is not yet demonstrated:** that patience beats grinding. A `Patient(0.4)`
policy — one that lets a thing fall to 40% recall before returning to it —
builds slightly more fluency but earns less at every horizon (408,741 against
445,572 at six hours). The reason is that slots are the binding constraint
either way: with six slots against eleven life, *everybody* is forced to be
patient, so the two policies barely differ in behaviour. The axis only opens up
at high capacity, which world 1 does not reach. Either `FLUENCY_YIELD_BONUS`
wants to be larger than 0.12, or this is a question for a world with more slots
than life — see WORLDS.md.

## 5. category mastery still fires trivially — open

Unchanged. Write only `holding`, and one aquatic life is revealed; Know it, and
the whole aquatic category is mastered forever (+12%, sticky) before the
category has any other members. And in a full 24-hour run with all eight
conditions written, `categoryMastered` is `{"aquatic": true}` and nothing
else — terrestrial and atmospheric life aren't visible from the water
worldspace, so `inCategory.length === 0` returns early and they are
*unmasterable* rather than unmastered.

## 6. the opening worldspace can never self-balance — accepted, and now legible

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

**Decided: leave it, and say so.** The opening act is nutrient-poor on purpose
and opening the shallows is what closes the loop — that is the reason sediment
exists. What was missing is that a player could not tell an intended state from
a broken one, so the Ledger now names which stocks sit outside their band rather
than showing a permanent unexplained silence where "holding itself" should be.

---

## what is still open

1. **Category mastery (§5)** — still fires on a single-member category and is
   unreachable for any category not in the current worldspace. Three lines:
   count over the authored world, require at least two members.
2. **Whether patience should beat grinding (§4)** — the mechanic works, the
   axis is flat. Needs either a larger fluency bonus or a world where slots
   outnumber nothing.

Everything else on the first pass's list is closed. The route through what
comes next is [WORLDS.md](./WORLDS.md).

Each is a one-line change, and the harness will tell you what it did in about a
second per simulated day.
