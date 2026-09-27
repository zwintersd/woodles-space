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
