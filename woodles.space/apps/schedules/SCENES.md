# scenes

the illustrated banners on the learner's visual schedule: how they're drawn,
why they look the way they do, and how to add one that belongs with the rest.
read this before touching `generator/scenes.js` or `generator/scenes.css`.

ten exist: trains, dinosaurs, unicorns, space, construction, ocean, pirates,
heroes, robots, princesses. the other themes fall back to emoji stickers (and
Bright sky to its ticket scene, Quiet and calm to nothing — both on purpose).

## where they live

| file | job |
|---|---|
| `generator/scenes.js` | `window.ScheduleScenes` — one SVG string per theme id, built from small helpers |
| `generator/scenes.css` | every `sc-*` animation, gated on motion; loaded by the view and the planner |
| `generator/themes.js` | a theme gets art when `ScheduleScenes[theme.id]` exists; `resolve()` sets `look.scene = 'art'`, `sceneMarkup(look)` returns it |
| `view/app.js` · `applyLook` | writes the scene into `#heroArt`, hides the ticket SVG and the sticker row |
| `view/styles.css` | `.hero-art` sizing: a 300px column on desktop, a 108×58 corner badge under 620px |
| `generator/style-studio.js` | the studio preview reuses `sceneMarkup` inside `.lp-scene.is-art` |

the planner's banner setting (`style.scene`) chooses between *Theme banner*
(the art), *Theme stickers*, *My stickers* and *Nothing*. art only shows for
`'theme'`.

## the look, in one paragraph

flat, friendly, sticker-like. every shape is a solid fill with a 3-unit
outline in a dark shade of the scene's own hue, rounded joins, no gradients,
no shadows, no texture. subjects are chunky and simple enough to read as a
silhouette at thumbnail size. faces, where there are any, are two dots or a
happy arc, a small smile, and pink cheeks. one focal subject on the right,
something smaller on the left, sky decoration behind, and a ground or water
strip that fades out at both ends rather than stopping square. it sits on
the theme's banner gradient, so the subject has to pop against that colour,
not against white.

## canvas

- `viewBox="0 0 320 170"`, the same box as the original ticket scene.
- rendered at about **300×160 css px** on desktop (≈0.94 px per unit) and
  **108×58** on phones (≈0.34 px per unit). design for the phone: anything
  under ~6 units disappears there, and the silhouette has to carry it.
- `overflow: visible` is on, but keep drawing inside the box except for wave
  paths, which run from x −40 and are clipped by their fade mask.

### composition zones

```
 0                    140              220                320
 ┌──────────────────────┬────────────────┬──────────────────┐ 0
 │ sky decor: moon,     │                │  ▒▒ keep clear ▒▒ │
 │ sparkles, stars      │                │  (Edit plan pill) │ 40
 │                      │   focal subject: x 150–310         │
 │ secondary subject:   │   the thing the learner loves      │
 │ x 0–140              │                                    │
 │                      │                                    │ 150 ← ground line
 └──────────────────────┴────────────────────────────────────┘ 170 ← fading strip
```

- **ground line at y ≈ 148–152.** wheels, feet, hulls and towers stand on it.
  check contact: a wheel at `cy` with radius `r` needs `cy + r = 148`.
- **top-right corner (x > 220, y < 40) sits under the "Edit plan" button.**
  tall things there (the castle's middle tower, a flag) get crowded; drop them
  10 units or move them left.
- the focal subject faces **into** the banner or travels **right**, toward the
  edge, so it reads as moving through the day.
- leave the left third lighter. on desktop the greeting text is far away, but
  the eye still lands on the busiest area first; that should be the subject.

## line

| element | stroke |
|---|---|
| outlines of main shapes | `3`, `stroke-linejoin="round"` (the `ink(color)` helper) |
| small parts (fish, flags, clouds, lashes) | `2.5` |
| interior detail (planks, rivets, crossbones, mouths) | `2`–`3.5`, `stroke-linecap="round"` |
| decorative lines with no fill (smoke trail, speed lines) | `3`–`4`, round caps, sometimes `stroke-dasharray="2 9"` |

outline colour is the **darkest shade of the scene's key hue**, never pure
black — except superheroes, where near-black `#1c1c1c` is the comic-book
convention. current inks:

| scene | ink | | scene | ink |
|---|---|---|---|---|
| trains | `#14284a` navy | | ocean | `#0b3d52` deep teal |
| dinosaurs | `#3d2a20` brown | | pirates | `#3a2410` tar brown |
| unicorns | `#6b3fa0` violet | | heroes | `#1c1c1c` comic black |
| space | `#2a3170` indigo | | robots | `#1e293b` slate |
| construction | `#1c1f24` charcoal | | princesses | `#6b2150` plum |

**tubes** (necks, arms, booms) are two stacked strokes of the same path: the
ink colour wide, then the fill colour 5–6 units narrower. that gives an
outlined limb without building a closed shape:

```js
'<path d="M256 102C272 88 270 58 282 44" fill="none" stroke="#3d2a20" stroke-width="22" stroke-linecap="round"/>' +
'<path d="M256 102C272 88 270 58 282 44" fill="none" stroke="#f2a541" stroke-width="16" stroke-linecap="round"/>'
```

## colour

- **flat fills only.** the one exception is the rainbow, which is six flat
  arcs, not a gradient.
- **the subject contrasts with the banner, not the page.** the banner is the
  theme's `heroA → heroB` gradient, so pick the subject's main colour from the
  opposite side of the wheel or far lighter:

  | banner | subject |
  |---|---|
  | red (trains) | navy boiler, yellow cab, green carriage |
  | green (dinosaurs) | orange-yellow brontosaurus `#f2a541` |
  | purple (unicorns) | white unicorn, rainbow mane |
  | navy (space, pirates) | white rocket, orange planet; cream sails |
  | yellow (construction) | orange `#ff9f1a` with charcoal ink — the ink does the separating |
  | teal (ocean, robots) | mid-blue whale; orange-bodied robot |
  | red→blue (heroes) | yellow burst behind a blue-and-red hero |
  | pink→purple (princesses) | pale pink castle, gold crown |

- give each subject **one lighter tone** for form: a belly, a sail, a wall.
  keep it to one; two starts to read as shading.
- **light sources** are warm yellow: `#ffe08a`, `#ffd43b`, `#ffe066` — windows,
  portholes, headlamps, lit city windows.
- **sparkles and stars:** `#fff` and pale yellow `#fff6b0`.
- **cheeks:** a circle in pink (`#ff9fb6`, `#ffb3cf`, `#fda4af`) at
  `opacity=".8"`.
- skin, when needed, is a mid-neutral `#f4c49c`, and kept small (the hero's
  mask covers most of the face).
- don't reach for the theme's CSS custom properties inside the art. scenes
  are fixed illustrations tuned to their banner; a planner who overrides the
  banner colour can switch the banner to stickers.

## character

- **friendly, never scary.** no teeth, no claws, no weapons pointed at
  anything, no angry brows. the dinosaur is a long-necked plant-eater, and
  the pirate scene is a ship and treasure, not a pirate with a sword.
- **eyes:** a dot (`r` 2.2–3.2) or a closed happy arc (`q7 7 14 0`). one white
  highlight dot on bigger eyes (the robot).
- **mouth:** a short upward curve, `stroke-width` 2–3, round caps.
- **generic, not branded.** the hero has no logo or recognisable costume; the
  star on the chest is the burst helper. avoid any likeness to a licensed
  character, toy or vehicle.
- **don't gender the learner.** the princess scene is a castle and a crown,
  not a princess, and the theme's greeting is "Hi {name}!". draw the
  interest, not a person the learner is meant to be.
- objects get a little life where it's cheap: a dome on the boiler, a blush on
  the whale, a chest light on the robot.

## building shapes

draw everything from primitives — `rect` with `rx`, `circle`, `ellipse`, and
paths made of `q`/`C` curves and arcs. hand-edit coordinates; there is no
drawing tool in the loop and none is needed.

### helpers in `scenes.js`

| helper | makes |
|---|---|
| `svg(name, body)` | the root `<svg class="scene-art scene-<name>">` with viewBox, `aria-hidden`, `focusable="false"` |
| `range(n)` | `[0..n)` for repeating sleepers, gear teeth, rivets |
| `ink(color)` | the standard outline attributes: `stroke`, width 3, round join |
| `faded(name, body)` | wraps a strip in a mask that fades it out over the first and last 14% |
| `sparkle(x, y, size, fill, delay)` | a four-point twinkling star |
| `burst(cx, cy, outer, inner, points)` | a star or comic burst path (also the hero's chest star) |
| `gear(cx, cy, r, teeth, fill, spinClass)` | a toothed gear with a hub |
| `wave(y, fill, extra)` | a scalloped water band from x −40 to 360 |
| `flag(x, y, fill, ink)` | a pole and a swallow-tail pennant that waves |
| `tower(x, y, w, wall, roof, flagFill)` | a castle tower: wall, cone roof, flag, arched window |
| `trainWheel`, `fish`, `cloud` | scene-local repeats |

add a helper as soon as a shape repeats; a scene should stay around
2.5–4 KB of markup.

### recurring constructions

- **arched window / doorway:** `v-24 a13 13 0 0 1 26 0 v24 z`.
- **cone roof:** a triangle 5 units wider than its wall on each side.
- **dome:** `a10 10 0 0 1 20 0 z` sitting on a body's top edge.
- **crenellations:** `range(n).map(i => 'M' + (x + i*14) + ' y v-8 h8 v8')`.
- **smoke / steam / clouds:** stacks of circles growing as they rise, or the
  `cloud` arc path.
- **palm / fern:** a curved double-stroked trunk, then four leaf paths
  radiating from one point (`q-24-6-34 8 q16-10 34-8 z`).
- **ground strip:** a rect or gently rolling path (`Q … T …`) wrapped in
  `faded()`.

### layering, back to front

1. sky decoration — moon, stars, sparkles, lightning, gears
2. back strip — the far wave, the hills
3. secondary subject — island, volcano, planet, crown, cones
4. the focal subject, back parts first (tail, far legs, mast, cape, the arm
   that's behind the body) then body, then the head and near limbs
5. front strip — the near wave, the rails

## motion

motion is a garnish. the scene has to work fully still, because it often is
(the plan's motion setting is off, the device asks for reduced motion, or
it's printing).

| class | does | duration | origin |
|---|---|---|---|
| `sc-bob` | floats up 2.5px | 2.4s | centre |
| `sc-rock` | tilts ±2° and lifts | 3.2s | bottom centre |
| `sc-nod` | head tilts 4° | 4s | 30% 100% (the neck) |
| `sc-sway` | tail swings 6° | 3s | right middle (the body end) |
| `sc-dig` | arm dips 7°, pauses | 3.6s | bottom right (the pivot) |
| `sc-wave-arm` | waves −12°…14° | 1.4s | bottom centre (the shoulder) |
| `sc-spin` / `sc-spin-rev` | full turn | 1.6s / 2.2s | centre |
| `sc-roll` | 0.8px jiggle, stepped | .5s | — |
| `sc-puff` | grows, drifts back, fades | 3s | centre |
| `sc-rise` | bubble rises and fades | 4s | — |
| `sc-twinkle` | dims and shrinks | 2.8s | centre |
| `sc-blink` | dims, stepped | 1.2s | — |
| `sc-flicker` | flame squash | .35s alternate | centre |
| `sc-pulse` | burst breathes 5% and turns 4° | 1.6s | centre |
| `sc-flag` | pennant ripples | 1.2s | left middle (the pole) |
| `sc-billow` | sail fills 5% | 3.2s | left middle |
| `sc-cape` | cape flutters | .6s alternate | right 30% (the shoulders) |
| `sc-zoom` | speed lines streak left | .9s | — |
| `sc-spout` | water spout squashes | 2.4s | bottom centre |
| `sc-swim` | fish drifts 14px and back | 5s | — |
| `sc-wave` (front/back) | water slides 20px | 6s / 8s alternate | — |

rules:

- **small and slow.** rotations ≤ 4° for living things, bobs ≤ 3px, cycles
  2–5s. only machines (wheels, gears, flames, blinking lights) go faster or
  spin fully.
- **stagger repeats** with an inline `style="animation-delay:…s"` so three
  puffs or five stars don't pulse in unison.
- **one class per element.** `[class^="sc-"]` sets `transform-box: fill-box`
  and only matches when the class attribute *starts* with `sc-`. nest a `<g>`
  if something needs two motions.
- **set the origin on the joint**, in fill-box percentages, in the block at
  the top of `scenes.css`. a head nods from its neck, not its centre.
- **use the individual properties `rotate`, `scale`, `translate`** in
  keyframes. they compose with each other and with an SVG `transform="…"`
  attribute. `skew` is not one of them; `sc-flag` uses
  `transform: scaleX() skewY()`, which *replaces* any `transform` attribute,
  so it may only go on elements without one.
- **never put an `sc-*` class on an element with a `transform` attribute**
  whose keyframes use `transform`. wrap it instead — the rocket is
  `<g class="sc-bob"><g transform="rotate(35 220 84)">…`.
- **gate everything on `[data-motion="on"]`.** both the learner page root and
  the studio's `.look-preview` carry that attribute, so one selector serves
  both. `prefers-reduced-motion` and print switch every scene animation off.
- a spinning group's bounding box must be centred on its pivot. the wheel
  spokes are a symmetric cross for exactly this reason.

## technical constraints

- **constant markup only.** scenes go in with `innerHTML`; nothing from a plan
  (names, stickers, colours) is ever interpolated into them. keep it that
  way, or escape it.
- **ids** exist only in `faded()` masks, as `sc-fade-<name>` and
  `sc-fade-<name>-g`. every call needs a name unique across *all* scenes. a
  page shows one scene at a time today; if that changes (a gallery of
  banners, say), the ids must become per-instance.
- `aria-hidden="true"` and `focusable="false"` come from `svg()`. the scene is
  decoration; the greeting carries the meaning.
- toggle visibility on SVG elements with `toggleAttribute('hidden', …)`, not
  `.hidden =` — SVG elements don't reflect it (the ticket scene bug).
- `node --check generator/scenes.js` catches the commonest mistake, a broken
  string concatenation.

## process

how the existing ten were made, and how to make the next one.

1. **brief.** one sentence: subject, secondary, sky, ground, what moves.
   *"a whale spouting among fish, waves in front and behind; spout pulses,
   waves roll."* choose the subject's colour against the theme's banner
   (`themes.js`, `heroA`/`heroB`) before drawing anything.
2. **block it in coordinates.** write the bounding boxes down first — subject
   x 150–310, ground at 150, secondary x 0–140 — and check contact points
   (`cy + r = 148`). most fixes later were layout fixes.
3. **build back to front** with primitives and helpers, ink colour picked,
   strokes from the table above.
4. **render it, both sizes, motion off.** the script below. look at the
   pictures — the markup tells you nothing about whether it reads.
5. **critique** against the checklist below, fix, re-render. expect two
   rounds. past fixes: the treasure island sat under the front wave (raised
   its peak about 13 units); the castle's middle flag touched the Edit plan pill
   (lowered 10); every ground strip ended in a hard rectangle (added
   `faded`); the studio preview drew the art at 96px (gave it a 136px
   column).
6. **turn motion on** and watch it in a real browser for a few cycles. check
   pivots, then check that nothing is distracting next to the schedule.
7. **wire and test** (below).

### screenshot script

drop this in `e2e/tmp-shots/shots.spec.ts` (delete it afterwards), set
`SHOTS` to an output folder, and run
`pnpm exec playwright test tmp-shots`. in the cloud container the bundled
Playwright may not match the installed Chromium; point a scratch config's
`launchOptions.executablePath` at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.

```ts
import { test } from '@playwright/test';
test('scene shots', async ({ page }) => {
  for (const theme of ['pirates', 'heroes']) {
    await page.goto('/schedules/generator');
    await page.evaluate((id) => {
      const S = (window as any).ScheduleStudio;
      const plan = S.sanitizePlan({ id: 'p', learner: 'Sam', name: 'Plan', style: { theme: id, motion: 'off' },
        days: [{ key: 'monday', start: '09:00', end: '10:00', activities: [{ kind: 'activity', occurrenceId: 'a', title: 'Read', start: '09:00', duration: 30, icon: '📖' }] }] });
      localStorage.setItem(S.STORAGE_KEY, JSON.stringify({ plans: [plan], activities: [], images: [] }));
    }, theme);
    for (const width of [1100, 390]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/schedules/view?plan=p&day=monday');
      await page.locator('.hero').screenshot({ path: process.env.SHOTS + `/${theme}-${width}.png` });
    }
  }
});
```

web fonts load from Google; if the network blocks them the greeting falls
back to a system font, which is fine for judging the art.

### critique checklist

- [ ] at 390px wide, can you name the subject in one glance?
- [ ] does the subject stand out from the banner gradient at both ends?
- [ ] is every outline the scene's ink colour, width 3, round joins?
- [ ] does everything that should stand on the ground touch y ≈ 150?
- [ ] is the top-right corner clear of the Edit plan pill?
- [ ] do strips fade at both ends instead of stopping square?
- [ ] is anything below ~6 units doing important work? (it vanishes on phones)
- [ ] is it friendly — no teeth, weapons, frowns, logos, or a gendered figure?
- [ ] still, does it look finished? moving, does each part pivot on its joint?
- [ ] does it sit well next to the others? render two neighbours side by side.

## adding a scene

1. the theme must exist in `THEMES` in `generator/themes.js`. the scene's key
   in `ScheduleScenes` is the theme id; that's the whole link.
2. add the scene to `generator/scenes.js` and to its `return { … }`.
3. new motion goes in `generator/scenes.css`: origin in the top block, the
   gated `animation` line, the `@keyframes`.
4. add the id to the `illustrated` list in `e2e/schedule-style.spec.ts` (and
   bump the theme-card count if you added a theme).
5. run `node --check apps/schedules/generator/scenes.js`, then
   `pnpm exec playwright test schedule-`.
6. add a CHANGELOG line — a new banner is something a reader would notice.

the API needs no change for a new scene; it only validates the
`style.scene` enum, not the art.

## not yet drawn

ideas for the themes still on stickers, in the same voice:

- **dragons and castles** — a round, sleepy green dragon curled on a hill
  beside a small castle, puffing a smoke ring rather than fire.
- **puppies and kittens** — a dog and a cat in a basket with a ball of yarn;
  tails wag (`sc-sway`).
- **horses** — a horse's head over a fence rail, a hay bale and a sun.
- **bugs and butterflies** — a ladybird on a big leaf, a butterfly that bobs,
  daisies.
- **jungle safari** — a giraffe's neck rising from palms, a monkey hanging
  from a vine (`sc-sway`).
- **cars and trucks** — a fire engine on a road with a dashed centre line;
  wheels spin, a light blinks.
- **pixel games** — a joystick and a coin block; draw it on a 10-unit grid
  with `shape-rendering="crispEdges"` and square joins, the one scene allowed
  to break the rounded-line rule.
- **building bricks** — a stack of studded bricks with one being placed.
- **sweets and baking** — a cupcake with a cherry and sprinkles, a cookie,
  rising steam.
- **weather** — a sun half behind a cloud with a rainbow and a few raindrops.

Bright sky keeps its tickets and Quiet and calm stays empty on purpose.
