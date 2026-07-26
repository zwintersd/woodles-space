# diorama assets

The world-canvas art lives here, served at `/marginalia/diorama/<file>`.
`WorldCanvas.svelte` paints the sky, weather, water, terrain shelf, and
sediment floor **procedurally** — no image files back those layers, so
there is nothing to drop in for them.

The files actually loaded are the sprite sheets layered over that painted
scene:

- `pearl_sediment_bits.png` / `pearl_sediment_clusters.png` — the sifted
  sediment floor's texture.
- `witch_influence_motes.png` — ambient magical motes.
- `witch_water_ripples.png` — water response rings.
- `sift_sediment_cast.png` — pearlescent falling sediment and impact puffs.
- `feature_awakenings.png` — soft auras for known/intervened world features.

Also expected here (not yet delivered — the canvas skips them gracefully
until they land): `star-drifter.png`, `spotted-swimmer.png` — the shared,
public decorative-creature sprite sheets declared in `worldShape.ts`'s
`CREATURE_SPECS`. See ASSETS.md's "the menagerie" section for the exact
grid/fps convention before adding more.

See [`../../ASSETS.md`](../../ASSETS.md) for sizes and palette. Its P1
image-layer brief (sky/cloud/rain/mist/terrain/soil/water) describes an
earlier architecture that the procedural rendering replaced — see
[`../../DIORAMA_ROADMAP.md`](../../DIORAMA_ROADMAP.md) for the story. P2
(flora & particles) and P3 (gauge frame & icons) in ASSETS.md are still
unbuilt, optional richness.
