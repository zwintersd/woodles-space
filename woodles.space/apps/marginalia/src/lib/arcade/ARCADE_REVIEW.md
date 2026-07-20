# Marginalia Arcade - Progress Roadmap

*Last updated: 2026-07-18. Companion to [`ARCADE_REUSE.md`](./ARCADE_REUSE.md),
which still defines the extraction philosophy: share the room, palette, shell,
and economy touch-points; keep each cabinet's core rules local until repetition
is real.*

## Current Status
## Updates Since Review

Recommendation #1 landed in [`arcadeRewards.ts`](./arcadeRewards.ts):

- `creditInsight(amount)` is now the single place the Book economy is mutated;
  all paying games route their payout through it. **Finding #3** (the
  payout block copy-pasted in nine games) is resolved.
- The clamp is unified on `cappedReward`; Insight Rush, Type Witch, and Inkblot
  no longer re-implement it inline. **Finding #2** is resolved.
- `creditInsight` is also the single attach point for a future per-day insight
  cap, giving **finding #1** a home. The cap itself is *not* yet applied — that
  is the deliberate economy decision in recommendation #2, still open.
- `ArcadeHud.svelte` and `ArcadeProgress.svelte` now carry the repeated shell
  for ten playable games, advancing **finding #4** without extracting game
  rules.
- `arcadeLabels.ts` now owns the shared `start / again / restart` control copy,
  closing the small label helper called out in recommendation #5.
- Week 5's movement/action stat pass is complete for Get Big!, Bullet Dot,
  Paddle Break, and Margin Snake: each now has visible Body/Mind/Grace/Heart
  effects, active-pet perk rows, local records, and the planned kinder fail
  mechanics.
- Get Big! phases 0–2 are complete: its docs now match the live pet perks and
  records, every edge entrant has a subtle warning, yellow clearly switches
  from locked to edible, and the end screen records time, food-tier totals,
  and one-count-per-blob danger dodges.
- Week 6's bubble pass is complete: Margin Bubbles has `SvgArena`, both bubble
  games have active-pet stat effects, local records, mobile aim/fire separation,
  and color-safe palette controls.
- Week 7's physics/timing pass is complete: Color POP! and Margin Miner now pay
  insight through `arcadeRewards`, carry Body/Mind/Grace/Heart effects with
  visible perk rows, keep local records and run summaries, and gained keyboard
  controls. Color POP!'s Matter.js dependency is now a bundled package
  (`matter-js`), lazy-imported and code-split so it loads from our own origin
  instead of a CDN. 2048 stays the one deliberate score-only game.
- The arcade route now pauses the idle world clock while `activeGame !== null`
  and resumes it when the cabinet returns, resolving recommendation #6 with a
  deliberate "arcade replaces idle accrual while playing" rule.

The remaining broad findings are token vocabulary cleanup where raw scene colors
are still intentional/local, lock honesty, and future extraction candidates that
need more repetition before they should move.

## Scope & method

`Arcade.svelte` now registers **18 cards**:

- **14 playable** games with mounted Svelte components.
- **1 coming soon** card: Condition Match.
- **3 locked roadmap** cards: Word Weave, Star Catcher, The Long Game.

The arcade has moved from a small experiment into a real cabinet. The immediate
roadmap is no longer "make more games at any cost." It is now: keep the new
games handmade, but consolidate the shared shell and economy before the next
round of growth makes the copy-paste expensive.

## Inventory

| Game | Component | Status | Loop / Runtime | `MAX_REWARD` | Pays `insight`? | Notes |
|---|---|---|---|---:|:---:|---|
| Inkblot | `Inkblot.svelte` | play | rAF | 20 | yes | Special daily cap; pays through `arcadeRewards`. |
| 2048 | `TwoZeroFourEight.svelte` | play | step / keyboard | - | no | Deliberate score-only pet-training toy. |
| Color POP! | `ColorPop.svelte` | play | Matter.js runner + UI interval | 22 | yes | Active-pet stats, local records, bundled `matter-js`. |
| Margin Miner | `MarginMiner.svelte` | play | rAF canvas | 20 | yes | Active-pet stats, local records, level payouts. |
| Type Witch | `TypeWitch.svelte` | play | interval | 32 | yes | Shared reward helper and HUD/progress shell. |
| Get Big! | `GetBig.svelte` | play | rAF | 28 | yes | Shared shell; pet perks, records, edge warnings, goal state, and run recap. |
| Margin Hollow | `MarginHollow.svelte` | play | rAF | 24 | yes | First platform / gate / pickup shape; shared HUD/progress shell. |
| Condition Match | - | soon | - | - | no | Placeholder only. |
| Insight Rush | `InsightRush.svelte` | play | interval + timeouts | 24 | yes | Shared reward helper and HUD/progress shell; explicitly repeatable. |
| Bullet Dot | `BulletHeaven.svelte` | play | rAF | 18 | yes | Shared reward helper and HUD/progress shell. |
| Margin Defense | `TowerDefense.svelte` | play | rAF | 20 | yes | Shared reward helper and HUD/progress shell. |
| Margin Snake | `Snake.svelte` | play | step on rAF | 18 | yes | Shared reward helper and HUD/progress shell. |
| Paddle Break | `PaddleBreak.svelte` | play | rAF | 22 | yes | Shared reward helper and HUD/progress shell. |
| Bubble Spinner | `BubbleSpinner.svelte` | play | rAF canvas | 30 | yes | Shared HUD shell, active-pet stats, local records, color-safe canvas swatches. |
| Margin Bubbles | `BubbleShooter.svelte` | play | rAF | 24 | yes | Shared reward helper, HUD/progress shell, `SvgArena`, active-pet stats, local records. |
| Word Weave | - | locked | - | - | no | Hardcoded roadmap lock. |
| Star Catcher | - | locked | - | - | no | Hardcoded roadmap lock. |
| The Long Game | - | locked | - | - | no | Hardcoded roadmap lock. |

## Progress Since The Last Review

- The cabinet grew from 15 cards / 11 playable games to 18 cards / 14 playable
  games.
- Newer playable games now include **Color POP!**, **Margin Miner**, and
  **Bubble Spinner**.
- `Arcade.svelte` owns cabinet registration and active-game routing, while the
  route owns shared `activeGame` / `activePet` state for the game panel and pet
  panel.
- `ActivePetPanel.svelte` persists the selected companion and locks companion
  switching while a game is open.
- `arcadeMath.ts` has grown beyond point math into the first safe primitive
  layer: `Dot`, `clamp`, `distance`, `normalize`, `cappedReward`, `rotate`, and
  cube-hex helpers.
- Cabinet cards expose `data-game-id`, which gives smoke tests and future
  tooling a durable hook.
- Every paying game now pays through `arcadeRewards.ts`; that helper is the
  only arcade file that mutates `book.insight` and calls `book.persist()` for
  game rewards.
- `dailyLimit.ts` now keeps a cached daily record and invalidates it when the
  date rolls over, instead of reparsing localStorage on every getter.
- `ArcadeHud.svelte` and `ArcadeProgress.svelte` now carry the repeated shell
  for 10 playable games. 2048, Color POP!, Margin Miner, and Inkblot keep
  custom local HUDs because their flows are still meaningfully different.

## Roadmap

### 1. Centralize arcade rewards

**Week 2 status: done.**

`arcadeRewards.ts` is now the shared reward chokepoint. All insight-paying
games route final payouts through `payReward` or `creditInsight`; the helper
clamps with `cappedReward`, mutates `book.insight`, and persists the Book.

Each game's scoring formula stays local. The shared layer owns the coin slot,
not the rules that earn the coin.

### 2. Decide the arcade economy policy

**Week 2 status: done, with a conservative no-balance-change policy.**
**Week 7 update: Color POP! and Margin Miner now pay; 2048 stays score-only.**

The Week 2 policy was:

- Existing insight-paying games stay uncapped except for their own local round
  caps.
- Inkblot intentionally keeps its special daily recognition cap.
- 2048, Color POP!, and Margin Miner intentionally remain score-only toys until
  a later balance pass decides how score-only games should join the economy.
- No 2048 best-score persistence was added in this pass, because that would
  change the score-only policy surface.

The Week 7 physics/timing pass was that balance pass for the two physics games:

- Color POP! pays through `arcadeRewards` (capped at 22); Margin Miner pays per
  level clear and on game over (capped at 20). Both keep local records.
- 2048 stays deliberately score-only: it spends active-pet stats instead of
  earning the shared insight resource, so it is the single entry left in
  `SCORE_ONLY_ARCADE_GAMES`.

`dailyLimit.ts` was still cleaned up now, so it is ready if the shared reward
helper later grows a daily or session cap.

### 3. Extract the shared cabinet shell

**Week 3 status: underway.**

`ARCADE_REUSE.md` waited until repetition was real before extracting
`ArcadeHud`, `ArcadeProgress`, and arena wrappers. That threshold has been
crossed.

Done in this pass:

- `ArcadeHud.svelte` for title, hint, score boxes, prize labels, and controls.
- `ArcadeProgress.svelte` for narrow time / progress tracks.
- Migrated 10 games onto the shared shell: Type Witch, Get Big!, Margin Hollow,
  Insight Rush, Bullet Dot, Margin Defense, Margin Snake, Paddle Break, Bubble
  Spinner, and Margin Bubbles.
- `arcadeLabels.ts` for the shared `start / again / restart` label helper.
- `SvgArena.svelte` pilot adoption in Margin Bubbles.

Still open:

- Broader `SvgArena.svelte` adoption. The component exists and Margin Bubbles
  uses it; other SVG games should move only when each fit is clean.
- A small `CanvasArcadeFrame.svelte` only if Color POP!, Margin Miner, and
  Bubble Spinner converge on the same canvas shell.

Keep 2048, Color POP!, Margin Miner, and Inkblot local until their control
surfaces settle.

### 4. Make roadmap locks honest or real

Condition Match, Word Weave, Star Catcher, and The Long Game are still hardcoded
cards. Their hints talk like gates, but no Book or reading state flips them.

Choose one path:

- keep them as visible roadmap cards and phrase the hints as future plans; or
- wire unlock predicates to real Book / reading / lifecycle state.

Until that decision is made, avoid adding more locked cards with specific
unlock promises.

### 5. Clean up tokens and shared labels

**Status: shared labels done; token cleanup remains selective.**

The Solarized palette is centralized in `Arcade.svelte`, but many components
still carry raw Solarized hex literals. Current arcade files contain more than a
hundred such occurrences, especially in canvas-heavy games.

Do not blindly replace every literal. Use this distinction:

- UI shell colors should use `--sol-*` tokens.
- Canvas/SVG scene art may keep local constants, but those constants should be
  named when the same color means the same thing across a game.

The common `start / again / restart` label now lives in `arcadeLabels.ts`.

### 6. Decide whether the world clock runs during play

**Status: done.**

The deliberate rule is: arcade play replaces idle world progress while a game is
open. The route pauses the idle tick when `activeGame !== null`, persists once
on pause, and restarts the tick when the cabinet returns. `startTick()` is now
idempotent so repeated resumes do not stack multiple loops.

### 7. Leave game rules local

Even with 14 playable games, the core game rules should remain local unless a
second game needs the exact same shape.

Still local:

- Get Big!'s growth / speed tradeoff;
- Margin Hollow's room data, collision, gates, pickups, hazards, and jump
  physics;
- Bubble Spinner's spinning hex cluster rules;
- Bubble Shooter's canopy and bank-shot rules;
- Color POP!'s Matter.js body setup and merge physics;
- Margin Miner's claw, loot, levels, and canvas drawing;
- each game's reward formula.

Future extraction candidates are small primitives, not a generic engine:

- a room / rect vocabulary if another platform game appears;
- shared canvas sizing only if the canvas games converge;
- `useArcadeLoop.ts` only if at least two games need the same rAF lifecycle;
- reward plumbing, because `insight` is the one resource all paying games share.

## Verification Path

For arcade roadmap work, use lightweight checks unless code changes accompany
the doc update:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia build`
- smoke the cabinet at `http://127.0.0.1:5173/marginalia/arcade` when gameplay
  changes, falling back to port 5174 if 5173 is occupied.

The arcade should stay a cabinet of tiny handmade machines: same room, same
materials, different little mechanisms, one increasingly coherent coin slot.
