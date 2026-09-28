# landing themes — a proposal

how a theme on the homepage could change the whole room instead of only its
colors. this is read against `apps/landing/index.html` as it stands. **nothing
here is built.** the decisions that block building it are listed in the last
section.

## what a theme is today

a theme is one attribute. `data-theme` on `<html>` picks one of the fifteen
blocks in `shared/palette.css`, each about seventeen color tokens and a
`color-scheme`. the rest of the desktop is fixed in the landing's own
stylesheet and looks the same under every theme:

- **type**: `'DM Mono'` is written out 70 times and `'Cormorant Garamond'` 7
  times, with no token for either.
- **shape**: fifteen different `border-radius` literals from 6px to 22px, plus
  pills and circles.
- **material**: every pane is frosted glass. there are eight different
  `blur()` values between 26px and 36px, and every shadow has the shape
  `0 Npx Mpx -Kpx var(--accent-deep)`.
- **motion**: the same `cubic-bezier(.2,.9,.3,1)` is repeated ten times across
  eleven keyframes.
- **weather**: seven `✧` sparkles, either on or off.
- **tiles**: each app keeps its own gradient from the manifest under every
  theme, so `paper`'s monochrome desk still has a full row of candy-colored tiles on
  it.
- **stray colors**: `#e8859a` (the close hover and the what's-new dot) and
  `#fff` (tile glyphs) are hardcoded literals.

so `signal`, the theme built "for legibility first", still puts 8px mono
labels on translucent glass over a drifting color wash. `typewriter` is the
cream glass desk with a browner tint.

two places already go further than color, and this proposal grows out of
them. the "theme flourishes" block (`index.html:101`) turns the wash up for
`blossom` and adds white dots over the wallpaper for `sugar`, each written by
hand against a theme id. the swatch trick (`index.html:1568`) gives each
swatch its own `data-theme`, so it previews the real palette at no extra
cost. and two prefs in `woodles-desk` sit beside the theme but are really the
same kind of setting: `wallpaper` (aura / still / confetti / ruled) and
`sparkles` (on / off).

## the proposal in one line

a theme becomes a **preset over six axes**: palette, type, shape, material,
motion, and atmosphere. each axis is an attribute on `<html>` that selects a
block of tokens. the theme chooses a value for each axis, and every axis
except palette can also be set by hand.

the workspace already has this shape elsewhere. the `templates` in
`shared/library.js` are `{ palette, motif, font }` presets, and Write applies
all three to a draft. the landing page only ever used the palette.

## the axes

| axis | attribute | values | sets |
|---|---|---|---|
| palette | `data-theme` | the fifteen, unchanged | color, from `shared/palette.css` (untouched) |
| type | `data-type` | `fontPairs` ids: `classic` `optical` `modern` `fell` `pixel` … | `--desk-display`, `--desk-ui`, `--desk-ui-track`, `--desk-ui-case`, `--desk-ui-scale` |
| shape | `data-shape` | `soft` `round` `crisp` `square` | `--desk-r-xs` … `--desk-r-xl`, `--desk-hair` |
| material | `data-material` | `glass` `paper` `flat` `glow` | `--desk-backdrop`, `--desk-pane`, `--desk-shadow`, `--desk-grain`, `--desk-tile-mix`, `--desk-tile-ink`, `--desk-alert` |
| motion | `data-motion` | `float` `snappy` `bouncy` `still` | `--desk-ease`, `--desk-dur-s/m/l`, `--desk-lift`, `--desk-ambient` |
| atmosphere | `data-ground`, `data-weather` | ground: `aura` `still` `confetti` `ruled` `sprinkles` `scanlines` `plain`; weather: `sparkles` `stars` `petals` `snow` `embers` `none` | the wash and pattern layers; the particle glyph, count, and path |

the prefix is `--desk-` because `lp-` already belongs to life points.

**type.** the desk only uses two type roles. *display* covers the greeting,
names, notes, and big numbers (Cormorant today). *ui* covers every label,
clock, and chip (DM Mono today). the values reuse the `fontPairs` ids from
`shared/library.js`, so a name means the same thing here as in Write and
Hygge: a pair's `display` face becomes our display face, and its `mono` face
becomes our ui face.

one rule keeps this safe: **expressive faces are for display only.**
`pixel`, `ancient`, `glaze`, and `gothic` look lovely at 1.65rem but can't be
read at the 0.5rem the desk uses for band labels. so the ui role only ever
uses DM Mono, Space Grotesk, or Plus Jakarta Sans. if a pair names anything
else, the ui role falls back to DM Mono. `--desk-ui-scale` lets a sans pair
nudge those tiny sizes up, because a sans at 0.54rem reads smaller than the
mono did.

fonts load one pair at a time: the pre-paint script adds a Google Fonts link
for the chosen pair. it does not use `shared/fonts.css`, which imports all
twelve families in a single request.

**shape.** the fifteen radii used today fold into five steps: 6–7px → xs,
8–9px → s, 10–13px → m, 14–18px → l, 20–22px → xl. `50%` and `999px` stay as
literals, because they mean "circle" and "pill", not a size. `crisp` uses
2–4px corners, `square` uses 0 for pixel looks, and `round` turns panes into
pills where the box allows it (the taskbar, chips, and search).

**material.** this axis is what the panes are made of.

- `glass` is how the desk looks today.
- `paper` is opaque, with no backdrop blur, more grain, and a hard offset
  shadow (`2px 3px 0`), like a card lying on a desk.
- `flat` is opaque, with a hairline border, no shadow, and no blur. this is
  the one `signal` needs, because translucent panes over a moving wash are
  exactly what a legibility-first theme should avoid.
- `glow` is dark glass with an accent-colored outer glow, for `midnight` and
  `amber`.

material also controls the tiles. `--desk-tile-mix` pulls each app's
manifest gradient toward the palette with
`color-mix(in oklab, var(--accent) var(--desk-tile-mix), var(--g1))`. at 0%
the tiles look like today's candy tiles, around 50% tints them into the room,
and 100% uses only palette colors. this is how `paper` stops having candy
tiles on it.

**motion.**

- `float` is how the desk moves today: the `.2,.9,.3,1` spring, 0.6s
  entrances, and the 34s wash drift.
- `snappy` shortens every duration and drops the overshoot and the hover
  tilt.
- `bouncy` overshoots harder, for `sugar`.
- `still` pauses ambient animation and keeps entrances to a simple fade.

**atmosphere.** this axis is the two existing prefs, renamed for what they
actually are.

*ground* is the wallpaper pref: `aura`, `still`, `confetti`, and `ruled` keep
their current meaning. it also absorbs the flourishes now hardcoded to theme
ids. sugar's dots become the `sprinkles` value, and blossom's heavier wash
becomes a `--desk-wash` strength, so the stylesheet never names a theme
again.

*weather* generalizes the sparkles. the seven spans already exist
(`index.html:4892`). a weather value gives them a glyph (`✧` `✦` `✿` `❄`
`·`), a count, and one of three keyframes: twinkle (today's), fall (petals,
snow), or rise (embers). the ✦ tray button keeps its meaning of weather on or
off.

## what the themes become

`cream` stays exactly as it is today, because the default must not change.
the rest of this table is a first pass, meant to be argued with:

| theme | type | shape | material | motion | ground | weather |
|---|---|---|---|---|---|---|
| cream | classic | soft | glass | float | aura | sparkles |
| dawn | optical | soft | glass | float | aura | sparkles |
| dusk | classic | soft | glass | float | aura | stars |
| midnight | modern | soft | glow | float | aura | stars |
| forest | optical | soft | paper | float | aura | none |
| terracotta | gothic | round | paper | float | aura | none |
| inkwell | fell | crisp | paper | float | ruled | stars |
| typewriter | fell | crisp | paper | snappy | ruled | none |
| paper | classic | crisp | flat | snappy | plain | none |
| blossom | glaze | round | glass | float | aura, strong | petals |
| sugar | modern | round | glass | bouncy | sprinkles | sparkles |
| fog | modern | soft | glass | float | still | none |
| glacier | modern | crisp | glass | float | aura | snow |
| signal | modern | crisp | flat | snappy | plain | none |
| amber | pixel | crisp | glow | snappy | scanlines | embers |

## how it works

**resolving.** a small classic script, `apps/landing/looks.js`, loads
blocking in `<head>`, where the pre-paint snippet sits now
(`index.html:24`). it holds the table above, reads `woodles-theme` and a new
`woodles-look` key, and sets the axis attributes before first paint. it is a
classic script rather than a module because the pre-paint step can't wait for
a module to load. it puts the table and `resolveLook(theme, overrides)` on
`window` so the page's module can use them. the CSS holds only one token block
per axis value, for example `[data-shape='crisp'] { --desk-r-s: 3px; … }`.

this also fixes a small flash. `data-wallpaper` is currently set by the module
in `renderPrefs()`, after first paint, so a non-default wallpaper draws as
`aura` for a moment first.

**storage.** `woodles-theme` keeps holding a palette id, and it has to:
`apps/animations/index.html` reads and writes the same key from its own
swatches. so the palette *is* the theme's identity, and it can't be
overridden. "typewriter's layout in glacier's colors" means choosing glacier
and setting type, shape, and material by hand.

`woodles-look` holds only the axes someone has set, for example
`{ "type": "modern" }`. any axis that isn't in it follows the theme. choosing
another theme keeps these overrides. personalize shows each overridden row
with a "use the theme's" link.

**migration.** `woodles-desk` saves the whole prefs object, including the
default `wallpaper: 'aura'`, so a stored `aura` can't be told apart from a
deliberate choice. the migration treats any other stored wallpaper as a
ground override and treats `aura` as following the theme. `sparkles: false`
becomes `weather: 'none'`. both prefs are removed from `woodles-desk` once
they've moved.

**previews.** the swatch trick extends to whole themes. a theme card in
personalize carries all of that theme's resolved attributes, so the card
renders in the theme's own type, corners, and material, not just its colors.
the small swatches in the flyout stay palette-only.

**derived, not configured.** two consumers read the resolved look instead of
getting their own settings:

- the screensaver's `SAVER_PALETTES` (`index.html:2947`) gets a `theme` entry,
  built from the live tokens (`getComputedStyle` on `--bg` and the five
  concrete colors). that entry becomes the default for a new screensaver.
- the phone layout (under 720px) draws from the same stylesheet, so it picks
  up every token automatically. weather should probably stay off there.

## accessibility

- expressive faces never go on ui text (see type, above).
- `prefers-reduced-motion` forces motion to `still` and weather to `none`
  before first paint. the particles are then never built, rather than built
  and frozen, which is the same stance as Thinking About's `logSitting`.
- `prefers-reduced-transparency` forces material to `flat`, in browsers that
  support it. `prefers-contrast: more` does the same. either way, any palette
  gets signal's form.
- `/` is audited today at `wcag2a` / `wcag21a` only
  (`e2e/accessibility.spec.ts`), and color contrast is a `wcag2aa` rule, so
  the landing page's contrast has never been checked. `landing.spec.ts` should
  gain a loop over every theme, with the desk and personalize open, running
  axe at `wcag2aa`, the way `homesuite.spec.ts` already does. one caveat: axe
  can't see through `backdrop-filter`, so under `glass` it measures text
  against `--surface` and the wash makes the result approximate. `paper` and
  `flat` are opaque, so their results are exact.

## order

each step ships on its own and leaves the desk working.

1. **tokenize, with no visible change.** move the fonts, radii, backdrops,
   shadows, easings, and the two stray colors onto `--desk-*` tokens with
   today's values. the proof is a screenshot of `/` under cream and dusk,
   identical before and after. this step is worth doing even if nothing else
   here is.
2. **add the axes and the resolver, still with no visible change.** this is
   `looks.js`, the per-value token blocks, every theme mapped to today's
   values, and the `woodles-desk` migration.
3. **give signal and typewriter their looks.** these are the two themes where
   the gap between the name and the look is widest, and signal's change is
   arguably a fix. the rest of the table follows.
4. **add a "this theme" section to personalize**, with one row per axis,
   overrides, and theme cards that preview the whole look.
5. **make the screensaver follow the theme, and tint the tiles.**
6. **later, not proposed in detail:**
   - a "use on desktop" button beside "use in write" in Hygge's palette mixer.
     `library.js` already has `decodeCustomPalette` and
     `customPaletteTokens`; the catch is that animations would render
     `woodles-theme = 'custom'` as cream.
   - letting people choose the light/dark pair for "follow the system",
     instead of the hardcoded cream/dusk.
   - a "follow the day" mode that changes theme at the greeting's own time
     bands (`greeting()`, `index.html:2526`), the way Carillon's chrome does.

## deliberately not

- **a theme editor for every token.** six axes with named values is the
  ceiling. a slider for radius belongs on a settings page, not a desktop.
- **sound.** a homepage that clacks when you open the typewriter theme is a
  surprise nobody asked for.
- **other apps.** the look registry stays in `apps/landing/` until a second
  app wants it, following ARCHITECTURE.md's rule to "duplicate until two apps
  have built the same thing". `shared/palette.css` is untouched throughout.

## what i need from you

- **should existing themes change?** the table above means anyone who chose
  typewriter comes back to a new typeface. the alternative is to keep the
  fifteen themes palette-only and add looks as new ids. that's safer, but it
  leaves thirty things called a theme. i'd change the existing themes and add
  a changelog entry.
- **how far should type reach?** display only (the greeting, names, and
  notes) is the gentle version. including ui (every label) is what makes
  signal and typewriter feel like themselves.
- **should ❄ cycle whole looks or only palettes?** whole looks is honest to
  the button's name, but it means one click changes the font.
- **is the table right?** in particular, which themes should get weather,
  since it's the loudest axis.
- **"follow the day"**: do you want it, or is that too much change for a
  homepage?
