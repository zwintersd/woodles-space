# changelog

what shipped, session to session — newest first. this is the read-facing
counterpart to `git log`: short, dated, and about *why it matters* rather
than every commit. hosted at
[woodles.space/changelog](https://woodles.space/changelog).

read [ARCHITECTURE.md](./ARCHITECTURE.md) for how the workspace fits
together, and `HANDOFF.md` / `REFACTORING.md` / `CONVERGENCE.md` for the
deeper narrative behind a change — this file is the index, not the story.

**the convention:** before ending a session that shipped something a reader
of the site would notice — a new route, a new feature, a real fix — add a
dated entry here. one heading per day is enough; add bullets under today's
if one already exists. skip pure internal refactors nobody outside the repo
would see, unless that refactor *was* the session. `CLAUDE.md` repeats this
so it's not easy to forget.

---

## 2026-10-31

- **the homesuite main page got a much prettier pass** — a soft gradient hero
  with a pill search, shorter category cards with big counts that lift on
  hover, pill-style view/filter tabs, and file and folder rows as rounded
  cards. the category cards now follow the theme, so dark mode finally gets
  them too.
- **homesuite home picked up decorative flourishes** — orbit rings and
  sparkles in the corners, a soft circle and ring with a star at the bottom
  left, a peach arc at the bottom right, and gentle wave shapes in the
  category cards. all theme-aware and hidden on small screens where they'd
  crowd the content.
- **homesuite home is much more compact** — the hero is one line (title and
  search, no tagline) and the category cards are a slim strip, so files start
  higher on the page.
- **less copy in homesuite's empty states** — the folder panel no longer
  explains itself when empty, and empty lists show just a heading.
- **homesuite's top-level file list no longer repeats the folders** — the
  "All files" breadcrumb and folder cards are hidden at the root, since the
  folder panel already lists them; they still show inside a folder.
- **homesuite got another polish pass** — a soft color wash behind the page, a
  frosted sticky top bar, and file rows with gradient kind icons, a colored
  edge on hover, an arrow and checkbox that appear on hover, and a glossier
  New button.
- **more ornament on the homesuite home** — an orbit arc in the hero, a tiny
  sparkle in each category card, a mid-page orbit on the right edge, a
  sparkle cluster for empty lists, and a soft glow in the folder panel.
  sparkles twinkle gently unless motion is reduced.
- **homesuite's Trash view matches the home** — a rose-tinted header card, the
  same orbit and sparkle ornaments, tabs and rows styled like the main list,
  and a one-line empty state. the folder cards above the file list are gone
  everywhere; folders open from the sidebar.
- **sort and see more about your files in homesuite** — a Sort menu above the
  file list orders by last edited, date created, last opened, name, word
  count, or type, with a button to reverse it, and remembers your choice. each
  row leads with the date you're sorting by, shows a document's word count, and
  hovering the date lists edited, created and opened together. documents
  know when they were made from their own id; boards and collections count from
  the first time homesuite saw them, and "opened" is tracked per device (it
  doesn't sync).
- **the homesuite home hero is wordless** — the "Your space, within reach."
  headline is replaced by a dotted constellation of sparkles beside the
  search box (a hidden "HomeSuite" heading stays for screen readers).

## 2026-10-25

- **margin notes stay beside the paragraph they were written against** — in
  Write, adding a paragraph above an annotated one could hand its note to the
  newcomer (at once if you pressed Enter at the start of the paragraph,
  otherwise on the next reload), and deleting one above it could lose the
  note: every load renumbered paragraphs top to bottom, while notes kept the
  numbers they were written with. a draft now keeps its own paragraph ids, a
  published letter goes out with the same ones its notes point at, and a new
  paragraph never picks up the note of one you deleted. pasted text still
  comes in without ids of its own. a note that had already moved in an
  existing draft may stay where it landed.
- **the moth is the mark** — Carillon's lunar moth, pared down to its
  peacock and amethyst wings and the crescent behind them, replaces the
  lapis w in browser tabs and saved home-screen shortcuts across every room.

## 2026-10-20

- **Write has a format menu** — right-click in the writing, on its own or in
  HomeSuite, for bold, italic, underline, strikethrough and a new highlight,
  then text, heading, subheading, quote, bullets and numbers, with whichever
  ones the words already have lit. links are edited in place — a bare
  `example.com` gets its `https://` — and cut, copy, paste, paste as plain
  text and a margin note sit underneath. right-clicking inside a word takes
  the whole word. every change is one ⌘Z. ⇧ right-click still opens the
  browser's own menu for spelling, and the Menu key or ⇧F10 opens Write's at
  the caret.
- **lists stop leaving empty paragraphs behind** — the toolbar's list
  buttons nested the list inside its paragraph, so it came back after a
  reload with an empty line above and below; lists now sit beside their
  paragraphs, and turning a line out of a list splits the list around it.
- **bold looks bold in Write** — it was drawn at 400 over the prose's 300,
  barely heavier, and the toolbar's **B** never lit up for it. it's 600 now,
  matching `<strong>`, in Write and in published letters.

- **Carillon syncs the way HomeSuite does** — something removed on one device
  now stays removed on the others: a signal, a sitting, an obligation, a daily
  activity or a domain used to come back from whichever device still had it.
  each record merges on its own against what this device and the server last
  agreed on, so a change made on one side wins even when the other device's
  clock runs ahead, and the very first sync still only adds. Carillon also
  syncs when you come back to it, every couple of minutes while it's open, and
  as you leave — it used to pull only on opening — and *sync now* pulls as
  well as pushes. two Carillon tabs on one device keep each other's changes
  instead of saving over them, and a sync with nothing new sends nothing.
- **sync stops stalling on a stray character** — Postgres refuses a NUL or
  half an emoji inside JSONB, and the sync endpoint answered every retry with
  the same 500, so one bad character in any document could block HomeSuite's
  sync for good. `/api/sync` and `/api/public` now drop NULs and turn a lone
  surrogate into `�` before saving. a sync that still fails now says why in
  its status, carrying the server's message instead of just `push failed (500)`.
- **Mycelium moves into Carillon's room** — the sidebar is gone; people now
  live under Carillon's mulberry cabinet, with a leaded transom, a rose
  window holding Mycelium's crescent, and a glazed wordmark in rose and
  sage. all people, favorites and new person are lancet tabs of glass. the
  shelf sits on parchment in stained-glass light, with IM Fell headings and
  gilt rules; contacts and the workshop are vellum sheets with filigree
  corners, the card waits in an arched stage, and the backup and comfort
  tools hang in a ribbon down the right edge. circles became a filter strip
  on the shelf. the cards themselves are unchanged.

## 2026-10-19

- **Mycelium keeps people on cards** — a contact book with Bestiary's visual
  styling on 3:4 cards. Each person has one stable Woodles reference: link to
  them from Write or bring current contact details into a Data Collection,
  keeping your own notes alongside. Removing a link or Collection membership
  leaves the person's card in Mycelium.
- **Carillon is parchment and stained glass now** — the instrument sits on
  warm, grained parchment scattered with gilt stars and crescent moons, and
  the hour's light falls across it through stained glass: rose and amber at
  dawn, gilt and emerald in the morning, ruby and sapphire at noon, marigold
  and teal in the afternoon, rose and amethyst at evening, violet and lapis at
  dusk, drifting between them rather than jumping. a leaded transom of jewel
  panes runs across the top; the bell sits in a little rose window; each
  section is its own pane of glass (Today ruby, Day piles amber, Routines
  emerald, Surge sapphire, Editions amethyst) and the open one is set in it
  like a lancet. cards are vellum with a gilt rule inside the edge, the
  sampler gets a jewelled top and a crescent moon, headings that are only
  words are set in IM Fell, and the wordmark is glazed glass. still light all
  day; after dark it turns to midnight velvet with the glass lit from behind.
  the binder's panel has a leaded spine, and no longer peeks out when closed.
- **Carillon's cards have their own drawn ornaments** — hand-drawn SVG art in
  gilt, lead and the same jewels: filigree corners with a ruby quarry on every
  vellum card, a crescent cradling a ruby star as the divider under card and
  page headings (and in the footer and binder), a little stained-glass bell
  hanging from a moon when the sampler is at rest, a moon and its stars in
  the sampler's wide corner and wherever there's nothing yet, and a
  four-jewel quatrefoil before the small labels.

## 2026-10-18

- **Carillon's bell can sound different for the hour, half hour and quarters**
  — a new ♪ bells panel in the binder (or tap the bell line on Today, which is
  how phones get there) gives each mark its own voice: bell, lower bell, low
  bell, glass chime, singing bowl, wood block, soft pip, the Westminster
  quarters, or silent. one tap picks a set — classic (as before), clock face,
  or westminster — and the hour can be counted on a low bell. bells between
  samples, block starts, lead time and reminder sounds have their own rows; a
  block's bell now follows the chime it shares a minute with instead of being
  drowned out. volume and pause live on each device, a preview button turns
  into stop while it plays, and Today names the next bell, says when the
  browser is holding sound, and shows "rang 12:30 · half hour" afterwards.
  under the hood the bell no longer rings late or twice: it ticks on the
  minute, catches up after a throttled background tab, never queues sound on a
  locked page, and settings changed on one device are no longer undone by
  another that synced later. Escape stops a ringing bell without closing
  whatever you were typing in, every binder panel has a close button, and the
  bell line stays on Today after a moment is saved.
- **sync keeps an edit made mid-push** — when two devices push at once, the
  one that loses now merges what's on it *now*, not what it had when the push
  started, across every app on the shared sync client.
- **Carillon's open loops can recur, remind, and look back** — a loop can be a
  recurring need: closing ends one cycle and *need is back* starts the next,
  with an optional rhythm. reminders are only the ones you set — a time on a
  loop, or a while after each closed cycle — and appear below the sampler,
  with browser notifications as a separate opt-in that stays quiet overnight.
  a *Patterns in your loops* disclosure counts what sat near your closures
  (reflections, labels, noticings, Five Contacts rounds) without calling any
  of it a cause, offers loop names and rhythms it spots in your notes, and
  shows ideas only when you ask. a single body, attention, or actions note can
  now link to its own loop, and saved loop events can be corrected — the time
  you first entered stays on the record.

## 2026-10-16

- **HomeSuite syncs between your computer and your phone** — a Sync button
  in HomeSuite's top bar connects with the same passphrase the other apps
  use. documents, boards, Collections, folders, and Trash then follow you
  between devices: HomeSuite syncs on opening, on coming back to the index,
  every couple of minutes, and as you leave. each thing merges on its own —
  a thing changed on both devices keeps the later edit, a delete on one
  removes it on the other, and the very first sync only adds. pictures on
  boards stay on the device they were added from.

## 2026-10-14

- **freeze and hide rows and fields in HomeSuite Data** — right-click a
  record or a field header (or open a record's ⋯ menu) to freeze everything
  up to it, so leading rows stay under the header and leading fields stay
  beside the row numbers while the rest scrolls. the same menu hides a record
  or a field. hidden things keep their values; the toolbar counts them and
  brings them back in one click, and row numbers keep their gaps so you can
  see where something is hidden. the Primary field can't be hidden. every
  change is undoable, saves with the Collection, and is also in the command
  palette.
- **slimmer Data scrollbars** — the table's lilac rails drop from 34px to
  20px, keeping their sparkle grip and corner flower; touch screens keep the
  larger buttons.

## 2026-10-13

- **four quiet-hobby themes for older learners and adults** — a new Quiet
  hobbies group in the style studio adds Houseplants, Tea and books,
  Stargazing and Birdwatching: muted colours, grown-up type (Young Serif,
  Fraunces, Josefin Sans and Quicksand over easy-reading body fonts), gentle
  words without the exclamation marks, and illustrated banners that keep
  their whimsy without shouting — a monstera on a sunny sill beside a
  trailing pothos and a cactus in flower, a ginger cat asleep on a stack of
  books by a teapot and a steaming cup, a fox watching the Plough beside a
  brass telescope, and a robin on a fence post with binoculars set down in
  the grass. faces stay on the animals, without cheeks, and only a few parts
  move, slowly: the pothos swings, steam rises, the cat breathes, the fox's
  tail sweeps and the robin leans in. Stargazing is a dark theme.
- **four seasonal themes for visual schedules** — a new Seasons group in the
  style studio adds Springtime, Summer days, Autumn leaves and Winter snow,
  each with its own colours, fonts, stickers, words and an illustrated
  banner: a lamb among tulips beside a cherry tree in blossom, a sandcastle
  under a striped beach umbrella while the sun wears sunglasses, a squirrel
  hugging an acorn on a log by a heap of leaves, and a snowman in a knitted
  hat and scarf waving beside snowy pines and a sled. with motion on, petals
  and leaves drift down, snow falls, the scarf flutters, the tail flicks and
  the boat rocks. they draw the time of year, never a holiday — no eggs,
  pumpkins or decorated trees.
- **every special-interest theme now has its own banner** — the last ten
  themes swap their emoji stickers for illustrations in the same flat,
  sticker-like style: a puppy and a kitten sharing a bed beside a ball of
  yarn, a horse resting its chin on a paddock fence by a hay bale, a ladybird
  on a big leaf with a butterfly, a bee and daisies, a giraffe rising from
  the palms while a monkey swings on a vine, a round green dragon asleep
  beside a little castle puffing smoke rings, a fire engine speeding past a
  green light, a pixel-art slime under a gold block and its coin, a stack of
  studded bricks with one being lowered on top, a smiling cupcake beside a
  plate of warm cookies, and a sun peeking out from behind a cloud over a
  rainbow and a rain shower. with motion on, tails wag, wings flap, the
  monkey swings, the dragon breathes, the siren blinks, the coin spins, steam
  rises and rain falls. Bright sky keeps its tickets and Quiet and calm stays
  plain.

## 2026-10-12

- **clearer schedule illustrations** — the music banner has a symmetric guitar
  with aligned strings and a smaller keyboard; the library and castle dragons
  have rounded silhouettes, wings on their backs and heads that nod at the
  neck. faces move with their subjects, and houses and potion bottles meet
  their ground or tabletop. reviewed still at desktop and phone sizes.
- **six more illustrated schedule themes** — Mushroom village, Cozy library,
  Farm friends, Music studio, Arctic explorers and Potion workshop each bring
  custom banner art, colours, fonts, stickers and words. the library starts
  still; the others follow the existing gentle-motion controls. the ten
  remaining emoji-only interest banners now have their own illustrations too.
- **visual schedules can wear a learner's favourite thing** — the weekly
  planner's new **Style** button opens a style studio with 22 themes built
  around popular special interests: unicorns, dinosaurs, trains, outer space,
  diggers, cars and trucks, dragons, robots, pixel games, superheroes,
  pirates, building bricks, sweets, weather, under the sea, horses, bugs,
  jungle animals, puppies and kittens, plus the original Bright sky and a
  low-stimulation Quiet and calm. each theme brings its own colours, fonts,
  banner stickers, timeline track (railway sleepers, a road, a rainbow, paw
  prints, hazard stripes), a marker that rides beside the current activity,
  a done stamp, a celebration burst, and words — trains say *All aboard* and
  label the now/next row *This stop* / *Next stop*. everything can then be
  tuned: eight colour roles with readability warnings, 26 heading fonts and
  easy-reading fonts (Atkinson Hyperlegible, Lexend, Andika), larger text and
  pictures, corners, bold outlines, background patterns, high contrast, and
  whether anything moves. the look is saved per plan and carried by
  published learner links.
- **illustrated banners** — six themes now draw their own banner instead of
  emoji stickers: a steam train pulling a carriage along a railway, a
  brontosaurus beside a smoking volcano, a unicorn under a rainbow, a rocket
  passing a ringed planet, a digger at work beside traffic cones, and a
  whale spouting among fish. with motion on, wheels turn, smoke puffs,
  heads nod, stars twinkle and waves roll. the style studio's banner choice
  can swap any of them for the theme's stickers, your own, or nothing.
- **four more banners, and princesses** — pirates get a ship with a
  skull-and-crossbones sail off a treasure island, superheroes a caped hero
  flying over a night city in front of a comic burst, robots a waving robot
  with blinking chest lights, turning gears and a hovering drone. a new
  *Princesses and castles* theme brings a pink castle with flags and a
  jewelled crown, in a bubbly Cherry Bomb heading font.
- **first/then rewards in the schedule planner** — an activity can list what
  the learner earns: a reward (M&M, sticker, token) and up to six results worth
  0–99 each, such as sat on toilet 1, voided liquid 3, voided solid 5. the
  learner taps the best thing that happened, and only that counts. *not this
  time* moves them on with nothing. a daily total sits in the schedule header.
  results reset each day like checks, and the ladder prints on the card and
  survives publishing.
- **advance when done** — a plan can now move the learner along by finishing
  rather than by the clock. pick it under plan tools: *learner view moves on
  — when each item is done*. now is the first unfinished item and next is the
  one after, whatever the time, so finishing early or running late both work.
  checking an item (or tapping a reward result, or *not this time*) moves on.
  existing plans keep following the clock. plan tools also no longer run off
  the side of a phone screen.

## 2026-10-05

- **marginalia's world can grow** — once the shallows are learned, the world panel
  shows "the water's reach": silt against 40% and steadiness against 60. when both
  are met, *widen the world* takes the world from 15 to 31 to 45 columns, free, and
  the view pans along it (arrows, shift-drag, sideways scroll, or a plain drag when
  nothing can be poured). the island you built stays exactly where it was, and the
  next step is earned from the new width. the floor also grows forests and mountains
  from what you have poured, mountains following how complex the world is right now.

## 2026-10-04

- **meet Faerie** — a glowing, winged companion with a standalone playground
  for attention cues, gentle hints, pointer following, and small celebrations.
  It is ready for future rooms to use, with reduced motion and keyboard
  controls, and is not attached to a particular Woodle.

- **a mark for woodles** — a soft, hand-drawn w in lapis on lavender now
  identifies every room in browser tabs and saved home-screen shortcuts.
- **keep a page for Thinking About** — the companion's page menu and keep card
  gain *add to thinking about*. what you keep lands in Reading · Articles —
  straight away if the board is open, otherwise the next time you open it —
  with your line, the quote, and the link in its notes; move it from there.
  *open it* in the side panel goes straight to that entry. reload the
  extension in `chrome://extensions` for the new menu item.
- **woodles in Chrome's side panel** — a small extension
  (`apps/companion/extension`, loaded unpacked) opens
  [/companion](https://woodles.space/companion) beside whatever you're
  reading. right-click a line, a link, an image, or the page to keep it in
  Write or pin it to a board; it's waiting there the next time you open
  either. the panel also shows what's waiting to be filed, the last few things
  HomeSuite touched, and your Life Points. it only sees the tab you're on
  while it's open, and everything stays in this browser.
- **marginalia's journal italicises instead of printing asterisks** — the first
  journal page now shows *flow* in italics rather than literal `*flow*`. the
  dev cheat console's `freerealestate` and `worldparty` also work again; they
  were throwing because the Book had no setters for the fields they write.

## 2026-09-30

- **every palette gets a landing look** — all fifteen themes now choose their
  own type, shape, material, motion, wallpaper treatment, and ambient weather.
  Midnight and Amber gain accent-lit glass; Blossom has drifting petals;
  Glacier has snow; Amber has scanlines and rising embers. The setting adapts
  to high-contrast and reduced-transparency preferences. The palette-cycle
  button now changes the typeface with the theme while holding its other look
  settings.

## 2026-09-29

- **two ways into the same rooms** — Personalize now offers Soft Desktop and
  Field Notes with live page previews, Apply, and Cancel. Field Notes turns
  the app list into a paper catalog grouped by write, tend, read, and play,
  with search and Pin controls, a clock and widgets in the margin, pinned rooms below, and a
  single-column phone layout. Your palette carries across scenes, and
  switching back restores Desktop icons and widgets to their saved places.

- **themes that change more than color** — on the homepage, a theme can now
  bring its own typeface, corners, material and motion. **signal** is flat and
  opaque, crisp-cornered, in a plain sans, with no drifting wash — the
  legible theme finally reads that way. **typewriter** is paper sheets with
  hard shadows on a ruled desk, in IM Fell. ❄ still changes only the colors
  and keeps the rest as it is; picking a swatch takes the theme's whole look.
  Every other theme looks as it did, and a chosen wallpaper or sparkles-off
  carries over. The plan for the rest is in `apps/landing/THEMES.md`.

## 2026-09-28

- **again and new** — videos and choice options can be marked familiar
  (↻ Again) or novel (✦ New) in the planner, and the visual schedule shows the
  mark on the card, so it's clear which of the
  things on offer the learner has seen before. A video already offered earlier
  the same day comes in marked Again, with a note saying when.

- **videos in the weekly planner** — "＋ Video" adds video cards to any day:
  one video to watch together, or two to
  four for the learner to pick from, each with a ▶ Watch link. Thumbnails come
  from the image studio, which now opens at the 16:9 video-thumbnail crop and
  attaches straight to the video; YouTube links show their own still until
  you upload one. The pick is saved with the day's choices and checks.

- **choices in the weekly planner** — "＋ Choice" adds a choice to a day: two to
  six options, each typed with a symbol or taken from the activity library with
  its picture. On the visual schedule they tap an option, Now / Next names what they picked,
  and the pick clears the next day along with the checks.

- **weekly plans open as visual schedules** — the schedule planner has a
  ▶ Visual schedule button (and a preview card beside each day) that opens the
  selected day with a greeting and learner's name,
  big pictures, a live Now / Next, check-offs that reset each day, and an
  "All done!" at the end. Open slots become the learner's choice. On any other
  weekday it reads First / Then instead of Now / Next.

- **one clock, not four** — the tray's flyout is a calendar now: the month,
  today marked, and tonight's moon, above the themes. The greeting widget keeps
  the time, the date, and the note, so nothing is said twice.
- **the desktop follows dark mode** — until you pick a theme, it's cream by
  day and dusk when your system is dark, like HomeSuite. Picking one sticks.
- **what's new** — a ✉ in the tray opens the changelog, with a dot when
  there's an entry since you last looked. About links to it, to Lore, and to
  how the site is built.
- **a today widget** — what Carillon has planned for today (standing slots
  included) and the last few things on your Thinking About shelf, each a link
  back into its app.
- **quieter taskbar, steadier widgets** — the dots under taskbar icons, which
  read as "running" but meant "opened lately", are gone. Widgets pulled back on
  screen by a smaller window return to their place when it grows again.

- **a HomeSuite widget** — add "homesuite" from the widget shelf for a wider
  card on the desktop: how many documents, boards, and collections you have,
  and the six you touched last, each opening straight into HomeSuite. It shows
  what HomeSuite's index last showed, and says when that was.
- **the desktop is banded** — by default, icons sit in columns under write,
  tend, read, and play, the same bands the start menu uses. Icons you've
  already moved stay put; "tidy icons" in Personalize brings the bands back.

- **the desktop survives having nothing pinned** — unpinning every app
  stopped the homepage on its next load: the clock stuck at `--:--`, and
  Start, widgets, and themes stopped answering. It starts normally now.
- **the homepage says what things do** — ❄ and the right-click menu say
  "next theme", which is what they always did; wallpaper is its own setting in
  Personalize. Carillon, Quiet Room, and Thinking About's tiles describe the
  apps they have become, and every icon's description shows on hover.
- **the desktop from a keyboard** — a focus ring for anything you can press;
  windows take focus when they open, keep Tab inside, and hand it back when
  they close; the right-click menu works from the keyboard; theme swatches are
  buttons; and closed menus and windows no longer sit in the tab order or in
  what a screen reader hears.
- **smaller things** — ⌘/Ctrl-click or middle-click an app to open it in a
  new tab. With reduced motion, apps open without the pause. A desktop brought
  back by Back resets its "opening…" card rather than staying stuck behind it.
  Sticky notes grow with their words instead of scrolling, and the windows'
  small type — Life Points' count, Personalize's hints, About's footer — is
  its intended size again.
- **the homepage runs in CI** — `e2e/landing.spec.ts` covers each of the
  above and runs after the build, with the `/` axe audit.

## 2026-09-27

- **HomeSuite in the dark, and easier to read** — HomeSuite and its
  Collections follow your system's dark mode, and every label now clears
  WCAG AA contrast in both schemes; the open view gained a proper landmark
  and heading. Collections got their own tile in the list.
- **Rename from the title** — click a document's, board's, or Collection's
  name at the top of HomeSuite to rename it (Enter to keep, Escape to
  cancel); it's an ordinary edit, so Undo takes it back. Collections no
  longer rename through a browser prompt.
- **Arrivals are announced** — things sent to Write from other apps, which
  HomeSuite quietly took in, are now named on the index.
- **Addresses you can share** — an open thing's link is now
  `/homesuite?document=…` (or `board=`, `collection=`), the same shape every
  other Woodles link uses; older links still open.
- **Quieter while you type** — HomeSuite no longer re-reads every library on
  each word written in a document.

- **One bad Collection no longer costs you the others** — a Collection that
  can't be read on this device is set aside, untouched, and HomeSuite says
  so; before, one wrong value hid every Collection, and making a new one then
  overwrote them all. Each save now rewrites only its own Collection, so two
  open tabs can't undo each other, and nothing is written over a library
  that can't be read at all.
- **Trash means the same thing everywhere** — Write's drafts list and
  Whiteboard's shelf leave trashed things out, and one opened directly offers
  Restore. Opening or making things in HomeSuite no longer changes which
  draft or board Write and Whiteboard reopen on their own.
- **HomeSuite, smoother at the edges** — ⌘/Ctrl-click a `#` reference in a
  document, or Open source in a Collection, and it opens in place. Leaving a
  thing waits for its last save, so the index is already up to date. The
  palette moves with the arrow keys, dialogs take and return focus, Escape
  closes the template picker, ⌘K works from inside a Collection, and field
  renames and number cells undo in one step. On a phone the inspector starts
  closed and the title keeps its room.

- **HomeSuite stops losing things at its seams** — a board edit or a
  Collection cell typed in the moment before leaving is now saved; Whiteboard
  and Data flush on `pagehide`, which fires when HomeSuite closes a frame
  (`beforeunload` never did). A new document's page is veiled until Write has
  loaded it, so a title typed straight after New is no longer erased. Walking
  through a board's portal now takes HomeSuite with it — before, Move to Trash
  trashed the board you had left, not the one on screen. A trashed thing
  opened by its address says In Trash and offers Restore. The Bestiary +
  Marginalia Collection no longer jumps to the top of the list just for being
  opened.
- **HomeSuite runs in CI** — its browser spec and the `/homesuite` axe audit
  now run after the build, with regression cases for each of the above. The
  first HomeSuite assessment is at `apps/homesuite/ASSESSMENT.md`.
- **main's checks are green again** — four Carillon tests used a sample kind
  (`reading`) that isn't one, which failed `svelte-check` on every push since
  2026-09-26.

## 2026-09-26

- **HomeSuite's first room** — `/homesuite` brings existing Write documents
  and Whiteboard boards into one recent-first index, with a shared New menu,
  navigation, title, commands, Undo/Redo, and inspector around their native
  editors. The homepage now opens this room while direct `/write` and
  `/whiteboard` links still reach the things those apps own.
- **HomeSuite Data: Collections and Table** — Collections now have a versioned
  domain store with required Primary fields, native and `WoodlesRef`-backed
  records, local fields, templates, and independent Table widths/order.
  `/homesuite` lists and opens them in the shared shell; the Data surface has
  direct cell editing, keyboard movement, field creation, select options,
  reference relations, and the shared Inspector/undo controls. Browser QA
  exercised templates, row creation, direct cell edits, select values,
  Inspector field editing, and undo; the Data build and check passed, with
  eleven domain/persistence/source tests and 17 app-manifest contract tests passing.
- **Collections can stay current with Bestiary and Marginalia** — the new
  `Bestiary + Marginalia` template pulls local Bestiary creatures, Marginalia
  discoveries, and field notes into synced columns on open, focus, and manual
  refresh. Personal fields survive source updates, and source records link
  back to their originating app.
- **Carillon: fixed a reactive infinite loop that could wedge the whole
  page** — opening the "new task" composer while a sync passphrase was
  connected made `ThinkingAboutShelf.refresh()`'s reference-churning
  reassignment of `entries` (a fresh array from every `localStorage`
  re-parse, even when nothing changed) feed back into the effects that call
  it (`TaskEditDrawer`, `TodayInstrument`), hitting Svelte's
  `effect_update_depth_exceeded` guard and freezing the page's reactivity —
  every button, including discard, stopped responding. `loadLocal()` and
  `refresh()` now only reassign `entries`/`status` when the shelf's contents
  actually changed.
- **Carillon: the momentary sample can tag what it's about** — "What's
  happening now?" gets the same shelf-chip picker as the task composer
  (`MomentarySample.svelte`), so a moment can be linked to a Thinking About
  entry (`IntervalObservation.thinkingAboutEntryId`) without a task ever
  having been scheduled for the block. The sitting offer
  (`store.offerableEntryIdsForInterval`) now unions the plan-linked entries
  with whatever the moment itself was tagged with.

## 2026-09-20

- **cheat codes, hosted** —
  [`/marginalia/cheats`](https://woodles.space/marginalia/cheats) lists
  every code the witch's cheat console accepts, read straight from
  `CHEAT_CODES` so the page can never drift from what the console actually
  runs.
- **this system** — `/changelog` (this file), `/architecture`
  (`ARCHITECTURE.md`), and `/lore` (`LORE.md`, new) join the memorable
  addresses `/fonts`, `/write`, and `/marginalia/cheats` already use: a
  small static page per doc under `apps/changelog`, `apps/architecture`,
  and `apps/lore`, each fetching its markdown source at runtime and
  rendering it client-side with `shared/docPage.js`, so the doc and the
  page can never go out of sync.
