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
**Copies:** `apps/{planner,bestiary,spores,marginalia-devlog}/src/lib/sync.svelte.ts`
**State:** consolidated
**Notes:** extracted into `createAppSync` in `packages/sync/src/index.ts`. each
app's file is now ~30 lines: a `SyncState` class with `$state` fields, its
instantiation, and a `createAppSync` call that wires up the app-specific adapter
(blob type, read/write/isNewer). the factory owns passphrase persistence,
connect/disconnect, status tracking, and the hydrate/flush cycle. `passKey`
defaults to `'woodles_sync_passphrase'`; `marginalia-devlog` passes
`'woodles_sync_passphrase_devlog'`. the `SyncState` class itself stays in each
app's `.svelte.ts` so `$state` compiles under the app's Svelte plugin rather than
in the package.

## text / HTML utilities
**Status:** candidate · strong
**Copies:** `write/src/lib/htmlTools.ts`, `marginalia/src/lib/reading/text.ts`,
`letter/index.html` (inline `<script>`)
**State:** converged in contract, diverged in detail
**Notes:** `sanitize`, `isEmptyHtml`, `stripTags`, `countWords`, `previewText`,
and anchor stamping. the contract is the same across all three. `write`'s and
`marginalia`'s copies are tested; `letter` reimplements them inline and is
untested. a small shared module would cover all three — `letter` is static, so it
would import the result as plain `.js`.

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
