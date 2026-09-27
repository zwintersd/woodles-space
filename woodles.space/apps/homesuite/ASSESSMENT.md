# homesuite — assessment

*dated review, 2026-09-27, of the room Write and Whiteboard collapsed into
(plus Data, which arrived with it). a snapshot, not live truth: re-check
anything here against [ARCHITECTURE.md](../../ARCHITECTURE.md) and the code.*

every finding marked **verified** was reproduced against a local build in
Chromium through the real shell; the rest are read from code and say so.

## the short version

the shape is right. HomeSuite lists, creates, and trashes things, and never
copies content; each owning app keeps its storage, history, and editing model
behind a small, origin-checked bridge. checks are clean, unit suites are green,
and the index reads well at desktop and phone widths.

the seams are where it leaks. four ways to lose or misplace work are
verified, all on the line between shell and surface: an iframe is torn down
without warning, so Whiteboard's and Data's unsaved debounce dies with it; a
surface can change what it is showing without the shell noticing; and the
prerendered Write page accepts typing before it has loaded the draft. one
latent path wipes every Collection. the HomeSuite e2e spec is red and nothing
in CI runs it.

## what was checked

| check | result |
| --- | --- |
| `svelte-check` — homesuite, data | 0 errors, 0 warnings |
| vitest — data / write / whiteboard / app-manifest / root | 11 / 250 / 258 / 17 / 16 passing |
| build — homesuite, write, whiteboard, data | clean; homesuite `dist/` 228 KB |
| `e2e/homesuite.spec.ts` | **2 of 2 fail** (see 9) — 5/5 on repeat, not flaky |
| axe — index, open artifact (shell only) | contrast failures; open view has no `main` or `h1` |
| open an artifact from the index | ~330–420 ms to a loaded frame |
| phone, 390 px | index fine, no overflow; open view crowded (see 10) |

## how it works, briefly

- `src/lib/surfaces.ts` imports Write's draft index, Whiteboard's board
  library, and Data's Collection library straight from their `src/lib`, and
  adapts each to `list / create / embedHref / permanentlyDelete`.
- an open artifact is `/homesuite?kind=&id=`; the owning app mounts in a
  same-origin iframe at its own deep link plus `&homesuite=1`.
- `shared/homesuiteBridge.ts` (`woodles.homesuite.v1`): surfaces post
  `state` (title, selection, inspector, commands, modes, undo/redo
  availability) and `request-palette`; the shell posts `action`s back.
- Trash is a HomeSuite-side list (`woodles.homesuite.trash.v1`) that hides
  refs from the index; permanent delete calls the owner's own removal.

## findings

ranked by what they cost a person using it.

### p0 — work lost or misdirected

1. **board edits made just before leaving are lost.** verified. Whiteboard
   saves on a 420 ms debounce (`whiteboard/src/routes/+page.svelte:582`) and
   flushes only on `beforeunload` (`:780`). removing an iframe — "← All
   things", opening another thing, New — does not fire `beforeunload`. Add
   card, leave after 60 ms or 300 ms: 0 items saved; after 700 ms: 1. the
   same goes for the last few hundred ms of typing into a card. Write
   survives this because it flushes on `pagehide`
   (`write/src/routes/+page.svelte:497`); verified: body typed 50 ms before
   leaving persisted.
2. **Collection edits made just before leaving are lost.** verified. Data
   debounces saves 120 ms (`data/src/routes/+page.svelte:65`) and flushes only
   in `onMount`'s cleanup (`:368`, `:370`), which never runs when the frame is
   removed. type a name, leave after 30 ms: `null` saved; after 300 ms:
   saved.
3. **walking through a portal desyncs the shell; Move to Trash hits the
   wrong board.** verified. `enterPortal` swaps the board inside the frame
   and rewrites the frame's `?board=` (`whiteboard/…/+page.svelte:1816`,
   `:2018`). the shell keeps its own `?id=` and accepts any `state` whose
   artifact has an id (`homesuite/…/+page.svelte:181`), but trashes
   `activeArtifact`, which comes from its URL (`:100`). with board B on
   screen via a portal from A, Move to Trash trashed **A**. a reload also
   returns to A. `navigate` is in the bridge's type but nothing sends it.
4. **a title typed right after New → Document is erased.** verified. Write
   is prerendered with `ssr = true` (`write/src/routes/+layout.ts`), so its
   title and body are live HTML before hydration. typed at 68 ms, blank by
   ~390 ms; hydration and the draft load reset `title` to `''`. HomeSuite
   makes this the common path — New drops you on an empty page whose next
   move is typing. this is also the e2e failure in 9.

### p1 — correct-looking, quietly wrong

5. **one malformed record hides every Collection, and the next create wipes
   them all.** verified by injection. `isCollectionLibrary` is
   all-or-nothing (`data/src/lib/collections.ts:68`); on failure `load()`
   falls back to `{ collections: [] }`. HomeSuite's `create` and
   `permanentlyDelete` save onto that fallback (`surfaces.ts:101`, `:109`),
   and `save()` only backs up a previous value that decodes. two
   Collections plus one string in a number cell, then New Collection:
   primary and backup both hold only the new one. the realistic trigger is a
   later deploy that adds a field type or bumps the schema while an older tab
   is open.
6. **the Bestiary + Marginalia Collection jumps to the top every time it is
   looked at.** verified. `mergePulledRows` stamps `updatedAt` on the
   Collection and every source row whether anything changed or not
   (`data/src/lib/sourceSync.ts:147`, `:154`) — even with zero source rows.
   sync runs on open, focus, visibility, and every 60 s (`+page.svelte:364`),
   and each run saves the whole library.
7. **long-lived Data frames write the whole library from a stale snapshot.**
   from code. `library` is read once at mount and every save writes
   `library.collections.map(…)`. with the 60 s sync, a Collection open in a
   second tab can resurrect one permanently deleted in the first, or drop one
   created there.
8. **Trash only exists inside HomeSuite.** verified. a trashed draft opens as
   the active draft at `/write` and at `/write?draft=<id>`; Write's drafts
   drawer and Whiteboard's shelf list trashed things (from code — neither
   filters). a deep link to a trashed artifact says "not in your HomeSuite
   yet" rather than "in Trash". related: HomeSuite's create and the embedded
   editors set Write's and Whiteboard's *active* item, so standalone Write
   opens whatever HomeSuite touched last.
9. **the HomeSuite e2e spec is red, and CI would not notice.** verified.
   test 1 asserts the retired copy "Collections are coming next."; test 2
   fills the title immediately and hits 4. `.github/workflows/quality.yml`
   runs check, test, and build — never Playwright. `accessibility.spec.ts`
   covers `/write` but not `/homesuite`, now the homepage's door. HomeSuite
   has no `test` script; `surfaces.ts` and `homesuiteTrash.ts` have no unit
   tests.

### p2 — rough edges people will feel

10. **phone, open artifact.** verified. Undo/Redo draw over the HomeSuite
    crumb, and the inspector opens by default (`+page.svelte:44`) over ~70 %
    of a 390 px document.
11. **keyboard.** verified. Escape closes the palette and New menu but not
    the New Collection dialog (`:210`); focus does not move into that dialog;
    the palette has no arrow-key movement (Enter runs the first match);
    neither `aria-modal` dialog traps focus. ⌘K from inside a Collection does
    nothing — Data imports `postHomeSuitePaletteRequest` and never calls it,
    where Write and Whiteboard forward it.
12. **axe.** verified. index: 13 `color-contrast` nodes (`kbd`, `.eyebrow`).
    open artifact: contrast on `.inspector-kicker`, no `main` landmark, no
    `h1`, `.selection-pill` outside any landmark.
13. **the shared Undo is not whole.** verified for Data: renaming a field
    from the shell's inspector leaves Undo disabled, because
    `inspectorChange` writes with `recordHistory = false`
    (`data/…/+page.svelte:255`). number cells push one undo step per
    keystroke (`:419`); text cells coalesce. Write's Undo is
    `document.execCommand('undo')`.
14. **links between things leave the suite, or go nowhere.** verified. a
    `#` reference inside an embedded document does nothing on click or
    ⌘-click; Data's Open source is `window.open` to the standalone app.
15. **visual.** verified. `.artifact-icon.collection` has no rule, so the
    Collection row lacks the tinted tile the other two have. `homesuite.css`
    carries 147 hard-coded hex colors and `data.css` 89; `shared/palette.css`
    is loaded but only `--bg` and `--text` are used, so there is no theming
    and no dark mode. Collection rename is `window.prompt`; no kind can be
    renamed from the shell's title.

### p3 — structure

16. **the shell knows too much about each surface.** glyphs (three copies),
    "Open details in Write/Whiteboard/Data", empty-inspector hints, a
    hard-coded `field:type` control id (`+page.svelte:336`), the six
    Collection templates (duplicating `TEMPLATE_FIELDS`), and the
    `living-world → 'Bestiary + Marginalia'` title (`surfaces.ts:102`). all
    of it belongs on the adapter or in the bridge.
17. **two vocabularies.** the shell says `document` where Write and the
    manifest say `draft`, and builds `/homesuite?kind=&id=` by hand; HomeSuite
    has no `addressableBy`, so `entityHref` cannot point into it.
18. **every state message re-reads every library.** measured: typing 48
    characters sent 11 `state` messages and caused 91 `localStorage` reads in
    the shell, with one artifact listed. `refresh()` re-parses the draft
    index, board index, the full Collection library with all records, and
    the trash once *per artifact* (`isHomeSuiteTrashed`). it grows with the
    library.
19. **handoffs arrive silently.** `prepareSurfaceStorage` drains Write's
    handoff queue on every index load, and an embedded board drains
    Whiteboard's; "opened something sent here" never shows.
20. **Data's page is hard to review.** several 1,000-character lines
    (toolbar, both dialogs, drag-and-drop, the picker) in
    `data/src/routes/+page.svelte`. `addField` opens with a no-op
    (`collections.ts:159`). imported Collections get bare UUIDs; created ones
    get `collection-`-prefixed ids.
21. **docs drift.** "the two app shapes" in ARCHITECTURE.md omits `data` and
    `grimoire`; README.md's SvelteKit list omits `data`; CONVERGENCE.md — the
    doc for why apps merged — has no entry for this third collapse;
    REFACTORING.md does not list the new duplication.
22. **all of it is per-device.** drafts, boards, Collections, and Trash never
    sync (Write's sync is letters only). a fair stance, but there is no
    suite-level export; only Data exports, one Collection at a time.

## proposed fixes

one PR per step; each small enough to review in a sitting.

**1 · stop losing things** (1–4, 6, 9)
- Whiteboard and Data: flush on `pagehide` and on `visibilitychange` →
  hidden. a few lines each, same as Write.
- shell: veil the frame until its first `state` message. fixes 4 for every
  surface and gives the ~400 ms swap a deliberate loading state.
- shell: treat `state.artifact` as the truth. when it differs from the URL,
  `goto(…, { replaceState: true })` without re-keying the frame; Move to
  Trash and the title read the reported artifact.
- `mergePulledRows`: compare values; bump a row's `updatedAt`, and the
  Collection's, only on change. keep `sourceSyncedAt` separate.
- e2e: replace the retired copy; wait on the veil instead of racing; add a
  case for each of 1–4; add `/homesuite` to `accessibility.spec.ts`. run at
  least `homesuite.spec.ts` in CI.

**2 · make the contract honest** (5, 7, 8, 10, 11, 13, 16)
- Data persistence: read-modify-write one Collection at a time; validate per
  Collection and quarantine a bad one rather than the library; refuse to save
  over a `fallback` load that carries an issue. same guard in `surfaces.ts`.
- bridge v2: a `flush` → `flushed` handshake before a swap (belt to step 1's
  braces); a `navigate { ref }` the shell obeys; `readonly` on inspector
  controls instead of a special-cased id; surface descriptors — glyph, app
  name, hint, templates — supplied by the adapter.
- Trash: owners honor it — filter their own lists, and open a trashed thing
  with an "in Trash · restore" bar. stop HomeSuite moving the standalone
  apps' active item.
- Data: inspector edits join undo; number cells coalesce like text; forward
  ⌘K; Escape and focus handling in both dialogs.
- phone: inspector closed by default under 600 px; collapse the crumb when
  history controls show.

**3 · clean the seams** (12, 15, 17–21)
- move colors to palette tokens; add dark mode; give Collections their tile;
  fix the contrast failures and add a `main` and `h1` to the open view.
- one kind vocabulary, or an explicit mapping in the manifest; give
  HomeSuite `addressableBy` so a ref can point at "open this in the suite".
- refresh the index on `storage`, focus, and close — not on every message;
  patch the open artifact's title from `state`; read Trash once per refresh.
- announce handoffs; break Data's page into components; record the collapse
  in CONVERGENCE.md and the duplication in REFACTORING.md.

## where it could go

- **links that stay home.** a `#` reference, a portal, or a relation cell
  opens its target inside the shell; the inspector grows a "mentioned by"
  panel from the backlinks Write already computes.
- **search inside things.** draft text, card text, record values — a small
  index built from what each adapter already lists.
- **more ways to see a Collection.** filter and sort, then a gallery, a
  calendar off a date field, a board layout — which Whiteboard could supply.
  change a field's type; many-to-many relations; relations to boards and
  other Collections.
- **instant switching.** keep the last two or three frames alive and hidden;
  prefetch on hover. the swap is ~400 ms today.
- **a suite backup.** one export of drafts, boards, Collections, and Trash
  together — then, if wanted, sync for the index and Trash.
- **the iframe is the right seam for now.** separate builds, isolated
  editors, no shared runtime to break. the bridge is also the contract
  that would let surfaces become components the shell mounts directly, if
  the builds ever merge. that is a later question; the p0s are not.
