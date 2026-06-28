# Marginalia Arcade - Progress Roadmap

*Last updated: 2026-06-28. Companion to [`ARCADE_REUSE.md`](./ARCADE_REUSE.md),
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

The remaining findings (#5 tokens/vocabulary, #6-#9) are unchanged.

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
| 2048 | `TwoZeroFourEight.svelte` | play | step / keyboard | - | no | Only active-pet-stat-driven game. |
| Color POP! | `ColorPop.svelte` | play | Matter.js runner + UI interval | - | no | Score-only physics merge game. |
| Margin Miner | `MarginMiner.svelte` | play | rAF canvas | - | no | Score-only claw game with levels. |
| Type Witch | `TypeWitch.svelte` | play | interval | 32 | yes | Shared reward helper and HUD/progress shell. |
| Get Big! | `GetBig.svelte` | play | rAF | 28 | yes | Shared reward helper and HUD/progress shell. |
| Margin Hollow | `MarginHollow.svelte` | play | rAF | 24 | yes | First platform / gate / pickup shape; shared HUD/progress shell. |
| Condition Match | - | soon | - | - | no | Placeholder only. |
| Insight Rush | `InsightRush.svelte` | play | interval + timeouts | 24 | yes | Shared reward helper and HUD/progress shell; explicitly repeatable. |
| Bullet Dot | `BulletHeaven.svelte` | play | rAF | 18 | yes | Shared reward helper and HUD/progress shell. |
| Margin Defense | `TowerDefense.svelte` | play | rAF | 20 | yes | Shared reward helper and HUD/progress shell. |
| Margin Snake | `Snake.svelte` | play | step on rAF | 18 | yes | Shared reward helper and HUD/progress shell. |
| Paddle Break | `PaddleBreak.svelte` | play | rAF | 22 | yes | Shared reward helper and HUD/progress shell. |
| Bubble Spinner | `BubbleSpinner.svelte` | play | rAF canvas | 30 | yes | Uses new hex helpers, `rotate`, and shared HUD shell. |
| Margin Bubbles | `BubbleShooter.svelte` | play | rAF | 24 | yes | Shared reward helper and HUD/progress shell. |
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

The policy for now is:

- Existing insight-paying games stay uncapped except for their own local round
  caps.
- Inkblot intentionally keeps its special daily recognition cap.
- 2048, Color POP!, and Margin Miner intentionally remain score-only toys until
  a later balance pass decides how score-only games should join the economy.
- No 2048 best-score persistence was added in this pass, because that would
  change the score-only policy surface.

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

Still open:

- `SvgArena.svelte` for SVG games that share a background, grid, and overlay.
- A small `CanvasArcadeFrame.svelte` only if Color POP!, Margin Miner, and
  Bubble Spinner converge on the same canvas shell.
- A tiny shared `start / again / restart` label helper, now that `ArcadeHud`
  exists.

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

The Solarized palette is centralized in `Arcade.svelte`, but many components
still carry raw Solarized hex literals. Current arcade files contain more than a
hundred such occurrences, especially in canvas-heavy games.

Do not blindly replace every literal. Use this distinction:

- UI shell colors should use `--sol-*` tokens.
- Canvas/SVG scene art may keep local constants, but those constants should be
  named when the same color means the same thing across a game.

Also move the common `start / again / restart` label to a tiny shared helper
once `ArcadeHud` exists.

### 6. Decide whether the world clock runs during play

The arcade route starts the idle world clock on mount and stops it only when the
route unmounts. That means the Book continues accruing idle resources while a
cabinet game is open, while the game itself may also run rAF, timers, or a
Matter.js runner.

This is not automatically wrong. It just needs to be a deliberate rule:

- keep idle accrual running if games are meant to layer on top of the world; or
- pause idle accrual while `activeGame !== null` if arcade play should replace
  idle progress for that moment.

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
