# scenes

the illustrated banners on the learner's visual schedule: how they're drawn,
why they look the way they do, and how to add one that belongs with the rest.
read this before touching `generator/scenes.js` or `generator/scenes.css`.

every theme but two has one: trains, dinosaurs, unicorns, space,
construction, ocean, pirates, heroes, robots, princesses, pets, horses, bugs,
jungle, dragons, cars, games, bricks, sweets, weather, the four seasons —
spring, summer, autumn, winter — and the four quiet hobbies — houseplants,
books, stargazing, birds. Bright sky keeps its ticket scene and Quiet and
calm shows nothing — both on purpose.

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
| pets | `#4a2614` warm brown | | dragons | `#2b1747` night purple |
| horses | `#3b2414` saddle brown | | cars | `#1b1e25` tyre black |
| bugs | `#1d3a12` leaf green | | games | `#1e0b3a` arcade purple (as pixels) |
| jungle | `#2d2410` earth brown | | bricks | `#1b1b2f` ink navy |
| sweets | `#3b1622` berry brown | | weather | `#1c2a63` storm blue |
| spring | `#1e3a28` moss green | | autumn | `#3f1a0c` chestnut |
| summer | `#123b5c` deep sea | | winter | `#17324a` frost navy |
| houseplants | `#1f3322` deep leaf | | stargazing | `#121a33` night navy |
| books | `#2d1a2a` aubergine | | birds | `#163033` deep teal |

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
  | orange→rose (pets) | cream puppy, grey kitten, blue bed |
  | brown (horses) | cream horse with a dark mane, white fence |
  | green (bugs) | red ladybird on a pale leaf |
  | dark green (jungle) | yellow giraffe, brown monkey with a tan face |
  | purple→green (dragons) | lime dragon, lilac stone keep |
  | slate (cars) | red fire engine |
  | violet→magenta (games) | green pixel slime, gold block |
  | red→orange (bricks) | blue, yellow, green and white bricks — never red |
  | magenta→orange (sweets) | white frosting on a sky-blue wrapper |
  | blue→violet (weather) | yellow sun, white cloud, four-band rainbow |
  | blue→green (spring) | white lamb, pink blossom, red, yellow and orange tulips |
  | azure (summer) | sand-gold castle, coral-and-white umbrella, yellow sun |
  | rust→wine (autumn) | ginger squirrel with a cream belly, gold and orange leaves |
  | steel→dusk blue (winter) | white snowman, orange hat, golden scarf, teal pines |
  | terracotta (houseplants) | sage-green monstera in a cream pot, eucalyptus hanger, mustard cactus pot |
  | dusky plum (books) | duck-egg teapot, mustard, rust and sage spines, ginger cat |
  | night navy (stargazing) | brass telescope, rust fox, cream stars |
  | muted teal (birds) | orange-breasted robin, cream birdhouse, leather-brown binoculars |

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
  character, toy or vehicle: the pixel block carries a sparkle rather than a
  question mark, the player is a slime of our own, and the bricks have no
  minifigure and no lettering on the studs.
- **don't gender the learner.** the princess scene is a castle and a crown,
  not a princess, and the theme's greeting is "Hi {name}!". draw the
  interest, not a person the learner is meant to be.
- **seasons, not holidays.** the season scenes draw what the time of year
  looks like outdoors — blossom and lambs, a beach, falling leaves and
  acorns, snow — and never a holiday: no eggs or bunnies, carved pumpkins or
  turkeys, decorated trees, presents, stockings, hearts or fireworks. keep
  holiday colour pairs away too: the snowman wears orange and gold, not red
  and green, and the pines carry snow, not baubles. the themes' stickers
  follow the same rule.
- **quiet hobbies are for grown-ups.** houseplants, books, stargazing and
  birds are built for older learners and adults, so they turn the volume
  down without losing the whimsy: dusty, lower-saturation fills (sage, not
  lime; rust, not red), faces only on the animals — dot eyes or sleeping
  arcs, never cheeks or a grin — and no faces on objects, not even the moon.
  their charm is in the situation instead: a cat asleep on the books, a fox
  seen from behind watching the Plough, a blue tit peeking out of a
  birdhouse, a cutting rooting in a jar. only a handful of parts move, all
  slowly, and stars twinkle a few at a time, never the whole sky. outlines,
  ink and composition follow every other rule here, so the set still sits
  beside the rest.
- objects get a little life where it's cheap: a dome on the boiler, a blush on
  the whale, a chest light on the robot, a face on the cupcake and the sun.
  vehicles and buildings stay faceless.

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
| `cloud(x, y, stroke, scale, fill)` | the flat-bottomed cloud, any ink, any size |
| `tube(d, outline, fill, width)` | an outlined limb or tail: the ink stroke, then the fill 6 narrower |
| `blush(points, r, fill)` | pink cheeks at `opacity=".8"` |
| `heart(x, y, size, fill, stroke, extra)` | a rounded heart; `extra` carries a class or style |
| `sunRays(cx, cy, inner, outer, count, color)` | glowing rays around a sun |
| `pixels(x, y, size, rows, palette)` | pixel art from rows of palette keys, merged into runs |
| `leaf(x, y, angle, fill, extra)` | an outlined leaf with a midrib; `extra` puts a motion class on a wrapper so the turn stays on its own group |
| `pine(x, top, width)` | a three-tier pine standing on y 150, each tier wearing a scalloped cap of snow |
| `snowball(cx, cy, r)` | a white ball with a pale blue crescent (`shade`) on its shadow side |
| `turned(x, y, angle, size, path)` | places a path drawn in local units (joint at `0 0`, tip toward −y) by rewriting its coordinates, so outlines keep their width and the result can still carry an `sc-*` class |
| `monstera(leaves)` · `pothos(leaves, size)` | split and heart-shaped leaves from `turned`, sharing one fill and outline; pothos hearts are drawn long so they never read as the ♥ symbol |
| `book(x, y, w, h, fill)` | a book lying flat, spine out, with a label and two bands |
| `trainWheel`, `carWheel`, `fish`, `paw`, `daisy`, `brick`, `sprinkle`, `raindrop`, `tulip`, `petal`, `sandTower`, `flake`, `steam`, `flyer` | scene-local repeats |

add a helper as soon as a shape repeats. most scenes are 3–5 KB of markup;
the busiest (pets, jungle, bugs) are about 6, and the seasons, with their
falling petals, leaves and snow, run 6–8, as does houseplants with its
leaves. past that, look for a helper.

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
- **union outline:** to outline several overlapping primitives as one shape
  (the bone, the horse's head, the jungle bush), draw them once filled and
  stroked in ink at `stroke-width="6"`, then again in the fill colour with no
  stroke. the inner seams disappear and the outside keeps a 3-unit line.
- **hiding a root:** a neck or stem that rises from off-canvas ends behind
  something — a fence, a bush, the front of a bed — never at the box edge,
  where its round cap pokes out below the banner.

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
| `sc-wag` | tail wags −5°…6° | 1.6s | bottom left (the tail's root) |
| `sc-nuzzle` | head dips 4° (`sc-nod` keyframes) | 4.4s | right 30% (where a left-facing head meets its neck) |
| `sc-tilt` | flower or frond sways ±2.5° | 3.4s | bottom centre (the stem) |
| `sc-swing` | hangs and swings ±4° | 3.6s | top centre (the vine's anchor) |
| `sc-breathe` | sleeping body swells 3% | 4s | bottom centre |
| `sc-flap` | wings close to 55% | .9s | centre (the body) |
| `sc-glow` | sun rays grow 8% and dim | 4s | centre |
| `sc-drift` | cloud slides 10px | 7s alternate | — |
| `sc-hop` | pixel player jumps 8px, stepped | 1.6s | — |
| `sc-flip` | pixel coin turns edge-on, stepped | 1.2s | centre |
| `sc-place` | brick lowers 7px toward its slot | 2.6s | — |
| `sc-fall` | raindrop falls and fades | 1.4s | — |
| `sc-flutter` | petal or leaf drifts down, turning 45°, and fades | 6s | centre |
| `sc-snow` | snowflake or snow dot drifts down and fades | 5s | — |
| `sc-steam` | steam curl rises 16px and fades | 5s | — |

rules:

- **small and slow.** rotations ≤ 4° for living things, bobs ≤ 3px, cycles
  2–5s. only machines (wheels, gears, flames, blinking lights) go faster or
  spin fully, and only falling petals and leaves turn further, slowly, as
  they drift.
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

## the pixel scene

Pixel games is the one scene that breaks the rounded-line rule. it's drawn
with `pixels()` from string maps — one character per pixel, `.` for empty,
each other character a key into a palette — so the art is legible in the
source:

```js
const pixelHeart = ['.kk.kk.', 'kwrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
pixels(10, 10, 4, pixelHeart, arcade)
```

- pixels are **5 units** for the player, block and coin, 4 for the hearts and
  sparkles. outlines are ink-coloured pixels, not strokes.
- the whole scene sits in `<g shape-rendering="crispEdges">`.
- its motion is stepped (`steps(3)` on the hop, `steps(2)` on the coin flip)
  so it moves like a sprite, not a tween.

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
   column); the horse's head read as a beak until it was rebuilt as a jowl,
   a face and a muzzle under one union outline; the giraffe's neck poked out
   below the canvas (now ends behind a bush); the pixel coin sat in line with
   the hearts and read as part of the score bar (moved down with its block).
6. **turn motion on** and watch it in a real browser for a few cycles. check
   pivots, then check that nothing is distracting next to the schedule.
   without a screen to watch, freeze it instead: render the scene a few times
   inside `data-motion="on"`, pause every animation and step it, then look
   for parts that come loose at the extremes.

   ```js
   for (const anim of document.getAnimations()) { anim.pause(); anim.currentTime = ms; }
   ```
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
4. `e2e/schedule-style.spec.ts` expects art on every theme except `classic`
   and `calm`. a new theme shipping on stickers first goes in that exception
   list until its scene lands; bump the theme-card count when you add a theme.
5. run `node --check apps/schedules/generator/scenes.js`, then
   `pnpm exec playwright test schedule-`.
6. add a CHANGELOG line — a new banner is something a reader would notice.

the API needs no change for a new scene; it only validates the
`style.scene` enum, not the art.

## new themes

a theme added to `THEMES` falls back to its stickers until it gets a scene.
pick the subject the learner loves, write the one-sentence brief, and follow
the process above. Bright sky keeps its tickets and Quiet and calm stays
empty on purpose.
