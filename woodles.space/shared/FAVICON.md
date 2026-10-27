# woodles mark

Carillon's lunar moth, pared down. The wings, lead and crescent come from
`apps/planner/src/lib/ornaments/lunar-moth.svg`; the herbarium, sparkles,
lower eyespots and most of the veins are gone. Peacock and amethyst glass
cross over the body, two gilt spots and a gilt leading edge stay, and the
antennae are drawn in lead so they read against the moon. The wing colors
alone carry it at 16 pixels, on light and dark tab bars. The fixed colors
keep the same identity across the rooms and their different themes.

`/favicon.svg` is the editable master. All app entry documents reference it,
with `/favicon.ico` as the fallback and `/apple-touch-icon.png` for saved
home-screen shortcuts. The ICO contains 16, 32, and 48 pixel images, all
transparent. The apple-touch icon sits on Carillon paper (`#fcf5e3`), inset
so the wingtips clear the rounded mask.

Regenerate the raster assets after editing the SVG:

```sh
node scripts/generate-favicon.mjs
```

Uses the repository's Playwright Chromium installation. The 256 pixel
`shared/woodles-mark.png` is a transparent preview of the same mark.
