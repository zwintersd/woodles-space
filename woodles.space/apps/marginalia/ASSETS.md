# marginalia — visual asset brief (the world canvas)

what to draw for the §1.6 **biome diorama** in [DESIGN.md](./DESIGN.md), for the parts
that still need art: the creatures come from your Bestiary sprites via the existing
binding, and the sky/weather/water/sediment floor are painted procedurally in
`WorldCanvas.svelte` (`drawSky`, `drawWeather`, `drawWaterBase`, `drawShallowsShelf`,
`drawSedimentGrid`) — there is no P1 image-layer brief to fill anymore; the version of
this doc that asked for `sky-sun.png`, `cloud-a/b/c.png`, `rain.png`, `mist.png`,
`terrain.svg`, `soil.png`, `water.png` described an earlier architecture that the
procedural rendering replaced, and those files have been removed. see
[DIORAMA_ROADMAP.md](./DIORAMA_ROADMAP.md) for the current punch list, including the
still-open **nutrients has no visual hook** gap (oxygen/moisture/favor/stability all
drive something on the canvas; nutrients doesn't, yet).

what's left to draw is **P2/P3 below** — richness on top of the procedural scene.

---

## conventions (please read once)

- **format:** PNG-24 with alpha, exported **@2x** (deliver the 1920-wide-class files;
  code downsamples). **SVG is welcome** where crisp scaling helps.
- **motion is done in code** — drift, fall, shimmer, sway, breathe, glow-pulse. Do
  **not** bake animation or motion blur. Deliver single still frames.
- **style:** soft and painterly. **Not pixel art** — that's Bestiary's mode. Avoid hard
  1px outlines; let edges feather.
- **palette** — stay within the current app tokens (`src/lib/style/tokens.css`):

  | token | hex | use |
  | --- | --- | --- |
  | bg | `#f3ecda` | parchment ground |
  | panel | `#ecdfc2` | raised parchment |
  | periwinkle | `#8a5568` | muted rose-brown — shadow, secondary accent |
  | cyan | `#5f7a52` | sage green — the "cool" accent role, despite the name |
  | leafeon-pink | `#b8506c` | warm accent — halo, nutrient motes |
  | cream | `#34281d` | ink-dark text/detail tone (the *dark* accent here, not a highlight — the repaint inverted this role from the old palette) |
  | print-pink | `#7c3349` | deep warm — sparingly |

  these are the **parchment/rose/sage** repaint's values (`fe87f8a`). don't paint for
  the old indigo/cyan/pink "twilight webcore" palette — if you're looking at an older
  reference image of this diorama, the colors it shows predate this table.
- **transparency:** everything here is on a transparent background — these are overlays
  on the procedural scene, not full-bleed layers.
- **naming:** lowercase-hyphen, exactly as listed below.
- **delivery:** drop files into **`apps/marginalia/static/diorama/`**. they'll serve at
  `/marginalia/diorama/<file>`; the code loads them base-prefixed, so you only need the
  right filenames. Sizes are targets — within ±25% is fine; **aspect ratio matters more
  than exact pixels.**

---

## P2 — flora & particles (richness; only the plants without Bestiary art)

| file | size @2x | notes |
| --- | --- | --- |
| `algae.png` | 128² | soft green bloom for the shallows; sways in code. |
| `lichen.png` | 192² | grey-gold crust patch for bare rock. |
| `moss.png` | 192² | low green cushion for the hollows. |
| `fungal.png` | 256² | pale underground thread mat; very low opacity, dreamlike. |
| `mote-oxygen.png` | 32² | a tiny bubble. drifts up over water. |
| `mote-nutrient.png` | 32² | a tiny warm speck. drifts in soil — currently the only
  place nutrients would get a visual hook at all (see the gap noted above). |
| `crystal-salt.png` | 48² | a small pale crystal cluster for the tide line. |

motes are spawned and animated in code — one of each shape is enough.

---

## P3 — the gauge cluster (the numbers' frame; matches `HexStage`)

| file | size @2x | notes |
| --- | --- | --- |
| `gauge-ring.png` | 192² | a soft hex or ring frame, transparent centre, gradient edge in the current accent tones (see palette above). re-tinted per sign in code. |
| `icon-nutrients.svg` `icon-oxygen.svg` `icon-moisture.svg` `icon-stability.svg` `icon-complexity.svg` | 48² logical | simple single-colour line glyphs (so code can recolour). e.g. nutrients = a seed/grain, oxygen = a bubble, moisture = a droplet, stability = a balance/keystone, complexity = a small web. |

---

## delivery checklist

- [ ] P2 (7 files) — flora and motes.
- [ ] P3 (1 frame + 5 icons) — the readout dressing.
- [ ] all in `apps/marginalia/static/diorama/`, named as above, transparent PNG-24
      @2x (or SVG where noted).

neither tier is blocking anything — the scene already reads as a living place without
them. if anything here is awkward to produce, tell me and I'll adjust to fit what's easy
to draw.
