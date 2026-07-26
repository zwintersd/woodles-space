# marginalia — the diorama's polish roadmap

scope note: this is about `WorldCanvas.svelte` itself — the rendering, legibility, and
craft of the biome diorama as a piece of canvas art. it's deliberately narrower than
[DESIGN.md](./DESIGN.md) (the game systems the diorama displays) and the root
[ROADMAP.md](../../ROADMAP.md) (the public-launch arc, where the diorama's *offline
binding* already shipped in week 5). nothing here blocks or is blocked by those — this
is the "does it read well, does it run well, is the art current" pass.

grounded in the actual code as of this write-up, not aspiration — every item below cites
where it lives.

---

## already shipped

- **witch-influence overlays were nearly invisible.** motes/ripples/sediment-cast/
  feature-auras all shared one aggregate scalar compressed into low alpha, and
  `screen`-blending pale art onto the diorama's light sky/water was close to a no-op
  regardless of alpha. split into two signals (`tending`, fast-moving; `witnessed`,
  slow/structural), ran both through a perceptual ramp, and added a plain
  alpha-blended tinted glow halo behind motes/auras so they show up regardless of
  background brightness.
- **floor creatures and features could sink off the bottom edge.** `y`/`cy` for the
  `floor` layer (dense sediment, placed features — both deliberately biased toward the
  deepest rows) was never clamped, so a full-size sprite plus its bob could push its
  bottom edge, and grounding shadow, past the canvas. clamped in `drawCreatureLayers`,
  `drawFeatures`, and `drawFeatureAuras`.
- **creatures sharing a spawn point rendered at the identical x.** world 1 alone has 4
  aquatic life sharing 3 points and 4 terrestrial life sharing 1 before sediment/features
  expand the pool, and the horizontal jitter was keyed off the *spawn point*
  (`point.id.length`), not the *creature* — so co-located lives stacked instead of
  spreading out. now keyed on a stable `(point.id, life.id)` pair so it's deterministic
  per creature. (code-verified; couldn't get a live screenshot with real creature art in
  this sandbox — no Bestiary bindings were available to test against.)
- **two avoidable per-frame costs.** `resolveSpawnPointForLife` was regenerating the
  whole spawn pool (including a sediment-grid scan) twice per life on *every* animation
  frame, even though the result only changes when the worldspace/`spawnRevision` does —
  now cached and invalidated on exactly those keys. the sediment floor (up to 48×12
  cells, several sprite draws each) was fully repainted every frame despite not
  animating at all — now baked to an offscreen canvas once per actual grid change and
  blitted with a single `drawImage`. verified live pouring still updates the bake in
  real time, and a resize re-bakes cleanly at the new size.
- **small a11y/reduced-motion gaps.** the canvas's `aria-label` was one static string
  regardless of state — now reflects the pour affordance (`book.canPourSediment()`) so
  it says something useful once there's something to do. `prefers-reduced-motion` was
  read once at mount; now a live `change` listener keeps it in sync with the OS setting
  mid-session (cleaned up on unmount).
- **housekeeping.** deleted the 9 dead P1 image-layer assets (`sky-sun.png`,
  `cloud-a/b/c.png`, `rain.png`, `mist.png`, `terrain.svg`, `soil.png`, `water.png`) —
  confirmed zero references anywhere in `src/` before removing. rewrote `ASSETS.md` to
  retire the P1 brief (the procedural renderer replaced it), fixed its palette table to
  the current parchment/rose/sage tokens instead of the pre-repaint indigo/cyan values,
  and fixed `static/diorama/README.md` to list what's actually loaded. left P2
  (flora/particles) and P3 (gauge cluster) in `ASSETS.md` as still-open, unbuilt asset
  requests — nobody's said those are unwanted, just deferred.

---

## still open

### the diorama's colors predate the palette repaint

the parchment/rose/sage repaint (`fe87f8a`) recolored every CSS token but explicitly
skipped the canvas:

> *"WorldCanvas.svelte's biome diorama is a procedural canvas painting with its own
> hardcoded gradient stops (sky/mist/water/shelf) — left untouched as a separate
> follow-up, since it needs real color-science attention per ASSETS.md rather than a
> mechanical value swap."*

that follow-up hasn't happened yet. `drawSky`, `drawWeather`, `drawWaterBase`, and
`drawShallowsShelf` all still hand-roll their own RGB stops rather than reading
`tokens.css`, so the diorama's palette isn't actually *wrong* (nothing clashes badly),
but it's also not *deliberate* against the new roles — it happens to still look
plausible rather than being tuned for them. worth a dedicated pass once someone's
looking at the diorama with fresh eyes, using the current token values (now the ones
actually documented in `ASSETS.md`) as the anchor instead of the pre-repaint ones.
deliberately deferred — bigger and more subjective than the rest of this list.

### blocked on your voice, not on code

two DESIGN.md items are specifically diorama *moments* that still have no on-canvas
beat, but the copy for them is explicitly reserved for you (§4, "✍️ you"):

- the world's **first self-balance** — mechanically real (`book.selfBalancing`,
  gates favor via `equilibriumFactor`), but the only trace anywhere is a small
  `— holding itself` label in the Ledger header. worth a one-time visual flourish on
  the canvas itself once there's a line to pair it with.
- **choosing not to intervene** — no visual counterpart at all yet.

not listing a build plan for these since the blocking piece is the line, not the
canvas work — happy to rough in placeholder copy for you to redline if that unblocks it
sooner.
