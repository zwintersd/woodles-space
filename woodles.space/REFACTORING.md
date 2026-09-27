# consolidation log

a living list of code that exists in more than one place. the habit here is to
duplicate until two apps have built the same thing and converged on its shape,
then extract the shared version — sharing too early freezes an API before the
copies have stopped moving. this file tracks what's duplicated, whether the
copies have settled, and what extraction would take.

each entry:

```
## <unit>
Status:  candidate | in progress | blocked | done
Copies:  where it lives
State:   identical | minor variation | diverged
Notes:   what consolidation needs, or what's holding it
```

---

## sync.svelte.ts
**Status:** done
**Copies:** `apps/{planner,bestiary,thinking-about}/src/lib/sync.svelte.ts`
**State:** consolidated
**Notes:** extracted into `createAppSync` in `packages/sync/src/index.ts`. each
app's file is now ~30 lines: a `SyncState` class with `$state` fields, its
instantiation, and a `createAppSync` call that wires up the app-specific adapter
(blob type, read/write/isNewer). the factory owns passphrase persistence,
connect/disconnect, status tracking, and the hydrate/flush cycle. `passKey`
defaults to `'woodles_sync_passphrase'`. the `SyncState` class itself stays in each
app's `.svelte.ts` so `$state` compiles under the app's Svelte plugin rather than
in the package.

## text / HTML utilities
**Status:** done
**Copies:** `packages/text` (`@woodles/text`)
**State:** consolidated
**Notes:** `sanitizeHtml`, `stripPresentation`, `ensureAnchorsOn`,
`stampAnchorsHtml`, `isEmptyHtml`, `stripTags`, `htmlToText`, `countWords`,
`countWordsInText`, `previewText`. three consumers since Spores retired
(CONVERGENCE.md §8): `write` (a pure re-export for most of the surface, plus
a direct `htmlToText` import in `DraftPromptModal.svelte`), `marginalia`
(keeps its paragraph model and its two sanitizer policies), and `letter`
(imports the `.js` directly — it is static, so the package ships
browser-ready `.js` + a `.d.ts` sidecar, same shape as `@woodles/app-manifest`).

extraction turned up **two real divergences the copies had been hiding**, both
now parameters rather than a winner:
- **`data-anchor` on sanitize.** `write` strips it and re-stamps; `marginalia`
  and `letter` keep it, because they display what they are given and a strip
  would orphan every margin note. `keepAttributes` covers both. write's own
  test suite caught this — the first version of the shared sanitizer changed
  write's semantics and a test that had been asserting the strip failed.
- **the anchor prefix.** `write` stamps `a-001`, marginalia's reading room
  stamps `p-001`, and both are already in stored documents. picking one would
  silently orphan the other app's notes, so `ensureAnchorsOn` takes a prefix.

the sanitizer body is marginalia's recursive `clean()` rather than write's flat
`querySelectorAll`, including its documented never-clean-the-root gotcha —
recursion handles nesting order correctly and the flat version happened not to
hit the difference.

## EditorToolbar.svelte
**Status:** candidate
**Copies:** `write/src/lib/EditorToolbar.svelte` (89 lines),
`marginalia/src/lib/components/reading/EditorToolbar.svelte` (113 lines)
**State:** diverged
**Notes:** same role — formatting buttons over a contenteditable — with different
markup and CSS. still moving; not ready to extract.

## MarginNotes.svelte
**Status:** candidate
**Copies:** `write/src/lib/MarginNotes.svelte` (204 lines),
`marginalia/src/lib/components/reading/MarginNotes.svelte` (193 lines)
**State:** diverged
**Notes:** anchored margin notes in both, each built against its own editor DOM.
the anchoring contract hasn't converged. still moving.

## SelectionPopover / SelectionBubble
**Status:** candidate
**Copies:** `write/src/lib/SelectionPopover.svelte` (58 lines),
`marginalia/src/lib/components/reading/SelectionBubble.svelte` (105 lines)
**State:** diverged
**Notes:** the floating popover over a text selection. same idea, different name,
different surface. still moving.

## HomeSuite surface wiring
**Status:** candidate
**Copies:** the `?homesuite=1` branches of `write/src/routes/+page.svelte`,
`whiteboard/src/routes/+page.svelte`, `data/src/routes/+page.svelte`
**State:** minor variation
**Notes:** each surface builds its own `HomeSuiteSurfaceState`, listens for
shell messages with the same origin/source check, and answers `flush`,
`rename`, `undo`/`redo`, and `command` in a switch of its own. the verbs have
settled since the bridge grew `flush`, `rename`, and `navigate`; a
`connectHomeSuite({ state, onAction })` helper beside the bridge would take
the listener, the checks, and the `flushed` reply. the state each builds
stays per app.

## WoodlesRef equality
**Status:** candidate
**Copies:** `sameRef` in `shared/homesuiteTrash.ts`, `trashKey` in
`apps/homesuite/src/lib/surfaces.ts`, `refKey` in
`apps/data/src/lib/sourceSync.ts`, and inline app/kind/id comparisons in
`apps/data/src/lib/collections.ts` (`addRecord`, `removeRecord`)
**State:** identical in meaning, different in shape (predicate vs. key)
**Notes:** one `refKey(ref)` and `sameRef(a, b)` next to the `WoodlesRef` type
in `shared/homesuiteBridge.ts` would serve all four.

## HomeSuite colors
**Status:** done
**Copies:** `shared/homesuiteTheme.css`
**State:** consolidated
**Notes:** the shell and Data had ~230 hard-coded colors between them, no
dark mode, and failing contrast. both now read `--hs-*` tokens from the one
file, with a dark scheme. Write and Whiteboard keep their own palettes on
purpose.

