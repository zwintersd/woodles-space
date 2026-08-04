# Bloomforge Studio

A visual studio for **making** incremental games — not an incremental game.
Edit a game's economy as a node graph, watch it run, and fast-forward ten hours
of it to find out where the player hits a wall.

Lives at [`/bloomforge`](https://woodles.space/bloomforge).

## the split that matters

The editor owns no game logic. [`@woodles/incremental-core`](../../packages/incremental-core/README.md)
owns the `GameDef` schema, the validator, and the simulation engine; this app
edits a `GameDef` and renders one running. That means the numbers you watch in
the Playtest dock and the numbers a Balance run reports come from the same
engine, stepped differently — they cannot drift apart.

## the parts

**Canvas** — Svelte Flow for pan/zoom/drag, with a custom card per entity kind
(currency, generator, upgrade, prestige, unlock, milestone) and sticky notes for
the thoughts that belong next to a place in the graph. Live values overlay the
cards while a playtest runs.

Edges are **derived from the def**, never stored. Drawing one is a gesture that
edits the data — dragging a generator onto a currency sets `producesCurrencyId`
— so the graph and the data are incapable of disagreeing. A drag that wouldn't
mean anything is refused with a reason rather than left dangling. See
[`connect.ts`](./src/lib/connect.ts).

**Inspector** — a form per entity kind, and the piece the mockup didn't have and
the tool most needs: a **curve editor with a live plot**. Cost and output are
drawn against level 1–100 on a shared axis with a log toggle, because a curve
you can't see is a curve you're guessing at.

**Dock** — Playtest steps the sim on animation frames at 1×/10×/100× game time
(10× by default; real time is too slow to feel a curve). Balance fast-forwards
Idle against Greedy in a Web Worker and reports time-to-milestone. Plus Log and
project Notes.

## state

One runes store, [`studio.svelte.ts`](./src/lib/studio.svelte.ts), holding the
def, the selection, and an undo stack of whole-def snapshots — cheap and correct
at this data size, and "correct" is what you want from the thing people reach
for right after breaking something. A drag is one undo step, not one per frame.

Projects autosave to `localStorage` through `@woodles/persistence`, with JSON
export/import. `@woodles/sync` is deliberately not wired in yet.

Playtest state is throwaway and never written back into the def: watching a run
must not edit the game.

## running it

```bash
pnpm --filter bloomforge dev
pnpm --filter bloomforge test     # 37 tests
pnpm --filter bloomforge check
```

## not built

The player runtime that turns a `GameDef` into a playable build, and the
art/audio/localization resource panels from the mockup. The schema leaves room
for the latter (`Currency.symbol` as a sprite reference); nothing is built.
