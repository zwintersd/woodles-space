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
- A HUD row with score, run state, reward preview, and arcade/back controls,
  usually through `ArcadeHud.svelte`.
- Reward payout through `arcadeRewards.ts` only in `finish`.

Keep game-specific rules inside the game component until at least two games need the same rule in nearly the same form.

## Already Shared

`arcadeMath.ts` is the first shared utility layer:

- `Dot`
- `clamp`
- `distance`
- `normalize`
- `cappedReward`
- cube hex helpers: `CubeHex`, `HEX_DIRECTIONS`, `hexKey`, `addHex`, `hexNeighbors`,
  `hexDistance`, `axialToPoint`, `pointToHex`, `hexesWithinRadius`
- `rotate`

These are safe to share because they are pure, tiny, and domain-neutral. They do not know about any particular game.

`arcadeRewards.ts` is the second shared layer - the single point where a game's
reward touches the Book economy:

- `creditInsight(amount)` - the one place `book.insight += ...; book.persist()`
  happens. Every paying game routes through it, so a future arcade-wide economy
  policy (e.g. a per-day insight cap) has exactly one home.
- `previewReward(raw, max)` - clamp score-derived previews through
  `cappedReward`.
- `payReward(raw, max)` - clamp a raw, score-derived reward to `[0, max]` and
  credit it; the common case for games whose reward floors at zero.

Reward *formulas* stay local (each game scores differently); only the clamp
(`cappedReward`) and the payout are shared.

`ArcadeHud.svelte` and `ArcadeProgress.svelte` are the first shared shell
components. They are now used by the core paying/action games:

- `TypeWitch.svelte`
- `GetBig.svelte`
- `MarginHollow.svelte`
- `InsightRush.svelte`
- `BulletHeaven.svelte`
- `TowerDefense.svelte`
- `Snake.svelte`
- `PaddleBreak.svelte`
- `BubbleSpinner.svelte`
- `BubbleShooter.svelte`

`arcadeLabels.ts` owns the shared `start / again / restart` control vocabulary
used by the shared HUD games.

`SvgArena.svelte` is the first SVG-frame extraction. It owns the responsive SVG
box, Solarized paper background, grid pattern, and pointer/touch surface for
good-fit SVG games. `BubbleShooter.svelte` is the pilot user; canvas games such
as `BubbleSpinner.svelte` should stay canvas-native unless their frame actually
converges.

## What To Reuse By Copying For Now

Some patterns are still intentionally local while their shape remains more
specialized:

- Inkblot's daily cap, reveal track, canvas, and "next" round flow.
- 2048's active-pet stat panel and power-up controls.
- Color POP!'s Matter.js canvas, swatch preview, and resilient CDN loader (it
  now pays insight through the shared `arcadeRewards` helper).
- Margin Miner's claw level controls (it now pays insight per level through the
  shared `arcadeRewards` helper).
- SVG arena treatment: responsive width, fixed `viewBox`, Solarized arcade
  tokens, grid background, and center overlays.

The first shell repetition has already been extracted. The remaining SVG
repetition produced `SvgArena.svelte`; future extractions should stay this small
and should not become a generic engine.

`MarginHollow.svelte` adds a first platform/metroidvania-like shape. Keep its room data, axis-aligned collision, door/gate requirements, pickup handling, hazards, and jump physics local until at least one more game wants the same shape. If that repetition appears, the likely first extraction is a tiny room/rect vocabulary, not a full platformer engine.

## Next Extraction Candidates

Extract in this order if the arcade keeps growing:

1. ~~`arcadeRewards.ts`~~ - done.
   Shared payout chokepoint with game ids and no shared reward formulas.

2. ~~`ArcadeHud.svelte`~~ - done for the core paying/action games.
   Shared title, hint, score boxes, start button, and arcade/back button.

3. ~~`ArcadeProgress.svelte`~~ - done for narrow time / progress tracks.
   Supports the current blue, green, yellow, violet, magic, and danger tracks.

4. `SvgArena.svelte` - pilot done.
   Responsive SVG wrapper, background rect, grid pattern, and pointer surface.
   Expand only to SVG games where the fit is clean.

5. `useArcadeLoop.ts`
   Only if at least two games need the exact same `requestAnimationFrame` lifecycle. Bullet Dot and Tower Defense are frame-based; Snake is step-based, so do not force this too early.

## What Not To Extract Yet

Do not extract these just because they look similar:

- Enemy movement, because Bullet Dot chases and Tower Defense follows a path.
- Projectile targeting, because player auto-fire and tower auto-fire have different ownership.
- Snake movement, because it is discrete and grid-step based.
- CSS wholesale, until `SvgArena` exists and the arena shape has settled.
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
3. Reuse `Dot`, `clamp`, `distance`, `normalize`, and `previewReward`
   when they fit naturally.
4. Use `ArcadeHud` and `ArcadeProgress` when the game's shell matches the
   existing arcade shape.
5. Register the card and active component in `Arcade.svelte`.
6. Smoke test the game from the cabinet, not only from the active screen.
7. Factor only after the third clear repetition.

The arcade should feel like a cabinet of tiny handmade machines: same room, same materials, different little mechanisms.
