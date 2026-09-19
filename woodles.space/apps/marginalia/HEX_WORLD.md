# marginalia — the hex world: handoff

What The World looks like now, how it got here, and what to know before touching
it. [2_5D.md](./2_5D.md) is the design record of the arc that produced it and
still holds the reasoning; this file is the current state and the next moves.
[DESIGN.md](./DESIGN.md) is unaffected — none of this changed a mechanic, a
number, or a save.

---

## 1. what it is

The World is a **hex field seen from a tilted axonometric camera**. Silt she pours
raises tiles; a tile whose top clears sea level is land. An untouched world is a
quiet seabed under deep water.

| | |
| --- | --- |
| the camera | `src/lib/witch/hex.ts` |
| the field over the sediment grid | `src/lib/witch/hexField.ts` |
| the renderer | `src/lib/witch/WorldCanvas.svelte` |
| tests | `hex.test.ts`, `hexField.test.ts` |

**Nothing about the save changed.** `SedimentGrid` is still 48×12 and still
persisted at that size. Odd-r offset coordinates are how hex maps are normally
stored — a rectangular array with alternate rows shifted half a tile — so the grid
already *was* a hex map. The visible field is coarser (15×27) and samples the grid
through `sampleSediment`; the pour writes the fine grid and reads back through the
same transform, so the two never disagree.

---

## 2. how it got here, and why the shape of the arc matters

Five steps, of which the fourth failed usefully.

| | what | outcome |
| --- | --- | --- |
| A | the floor became a plane in perspective | shipped |
| B | depth for the whole scene: z-sorting, scale and fog from distance | shipped |
| C | the pour landed where you point; silt gained thickness | shipped |
| D | the lateral axis, so a shore could exist | **hit a wall** |
| — | the hex camera | replaced A–D's rendering |

### the wall, because it explains the camera

A–C built a perspective floor under an aquarium cutaway: sky above a water line at
`y = 0.34`, a floor receding to a vanishing point at `y = 0.667`. That worked while
the floor was the only thing in perspective.

D needed terrain to cross the water. It cannot. **The water line sat a third of the
frame *above* the floor's own horizon**, so for land to emerge the near edge of the
shelf had to ramp across two thirds of the frame — a wall thrown across the
diorama, not a beach. The scene had two cameras and always had; nothing exposed it
until something had to travel between them.

2_5D.md lists three ways out, each trading something real. The one taken was a
fourth that trades nothing, and it came from reference art rather than from the
geometry: **an axonometric camera has no vanishing point, so there is no horizon
left to disagree with.** Sea level becomes a plain world height.

Two things fell out of that which were not the point but are worth knowing:

- **panning is free.** With no perspective to recompute, moving the camera is a
  translation of `origin` and nothing else. The lateral travel D was scoped for
  costs almost nothing now.
- **painter's order is exact**, not an approximation. Rows cannot interleave in
  depth without perspective, so `byHexRow` is provably correct rather than a good
  heuristic.

### what survived from A–D

The rendering did not; the thinking did. `sampleSediment` (bilinear read of the
grid, written in C) is what makes the coarse field possible. The coverage coupling,
the discipline of verifying under the failing condition, and 2_5D.md's record of
the reasoning all carried over. **The perspective projection, its coupled inverse,
and the band-strip surface were thrown away.** That is a real cost and the doc says
so rather than pretending the pivot was free.

---

## 3. the numbers, and why each is what it is

None of these were picked by eye. Changing one without the reason is how this
drifts.

| constant | value | tied to |
| --- | --- | --- |
| `HEX_SIZE` | 0.028 | the frame. 15 tiles at this size span ~¾ of the width; a test fails if the field stops fitting |
| `CAMERA_TILT` | 0.56 | tops readable as tops, sides with room to show thickness |
| `TILE_THICKNESS` | 0.032 | a tile's own drawn height. At 0.052 land stood two tile-heights proud and read as stacked blocks |
| `FIELD_COLS × FIELD_ROWS` | 15 × 27 | the canvas is 2:1 and the tilt squashes rows, so a proportionate field needs far more rows than columns |
| `TILE_ELEVATION_SCALE` | 2.2 | puts the shore at ~0.45 density, a beat past `SEDIMENT_CELL_THRESHOLD` |
| `SEABED_ALPHA` | 0.24 | visible, quiet. Zero is the bug in §5 |
| `SEABED_RELIEF` | 0.22 | enough that tiles have sides; a fraction of what a pour adds |
| `CREATURE_TILES` | 0.9 | **measured in tiles, not frame heights** — see §5 |
| `SPAWN_INSET` | 0.62 | spawn points were authored full-bleed; the field is the middle of the frame |

---

## 4. how a thing gets into the world

Everything on the field goes through two functions. If something looks wrong in
space, one of these is why.

**`standOn(u, v)`** — a place in the density field to the tile there, its height,
and whether it is land. Creatures, features, auras and the falling silt all use it,
so they cannot disagree about where the ground is. It reads `tileElevation`, which
is deliberately the same sum `fieldTiles` builds — a test pins that, because a
creature standing at a different height than its own tile is worse than a flat
floor.

**`drawTileShadow`** — the mark that does the actual work of putting something in
the world. A sprite with a shadow beneath it is standing on something; the same
sprite without one is a decal. Flattened to the same tilt as a tile's top face, and
leaning blue rather than black, because a hard dark ellipse on open water reads as
a hole in it.

`LAYER_HOVER` then gives the spawn layers meaning they never had: a swimmer rides
above its tile while its shadow stays on it, air rides higher, anything that walks
stands on the top face.

---

## 5. bugs worth remembering, because each has a lesson

**The empty world drew nothing.** `drawHexField` skipped tiles below a minimum
elevation — right for making an island read as an island, catastrophic applied to
the whole field. A save at 0 insight, before pouring is even unlocked, is exactly
that world, so a new player opened The World and found an empty rectangle. *Every
screenshot taken while building it had silt in it.* The one state every player
passes through was the one state never opened. **Open a fresh save, not a
convenient one.**

**The seabed was a slab.** Fading in from the field's rectangular border removed the
hard cut but kept the shape — a scalloped top edge, a combed side. A seabed has no
rectangle in it. The falloff is radial and per-tile ragged now, and a test pins that
a corner fades before an edge midpoint, which is precisely what a rectangular
falloff would not do.

**Creatures were sized in frame heights.** Correct for a water column filling the
canvas, meaningless against tiles. They came out six tile-heights tall. Against a
field, the only scale that means anything is the tile.

**The pour brush was elliptical without meaning to be.** It measured its radius in
grid cells, and the grid is 48 wide by 12 deep — 2.5 cells reaches 5% across and
21% down. The old wide floor band hid it; the hex field made it raise a tall narrow
column. Fixed by scaling the vertical reach by the grid's own proportions, which
left the horizontal reach untouched.

**Underwater strokes became stripes.** A whole row's tile outlines line up and read
as lines ruled across the sea. Only land keeps a drawn edge; below water a per-tile
difference in tone tells pieces apart.

---

## 6. known, and deliberately not fixed

**A creature on a back tile draws over tiles in front of it.** The field is baked to
one offscreen canvas, so it cannot interleave with animated sprites. Fixing it
properly means splitting the bake by row rather than a two-pass hack. It reads far
better than it did; this is worth doing on purpose.

**The vitest worker emits `Timeout calling "onTaskUpdate"`** and exits non-zero even
with every test passing. It reproduces on a clean checkout, does not occur on
GitHub's runner, and has no config knob — see PR #313.

**`WATER_TOP` still anchors a few leftovers** — the weather mist band, the ripples.
They are drawn against a water surface that no longer exists as a line. Harmless,
but they belong to the old camera.

---

## 7. what is next

In the order I would take them.

1. **Atmosphere.** The base is coherent now, which is what the last few rounds were
   for. Depth-tinting so far tiles recede, light on tile tops, and the biome
   vocabulary from the reference art — biome colour by elevation, then mountains and
   forests.
2. **The row-split bake**, so creatures occlude correctly against tiles.
3. **Retire the `WATER_TOP` leftovers.**
4. **Panning**, which is nearly free and opens a world larger than one frame — the
   original point of D's lateral axis.

Two questions the reference art raises that are design calls, not implementation:

- **Does the world grow past one screen?** Panning makes it cheap. The mechanic
  currently fills a fixed field.
- **What do the later panels mean mechanically?** Mountains, forests and the sunset
  view are a vocabulary; which of them are *states of the world* (tied to
  complexity, stability, the Known endgame) rather than decoration is a DESIGN.md
  question.

---

## 8. where the work is

| PR | what |
| --- | --- |
| #312 | steps A–C, and `2_5D.md` |
| #313 | the CI fix that made any of this verifiable |
| #314 | the hex camera and the field |
| #315 | the seabed is always there |
| #316 | the seabed stops looking like a slab |
| #317 | creatures stand on tiles; the silt arrives from above; sizing |

#313 is worth reading separately: CI had been red on `main` for weeks on wall-clock
assertions in `packages/incremental-core`, which meant marginalia's own tests had
**never run in CI**. `cozy-garden` already had the right pattern for it and a
comment explaining why raising the threshold was the wrong fix — a good argument
for reading a file before changing it.
