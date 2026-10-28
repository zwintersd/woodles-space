# Boards Compose

Compose adds board-local expression and composition tools while retaining Cards,
Slips, photos, stacks, frames, portals, connections, and the original image editor.

## Lettering and paper

Use **Text** in the dock, or press **T**, for words directly on the board. Lettering
has four local font families: Book, Plain, Handwritten, and Typewriter. Appearance
also offers size, alignment, emphasis, line spacing, line highlighting, and label,
banner, or paper-strip backing. Text grows to its contents. The measured dimensions
are saved, including the chosen backing and border. A rotated text object's top-left
corner stays in place as its height grows.

Cards and Slips also offer lettering controls and clean paper, index card, sticky
note, torn-edge, and vellum treatments. Fill colours can be combined with these
papers. Plain Slips keep their original simple controls until styling is chosen.

Photos offer mats, outlines, corners, shadows, and captions. **Arrange** edits a
photo's optional caption. Its crop, internal rotation, shape, and original asset
remain independent of board appearance and positioning.

## Appearance

Select an object (Shift-click adds others), then use the palette icon for
**Appearance** or the layout icon for **Arrange**. The compact icon rail finds space
outside the selected material, clears the rotation handle and app chrome, and
docks near a viewport corner when a large spread fills the view. It hides when
the selection is offscreen and fades during object movement or resizing. Hover
labels, screen-reader names and keyboard navigation retain the control names.

Right-clicking board objects or their editable text uses the shared Woodles menu
both in standalone Boards and inside HomeSuite. Escape restores focus and the
text selection; Shift+F10 also opens the menu. Image editing is available through
**Edit image** in this menu. Other app controls keep their normal browser menus.

HomeSuite also offers Appearance through the context menu, inspector, and command
palette. Uncommon controls stay under **More details**. Preview changes before
**Apply**; **Cancel**, Escape, or clicking the board discards the draft. Close/Cancel
returns focus to the originating control. A mixed selection changes only the
controls used, retaining the objects' different existing treatments.

**Copy look** copies one object's appearance for this session. **Paste look**
previews it on another selection; **Original** restores default appearance. Save
up to twelve colours with a board. Saved-colour changes are separate undoable
actions, so keeping a favourite does not require applying the object preview.

## Arrange and layers

**Arrange** beside a selection provides front/back/forward/backward, group/ungroup,
lock/unlock, alignment, equal spacing, rotation, and optional alignment snapping.
**Layers** lists objects from front to back and can find or unlock buried objects.
Selecting an object never changes its paint order. Connections retain their
existing plane below the other objects. A stack's Cards and Slips remain above the stack.

Groups are flat, board-local memberships, not new artifacts. Clicking a member
selects the group; dragging or nudging moves it together. Alignment treats a group
as one unit and retains its internal spacing. A new group can combine existing
groups; ungrouping leaves each object independent in its current position. A group
with only one surviving member dissolves on document repair.

Duplication creates independent objects, fresh group IDs, and new internal
connections. Source links and original image assets remain references. Duplicating
a stack also duplicates its Cards and Slips with remapped membership. Deleting a group
removes its selected members and their connections; deleting a stack preserves the
existing behaviour of releasing its notes. Undo restores these edits together.
Cards and Slips inside a stack use its layout and cannot be grouped independently;
extract a note before grouping it with other material. Grouped notes do not fall
into a stack accidentally while their composition is being moved.

Photo deletion retains original image data while undo/redo history or another
board still references it. Restoring an edit also restores its image surfaces,
and restoring then reloading keeps the original asset available.

Locking protects canvas editing, movement, rotation, styling and deletion. Group
members lock together; a locked stack also protects its Cards and Slips. Unlock in Arrange
or Layers, or undo the lock. There is no attachment relationship in this increment:
future attached decoration will travel with its owner, while a group will remain
an independently managed selection. Adding attachments must define duplication,
owner deletion, undo and reload before introducing any new stored relationship.

## Slips in Stacks

Drag a Slip into a Stack to place it in the shared Card/Slip order. The Stack
highlights and shows an insertion marker before release. Slips keep their compact
height, fit the Stack's width, and grow to wrapped text. Gallery rows accommodate
taller Slips without overlap. Checklist, queue and status behaviours include Slips.
Drag within the Stack to reorder, or outside it to recover the Slip's free width
and angle. Conversion to a Card keeps its identity, connections and place.

Placement finishes with a brief, softly overshooting pop; multiple notes settle
with a small stagger. Reduced motion skips this animation. Membership and ordering
persist through undo, redo, reload and HomeSuite sync; animation is never saved.

## Rotation geometry

Board rotation is separate from rotation inside a photo. Free Cards, Slips,
lettering, images and portals can rotate; frames and stacks remain axis aligned.
A stacked Card or Slip retains its angle but displays upright until extracted.

The round handle turns an object, gently snapping near multiples of 15 degrees;
Shift holds those steps. Its keyboard controls adjust by one degree, or fifteen
with Shift; Home returns to zero. Arrange also accepts an exact angle. With several
objects selected, that control sets each object's angle in its own position.

Native hit testing and selection rings follow the rotated object. Marquee
selection, alignment, snapping, search extents, minimaps, finding an object and
fitting the board use its conservative rotated bounding rectangle. Resize works
in the object's axes and retains the opposite rotated corner. Connections remain
attached to object centres as before, including through movement, resizing,
rotation and Slip conversion. Export will need to consume these same bounds when
that later release begins.

## Keyboard and persistence

- T: add lettering. R: Arrange. L: Layers.
- Ctrl/Cmd+G: group; Shift+Ctrl/Cmd+G: ungroup.
- Arrow keys nudge a free selection; Shift uses ten-pixel steps. Stacked Cards and Slips keep
  their existing Shift+Left/Right column navigation.
- Escape closes a tray and restores focus. Controls own their wheel gestures.
- Existing undo, redo, find and save shortcuts continue to work.

Schema 10 lets Slips share stack membership and saved free positions with Cards.
The existing ordered membership field remains compatible with earlier Cards.
Schema 9 adds lettering and optional rotation, locking, flat grouping, explicit
layer order and photo captions. Schema 8's optional appearance/swatches remain
compatible. Earlier documents migrate without receiving styling. Migration drops
unreadable optional appearance/composition data rather than discarding content.
Current saves use the existing validation and backup recovery.

Appearance uses validated hex colours, finite ranges and fixed choices. History
snapshots copy appearances and saved swatches independently. Content, identities,
source links and connections survive styling and Slip conversion. Appearance
previews never write draft appearance or measured text heights to storage.
Applying typography updates the saved geometry as part of the same undoable edit.
Snapping is a device view preference; it is optional and remembered after reload.
Opacity stops at 20% so objects remain recoverable.

## Validation

Run from `woodles.space`:

```powershell
pnpm --filter whiteboard test
pnpm --filter whiteboard check
pnpm check:e2e
pnpm --filter whiteboard build
pnpm --filter homesuite test
pnpm --filter homesuite check
pnpm --filter homesuite build
$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\brian\AppData\Local\ms-playwright'
pnpm exec playwright test --config e2e/whiteboard.config.ts
```

The dedicated browser configuration serves this checkout on port 5199 and uses
isolated browser contexts. The suite covers desktop/narrow layouts, appearance
preview/apply/cancel, keyboard focus, multi-selection, copying looks, saved colours,
undo/redo/reload, original image and edit preservation, HomeSuite context commands,
lettering and search, group movement/duplication/lock recovery, stable layer order,
rotation handles and rotated resizing, paper treatments, alignment/snapping, photo
captions, rotated text growth, grouped-photo deletion/undo/reload, selected-text
context menus, adaptive icon placement for clipped and full-view stacks, and Slip
placement/reordering/extraction/conversion with mixed Stack contents. Narrow-screen
placement and reduced-motion animation preferences are covered too. It also
fails on unhandled browser errors. HomeSuite's sync tests include a Compose
document round trip retaining the new fields.
Screenshots are written to `test-results`.

Drawing, scrapbook materials and kits remain Release 2. Page boundaries, reusable
spreads, export and presentation remain Release 3.
