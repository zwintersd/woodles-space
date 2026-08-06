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
**Copies:** `apps/{planner,bestiary,spores}/src/lib/sync.svelte.ts`
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
`countWordsInText`, `previewText`. four consumers since notebook retired
(CONVERGENCE.md §7): `write` (now a pure re-export), `marginalia` (keeps its
paragraph model and its two sanitizer policies), `letter` (imports the `.js`
directly — it is static, so the package ships browser-ready `.js` + a `.d.ts`
sidecar, same shape as `@woodles/app-manifest`), and `spores` for `htmlToText`.

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
