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

## already shipped (this pass)

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

---

## 1. creatures pile up on the same spot

**the problem.** `resolveSpawnPointForLife` (`worldShape.ts:475`) picks one spawn point
per life from a small weighted pool, but the pool is *tiny* before sediment/features
expand it:

- **aquatic**: 3 points total (`DEFAULT_WATER_SPAWNS`, `worldShape.ts:107`) — and world 1
  already ships 4 aquatic life (`salt_deposit`, `algae_bloom`, `tidal_pool`,
  `soft_swimmer`). pigeonhole guarantees at least two share a point from turn one.
- **terrestrial**: exactly **1** point (`first-shelf`, `worldShape.ts:143`) until a
  feature is placed — and world 1 ships 4 terrestrial life. all four stack on the same
  spot the moment the shallows unlock.
- **atmospheric**: exactly **1** point (`salt-mist-line`, same block) for 3 atmospheric
  life.

and when two lives land on the same point, they don't just crowd nearby — they render
at the *identical* x. `WorldCanvas.svelte`'s jitter is keyed off the spawn point, not
the creature:

```ts
const jitter = (point.id.length % 7) * W * 0.002;   // same point → same jitter
const cx = point.x * W + jitter;
```

only the bob phase (seeded off `life.id.length`) differs, so co-located creatures drift
through a shared ~4%-of-H vertical band and cross paths rather than sitting apart. (this
is a code-level finding, not yet screenshotted with bound sprites — unbound life renders
nothing at all, so seeing it live means binding a few Bestiary sprites first.)

**the fix, roughly:** make the jitter (and maybe a small per-life radius offset) a
function of `life.id`, not just `point.id`, so co-located creatures fan out around the
point instead of stacking on it. cheap, contained to `drawCreatureLayers`.

---

## 2. the diorama's colors predate the palette repaint

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
looking at the diorama with fresh eyes, using the current token values (see item 5) as
the anchor instead of the pre-repaint ones.

---

## 3. two avoidable per-frame costs

not urgent at today's creature counts, but worth fixing before the creature cap climbs
toward the **40** ceiling ([DESIGN.md §3.4](./DESIGN.md)):

- **spawn points are regenerated from scratch every creature, every frame.**
  `drawCreatureLayers` calls `resolveSpawnPointForLife` once per life, *twice* per frame
  (water/floor pass, then shore/air pass), and each call re-runs
  `generateSpawnPoints()` — including a full scan of the sediment grid
  (`sedimentSpawnPoints`, `worldShape.ts:441`). the result only changes when
  `worldShape.spawnRevision` changes. cache spawn points (and each life's resolved
  point) keyed on `spawnRevision`, recompute only when it bumps.
- **the sediment grid is painted cell-by-cell every frame** (`drawSedimentGrid`,
  up to 48×12 cells, several sprite draws per cell above threshold) even though
  sediment only changes while actively pouring. pre-bake it to an offscreen canvas,
  redraw the offscreen copy only when the grid mutates, and `drawImage` the cached
  result each frame — same visual, far fewer draw calls on every idle frame.

---

## 4. small legibility/accessibility gaps

- the canvas's `aria-label` is a single static string regardless of state
  (`"a living water world where sediment can gather into shallows"`) — fine as a
  baseline, but it never reflects weather, favor, or the pour affordance. low priority
  since the Ledger already gives the numeric/text equivalent of everything the diorama
  shows; mostly worth deciding *deliberately* that the canvas is decorative+interactive
  rather than the accessible source of truth, rather than leaving it implicit.
- `prefers-reduced-motion` is read once at mount (`const reduce = matchMedia(...).matches`)
  and never re-checked, so toggling the OS setting mid-session has no effect until
  reload. minor; a `change` listener on the media query would make it live.

---

## 5. housekeeping: the diorama outgrew its own asset brief

[ASSETS.md](./ASSETS.md) still documents a **P1 image-layer architecture**
(`sky-sun.png`, `cloud-a/b/c.png`, `rain.png`, `mist.png`, `terrain.svg`, `soil.png`,
`water.png`) that the current code doesn't use at all — `WorldCanvas.svelte` paints
sky/weather/water/shelf procedurally now. confirmed zero references anywhere in `src/`:

```
$ grep -rn "sky-sun\|cloud-a\.png\|terrain\.svg\|soil\.png\|water\.png\|mist\.png\|rain\.png" src/
(no matches)
```

those 9 files still sit in `static/diorama/`, shipped to every visitor, doing nothing.
and ASSETS.md's palette table is now actively misleading, not just stale — it documents
the *pre-repaint* hex values under the *current* token names (e.g. `--cyan` was
`#6ce5e8`, a bright cyan, and is now `#5f7a52`, a sage green; `--periwinkle` was a light
violet `#9a96c9` and is now a muted rose-brown `#8a5568`). an artist reading it today
would paint for a palette the app no longer has.

**the fix:** delete the 9 dead P1 files, and either retire ASSETS.md's P1 section
(procedural rendering replaced it) or rewrite it against the current
`src/lib/style/tokens.css` values and the procedural architecture. P2 (flora/particles)
and P3 (gauge frame/icons) in the same doc were never built either — worth a deliberate
call on whether they're still wanted before rewriting them too.

---

## 6. blocked on your voice, not on code

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

---

## suggested order

1. **item 1** (spawn crowding) — cheapest, most visible, no art or copy needed.
2. **item 5** (dead assets + stale doc) — pure cleanup, zero risk, clears the deck
   before any real art pass.
3. **item 3** (perf) — invisible today, matters more every creature-cap tier from here.
4. **item 2** (color-science pass) — bigger, more subjective, benefits from doing it
   once item 5 has made the current palette the documented one.
5. **item 4** (a11y/reduced-motion) — small, do whenever convenient.
6. **item 6** — whenever the voice lines exist.
