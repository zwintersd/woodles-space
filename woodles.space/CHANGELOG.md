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
