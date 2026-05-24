# Mega-Component Extraction Plan

Two files concentrate ~15% of the codebase by line count and ~all of the
high-coupling complexity:

| File | Lines | Script | Markup | Style |
|---|---:|---:|---:|---:|
| `apps/write/src/routes/+page.svelte` | 2462 | 1–954 | 963–1396 | 1398–2462 (180 rules) |
| `apps/marginalia/src/lib/components/reading/ReadingRoom.svelte` | 960 | 1–524 | 526–669 | 671–960 |

The shape of each problem is different. Plans below are ordered safest-first.

---

## write/+page.svelte — extraction targets

The script does **eight distinct concerns** glued together by shared `$state`.
Most of the markup has already been laid out in regions that match those
concerns, so the extractions track natural seams. The CSS in each block is
overwhelmingly per-region — when you move a markup region, the matching
selectors should follow.

### Concern map (script)

| Concern | Script LOC | Markup LOC | Notes |
|---|---|---|---|
| 1. Editor surface (3 layers + contenteditable) | 54–73, 146–222, 446–545, 742 | 1029–1121 | Owns `fgEl/mgEl/bgEl`, sanitize/paste/anchors. **Core — do not extract.** |
| 2. Drafts (index, load, save, switch, delete) | 107–116, 397–443, 558–632 | 978–1022, 1000–1022 | Modal + topbar toggle. Pure localStorage logic + UI; clean seam. |
| 3. Pocket notes | 38–45, 75–79, 118–127, 679–740 | 1123–1179, 1292–1331 | Two views: in-document panel + binder tab. Shared list state. |
| 4. Margin notes | 46–52, 81–84, 128–145, 741–845 | 1182–1227, 1228–1243, 1333–1357 | Includes selection popover + binder tab. Anchored to fg DOM. |
| 5. Binder (right-edge slide-out) | 88–95, 846–953 | 1245–1358 | Three tabs (layers/pockets/notes) re-using derived data. |
| 6. Publish flow + letters list | 235–284, 634–678 | 1024–1027, 1386–1396 | Modal-less; one button + overlay. |
| 7. Topbar (brand, layer-switch, toggles) | n/a (uses state) | 963–998 | Layout-only; pure presentational. |
| 8. Bottom bar (status, theme/motif/font pickers) | n/a | 1360–1396 | Layout-only; pure presentational. |

### Recommended extractions (safest → riskiest)

#### Phase A — pure presentation (zero behavior change, low risk)

These have no business logic; they just bind props in and emit a callback.
Worth doing first because they shrink the file noticeably without touching
state ownership.

1. **`Topbar.svelte`** (~50 LOC markup + ~140 LOC CSS)
   - In: `activeLayer`, `draftsOpen`, `pocketsOpen`, `pockets.length`
   - Out: `setActiveLayer`, `toggleDrafts`, `togglePockets`
   - Markup: `+page.svelte:963–998`
   - CSS: `.topbar*`, `.layer-switch`, `.layer-btn*`, `.pockets-toggle*`,
     `.pockets-count`, `.drafts-toggle*`, `.topbar-divider`, `.topbar-clock`
     (`+page.svelte:1418–1567`)

2. **`BottomBar.svelte`** (~35 LOC markup + ~120 LOC CSS)
   - In: `saveStatus`, `wordCount`, `theme/motif/font` (bindable), `palettes`,
     `motifList`, `fontPairs`, `activeLayer`, `fgIsEmpty`
   - Out: `onPublish`
   - Markup: `+page.svelte:1360–1396`

3. **`EditorToolbar.svelte`** (~30 LOC markup, ~80 LOC CSS)
   - In: `bold`, `italic`, `underline`
   - Out: `onCommand(cmd, val?)`, `onInsertLink()`
   - Markup: `+page.svelte:1050–1080`
   - Note: marginalia already has an `EditorToolbar.svelte` — do not copy.
     See "Cross-app duplication" below.

#### Phase B — self-contained features (small risk, big payoff)

4. **`DraftsModal.svelte`** + a `drafts.ts` lib module
   - Move all `DRAFTS_INDEX_KEY` / `DRAFT_PREFIX` / `ACTIVE_DRAFT_ID_KEY` /
     `LEGACY_DRAFT_KEY` handling into `lib/drafts.ts`:
     - `listDrafts(): DraftIndexItem[]`
     - `loadDraft(id): StoredDraft | null`
     - `saveDraft(id, data)`, `deleteDraft(id)`, `createDraft()`,
       `migrateLegacy()`
   - Component: just renders the modal and calls the lib.
   - In: `drafts`, `currentDraftId`, `open`
   - Out: `onSelect(id)`, `onCreate`, `onDelete(id)`, `onClose`
   - Markup: `+page.svelte:1000–1022`
   - Why first: this is **the cleanest extraction** — the storage logic is
     already pure (no DOM/$state) and unit-testable. Doing this gets test
     coverage on the draft system that we currently can't reach because the
     code is locked inside `.svelte`.

5. **`PublishOverlay.svelte`** + `publish.ts` lib module
   - Move `publish()` (`+page.svelte:634–677`) and the letters-list logic
     (`+page.svelte:235–284`) into `lib/publish.ts`. Component renders just
     the overlay text.
   - Markup: `+page.svelte:1024–1027`

#### Phase C — anchored features (real risk, design decisions)

6. **`PocketsPanel.svelte`** + `BinderPocketsTab.svelte`
   - Two consumers of one pocket list. Two reasonable shapes:
     - **Option A:** lift state into a store (`lib/pockets.svelte.ts` with
       `$state`), have both components subscribe.
     - **Option B:** keep state in `+page.svelte`, pass `pockets` + handlers
       as props to both components.
   - Recommend **Option B** for now — Svelte 5 runes already make local
     `$state` cheap, and a store would be overkill for one-page scope.
   - Markup: `+page.svelte:1123–1179` (panel), `1292–1331` (binder tab)
   - **Concern:** `pocketBody` Svelte action depends on local `sanitizeHtml`.
     Promote `sanitizeHtml` to `lib/sanitize.ts` first — see "shared" below.

7. **`MarginNotes.svelte`** + selection-popover sub-component
   - Highest-coupling extraction. Owns:
     - The anchored list rendering (`+page.svelte:1182–1227`)
     - The selection popover (`+page.svelte:1228–1243`)
     - The binder tab (`+page.svelte:1333–1357`)
     - Anchor measurement (`measureAnchors`, `scheduleMeasure`)
     - Selection-change listener
   - **Concern:** `addMarginNote` and `measureAnchors` both reach into
     `fgEl` (the foreground editor DOM). Extract by having the parent pass
     `getFgEl: () => HTMLElement | undefined` as a prop, or by moving
     anchor stamping into `lib/anchors.ts` and passing the result.
   - Defer until Phase B has shrunk the file enough that the coupling is
     clearer.

8. **`Binder.svelte`** (right-edge slide-out)
   - Aggregates layers + pockets + margin-notes tabs. Once each tab body is
     its own component (above), `Binder` is mostly tab-routing + animation.
   - Markup: `+page.svelte:1245–1358`

### Pre-extraction cleanups (do these first)

- **`sanitizeHtml`** (`+page.svelte:153–172`), **`stampAnchorsHtml`** /
  `ensureAnchorsOn` (`193–232`), **`stripTags`** / **`countWords`** /
  **`previewText`** (`847–908`), **`isEmptyHtml`** (`446–449`) → move to
  `apps/write/src/lib/htmlTools.ts`. **These are pure, testable, and
  currently un-importable from a `.test.ts`.** This alone unlocks ~80 LOC
  of new test coverage and matches what `apps/marginalia/src/lib/reading/
  text.ts` already does for that app.

- **Storage keys** (`+page.svelte:14–22, 112–114`) → consolidate in
  `apps/write/src/lib/storage.ts`. Currently spread across the file; some
  were undefined until the previous commit found them.

### What NOT to extract

- The three contenteditable layer divs (`+page.svelte:1082–1121`) — they
  share too much state (selection, paste sanitization, anchor stamping,
  word counting). Extracting them would just push the same complexity into
  a child component with a fatter prop interface.
- The motif background blobs (`+page.svelte:957–961`) — three lines of
  pure decoration.

---

## marginalia/ReadingRoom.svelte — extraction targets

This file is **healthier than write/+page.svelte**: the heavy lifting
(`Passage`, `MarginNotes`, `EditorToolbar`, `Star`, `StarShelf`) is already
in separate components. What remains is orchestration + four bounded
concerns. Smaller wins, lower risk.

### Concern map

| Concern | LOC | Notes |
|---|---|---|
| 1. Doc persistence + v1/v2/v3 migration | 99–168 | Pure logic; unit-testable. |
| 2. PDF intake | 209–249, 575–602 (markup) | Already lazy-imports `lib/reading/pdf`. |
| 3. Selection bubble | 287–334, 379–475, 652–669 (markup) | Selection logic + popover UI. |
| 4. Session/star header | 60–78, 540–562 (markup) | Timer + progress derived. |
| 5. Editor commands (highlight, link) | 264–334 | DOM-mutation glue. |

### Recommended extractions

1. **`lib/reading/doc.ts`** — extract `persistDoc`, `loadDoc`,
   `paraHtmlFromContent` (`ReadingRoom.svelte:99–168`). Drops ~70 LOC and
   makes the v1→v2→v3 migration unit-testable. Match the shape of
   `lib/witch/persist.ts` which we just covered with tests.

2. **`PdfIntake.svelte`** — wraps the textarea + file input + status row.
   - Owns: `pdfLoading`, `pdfProgress`, `pdfError`, `pasteText` (bindable),
     `truncated`, `fileInputEl`, `handlePdfFile`, `onPdfPick`.
   - Emits: `onCommit(text)`.
   - Markup: `ReadingRoom.svelte:565–612`
   - Script: lines `209–249` + the paste-mode UI logic.

3. **`SelectionBubble.svelte`** — the floating popover.
   - Owns: positional style, button cluster.
   - Emits: `bold`, `italic`, `underline`, `strikethrough`, `highlight`,
     `link`, `addNote`.
   - Markup: `ReadingRoom.svelte:652–669`
   - **Selection state stays in the parent** — the bubble is just a view.

4. **`SessionHeader.svelte`** (optional, smallest win)
   - The `<div class="active-star">` block (`540–562`). Pure presentation
     over `book` reads.

5. **Editor-command helpers** (`runCommand`, `applyHighlight`, `applyLink`)
   could move into a `lib/reading/commands.ts` once the markup using them
   is gone. They're tightly coupled to `passageEl` and `afterEdit`, so
   defer until selection is extracted.

### Pre-extraction cleanups

- `formatHms` / `formatMin` (`ReadingRoom.svelte:79–97`) → move to
  `lib/reading/format.ts`. Pure, testable, currently locked in.

### What NOT to extract

- The `<Passage>` / `<MarginNotes>` orchestration — already as small as it
  can be.
- The `onMount` / `onDestroy` lifecycle — splitting it across children
  would create coordination overhead.

---

## Cross-app duplication (not blocking, but flag)

Both `write` and `marginalia` independently implement:

- **HTML sanitization** with a fixed allowed-tag list.
- **Anchor stamping** for stable IDs on block elements.
- **Margin-note rendering** anchored to the source paragraph.
- **Selection popover** that surfaces on text selection.
- **Per-app `EditorToolbar`** (similar buttons, different CSS).

These are real candidates for a shared workspace package
(`@woodles/text-tools` or similar) once both apps have extracted their
inline versions into local libs. Doing the per-app extraction **first**
clarifies the contract — premature sharing would freeze the API before the
two apps have stopped diverging.

---

## Suggested execution order

1. write Phase A (Topbar, BottomBar, EditorToolbar) — ~3 components, ~600 LOC moved, no behavior risk.
2. write pre-extraction cleanup (htmlTools.ts, storage.ts) — unlocks tests.
3. marginalia pre-extraction (doc.ts, format.ts) — symmetry with #2.
4. write DraftsModal + drafts.ts — high payoff, isolated.
5. marginalia PdfIntake + SelectionBubble — file drops below ~600 LOC.
6. write PublishOverlay — small.
7. write PocketsPanel + BinderPocketsTab — first real cross-component state share.
8. write MarginNotes + Binder — last; cleanest to do once everything else is gone.

After step 4 both files are unit-testable in a meaningful way. After step
7 both files are under ~1000 LOC. After step 8, cross-app sharing becomes
worth a follow-up audit.

### Estimated effort

- Steps 1–3: 1–2 hours, near-zero risk. Worth doing in one PR.
- Steps 4–6: 2–4 hours each, low risk. One PR per step.
- Steps 7–8: half-day each. Manual browser verification recommended for
  both — selection / anchoring / scrolling are hard to test headlessly.
