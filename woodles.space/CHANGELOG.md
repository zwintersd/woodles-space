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

## 2026-09-26

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
