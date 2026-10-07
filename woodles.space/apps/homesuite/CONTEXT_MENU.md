# Context actions in HomeSuite

HomeSuite is a shared room over three owners. Write owns draft prose, layers,
annotations, and browser editing history. Whiteboard owns its board library,
cards, frames, stacks, connectors, portals, assets, and editing history. Data
owns Collection fields, records, views, and local values. The shell lists,
addresses, and presents them; it does not convert them to one common entity.

## How data crosses forms

| Connection | What travels | What stays authoritative |
| --- | --- | --- |
| Write `#` anchor | `data-ref-app`, `data-ref-kind`, `data-ref-id`, and readable words | The referenced app; unlinking preserves prose |
| Board portal | Destination board ID and a layout item | Destination board; removing a portal removes that representation |
| Collection membership | `sourceRef: { app, kind, id }` plus Collection-owned fields | Referenced app; removing the row preserves the source |
| Relation cell | A `WoodlesRef` in one local cell | Referenced app; removing the reference clears only that cell |
| Connected source pull | Read-only source columns, merged by the full reference | Bestiary, Marginalia, or the shared catalog; local notes survive refresh |
| Write → board Inbox | Existing handoff snapshot of foreground prose and source information | Each owner keeps its own content after the handoff; later edits do not sync |

Documents, boards, and Collections can now be added to an existing Collection
from their menu as a reference. Data resolves boards and Collections from
their native libraries, alongside its existing Write and external sources.
The picker reads current destinations, excludes Trash and self membership,
shows existing memberships, and deduplicates by all three parts of the ref.
An explicitly re-added reference clears its sync exclusion. If the destination
is mounted, Data applies the addition to its current model and undo history;
otherwise its versioned store saves only that Collection against a fresh library.

Native Collection rows and board cards are not independently addressable.
They therefore get local editing verbs, without fabricated cross-app links or
automatic conversion. Further conversions need an owner-defined handoff with
clear snapshot semantics; further live representations need an address contract.

## Menu scope

| Target | Actions |
| --- | --- |
| Workspace artifact / title `⋯` | Open, rename through its surface, copy suite link, add reference to Collection, open owner app, Move to Trash / Restore |
| Trash row `⋯` | Restore, copy link, begin the existing permanent-deletion confirmation |
| Collection row | Duplicate native record, Remove from collection for referenced records, Delete record for local records, inspect |
| Field header | Inspect/rename via inspector, add field, delete field with a required-Primary explanation |
| Relation cell | Choose/change reference, open/copy/collect target, Remove reference, row actions |
| Board selection | Edit details, duplicate supported items, remove selection; portal also exposes its destination reference |
| Empty canvas | Add card, draw frame, add stack, fit board, connect the board |
| Write reference | Open/copy/collect source, unlink while keeping words, inspect |
| Write surface | Continue writing, layers and notes, existing prose-to-Inbox handoff, connect document |

Actions group into Edit, Connect, View, and destructive scope, without nested
hover submenus. This uses HomeSuite's existing color tokens in both schemes.
Editable text retains the browser context menu, except explicit reference
anchors. Right-click and keyboard Context Menu / Shift+F10 open native targets;
visible `⋯` buttons on artifacts, records, and the selection strip support touch.
Arrow keys, Home/End, Enter, Escape, and Tab work; menus fit inside the viewport,
scroll on short screens, and dismiss on outside interaction, resize, and scroll.

## Extension contract

`shared/homesuiteContext.ts` keeps a request ID, focused element, and callbacks
inside the owner. The owner snapshots its target IDs when opening. It publishes
only label, scope, optional reference, coordinates, and serializable action
descriptors through the origin-checked bridge. The shell translates iframe
coordinates and renders `ContextMenu.svelte` above the frame. It adds reference
navigation/connection and inspector presentation; it never invents domain edits.

An action returns the request ID and command ID to that same frame. The owner
executes only the current request's enabled callback, once, and verifies that
its artifact and target still exist. Dismissed or superseded requests cannot
act on a newly selected item. Navigation keeps the existing flush handshake.
To extend the menu, add target-specific descriptors and guarded callbacks in
the owning surface; the shell and menu renderer need no new kind switch.
Surface commands tagged `context: 'artifact'` also appear in the open artifact's
`⋯` menu, grouped by the owner's declared scope. Write's handoff, Data's export
and source refresh, and Whiteboard's find/fit/journey controls use this path.

The menu does not add a clipboard content interchange format, source writeback,
backlink index, suite backup, or arbitrary document/board/table conversion.
