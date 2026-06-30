# Marginalia Arcade Polish Roadmap

Status snapshot: June 28, 2026.

This roadmap reviews the current Arcade cabinet as it exists in
`Arcade.svelte`: 14 playable games, 1 coming-soon card, and 3 locked cards.
It is broader than `ARCADE_REVIEW.md`, which is a resource-sharing review and
is now stale on the game inventory.

The development pause is the right move. The cabinet already has enough genre
range. The next value is not more games; it is making each little machine
deeper, clearer, fairer, and more meaningfully connected to the active pet.

## North Star

Each game should stay a game first. The practicable part should be felt through
repetition: timing, aiming, estimating, waiting, classifying, planning, steering,
noticing, recovering. No game should explain itself as a lesson. The child
should feel like they are getting better at the toy.

The active pet stats should work the same way: not flat score multipliers, not
abstract buffs, and not hidden math. Stats should change something visible in
the cabinet.

## Shared Priorities

1. Add one small stat vocabulary for all games.
   - Reuse the 2048 thresholds: stat 5 = tier 1, 7 = tier 2, 9 = tier 3.
   - Focus the arcade on the four core capacity stats: Body, Mind, Grace, Heart.
   - Put shared helpers in a tiny `arcadeStats.ts`, not in each game.
   - Show a compact pet-perk row when a game uses pet stats.

2. Centralize payouts and daily pacing.
   - Create a shared payout helper, likely `awardArcadeInsight(gameId, raw, max)`.
   - Route paying games through it.
   - Decide whether every paying game gets a daily cap, or whether caps only
     apply to games with high insight-per-minute output.
   - 2048, Color POP!, and Margin Miner currently do not pay insight.
   - Inkblot is the only daily-limited game.

3. Extract settled presentation parts.
   - `ArcadeHud.svelte`: title, hint, score boxes, start/back buttons.
   - `ArcadeProgress.svelte`: the thin progress bar shape.
   - `SvgArena.svelte`: responsive SVG wrapper and overlay slot.
   - Leave game rules local. Do not extract platformer physics, tower targeting,
     snake movement, or bubble matching yet.

4. Add durable run memory.
   - Persist best scores per game.
   - Consider per-game "best run" details: best streak, fastest clear, highest
     tier, fewest falls, longest survival.
   - Keep this lightweight and localStorage-backed unless the Book needs it.

5. Tighten input and accessibility.
   - Every pointer-heavy game should have keyboard or button controls.
   - Canvas games need stronger fallback text and visible controls.
   - Mobile controls should avoid accidental scroll and lost pointer capture.

6. Make gates real or make them honest.
   - Condition Match is marked `soon`.
   - Word Weave, Star Catcher, and The Long Game are hardcoded `locked`.
   - Either wire these statuses to Book state or label them as roadmap promises.

## Core Stat Pattern

- Body: mass, speed, stamina, strength, impact, survival.
- Mind: previews, memory, prediction, planning, clearer structure.
- Grace: precision, forgiveness, control smoothing, gentler timing windows.
- Heart: recovery, second chances, shields, streak protection, staying power.

Preferred implementation rule: each stat should be visible in the HUD or arena.
If Body gives a wider paddle, the paddle is wider. If Mind gives a preview, the
preview is visible. If Grace forgives a miss, the miss visibly softens. If Heart
grants a save, the save has a count and a moment.

## Playable Games

### Inkblot

Current progress: A creature-recognition game using Bestiary art. The image
reveals over 30 seconds, space pauses the reveal, and fuzzy name matching pays
insight. This is already a strong observation-and-patience loop.

Next expansions:
- Add a "practice without payout" mode after the five daily plays.
- Add a tiny recap of reveal time, guess count, and similarity.
- Let the active pet participate, not only the creature list.
- Consider creature pools: recent creatures, favorites, or unknown-only.

Rough edges:
- Only this game uses `dailyLimit`.
- Daily reset uses `toISOString()`, which is UTC rather than the player's local
  day.
- OffscreenCanvas may need a graceful fallback for older browser contexts.
- The result phase could make the exact learned recognition cue more visible
  without becoming instructional.

Stat pitch:
- Body: steadier reveal. Higher Body reduces visual wobble/blur at the very
  start so the child can anchor on shape earlier.
- Mind: one "structure glint" per round, such as a brief silhouette edge or
  first-letter glimmer after a pause.
- Grace: one gentle wrong guess per round that does not consume a guess if it is
  close to the name.
- Heart: one extra practice reveal after daily plays are spent, with no or low
  payout, framed as the pet staying to look a little longer.

### 2048

Current progress: The current stat prototype. Body opens with a higher tile,
Mind grants undo, Grace grants delete, Heart grants double, while Will and Spark
also exist as turn budget and wild reserve. Endless and 100-turn modes are live.

Next expansions:
- Decide whether 2048 pays insight or intentionally remains a pet-training toy.
- Persist best score per mode.
- Add tile movement/merge animation so the board feels less static.
- Add a small "pet rules this run" summary on game over.
- Consider a variant board, such as 5x5, only after the core board is polished.

Rough edges:
- It is the only live stat-heavy game, so the stat experience feels isolated.
- It consumes active pet power but does not pay the shared insight economy.
- Power-up use does not feel as kinetic as normal sliding.
- The perk grid includes Will/Spark, which muddies the four-core-stat frame.

Stat pitch:
- Body: keep the opening tile effect, but show it as "Body opened the board."
- Mind: keep undo; add a subtle "last move" ghost when undo is available.
- Grace: keep delete; make targetable tiles visually crisp and safe to cancel.
- Heart: keep double; make it feel like encouragement, not a cheat button.

### Color POP!

Current progress: A Matter.js physics merge game. Dropped circles collide,
matching tiers merge into larger circles, and a ceiling danger line ends the run.
It has strong physics, geometry, estimation, and patience value. It now uses a
local Matter dependency, remains explicitly score-only, records local runs, and
shows pet-stat effects for drop impulse, next-drop preview, cooldown, and settle
saves.

Next expansions:
- Add insight payout only if the balance pass brings score-only games into the
  economy.
- Add a visible goal ladder: next named tier, highest tier reached, clear target.
- Add a daily or session mode if payouts arrive.
- Add small merge effects that make cause and effect easier to read.

Rough edges:
- No Book payout yet; score-only is deliberate during this balance pass.
- It uses a local clamp helper rather than shared `arcadeMath`.
- Game over can feel abrupt when a settled circle crosses the line.

Stat pitch:
- Body: heavier drops or stronger pop impulse, making merges physically punchier.
- Mind: show the next two drops, or a faint landing column after the pointer
  steadies.
- Grace: shorter cooldown and slightly more forgiving settle threshold near the
  danger line.
- Heart: one "settle save" that nudges a just-too-high stack downward instead
  of ending the run.

### Margin Miner

Current progress: A claw-machine game with a pendulum, object value, object
weight, reeling speed, level targets, and timed rounds. It is one of the best
pure timing/estimation loops in the cabinet. It now remains explicitly
score-only while recording best/run summaries and showing pet-stat effects for
heavy reeling, scan, catch radius, and close-target extension.

Next expansions:
- Add insight payout on level clear or game over only if the balance pass brings
  score-only games into the economy.
- Add a small shop between levels: stronger reel, wider claw, one scan pulse.
- Add object variety that changes timing, not only value.
- Add a visible "best level" and "best haul."

Rough edges:
- No Book payout yet; score-only is deliberate during this balance pass.
- The canvas is beautiful but not very accessible beyond click/tap/Down.
- Level difficulty may need tuning now that pet effects and records exist.

Stat pitch:
- Body: faster reeling for heavy objects and slightly stronger claw grip.
- Mind: brief weight/value scan when the claw passes over an object.
- Grace: slower swing near center or a slightly wider grab radius.
- Heart: one end-of-level extension if the player is close to the target.

### Type Witch

Current progress: A typing/transcription game over condition phrases. It has a
60-second round, 12-second phrase timers, per-character feedback, accuracy, and
insight payout.

Next expansions:
- Add best round and best accuracy memory.
- Add phrase sets or difficulty bands by phrase length.
- Add combo language for clean phrases.
- Add a practice mode with no timer.

Rough edges:
- No daily pacing despite a high maximum reward.
- `cappedReward` is not used.
- There is an unused derived shuffle value; the pool itself handles shuffling.
- Backspacing and partial correction could feel clearer.

Stat pitch:
- Body: steadier hands. Slightly slower phrase dissolve or larger active input
  text at higher Body.
- Mind: preview the next phrase as a faint title strip after a clean phrase.
- Grace: forgive the first typo in a phrase before it counts as an error.
- Heart: preserve a combo after one failed phrase, or grant one "keep going"
  phrase when the round timer expires.

### Get Big!

Current progress: A tight growth-survival game. The player eats strictly smaller
blobs, avoids bigger ones, slows as they grow, wraps around edges, and wins by
becoming large enough to eat the yellow blob. The hard rule is clear and good.

Next expansions:
- Add difficulty bands: calm, normal, hungry.
- Add a post-run breakdown of edible contacts, danger dodges, and time.
- Add subtle spawn warning at screen edges.
- Add pet-stat tuning without weakening the "strictly bigger" rule.

Rough edges:
- No active-pet stats yet.
- Mobile directional controls work, but could use more tactile pressed states.
- The win target is strong but could use a clearer pre-win signal.
- No saved best run.

Stat pitch:
- Body: slightly larger starting radius or stronger acceleration.
- Mind: clearer edible/danger outline and brief edge-entry preview.
- Grace: better ice-foot correction: faster braking and softer turning.
- Heart: one nonlethal bump against a bigger blob that costs growth instead of
  ending the run.

### Margin Hollow

Current progress: A compact platform/metroidvania-like game with rooms,
platforms, gates, pickups, hazards, lives, double jump, key, and exit. It is
already the arcade's richest spatial-navigation loop. It now has visible pet
effects for jump/run, map memory, coyote/buffer timing, and checkpoint saves,
with local run records.

Next expansions:
- Add a map strip showing room connections and collected pickups.
- Add checkpoints at doors.
- Add one optional challenge route for a higher reward.
- Add more readable coyote time and jump buffering.

Rough edges:
- Three lives can still feel punishing if checkpoint saves are not available.
- Controls need very careful mobile tuning.
- Current room data is local and should stay local until another platformer
  proves the same vocabulary is needed.

Stat pitch:
- Body: higher jump, faster run, or one extra life at tier thresholds.
- Mind: tiny map memory: visited rooms and unopened gates stay marked.
- Grace: coyote time, jump buffer, and more air correction.
- Heart: checkpoint kindness. Keep glyphs after a fall or respawn at the room
  entrance instead of the room spawn.

### Insight Rush

Current progress: A short attention game. The player taps the true spark among
echoes, builds streaks, sees focus pips, and gets a capped insight payout after
20 seconds.

Next expansions:
- Add a daily/session cap or lower faucet pressure.
- Add keyboard support for accessibility.
- Add patterns of decoy behavior, not just more echoes.
- Add a calm mode that emphasizes accuracy over speed.

Rough edges:
- `cappedReward` is not used.
- The game explicitly allows repeated sets despite a high per-minute payout.
- It is pointer-first.
- A miss fully resets the streak, which may be harsher than the rest of the
  arcade's tone.

Stat pitch:
- Body: larger target hitbox or slightly longer target pulse.
- Mind: fewer decoys at the start of a run, or a clearer target shimmer.
- Grace: first miss at a high streak becomes a stumble instead of a reset.
- Heart: streak shield that recharges after several accurate hits.

### Bullet Dot

Current progress: A survival arena. The player moves a dot, enemies chase,
shots autofire at the nearest enemy, and the goal is surviving 45 seconds.

Next expansions:
- Add enemy variety: slow heavy, fast small, splitting mark.
- Add pickups that change positioning decisions.
- Add a "manual aim" or "priority target" option only if it stays simple.
- Add best survival and best kill count.

Rough edges:
- No active-pet stats yet.
- Autofire makes the player's agency almost entirely movement-based.
- Pointer movement and keyboard movement coexist, but the field could show the
  pointer goal.
- There is no daily pacing.

Stat pitch:
- Body: higher move speed or one extra health.
- Mind: smarter targeting, such as leading shots or prioritizing the closest
  dangerous enemy.
- Grace: smaller hitbox or smoother pointer movement.
- Heart: longer invulnerability after a hit, or one shielded collision.

### Margin Defense

Current progress: A tower-defense loop with a fixed path, build pads, tower
upgrades, coins, five waves, enemies with HP, leaks, and insight payout. It now
has a between-wave build pause, local records, and visible pet effects for
lives, wave preview, tower range, and refunds.

Next expansions:
- Add tower types: slow, splash, long-range.
- Consider deeper sell/repositioning after the first refund pass settles.

Rough edges:
- Build-before-start and between-wave building work mechanically; future polish
  can make tower planning richer.
- Only one tower type limits long-term planning.
- No daily pacing.

Stat pitch:
- Body: sturdier margin: more starting lives or stronger tower damage.
- Mind: wave preview and better default target priority.
- Grace: cheaper upgrades or slightly larger tower range.
- Heart: one repaired leak or partial refund when rebuilding.

### Margin Snake

Current progress: A classic grid snake with wrapping, swipe support, score,
length, speed increase, win score, and insight payout. It is clean logic,
planning, patience, and self-collision practice.

Next expansions:
- Add modes: classic walls, wrap, or obstacle grid.
- Add a ghost of the next head cell for younger players.
- Add persistent best score by mode.
- Add optional slow mode.

Rough edges:
- No active-pet stats yet.
- One mistake ends the run.
- Direction buttons are useful but could be more spatially arranged on mobile.
- No daily pacing.

Stat pitch:
- Body: slower speed ramp or slightly lower minimum step speed.
- Mind: next-head preview and one upcoming food preview.
- Grace: buffered turns with a visible queued direction.
- Heart: one self-bite becomes a tail shed instead of game over.

### Paddle Break

Current progress: A Breakout/Pong hybrid. The player keeps the ball alive,
breaks bricks, builds combo, and gets insight payout on complete or over.

Next expansions:
- Add levels with brick layouts.
- Add powerups: widen paddle, slow ball, pierce one brick.
- Add serve control before the first launch.
- Add best clear and best combo memory.

Rough edges:
- No active-pet stats yet.
- One miss ends the run.
- Paddle hit angles are good but could be more legible.
- No daily pacing.

Stat pitch:
- Body: wider paddle or stronger paddle impact angle.
- Mind: short predicted ball path after paddle contact.
- Grace: wider save zone and more controllable ball English.
- Heart: one ball reserve or one bottom-wall bounce per run.

### Bubble Spinner

Current progress: A rotating hex-bubble shooter. It uses shared hex helpers,
impact torque, fouls, penalty layers, matches, orphan drops, canvas drawing, and
insight payout. This is a strong geometry and aiming game.

Next expansions:
- Add level seeds with known clearable clusters.
- Add a color-safe palette option.
- Add a visible anchor/orphan preview for Mind-like play.
- Add better mobile aim/fire separation.

Rough edges:
- No active-pet stats yet.
- Canvas text currently uses CSS-variable font strings that may not resolve as
  intended in all browsers.
- Foul penalty layers are interesting but could surprise players.
- No daily pacing.

Stat pitch:
- Body: stronger impact torque control, or heavier shots that spin the cluster
  more predictably.
- Mind: longer aim guide and brief orphan-preview glow on hover/aim.
- Grace: extra foul count or wider snap tolerance.
- Heart: one penalty layer is absorbed by the pivot instead of spawning.

### Margin Bubbles

Current progress: A fixed-canopy bubble shooter with bank shots, match-three
clusters, orphan drops, every-fifth-shot ceiling pressure, and insight payout.
It is the clearest aim/angle/reaction game in the cabinet.

Next expansions:
- Add level seeds and board patterns.
- Add a color-blind palette pass.
- Add a "bank challenge" mode later, after the normal mode is polished.
- Add a clearer lost-run breakdown: popped, dropped, ceiling advances.

Rough edges:
- No active-pet stats yet.
- Pointer-drag-to-fire is nice, but accidental fire needs testing on mobile.
- The queue only shows loaded and next; deeper preview should be stat-gated if
  added.
- No daily pacing.

Stat pitch:
- Body: faster shot or stronger rebound, with visible speed trail.
- Mind: longer aim guide or two-bubble preview.
- Grace: one extra shot before ceiling drop, or easier snap placement.
- Heart: one ceiling hold when the canopy reaches danger.

## Coming-Soon And Locked Cards

### Condition Match

Current progress: Registered as `soon`; no playable component yet. The card
promises a memory game pairing conditions with emergences.

Next expansions:
- Build the first playable loop: reveal, hide, match, score, finish.
- Pull pairs from existing condition/emergence content.
- Add a simple difficulty ladder by pair count.

Rough edges:
- The promise exists in the cabinet but there is no game surface.
- It will need content selection rules so repeated plays are not identical.

Stat pitch:
- Body: faster card flip animation and shorter lockout after a match.
- Mind: one or more peek charges.
- Grace: mismatched cards linger slightly longer before hiding.
- Heart: one mismatch forgiveness that protects the streak.

### Word Weave

Current progress: Registered as locked with the hint "unlocks after writing 8
conditions." No unlock wiring or playable component exists.

Next expansions:
- Wire the unlock to Book condition count or relabel as roadmap.
- Build a small phrase-arrangement game using condition vocabulary.
- Start with sentence reconstruction before free-form validation.

Rough edges:
- The locked hint currently promises a mechanism that does not exist.
- Validation could become brittle if it tries to parse too much too soon.

Stat pitch:
- Body: faster tile handling and larger drag/drop targets.
- Mind: preview the target syntax skeleton.
- Grace: allow adjacent swaps or one misplaced word tolerance.
- Heart: preserve partial progress after a failed arrangement.

### Star Catcher

Current progress: Registered as locked with the hint "unlocks after earning 3
reading stars." No unlock wiring or playable component exists.

Next expansions:
- Wire the unlock to reading-star state or relabel as roadmap.
- Build a falling-object catch game with missed-star pressure.
- Make the loop about reading falling trajectories, not just reaction speed.

Rough edges:
- Locked state is hardcoded.
- It overlaps with Bullet Dot and Paddle Break unless the catch mechanic has its
  own feel.

Stat pitch:
- Body: faster basket movement or wider catch arc.
- Mind: faint landing-path preview for falling stars.
- Grace: softer edge catches and slower initial fall.
- Heart: one missed star is caught by the pet instead of lost.

### The Long Game

Current progress: Registered as locked with the hint "unlocks after witnessing a
full lifecycle." No unlock wiring or playable component exists.

Next expansions:
- Decide whether this should be a game, a prestige screen, or an idle ritual.
- Wire the unlock to lifecycle evidence.
- Keep it rare and quiet, not another high-frequency reward faucet.

Rough edges:
- The card is evocative but undefined.
- It could easily become too abstract unless it has one concrete repeated action.

Stat pitch:
- Body: sturdier long-run containers, such as slower decay or stronger storage.
- Mind: clearer long-horizon forecasts.
- Grace: smoother transitions between phases.
- Heart: recovery after neglect and gentler prestige reset.

## Recommended Development Order

1. Create `arcadeStats.ts` and a small stat-perk display.
   - Port 2048's stat tier helper into the shared helper.
   - Pass `activePet` into every playable game, but only turn stats on game by
     game.

2. Fix economy plumbing before adding more rewards.
   - Add a payout helper.
   - Decide daily-cap policy.
   - Bring Color POP!, Margin Miner, and 2048 into or explicitly out of the
     insight economy.

3. Extract HUD/progress/arena shells.
   - Do this before touching all games with stat UI.
   - The repeated markup is mature enough now.

4. Apply stats in genre clusters.
   - Puzzle/attention first: 2048, Inkblot, Type Witch, Insight Rush.
   - Movement/action next: Get Big!, Bullet Dot, Paddle Break, Snake.
   - Geometry/physics next: Color POP!, Margin Miner, Bubble Spinner,
     Margin Bubbles.
   - Strategy/platform last: Margin Defense, Margin Hollow, because those have
     the richest tuning surfaces.

5. Polish one cluster at a time with browser smoke tests.
   - Use the real route: `/marginalia/arcade`.
   - Prove visible effects, not only type checks.
   - Add tests for shared helpers and any extracted payout/stat logic.

## Definition Of Done For A Polished Game

- The game has a clear practicable core.
- The active pet's four core stats produce visible, named effects.
- The game records a local best or meaningful run summary.
- Reward behavior is intentional and consistent with the shared economy policy.
- Keyboard and pointer/touch paths both work, or the exception is deliberate.
- Finish/fail states show what happened and invite another try without scolding.
- The implementation still keeps game rules local unless repetition is proven.
