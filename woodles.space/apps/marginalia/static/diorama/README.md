# diorama assets

The world-canvas art lives here. `WorldCanvas.svelte` loads these by exact
filename and serves them at `/marginalia/diorama/<file>`; missing files are
skipped (the sky is painted in code), so the scene degrades gracefully and
fills in as art lands.

See [`../../ASSETS.md`](../../ASSETS.md) for the full brief — sizes, palette,
and what each sign drives. P1 (the minimum for a living scene):

- `sky-sun.png`
- `cloud-a.png`, `cloud-b.png`, `cloud-c.png`
- `rain.png`
- `mist.png`
- `terrain.png` (or `terrain.svg`)
- `soil.png`
- `water.png`

P2 (flora & particles) and P3 (gauge frame & icons) are optional richness.
