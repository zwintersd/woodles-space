# Marginalia Arcade Implementation Plan

Status snapshot: June 28, 2026.

This plan turns `ARCADE_ROADMAP.md` into a staged build sequence. It assumes one
primary developer working in focused passes, with browser smoke tests after each
cluster. Dates are absolute so the work can be copied into issues, a project
board, or a personal calendar without guessing what "next week" meant.

Main rule for this cycle: do not add new games. The goal is to make the current
cabinet stronger. Condition Match, Word Weave, Star Catcher, and The Long Game
should only receive status/gating work unless the polish cycle is complete.

Current implementation note:

- Week 7 status: complete. Color POP! and Margin Miner now have intentional
  score-only records, active-pet stat effects, and the Color POP! Matter.js
  dependency is local.
- Week 8 status: complete. Margin Defense and Margin Hollow now have visible
  active-pet stat effects, local records, and the requested strategy/platform
  kindness passes.

## Target Outcome

By September 6, 2026, the Arcade should have:

- A shared four-stat arcade vocabulary for Body, Mind, Grace, and Heart.
- Active-pet stat effects in all 14 playable games.
- A consistent insight payout path and daily/session pacing policy.
- Local best/run summaries for every playable game.
- Extracted shared HUD/progress/arena presentation pieces where they reduce
  real duplication.
- More forgiving, legible finish/fail states.
- A smoke-tested `/marginalia/arcade` experience on desktop and mobile widths.

## Workstreams

### 1. Shared Arcade Foundation

Deliverables:

- `arcadeStats.ts`
  - `coreStatValue(creature, stat)`
  - `statTier(value)` using the current 2048 thresholds: 5, 7, 9.
  - `coreStatPerks(creature, gameId)` helper shape if useful.
- `ArcadePetPerks.svelte`
  - Compact per-game stat-effect display.
  - Shows only Body/Mind/Grace/Heart for this cycle.
- Active-pet prop wiring
  - Pass `activePet` from `Arcade.svelte` into every playable game.
  - Keep each game's actual stat rules local.

Acceptance criteria:

- 2048 no longer owns the only stat-tier helper.
- A game can show active-pet perks without reimplementing a perk grid.
- No game receives an abstract score multiplier as its stat implementation.

### 2. Economy And Run Memory

Deliverables:

- `arcadeRewards.ts`
  - Central reward clamp and insight payout.
  - One payout call site shape for paying games.
  - Room for daily/session caps without rewriting every game again.
- `arcadeRecords.ts`
  - Local bests and small run summaries.
  - Per-game storage keys.
- `dailyLimit.ts` cleanup
  - Local-day reset, not UTC reset.
  - Cached reads with explicit invalidation on increment.

Policy decision:

- High-frequency games should have daily/session pacing first:
  Insight Rush, Type Witch, Inkblot, Bullet Dot, Paddle Break, Snake.
- Slower completion games may use lower payout caps instead:
  Margin Hollow, Margin Defense, Bubble Spinner, Margin Bubbles.
- Score-only games must be deliberate, not accidental:
  Color POP!, Margin Miner, and 2048 need an explicit choice.

Acceptance criteria:

- All paying games use the shared payout helper.
- Every game either pays through the helper or clearly declares itself score-only.
- Each playable game remembers at least one best/run summary.

### 3. Shared Presentation Extraction

Deliverables:

- `ArcadeHud.svelte`
  - Title, hint, score boxes, start/back controls.
- `ArcadeProgress.svelte`
  - Thin progress bar with configurable tone/gradient.
- `SvgArena.svelte`
  - Responsive SVG frame and ready/complete/over overlay slot.

Extraction rule:

- Extract only the shell and frame. Keep game rules, movement, targeting,
  collision, reward formulas, and level data local.

Acceptance criteria:

- At least 8 playable games use `ArcadeHud` and `ArcadeProgress`.
- At least 6 SVG games use `SvgArena`.
- No platformer, snake, tower-defense, or bubble-rule engine is introduced.

### 4. Per-Game Stat And Polish Passes

Deliverables:

- Body/Mind/Grace/Heart effects for each playable game.
- Visible stat effect labels in the game surface.
- Small run-summary and best-memory display.
- One or two rough-edge fixes per game, scoped tightly.

Acceptance criteria:

- Each stat changes something visible.
- Each game remains playable without an active pet.
- Each game still has a clear practicable core after stat tuning.

### 5. Gates And Honesty Pass

Deliverables:

- Condition Match remains `soon`, or gets a scoped placeholder with real unlock
  logic.
- Word Weave, Star Catcher, and The Long Game either wire to real Book state or
  are relabeled as roadmap cards.
- Locked hints do not promise mechanisms that do not exist.

Acceptance criteria:

- No hardcoded lock hint implies a live unlock that is not wired.
- No new playable game is added in the core polish timeline.

## Timeline

### Week 1: June 29-July 5, 2026

Theme: foundation without behavior churn.

Tasks:

- Create `arcadeStats.ts`.
- Create `ArcadePetPerks.svelte`.
- Port 2048's stat-tier helper to `arcadeStats.ts`.
- Keep 2048 behavior equivalent after the helper extraction.
- Add tests for stat tiers and null-creature behavior.
- Start `arcadeRecords.ts` with localStorage helpers.

Validation:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia test`
- Browser smoke: 2048 still opens from `/marginalia/arcade`, active pet remains
  locked during play, and its existing powers still work.

Milestone:

- Shared stat vocabulary exists, but only 2048 is behaviorally changed.

### Week 2: July 6-July 12, 2026

Theme: economy and records before more stats.

Tasks:

- Create `arcadeRewards.ts`.
- Clean up `dailyLimit.ts`.
- Decide the score-only vs payout policy for Color POP!, Margin Miner, and 2048.
- Move Inkblot, Type Witch, Insight Rush, Bullet Dot, Snake, Paddle Break,
  Margin Defense, Margin Hollow, Bubble Spinner, and Margin Bubbles through the
  shared payout helper.
- Add first local best/run records for 2048 and the attention games.

Validation:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia test`
- Browser smoke: play one paying game and confirm insight is awarded once.

Milestone:

- The Arcade has one coin slot.

### Week 3: July 13-July 19, 2026

Theme: shared shell extraction pilot.

Tasks:

- Create `ArcadeHud.svelte`.
- Create `ArcadeProgress.svelte`.
- Apply them to a small pilot set:
  2048, Type Witch, Insight Rush, Margin Snake.
- Preserve existing text and control placement as much as possible.
- Add run-summary display to the pilot set.

Validation:

- `pnpm --filter marginalia check`
- Browser smoke: all pilot games open, start, finish or reset, and return to the
  cabinet.

Milestone:

- The repeated HUD shape is real shared UI, with limited blast radius.

### Week 4: July 20-July 26, 2026

Theme: attention and puzzle stat pass.

Games:

- 2048
- Inkblot
- Type Witch
- Insight Rush

Tasks:

- Finalize 2048's four-core-stat frame and make Will/Spark secondary or hidden
  from the main arcade stat language.
- Add Inkblot active-pet effects and practice-after-limit behavior.
- Add Type Witch typo forgiveness, next-phrase preview, combo preservation, or
  timer adjustment according to stat tiers.
- Add Insight Rush target/decoy/streak-shield effects and keyboard support.
- Apply local best/run records across the cluster.

Validation:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia test`
- Browser smoke at desktop and mobile width.

Milestone:

- First full stat cluster complete.

### Week 5: July 27-August 2, 2026

Theme: movement/action stat pass.

Games:

- Get Big!
- Bullet Dot
- Paddle Break
- Margin Snake

Tasks:

- Add Get Big! starting-size/outline/control/bump-save stat effects.
- Add Bullet Dot speed/targeting/hitbox/shield stat effects.
- Add Paddle Break paddle/path/save stat effects.
- Add Snake speed/preview/buffer/tail-shed stat effects.
- Improve mobile control pressed states for Get Big! and Snake.
- Add local best/run summaries across the cluster.

Validation:

- `pnpm --filter marginalia check`
- Browser smoke: directional controls, pointer controls, stat labels, and one
  failure/finish path per game.

Milestone:

- The movement games feel kinder without losing their rules.

### Week 6: August 3-August 9, 2026

Theme: geometry and shooter stat pass, part 1.

Games:

- Margin Bubbles
- Bubble Spinner

Tasks:

- Create `SvgArena.svelte`.
- Apply `SvgArena` to both bubble games if the fit is clean.
- Add Margin Bubbles shot/aim/ceiling-hold stat effects.
- Add Bubble Spinner torque/guide/foul/pivot-save stat effects.
- Improve mobile aim/fire separation.
- Add color-safe palette option or at least central color mapping hooks.

Validation:

- `pnpm --filter marginalia check`
- Browser smoke: bank shot, match resolution, orphan drop, spinner collision,
  foul behavior, and one stat effect in each game.

Milestone:

- The bubble games become the geometry showcase.

### Week 7: August 10-August 16, 2026

Theme: physics and timing stat pass, part 2.

Games:

- Color POP!
- Margin Miner

Tasks:

- Decide and implement payout/score-only status for both games.
- Move Color POP! to a local Matter dependency or add a stronger CDN fallback.
- Add Color POP! drop/preview/cooldown/settle-save stat effects.
- Add Margin Miner reel/scan/swing/extension stat effects.
- Add run summaries and bests.
- Improve keyboard/control accessibility where feasible.

Validation:

- `pnpm --filter marginalia check`
- Browser smoke: Matter loads, drops merge, game over works, claw fires and
  reels, stat effects are visible.

Milestone:

- The physics games are no longer outliers in economy or pet support.

### Week 8: August 17-August 23, 2026

Theme: strategy and platform stat pass.

Games:

- Margin Defense
- Margin Hollow

Tasks:

- Add Margin Defense lives/preview/range/refund stat effects.
- Add clearer between-wave build state.
- Add Margin Hollow jump/map/coyote/checkpoint stat effects.
- Add checkpoints or gentler fall recovery.
- Add local records.
- Keep room data and platform physics local.

Validation:

- `pnpm --filter marginalia check`
- Browser smoke: tower build/upgrade, wave clear/fail, platform room transition,
  pickup, hazard, and door/gate behavior.

Milestone:

- The two richest games get their deliberate tuning pass.

### Week 9: August 24-August 30, 2026

Theme: cabinet-level polish and lock honesty.

Tasks:

- Apply `ArcadeHud`, `ArcadeProgress`, and `SvgArena` to remaining good-fit
  games.
- Normalize stat-perk display copy across all games.
- Wire or relabel Condition Match, Word Weave, Star Catcher, and The Long Game.
- Tune reward caps after all games use the same payout helper.
- Review all finish/fail copy for tone.
- Add a small cabinet-level note explaining that the active pet is locked while
  a game is open, if needed.

Validation:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia test`
- `pnpm --filter marginalia build`
- Full cabinet smoke: open every playable card once.

Milestone:

- Cabinet feels coherent instead of merely populated.

### Week 10: August 31-September 6, 2026

Theme: release hardening.

Tasks:

- Desktop and mobile visual pass for every game.
- Console-error sweep.
- Verify reward once-only behavior.
- Verify local bests persist after reload.
- Verify active-pet effects degrade gracefully with no pet.
- Update `ARCADE_ROADMAP.md` with completed/in-progress notes.
- Add or refresh targeted tests for shared helpers.

Validation:

- `pnpm --filter marginalia check`
- `pnpm --filter marginalia test`
- `pnpm --filter marginalia build`
- Browser smoke at `/marginalia/arcade`.

Milestone:

- Full polish cycle complete.

## Minimum Viable Polish Timeline

If the full 10-week cycle needs to compress, the six-week version is:

1. June 29-July 5: `arcadeStats.ts`, `ArcadePetPerks.svelte`, 2048 helper
   extraction.
2. July 6-July 12: `arcadeRewards.ts`, `dailyLimit.ts`, payout policy.
3. July 13-July 19: attention cluster: 2048, Inkblot, Type Witch, Insight Rush.
4. July 20-July 26: action cluster: Get Big!, Bullet Dot, Paddle Break, Snake.
5. July 27-August 2: geometry cluster: Margin Bubbles, Bubble Spinner, Color
   POP!, Margin Miner.
6. August 3-August 9: Margin Defense, Margin Hollow, gate honesty, full smoke.

What gets deferred in the six-week version:

- Broad `ArcadeHud` and `SvgArena` adoption.
- Multi-level expansions.
- Color-safe palette polish beyond the highest-risk games.
- Deep mobile polish for every control scheme.
- Any new playable locked-card implementation.

## Backlog Order After The Polish Cycle

1. Condition Match as the first new game after the pause.
2. Word Weave only after condition-writing unlock state is real.
3. Star Catcher only if it feels distinct from Paddle Break and Bullet Dot.
4. The Long Game only after lifecycle state has a clear source of truth.
5. A second platformer-like game only if `MarginHollow` proves a reusable room
   vocabulary is worth extracting.

## Risk Register

### Scope Creep

Risk: Every game can absorb infinite polish.

Control: Each game gets one stat pass, one run-memory pass, and one rough-edge
fix pass in the main cycle. Larger ideas move to backlog.

### Shared Component Churn

Risk: Extracting `ArcadeHud` or `SvgArena` breaks too many games at once.

Control: Pilot with four games. Expand only after browser smoke tests prove the
component shape.

### Economy Imbalance

Risk: High-frequency games flood insight and make the idle loop meaningless.

Control: Central payout helper first, cap policy second, per-game tuning third.

### Pet Stats Becoming Passive Math

Risk: Stats become invisible bonuses.

Control: Every stat effect must have a visible label and an observable arena
effect.

### Mobile Controls

Risk: Pointer-heavy games feel worse on touch screens after stat additions.

Control: Smoke each cluster at mobile width before moving to the next cluster.

### Physics Dependency

Risk: Color POP! depends on a CDN Matter.js script.

Control: Make the dependency local or make failure graceful during the physics
cluster.

## Per-Game First Tickets

- Inkblot: local-day daily limit, active-pet reveal/guess perks, practice after
  payout cap.
- 2048: shared stat helper, four-core stat display, local best per mode.
- Color POP!: payout decision, Matter dependency plan, visible tier goal.
- Margin Miner: payout decision, best haul/level memory, keyboard accessibility
  check.
- Type Witch: shared payout helper, typo forgiveness, best accuracy memory.
- Get Big!: active-pet prop, edge preview, bump-save and control-stat effects.
- Margin Hollow: coyote time, checkpoint recovery, map memory.
- Insight Rush: shared payout helper, keyboard support, streak shield.
- Bullet Dot: local bests, shield/hitbox effects, pointer-goal visibility.
- Margin Defense: wave preview, range/refund effects, build-state clarity.
- Margin Snake: queued-direction display, tail-shed save, best by mode.
- Paddle Break: serve control, ball reserve, path preview.
- Bubble Spinner: stat aim guide, foul forgiveness, mobile aim/fire separation.
- Margin Bubbles: ceiling hold, aim guide tiers, lost-run breakdown.
