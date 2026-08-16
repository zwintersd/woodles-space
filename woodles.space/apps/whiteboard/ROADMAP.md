# whiteboard — the next primitives

a features roadmap for `apps/whiteboard`, drafted august 2026 — three days
after the app's first commit (`c4d45c5`, "Add Whiteboard Woodle", aug 13)
and the day after its last (`6bc5dbc`, "the board gets hungry", aug 15).
read alongside [ARCHITECTURE.md](../../ARCHITECTURE.md)'s "the navigable
board" section, which is the source of truth for what already exists; this
file only proposes what doesn't.

grounded in the actual code as of this write-up, not aspiration: 207 tests
pass (`pnpm --filter whiteboard test`), schema is at version 5
(`BOARD_SCHEMA_VERSION` in `model.ts`), the app is live at `/whiteboard`.
every item below cites where it lives, or where it would.

## what's here, briefly

six kinds of thing on one big canvas — card, image, frame, stack,
connector, portal — plus a camera that flies between them instead of
cutting (`camera.ts`), a shelf of boards instead of one (`library.ts`), an
optional property sheet any item can grow into (`properties.ts`), reusable
labels (`labels.ts`), weighted search (`search.ts`), journeys the camera
can play back (`journey.ts`), stacks that behave like status columns,
checklists, queues, or galleries (`geometry.ts`), doorways between boards
(`portals.ts`), and a paste/drop inbox (`capture.ts`). all of it local: a
versioned `localStorage` document per board, image blobs in IndexedDB
(`assets.ts`), no accounts, no server.

that's a lot of primitives for eleven commits. most of what follows is
about finishing and connecting what's already there, not adding a seventh
shape.

## the roadmap, in order

roughly ordered by how much it costs against how much it's currently
missed — cheap-and-load-bearing first, expensive-and-speculative last.

### 1. undo ✅ shipped

there is no way to undo a document edit. ⌥←/⌥→ (`camera.ts`'s
`CameraHistory`) replay *where you looked*, not *what you did* — select six
things and hit Backspace (`deleteSelection`, `+page.svelte`), and there is
no confirmation and no way back. it isn't just gone from the board, either:
deleting an image card queues its underlying blob for removal from the
IndexedDB asset store (`pendingAssetDeletes` in the same function) — a
slip of the Delete key can cost you the picture, not just its placement.
retyping a card is the least of it.

for a canvas meant to hold real time-on-task, that's the gap that makes
everything else feel provisional. the shape of a fix: a bounded stack of
document snapshots pushed on every committed mutation. `snapshotDocument`
in `model.ts` already exists for exactly the cheap-deep-copy job undo
needs, and every edit already funnels through a small number of setters in
`+page.svelte` — one choke point to hook, not a rewrite. ⌘Z / ⇧⌘Z, scoped
to the open board; camera moves stay out of it, same as they're already
out of save.

**what actually shipped:** a new `history.ts` — deliberately not named or
shaped like `camera.ts`'s `CameraHistory`, since the two solve different
problems (this one has no notion of "the live position between marks").
`recordEdit(history, board, coalesceKey?)` snapshots the board *before* a
mutation; every one of the ~30 places `+page.svelte` commits a document
change now calls a small `beginEdit(coalesceKey?)` wrapper first — the
"one choke point" from above turned out to be closer to two dozen, since
label/journey/viewpoint/property edits each go through their own setter,
not through `setItems`. what stayed a single choke point: the *coalescing*
rule. typing into a card, a frame title, a viewpoint name, a label name, or
the hold-seconds field calls `beginEdit` on every keystroke, but passes a
key (`` `card-${field}:${id}` `` and siblings) so a burst within 800ms
merges into one step — a sentence is one undo, not one per letter. a drag
or resize records once at the pointer-down that starts the gesture, before
any frame of movement, so the whole drag is one step regardless of how
many animation frames it took. board-switch and initial load reset the
history outright (`editHistory = createEditHistory()`, next to where
`history = createCameraHistory(...)` already did the same for camera
moves) rather than letting undo reach across boards. `⌘Z` / `⇧⌘Z`, gated
behind the same `isTextTarget` check `⌘S`/`⌘D` already used, so undoing
while focused in a text field falls through to the browser's native
per-field undo instead of rewinding the whole board. picked up `⌘A`
(select everything but connectors) alongside it, and documented `⌘D` and
Delete/Backspace in the shortcuts panel — both real, both previously
missing from `?`. 12 new tests in `history.test.ts`; 219/219 pass.

### 2. connectors get their second pass

every other primitive got a follow-up commit that gave it depth after
being born plain — cards grew the property chip row ("cards that can say
more than they show"), stacks grew behaviors ("stacks that can do more
than hold cards"), portals grew a trail. connectors never did: a
connector is still exactly what `createConnector` made on day one —
`fromId`, `toId`, `arrow`, nothing else.

the interesting part is that the gap isn't in the data model. the Details
drawer's Color/Status/Type/Source/Labels sections apply to whatever is
`chosen` regardless of item type, so a connector can already pick up a
`tint`, a status, a label through the ordinary UI. it just doesn't show:
`.connector-path`'s stroke in `+page.svelte` is a single hardcoded color
that only changes on hover or selection, never reading `colorOf(connector)`
the way every other tinted item does. so coloring a connector today is a
silent no-op — worth fixing on its own, regardless of anything bigger.
whether connectors deserve more than color — a label rendered at the
midpoint, a waypoint or two so a line can route around whatever's between
its ends instead of `connectorEndpoints`'s straight chord
(`geometry.ts`) — is a bigger, separate call, worth making only once color
alone proves the small fix isn't enough.

### 3. close the handoff loop

`whiteboard` is a registered `HANDOFF_TARGETS` receiver
(`packages/handoff/src/index.ts`) — its Inbox drains the queue on open,
and the mechanics are tested. but workspace-wide, nothing calls
`sendHandoff(` outside of test files — grepped for it; zero real callers.
the package's own comment says why whiteboard joined the target list: "a
thought that wants room around it rather than a line in a draft is the
other half of 'put it anywhere, move it later.'" that other half has never
actually been built for anyone to use.

`write` is the natural first sender: it's already the front door
(ARCHITECTURE.md, "the writing surface"), already owns a capture surface,
and already imports the same package to *receive*. a "send to a board"
action alongside wherever `write` currently resolves where a capture
landed would close a loop the codebase has been carrying open since
whiteboard's first commit — small, concrete, and it's the one item here
that makes another app better too.

### 4. search the shelf, not just the board

`search.ts` takes a single `WhiteboardDocument` — there's no way to find a
card by searching across boards, only within whichever one is open. a
non-issue for one board; it stops being one the moment the shelf
(`library.ts`) holds more than a couple. the shelf already keeps a
lightweight `BoardSummary` index (title, item/frame counts, `updatedAt`)
outside any single document, which is enough for a first pass — search
board titles from the shelf view before taking on the bigger job of
indexing card text across boards that aren't currently loaded.

### 5. export a board — or a frame — as an image

no PNG, no PDF, no "save as image" anywhere in the app. the bestiary
already solved the adjacent problem (root [ROADMAP.md](../../ROADMAP.md),
week 4): render the finished thing to a canvas and hand back a file, no
server involved. whiteboard's version would rasterize whatever's on
screen, or a chosen frame's bounds, client-side — no publish flow, no
sync. it's most of what someone reaching for "share this board" actually
wants, without taking on the bigger commitment below.

### 6. a public read path — later, and only if a board earns it

every other public-facing app in this workspace — the bestiary,
marginalia, echoes — went through the same shape of change (root
[ROADMAP.md](../../ROADMAP.md)): a `published` snapshot, an
unauthenticated `GET`, a read-only view. whiteboard hasn't; it doesn't
import `@woodles/sync` at all and has no server surface whatsoever. that's
probably right for now — a personal thinking-and-arranging tool has a less
obvious "gallery" moment than a bestiary or a witch game — but if a board
is ever something Z wants to *show* someone rather than describe, the
pattern to follow already exists and already respects the workspace's
rule against visitor writes. this is the one item on this list that's a
real new subsystem rather than a finish on an existing one; it should wait
until something above earns it, not lead.

## smaller, whenever

- **the accessibility audit doesn't cover it.** `e2e/accessibility.spec.ts`
  runs axe against `/`, `/write`, `/letter`, `/marginalia/arcade`,
  `/hygge/motion`, `/hygge/motion/svg` — not `/whiteboard`. adding it is a
  one-line change to `auditRoutes`; whatever it turns up is the real next
  step, but the line should go in regardless of what it finds.
- **no dedicated mobile or small-viewport pass.** the canvas runs on
  pointer events throughout, so pan/zoom/drag likely already work on a
  touchscreen, but nobody's sat with it on a phone the way the root
  roadmap's weeks 6 and 8 did for marginalia's witch screen and arcade.
  worth doing once there's a reason to expect visitors on small screens —
  see item 6, above.
- **card bodies are plain strings.** `write` and `marginalia` already lean
  on `@woodles/text` to sanitize and read real HTML; whiteboard's cards
  don't, so there's no bold, no inline link, no checkbox inside a card's
  body today. `@woodles/text` gets you the sanitizer, not an editor —
  `write`'s contenteditable machinery is its own thing and bigger than a
  card needs. if this happens, it should be a small, card-shaped slice
  (bold, italic, a bare link), not an import of write's whole editing
  stack.
- **no board export or import as a file.** `library.ts`'s `duplicate`
  copies a board *within* the shelf, but there's no way to get a board out
  as JSON and back in on another device, or after clearing site data.
  small, and only worth doing once losing a board to a cleared browser has
  actually happened to someone.

## deliberately not proposing

- **real-time multiplayer.** every app in this workspace is single-user
  and local-first by explicit design (root ROADMAP.md: "no visitor writes
  to the server"). a shared cursor is the single biggest architecture
  change anything on this page could suggest, and nothing above needs it.
- **accounts, or any login.** would contradict every other app here.
- **a seventh shape.** card, image, frame, stack, connector, portal
  already cover card, container, and connective needs; this roadmap is
  about depth, not width.
- **AI-anything** — auto-layout, summarizing a board, suggested
  connections. none of the workspace's other apps reach for this, and a
  spatial-thinking tool is exactly the place where "the model arranged it
  for you" would undercut the point of arranging it yourself.
