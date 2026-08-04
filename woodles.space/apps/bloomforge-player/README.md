# Bloomforge Player

The runtime that turns a `GameDef` into a game you can actually play. Lives at
[`/play`](https://woodles.space/play).

This is the third consumer of the schema, after the editor and the balance
runner, and the one that proves the split was worth making: it contains no game
logic at all. [`@woodles/incremental-core`](../../packages/incremental-core/README.md)
owns everything; this app draws buttons.

## the same engine, played rather than simulated

It drives the very same `createSim` the studio's playtest dock does, differing
in exactly two ways:

- **1× real time**, not 10× or 100×.
- **`idlePolicy`** — the engine buys *nothing*, because every purchase is a
  person deciding to make it. The buttons dispatch the same `Action`s a policy
  would have returned, and the engine re-checks affordability, so a stale
  "affordable" flag in the UI can never conjure a level out of nothing.

## getting a game into it

The studio's **Play it** hands over `?game=<project id>`. Both apps sit on one
origin, so the player reads the same localStorage entries the studio writes —
no export step between making a thing and playing it, and no definition in the
URL that could go stale against an edited game. The key names live in the core
([`library.ts`](../../packages/incremental-core/src/library.ts)) rather than in
either app, which is what stops the two drifting apart.

Failing that: pick from your shelf, open a `.json` file, or play the bundled
example. Whatever you had open is remembered, so a reload lands you back in
your game rather than at the shelf.

## saves

Progress autosaves every ten seconds, on every purchase, and when the tab goes
away. A save is keyed by `meta.id` rather than project id — the same game played
from two project entries is the same game.

Two things about the format are worth knowing:

**A save outlives the design.** The author keeps editing after people have
started playing, so restoring is a *reconciliation*, not a load: start from a
fresh state for the current def, then lay the saved numbers over the top
wherever both agree. Entities the author deleted are dropped, ones they added
start at zero, levels past a newly-lowered cap are clamped, and a save from a
different game is refused outright.

**The random stream resumes.** A save records where the generator had got to,
not just its seed. Without that, reloading replays the crit rolls the run made
in its first second — which makes save-and-reload a way to reroll a bad one.

## not built

Offline progress. The frame delta is clamped when a tab has been backgrounded
rather than paid out, because whether time passes while you're away is a design
decision for the author to make, not an accident of how `requestAnimationFrame`
behaves. The save records wall-clock time, so it's addable without a format
change.

## running it

```bash
pnpm --filter bloomforge-player dev
pnpm --filter bloomforge-player test     # 18 tests
pnpm --filter bloomforge-player check
```
