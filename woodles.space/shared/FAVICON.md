# woodles mark

A lowercase w drawn as one soft, slightly asymmetric stroke. The rounded
lavender tile belongs to the desktop's little objects; lapis ink belongs to
its letters and paper. Both colors come from the shared cream palette.
The open counters and thick stroke stay legible at 16 pixels. The fixed
colors keep the same identity across the rooms and their different themes.

`/favicon.svg` is the editable master. All app entry documents reference it,
with `/favicon.ico` as the fallback and `/apple-touch-icon.png` for saved
home-screen shortcuts. The ICO contains 16, 32, and 48 pixel images.

Regenerate the raster assets after editing the SVG:

```sh
node scripts/generate-favicon.mjs
```

Uses the repository's Playwright Chromium installation. The 256 pixel
`shared/woodles-mark.png` is a preview of the same mark.
