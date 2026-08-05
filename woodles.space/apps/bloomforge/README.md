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

## first run

A one-time welcome offers two doors: take the tour, or poke at the example
garden loaded behind it. The tour opens a **genuinely blank** project and walks
six steps — currency → generator → press play → tune the curve → add an upgrade
→ fast-forward.

Every step completes by **observing the def and the running simulation**, never
by a "next" button ([`tour.svelte.ts`](./src/lib/tour.svelte.ts)). That one
constraint does a lot of work: the tour cannot claim you did something you
didn't, it cannot drift out of step with the app, and it gives you credit for
doing the thing by a route the hint never mentioned. It is a banner above the
canvas rather than a floating card, because a card that covers the button it is
pointing at is worse than no card.

The `?` in the toolbar starts it again. Skipping means "not now", never "never
again".

Walking it end to end is also how two first-timer-only bugs turned up: a new
generator that started unowned — so a from-scratch game could never afford
anything and pressing play showed a column of zeroes — and a playtest that kept
simulating the def it was built from, making every edit invisible until you
found the reset button. Both are fixed and both now have tests.

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
export/import.

**Sync moves the whole shelf**, not the open project — syncing one game would
quietly lose the rest. The blob is the index plus every definition, and the
merge is per project, newest wins, and deliberately *order-independent*:
`createAppSync` retries a merged snapshot against the version it just observed,
and an order-dependent merge would ping-pong instead of settling. Editing a
different game on each device leaves you holding both.

Playtest state is throwaway and never written back into the def: watching a run
must not edit the game.

## icons

Every glyph in the UI is [OpenMoji](https://openmoji.org) artwork (CC BY-SA
4.0), drawn from a small bundled SVG set — never a native emoji character,
which renders differently on every OS and browser. A currency's Symbol field
is a picker into that same set rather than free text, so what you choose is
always something this app (and [the player](../bloomforge-player/README.md),
off the same [`@woodles/emoji`](../../packages/emoji/src/index.ts) registry)
actually knows how to draw.

## running it

```bash
pnpm --filter bloomforge dev
pnpm --filter bloomforge test     # 71 tests
pnpm --filter bloomforge check
```

## handing it to a player

**Play it** opens [the player](../bloomforge-player/README.md) on the current
project. It passes `?game=<project id>` rather than a definition, because both
apps share an origin and a link carrying data would go stale the moment you
edited the game. The playtest dock simulates a player; this hands the real
thing to a real one, off the same engine and the same def.

## not built

The art/audio/localization resource panels from the mockup. The schema leaves
room (`Currency.symbol` as a sprite reference); nothing is built.
