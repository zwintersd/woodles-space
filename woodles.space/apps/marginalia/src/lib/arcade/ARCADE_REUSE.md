# Marginalia Arcade Reuse Notes

This arcade works best when each game is small, readable, and self-contained, while sharing the parts that are truly common. The goal is not to make a generic game engine. The goal is to make new small games feel native to the arcade without scattering their rules across too many files.

## Current Shape

Each playable game is a Svelte component mounted by `Arcade.svelte`.

A good arcade game component usually contains:

- A local `Phase` union such as `ready | running | complete | over`.
- Local entity types near the logic that owns them.
- A small set of constants for arena size, timing, score caps, and tuning.
- A `start`, `reset`, `stop`, `finish` lifecycle.
- One update loop, either frame-based or step-based.
- A compact SVG or grid arena.
- A HUD row with score, run state, reward preview, and arcade/back controls.
- Reward payout through `book.insight` only in `finish`.

Keep game-specific rules inside the game component until at least two games need the same rule in nearly the same form.

## Already Shared

`arcadeMath.ts` is the first shared utility layer:

- `Dot`
- `clamp`
- `distance`
- `normalize`
- `cappedReward`

These are safe to share because they are pure, tiny, and domain-neutral. They do not know about any particular game.

## What To Reuse By Copying For Now

Some patterns are intentionally repeated in `BulletHeaven.svelte`, `TowerDefense.svelte`, and `Snake.svelte`:

- Shell layout: `*-shell`, `*-bar`, `score-group`, `score-box`, `btn-group`.
- SVG arena treatment: responsive width, fixed `viewBox`, Solarized arcade tokens, grid background.
- Center overlay text for ready/complete/over.
- Progress track below the HUD.
- Start/back button placement.

This repetition is useful evidence. It lets the shape settle before we commit to a shared component API.

## Next Extraction Candidates

Extract in this order if the arcade keeps growing:

1. `ArcadeHud.svelte`
   Shared title, hint, score boxes, start button, and arcade/back button.

2. `ArcadeProgress.svelte`
   A narrow progress track with `--left` styling and a configurable gradient class.

3. `SvgArena.svelte`
   Responsive SVG wrapper, background rect, grid pattern slot, and overlay slot.

4. `arcadeRewards.ts`
   Shared payout helpers if reward formulas start to align. Keep formulas local while games still score differently.

5. `useArcadeLoop.ts`
   Only if at least two games need the exact same `requestAnimationFrame` lifecycle. Bullet Dot and Tower Defense are frame-based; Snake is step-based, so do not force this too early.

## What Not To Extract Yet

Do not extract these just because they look similar:

- Enemy movement, because Bullet Dot chases and Tower Defense follows a path.
- Projectile targeting, because player auto-fire and tower auto-fire have different ownership.
- Snake movement, because it is discrete and grid-step based.
- CSS wholesale, until `ArcadeHud` and `SvgArena` exist.
- Reward formulas, while each game expresses success differently.

Small games become harder to tune when their core rules are hidden in a generic engine.

## Logic Boundaries

Prefer this boundary:

- Shared files contain pure helpers and presentation shells.
- Game components contain game rules, entity state, tuning constants, and collision/update logic.
- `Arcade.svelte` contains cabinet registration and active-game routing only.

If a helper needs to import `book`, it is probably not a math helper. If a helper needs to know a game id, it probably belongs in the game.

## Browser Testing Checklist

For each new arcade game:

- The cabinet card appears and opens the correct active game.
- The start path works from the visible UI.
- The main moving pieces visibly change over time.
- Keyboard or pointer controls work after opening from a lower card.
- Completion or failure pays rewards only once.
- Browser console has no errors.
- `pnpm --filter marginalia check` passes.
- `pnpm --filter marginalia build` passes.

Specific lesson from `Margin Snake`: be careful about time units. `requestAnimationFrame` gives timestamps in milliseconds. If a loop uses millisecond step thresholds, cap deltas in milliseconds too.

## New Game Recipe

When adding a new game:

1. Start with one component in `src/lib/arcade`.
2. Define the smallest possible complete loop.
3. Reuse `Dot`, `clamp`, `distance`, `normalize`, and `cappedReward` when they fit naturally.
4. Copy the existing HUD/SVG shape if no shared component exists yet.
5. Register the card and active component in `Arcade.svelte`.
6. Smoke test the game from the cabinet, not only from the active screen.
7. Factor only after the third clear repetition.

The arcade should feel like a cabinet of tiny handmade machines: same room, same materials, different little mechanisms.
