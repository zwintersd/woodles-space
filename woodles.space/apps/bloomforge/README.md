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

A generator can also take a **population boost** — a rate multiplier driven by
a live count instead of its own level, off `@woodles/incremental-core`'s
`populationBoost` field. It's what the stress-test sample
[`apiaryOfBadDecisions`](../../packages/incremental-core/src/fixtures/apiary-of-bad-decisions.json)
is built on: a Hive that earns almost nothing from its own curve and almost
everything from upgrades the player owns but has deliberately left unequipped
— hoarding as a strategy, not a mistake. Equipping is a player action in
[the player](../bloomforge-player/README.md), not an editor concern, so the
Studio's own playtest — Idle or Greedy, never a human — never exercises it;
what the Inspector edits here is just the multiplier those two bots can't
reach.

A currency can carry a **spend tax** — spend it anywhere, on anything, and a
share mints into another currency as a byproduct — and a generator can
**convert** one currency into another instead of producing from a bare curve,
throttled every tick to whatever its input can actually supply. Together
they're the second stress-test sample,
[`confessionBooth`](../../packages/incremental-core/src/fixtures/confession-booth.json):
a Booth that produces nothing from its own curve, fed entirely by a tax
skimmed off every other purchase in the game. Unlike the Hive, this one needs
no player choice at all — Greedy funds it just by playing normally, which is
the whole point: some stress tests need a human to find the strategy, and
some the economy finds on its own.

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

## teaching as you build

The jargon an incremental game is built from — a generator's output curve, a
prestige layer's threshold and exponent, what an unlock actually reveals —
used to live only in this README. Now it lives in the app: a small gold star
([`InfoTip.svelte`](./src/lib/InfoTip.svelte)) sits next to the Systems
panel's entity-kind headers and the Inspector's denser fields, and hovering
or focusing it pops a candy-pink callout ([`Tooltip.svelte`](./src/lib/Tooltip.svelte))
with a one-sentence, in-voice explanation, sourced from
[`glossary.ts`](./src/lib/glossary.ts) so the same idea reads the same way
everywhere it shows up. The bubble is decorative — `aria-hidden` — because
the star's own `aria-label` already carries the explanation, so nothing here
depends on hovering to be understood.

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
