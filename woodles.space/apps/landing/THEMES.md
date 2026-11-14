# landing themes — how the looks work

what is built, as of 2026-11-14. the proposal this grew from, and the page
before it, are in git history (this file before that date).

## the shape

a theme is a **preset over six axes**. the palette is the theme's identity;
the other five are the desk's form.

| axis | attribute | values | sets |
|---|---|---|---|
| palette | `data-theme` | the fifteen in `shared/palette.css` | color |
| type | `data-type` | `classic` `optical` `modern` `fell` `gothic` `glaze` `pixel` | `--desk-display`, `--desk-ui` |
| shape | `data-shape` | `soft` `round` `crisp` `square` | `--desk-round` |
| material | `data-material` | `glass` `paper` `flat` `glow` | `--desk-glass`, `--surface`, `--desk-shadow-ink`, `--desk-tile-mix`, pane shadows |
| motion | `data-motion` | `float` `snappy` `bouncy` `still` | `--desk-spring`, `--desk-tilt`, durations |
| atmosphere | `data-ground` | `aura` `still` `confetti` `ruled` `sprinkles` `bloom` `scanlines` `plain` | the wash and pattern layers |
| | `data-weather` | `sparkles` `stars` `petals` `snow` `embers` `none` | the particle glyph, count, and path |

every attribute sits on `<html>`. `apps/landing/looks.js` holds the table and
sets them; `index.html` holds one block of `--desk-*` tokens per axis value.
the stylesheet never names a theme.

`data-scene` (Soft Desktop or Field Notes) is separate: it picks the
composition, and is stored in `woodles-landing-scene-v1`. the palette colors
either scene. Field Notes keeps its own paper style and ignores the form
axes; `field-notes.css` owns it.

## the looks

| theme | type | shape | material | motion | ground | weather |
|---|---|---|---|---|---|---|
| cream | classic | soft | glass | float | aura | sparkles |
| dawn | optical | soft | glass | float | bloom | sparkles |
| dusk | classic | soft | glass | float | aura | stars |
| terracotta | gothic | round | paper | float | aura | none |
| midnight | modern | soft | glow | float | aura | stars |
| forest | optical | soft | paper | float | aura | none |
| paper | classic | crisp | flat | snappy | plain | none |
| inkwell | fell | soft | glow | float | ruled | stars |
| typewriter | fell | crisp | paper | snappy | ruled | none |
| blossom | glaze | round | glass | float | bloom | petals |
| sugar | modern | round | glass | bouncy | sprinkles | sparkles |
| fog | modern | soft | glass | still | still | none |
| glacier | modern | crisp | glass | float | aura | snow |
| signal | modern | square | flat | snappy | plain | none |
| amber | pixel | square | glow | snappy | scanlines | embers |

cream is the desk as it always was, and dusk is cream at night; those two are
a pair on purpose. the 2026-11-14 pass pulled four near-twins apart: dawn
took the heavier `bloom` wash, inkwell became gilt `glow` with soft corners
(it had been typewriter in navy), and signal and amber went `square`.
`confetti` belongs to no theme; it is there to be chosen by hand.

## resolving

`looks.js` is a classic script, loaded blocking in `<head>`, so every
attribute is set before first paint. it leaves `window.woodlesLooks`
(`THEMES`, `AXES`, `VALUES`, `lookOf`, `resolve`, `read`, `write`, `apply`)
for the page's module.

the order is: base → the theme's look → `held` → `over` → the system.

- **`woodles-theme`** holds the palette id. `apps/animations` reads and writes
  the same key, so the palette cannot be overridden: "typewriter's form in
  glacier's colors" is glacier with the form set by hand.
- **`woodles-look`** holds `{ over, held }`.
  - `over` is what someone chose in Personalize. it survives every theme
    change, by swatch or by ❄, until its row is set back to "theme's".
  - `held` is the form ❄ kept. ❄ steps to the next palette and takes that
    palette's typeface, but holds shape, material, motion, ground, and
    weather where they were. choosing a swatch clears `held` and takes the
    theme's whole look.
- **the system** beats anyone's choice. `prefers-reduced-motion` forces
  motion `still` and weather `none`, so the particles are never built.
  `prefers-contrast: more` forces material `flat`.
  `prefers-reduced-transparency` turns `glass` and `glow` to `flat`.

with no theme chosen, the desk follows the system: cream in light, dusk in
dark.

## where it shows in the page

- **Personalize → theme**: fifteen swatches. each carries its own
  `data-theme`, so it previews the real palette for free.
- **Personalize → this theme's look**: one row per axis, built from
  `VALUES`. the first button is "theme's · <value>"; the rest set `over`.
  the row for ground keeps the name wallpaper.
- **the tray**: ✦ switches weather on and off (the theme's own, or sparkles
  when the theme has none). ❄ steps the palette.
- **the hold**: while `held` differs from the theme's own look, ❄ carries a
  dot, and the flyout and Personalize show a line with a "use <theme>'s own
  look" button.

## the axes, as built

**type.** two roles: *display* (greeting, names, notes, big numbers) and *ui*
(labels, clocks, chips). the ids follow `fontPairs` in `shared/library.js`,
with two rules of the desk's own:

- expressive faces are for display only. ui is DM Mono, or Space Grotesk
  under `modern`.
- `pixel` is VT323 here, not Write's Coral Pixels. Coral Pixels is a colour
  font: it ignores the palette's ink. pixel also sets the name, note, and
  moon line upright, since a slanted bitmap face smears.

classic's faces and Field Notes' come with the page. the others are added by
`looks.js` on first use, marked `blocking="render"` so a stored theme's
stylesheet holds first paint as the page's own font link does. Landing does
not import `shared/fonts.css`, which fetches the whole workspace set.

**shape.** corners scale, they don't step:
`border-radius: calc(Npx * var(--desk-round))`. `soft` is 1, `round` 1.45,
`crisp` 0.25, `square` 0. `50%` and `999px` stay literal; they mean circle
and pill.

**material.**

- `glass`: each pane reads `var(--desk-glass, <its own blur>)`, so glass
  keeps its per-pane values.
- `paper`: opaque, more grain, a hard offset shadow.
- `flat`: opaque, a hairline, no shadow, no grain.
- `glow`: dark translucent panes with an accent halo.

paper and flat redefine `--surface` on `<html>`. paper, flat, and glow tint
each tile toward the palette: `color-mix(in oklab, var(--accent)
var(--desk-tile-mix), var(--g1))`. the mix is toward `--accent`, not
`--accent-strong`, which is near-white in dark palettes and near-black in
paper and signal.

**tiles.** a glyph reads its own tile. `--tile-mid` is the middle of the
tile's gradient; a relative `oklch()` colour makes the glyph white on a deep
tile and a dark ink in the tile's hue on a pale one, with a halo of the
opposite weight. `--desk-tile-ink` (white) is the fallback where relative
colours aren't understood.

**motion.** `float` is the original spring. `bouncy` overshoots harder.
`snappy` and `still` are blanket rules over `*`: snappy sets every transition
to 0.12s and every entrance to 0.3s; still settles everything. snappy
excludes the loops that never end (`.wash`, the launch pulse, `.sparkle`),
because a 34s drift cut to 0.3s is a flicker. **a new endless animation has
to be added to that exclusion**; `landing.spec.ts` fails if one is caught.

**ground and weather.** ground is the wash and the pattern layer. weather
gives its marks a glyph, a count, and one of three paths: twinkle, fall, or
rise. the `WEATHER` table is in the page's module.

## small text and alerts

two tokens exist because the shared palette is tuned for body text on a
plain ground, and the desk sets 8–10px labels on glass over a wash:

- `--desk-muted` leans the palette's `--muted` halfway toward `--text`.
  everything in the page that was `--muted` uses it. band labels, which sit
  straight on the wallpaper, lean further.
- `--desk-alert` and `--desk-on-alert` follow the palette's `color-scheme`
  through `light-dark()`: a deep rose under white on a light desk, a pale
  rose under dark ink on a dark one.

## tests

- `e2e/landing.spec.ts`: a theme brings its whole look; ❄ holds the form and
  the hold can be released; each axis can be set by hand and stays; snappy
  hurries no endless loop; every theme's tile glyphs reach 3:1 against their
  tile.
- `e2e/accessibility.spec.ts`: every theme's Desktop, with Personalize open,
  audited at WCAG 2.1 AA. axe can't see through `backdrop-filter`, so glass
  and glow are measured against the pane's surface and text on the wash is
  not judged; paper and flat are exact.

## known limits

- the shared palette names tokens for colours and remaps them (`--peach` is
  red in signal, `--cream` is the background in dark themes), and
  `--accent-strong` is really "strong ink". the desk works around this with
  its own tokens rather than renaming, since every app reads the palette.
- motion is still a blanket override, not duration tokens. tokenizing the
  page's fifty-odd transitions would remove the exclusion list above.
- a change to the system's motion or contrast preference applies on the next
  load, not live.
- the screensaver has its own palettes and does not follow the theme.
- under reduced motion, the weather controls change the stored choice but
  nothing is drawn.

## deliberately not

- **a theme editor for every token.** six axes with named values is the
  ceiling.
- **sound.**
- **other apps.** the look registry stays in `apps/landing/` until a second
  app wants it. `shared/palette.css` is untouched.
- **"follow the day".**
