# marginalia — visual asset brief (the world canvas)

what to draw for the §1.6 **biome diorama** in [DESIGN.md](./DESIGN.md): a side-on
slice of Brianna's world — sky over land over water — that fills and animates from
the vital signs. this is the **phase B** art; phase A (the sign math) ships first as
numbers, so nothing is blocked on these.

**you don't draw the creatures.** living things come from your Bestiary sprites via
the existing binding. these assets are the *stage* they stand on: sky, weather, land,
water, and a few ambient bits.

---

## the composition

a wide, short band. three parallax layers between a back and front:

```
   ┌───────────────────────────────────────────────────────────┐
   │  ☀ sun/glow            ☁ clouds  (drift)                   │  SKY      (back)
   │                                              ~ mist ~       │
   │ - - - - - - - - - - horizon - - - - - - - - - - - - - - - - │
   │            ▓▓▓ terrain: rock strata ▓▓▓                     │  LAND     (mid)
   │      ▒▒ soil band (tinted by nutrients) ▒▒                  │
   │ ≈≈≈≈≈≈≈≈≈≈≈ water (shimmer) ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ │  WATER    (front)
   └───────────────────────────────────────────────────────────┘
        rain falls over the whole frame when moisture is high
```

**reference frame:** design at **1920 × 680 px (= the @2x of a 960 × 340 logical
canvas)**. the canvas is responsive-width and will crop/letterbox slightly, so keep
anything essential within the centre **80%** horizontally and away from the very top.
full-width pieces (terrain, water, soil, mist) should **bleed past both edges** by
~5%.

**what each sign does to the scene** (driven in code — you just supply the art):

| sign | drives |
| --- | --- |
| oxygen | sky brightness/hue — thin air is dim and violet, rich air clears toward blue |
| moisture | cloud count & opacity, rain intensity, mist density |
| nutrients | how dark/rich the **soil band** tints |
| stability | overall steadiness — low stability adds a faint desaturation/flicker |
| (life vitality) | a stressed creature dims; healthy life sits brighter |

---

## conventions (please read once)

- **format:** PNG-24 with alpha, exported **@2x** (deliver the 1920-wide-class files;
  code downsamples). **SVG is welcome** for the terrain silhouette and the icons,
  where crisp scaling helps.
- **motion is done in code** — drift, fall, shimmer, sway, breathe, glow-pulse. Do
  **not** bake animation or motion blur. Deliver single still frames. For clouds,
  three shape variants are plenty; code moves and fades them.
- **style:** soft and painterly, matching the existing glow aesthetic (see
  `HexStage.svelte`). **Not pixel art** — that's Bestiary's mode. Avoid hard 1px
  outlines; let edges feather.
- **palette** — stay within the app tokens (`src/lib/style/tokens.css`):

  | token | hex | use |
  | --- | --- | --- |
  | stage / bg | `#1a1a3e` | deep indigo — the night ground tone |
  | panel | `#2d2d5f` | raised indigo |
  | periwinkle | `#9a96c9` | soft violet — mist, cloud shadow |
  | cyan | `#6ce5e8` | water, oxygen, cool light |
  | leafeon-pink | `#f08fb8` | warm accent — sun halo, nutrient motes |
  | cream | `#f5f2e8` | highlights, cloud tops |
  | print-pink | `#b54a85` | deep warm — sparingly |

  greens for flora are fine, but **mute them** so they sit inside this twilight
  webcore rather than fighting it.
- **transparency:** everything is on a transparent background **except** the terrain
  and water layers, which may be full-bleed.
- **naming:** lowercase-hyphen, exactly as listed below.
- **delivery:** drop files into **`apps/marginalia/static/diorama/`** (create it).
  They'll serve at `/marginalia/diorama/<file>`; the code loads them base-prefixed, so
  you only need the right filenames. Sizes are targets — within ±25% is fine; **aspect
  ratio matters more than exact pixels.**

---

## P1 — the diorama (the minimum for a living scene)

| file | size @2x | alpha / tiling | notes & what drives it |
| --- | --- | --- | --- |
| `sky-sun.png` | 256² | alpha | soft radial star/sun with a warm cream→leafeon-pink halo. halo intensity tracks favor. |
| `cloud-a.png` `cloud-b.png` `cloud-c.png` | 512×256 each | alpha | three soft puff shapes, periwinkle-shadowed / cream-topped, feathered edges. count + opacity ∝ moisture; they drift in code. |
| `rain.png` | 256×512 | alpha · **tiles both ways** | faint diagonal cyan/periwinkle streaks on transparent. opacity ∝ moisture; scrolls in code. keep it subtle. |
| `mist.png` | 1024×384 | alpha · tiles horizontally | very soft low haze, cream/periwinkle, low opacity. density ∝ moisture near the shore. |
| `terrain.png` *(or .svg)* | 1920×680 | alpha above the land line | the land cross-section: rock strata in indigo (`#1a1a3e`/`#2d2d5f`), an irregular soil/rock top edge, sloping toward the waterline. full-bleed; anchored to the bottom. **SVG preferred.** |
| `soil.png` | 1920×160 | alpha · tiles horizontally | the topmost earth band that rides the terrain's top edge. paint it **neutral/mid** so code can multiply-tint it darker & richer as nutrients rise. |
| `water.png` | 1920×280 | alpha | translucent sea: cyan→periwinkle vertical gradient, a brighter surface line near the top. sits in front of the lower terrain; shimmer is animated in code. |

---

## P2 — flora & particles (richness; only the plants without Bestiary art)

| file | size @2x | notes |
| --- | --- | --- |
| `algae.png` | 128² | soft green bloom for the shallows; sways in code. |
| `lichen.png` | 192² | grey-gold crust patch for bare rock. |
| `moss.png` | 192² | low green cushion for the hollows. |
| `fungal.png` | 256² | pale underground thread mat; very low opacity, dreamlike. |
| `mote-oxygen.png` | 32² | a tiny cyan bubble. drifts up over water. |
| `mote-nutrient.png` | 32² | a tiny warm-pink speck. drifts in soil. |
| `crystal-salt.png` | 48² | a small pale crystal cluster for the tide line. |

motes are spawned and animated in code — one of each shape is enough.

---

## P3 — the gauge cluster (the numbers' frame; matches `HexStage`)

| file | size @2x | notes |
| --- | --- | --- |
| `gauge-ring.png` | 192² | a soft hex or ring frame, transparent centre, gradient `cyan → periwinkle → leafeon-pink` edge (same family as the hex in `HexStage.svelte`). re-tinted per sign in code. |
| `icon-nutrients.svg` `icon-oxygen.svg` `icon-moisture.svg` `icon-stability.svg` `icon-complexity.svg` | 48² logical | simple single-colour line glyphs (so code can recolour). e.g. nutrients = a seed/grain, oxygen = a bubble, moisture = a droplet, stability = a balance/keystone, complexity = a small web. |

---

## delivery checklist

- [ ] **P1 (7 files + 2 extra cloud variants)** — the scene stands up with just these.
- [ ] P2 (7 files) — flora and motes.
- [ ] P3 (1 frame + 5 icons) — the readout dressing.
- [ ] all in `apps/marginalia/static/diorama/`, named as above, transparent PNG-24
      @2x (or SVG where noted).

if anything here is awkward to produce, tell me and I'll adjust the composition to fit
what's easy to draw — the code reads the filenames, so the plan can bend around the art.
