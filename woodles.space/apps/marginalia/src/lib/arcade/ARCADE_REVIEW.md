# Marginalia Arcade — Resource-Sharing Review

*Read-only review of the arcade as it stands today: the games in it, and how
effectively and efficiently they share code, state, and runtime resources.
Companion to [`ARCADE_REUSE.md`](./ARCADE_REUSE.md), which sets the
extraction philosophy this review measures against.*

## Scope & method

Reviewed every file under `src/lib/arcade/`, the arcade route
(`src/routes/arcade/+page.svelte`), the shared idle engine
(`src/lib/witch/book.svelte.ts`, `tick.ts`), and the bestiary integration.
"Resources" is read in three senses: **shared code** (utilities, components,
CSS), **shared state** (the Book's `insight` economy, localStorage), and
**shared runtime** (animation loops, timers, listeners).

## Inventory

`Arcade.svelte` registers **15 cards**: 11 playable, 1 `soon`
(Condition Match), 3 `locked` (Word Weave, Star Catcher, The Long Game). Eleven
game components back the playable cards.

| Game | Component | Loop | `MAX_REWARD` | `cappedReward`? | Daily cap? | Pays `insight`? |
|---|---|---|---:|:---:|:---:|:---:|
| Inkblot | `Inkblot.svelte` | rAF | 20 | inline | **yes (5/day)** | yes |
| 2048 | `TwoZeroFourEight.svelte` | step | — | — | — | **no** |
| Type Witch | `TypeWitch.svelte` | interval | 32 | inline | no | yes |
| Get Big! | `GetBig.svelte` | rAF | 28 | shared | no | yes |
| Margin Hollow | `MarginHollow.svelte` | rAF | 24 | shared | no | yes |
| Insight Rush | `InsightRush.svelte` | interval | 24 | inline | no | yes |
| Bullet Dot | `BulletHeaven.svelte` | rAF | 18 | shared | no | yes |
| Margin Defense | `TowerDefense.svelte` | rAF | 20 | shared | no | yes |
| Margin Snake | `Snake.svelte` | step/rAF | 18 | shared | no | yes |
| Paddle Break | `PaddleBreak.svelte` | rAF | 22 | shared | no | yes |
| Margin Bubbles | `BubbleShooter.svelte` | rAF | 24 | shared | no | yes |

## What is shared well

- **`arcadeMath.ts`** (`Dot`, `clamp`, `distance`, `normalize`,
  `cappedReward`) is pure, tiny, and domain-neutral, and the frame-based games
  use it as intended. This is the right kind of shared layer.
- **One economy sink.** Every paying game routes its payout through the single
  global `book` (`book.insight += awarded; book.persist()`), so rewards land in
  one place and survive via the same persistence path. The Book itself is a
  clean single source of truth.
- **Design tokens are defined once.** `Arcade.svelte` declares the Solarized
  `--sol-*` palette on `.arcade-root` (`Arcade.svelte:281`), and game shells
  mounted beneath it inherit those variables through the cascade rather than
  re-declaring them.
- **Clean teardown.** Every game cancels its `requestAnimationFrame`/timers and
  removes its window listeners in `onDestroy`. No loops or listeners leak when a
  cabinet closes — verified across all 11 components.

## Findings — shared code (reuse gaps)

These are the places where a shared resource *exists* but isn't used, or where
duplication has clearly passed the "factor after the third repetition" line that
`ARCADE_REUSE.md` itself sets.

### 1. `dailyLimit.ts` is used by 1 of 11 games — the biggest gap

`dailyLimit` is a shared, well-built rate-limiter, but only **Inkblot**
consumes it (`Inkblot.svelte:22`). The other nine paying games have no per-day
cap. The effect is both a reuse gap and an **economy-balance gap**: Inkblot's
careful 5-plays-per-day ceiling is meaningless next to uncapped games that pay
more per attempt. Insight Rush is the sharpest example — it pays up to 24
insight per 20-second round and its own note literally invites repetition
("the drill will let you keep taking sets", `InsightRush.svelte:279`). The
arcade's insight faucet is effectively unbounded today, which devalues the idle
loop the rewards are meant to feed back into.

### 2. `cappedReward` is bypassed in three games

`InsightRush.svelte:101`, `TypeWitch.svelte:73`, and `Inkblot.svelte:195` each
re-implement `Math.max(0, Math.min(MAX_REWARD, raw))` inline instead of calling
the shared helper that exists for exactly this. Harmless individually, but it
means the one clamp the arcade standardized on isn't actually standard.

### 3. The payout block is copy-pasted in nine games

```
rounds += 1;
awarded = rewardFor(...);
if (awarded > 0) { book.insight += awarded; book.persist(); }
```

This exact shape appears verbatim in all nine paying games
(`BulletHeaven.svelte:132`, `Snake.svelte:120`, `InsightRush.svelte:137`,
`TypeWitch.svelte:115`, `GetBig.svelte` ~225, `TowerDefense.svelte` ~169,
`PaddleBreak.svelte` ~144, `BubbleShooter.svelte` ~207, `MarginHollow.svelte`
~318). It is the single piece of logic that touches the shared economy, and it
is the most duplicated. A one-line helper —
`payArcadeReward(gameId, raw, max)` — is the natural single chokepoint to (a)
apply the clamp from finding #2, and (b) enforce a shared daily cap from finding
#1. Centralizing the payout fixes three findings at once.

### 4. HUD / shell CSS is duplicated ~150–200 lines per game

`ARCADE_REUSE.md` deferred extracting `ArcadeHud`, `ArcadeProgress`, and
`SvgArena` until the shape settled — a reasonable call at three games. At
**eleven**, `.score-box`, `.score-group`, `.btn-group`, `.ctrl-btn`,
`.game-id`, the `--left`/`--time` progress track, `.center-title`/`.center-sub`,
and the 560px media query are near-identical copies in every shell. A token or
spacing change now means editing nine-plus files. The extraction candidates the
reuse doc already named have not moved despite the game count tripling; the
threshold the doc set has been crossed.

### 5. `startLabel` and tokens-as-hex — small shared vocabulary that drifted

- The derived `phase === 'running' ? 'restart' : rounds > 0 ? 'again' : 'start'`
  is repeated in eight games, and `TypeWitch.svelte:191` inlines the same
  expression in markup instead of a derived. This "start / again / restart"
  vocabulary is arcade-wide and belongs in one place.
- Despite the shared `--sol-*` tokens, raw Solarized hex literals
  (`#fdf6e3`, `#eee8d5`, `#e7dfc7`) appear **28 times across 11 files** — e.g.
  `.field-bg { fill: #fdf6e3 }` in Bullet Dot and Snake, gradient stops in
  Insight Rush, and a large local re-statement in 2048 (13 occurrences). These
  bypass the tokens they could reference, so a palette change won't propagate.

## Findings — shared state & runtime

### 6. The idle economy and the game economy both run during play

The arcade page starts the world clock on mount and only stops it on unmount
(`+page.svelte:23,29`), so `tick.ts`'s rAF keeps calling `book.tick(dt)` —
accruing idle insight and persisting every 5s — the entire time a game is open.
Meanwhile each frame-based game runs its own rAF. So during play there are two
independent animation loops, and the same `insight` resource is being filled
from two faucets at once (idle accrual + game payout). It's not a leak and the
per-frame cost is small, but it's worth a deliberate decision: should the world
keep paying out while you're in a cabinet?

### 7. `dailyLimit` re-reads localStorage on every getter

Each of `remaining`, `used`, and `canPlay` calls `load()` →
`localStorage.getItem` + `JSON.parse` on every access
(`dailyLimit.ts:40–43`), and they're read inside reactive `$derived`/template
contexts. The `const record = load()` at `dailyLimit.ts:37` is then never used
(dead read). A single cached read with explicit invalidation on `increment()`
would be both cheaper and clearer. Low impact today (one consumer), but it
becomes real the moment finding #1 is addressed and every game calls it.

### 8. 2048 sits entirely outside the shared economy

`TwoZeroFourEight.svelte` is the only game that turns the **active pet** into a
mechanical advantage — it reads `creature.stats` to seed power-ups
(`:64–70`) — yet it pays **no** insight and persists no state. That asymmetry
(consumes the shared pet resource, returns nothing to the shared economy, keeps
no best score) may be intentional, but it currently reads as an accident of
omission rather than a choice.

### 9. `locked` / `soon` statuses are inert

The three locked cards carry evocative gates ("unlocks after writing 8
conditions", `Arcade.svelte:143`), but nothing reads Book progress to flip them
— `status` is a hardcoded literal. They are permanent placeholders today. Fine
as a roadmap, but the gating "resource" (book state) is not wired, so the hints
promise a mechanism that doesn't exist.

## Recommendations, in priority order

1. **Add a shared payout helper and route every game through it.** One function
   that clamps (absorbing finding #2) and is the single place a daily cap can
   live (finding #1). This is the highest-leverage change: it touches the one
   resource all games share and collapses nine copies into one.
2. **Decide the economy policy deliberately.** Either extend `dailyLimit` to the
   uncapped paying games, or soften Inkblot's cap — but make the faucet
   consistent. Re-tune Insight Rush's "keep taking sets" framing to match
   whatever you choose.
3. **Extract `ArcadeHud` + `ArcadeProgress` (and likely `SvgArena`).** The reuse
   doc already specifies these and the repetition has crossed its own threshold.
   Start with the HUD bar + score boxes + control buttons, since that markup and
   CSS is the most identical across all eleven.
4. **Fix `dailyLimit`'s per-access reads** (cache + invalidate; drop the dead
   `record`). Cheap, and a prerequisite for #1/#2 scaling to every game.
5. **Replace raw hex with `--sol-*` tokens** and share the `startLabel`
   vocabulary. Small, mechanical, and restores the token system the arcade
   already pays for.
6. **Make `locked`/`soon` either real or honest** — wire them to Book state, or
   label them as roadmap so the hints don't over-promise. Decide whether 2048
   should join the reward economy.

## What still should *not* be extracted

The reuse doc's restraint holds where it matters. Keep local: enemy movement
(chase vs. path-follow vs. discrete), projectile ownership, Margin Hollow's
platform physics/room data, and the per-game reward *formulas* — these are the
rules that make each cabinet feel hand-made, and a generic engine would make
them harder to tune. The extractions above are all presentation shells and the
single shared economy touch-point, not game rules. The arcade should stay a
cabinet of tiny handmade machines that happen to share a frame, a palette, and
one coin slot.
