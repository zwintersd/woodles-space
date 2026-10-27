# Compose, increment 1: appearance

The board can now carry a personal colour and treatment on its existing objects.
Select an object (Shift-click to add others), then choose **Appearance** beside
the selection. HomeSuite also offers it in the context menu, inspector, and
command palette.

The tray offers fill, text colour, and outline colour, with outline weight and
style, corners, shadow, and opacity under **More details**. Photos offer a mat
instead of text styling. Their outline sits outside the mat, keeping the image
viewport and existing crop/shape/rotation intact. Image shapes remain authoritative
over the photo's silhouette.

Changes preview on the board. **Apply** records one undo step; **Cancel**, Escape,
or clicking back onto the board discards the preview. Closing with the tray's
controls returns focus to its Appearance button. Selecting something else cancels
the draft. A mixed selection changes only the controls used, preserving different
fills or other treatments on each item. Connectors keep their existing tools.

**Copy look** copies one selected object's appearance for this session. **Paste
look** previews it on a new selection. **Original** restores the object's default
treatment. Content, source links, identities, stack membership, and connections
stay with their objects, including when a Slip becomes a Card.

Save up to twelve favourite colours with a board, and remove them under More
details. Saved colours are separate undoable actions; saving a colour keeps that
favourite even if the object preview is cancelled.

## Storage and history

- Board schema 8 adds optional flat `appearance` fields on objects and an optional
  board `swatches` array. Unstyled objects keep their previous rendering.
- Older documents migrate without adding appearance to their objects. Migration
  drops unreadable appearance or swatches while retaining content. The ordinary
  storage validation and backup recovery also protect current-schema saves.
- Colours are validated six-digit hex values, numerical fields have finite
  bounds, and style choices use fixed values. Appearance and saved colours are
  copied independently in document/history snapshots.
- Opacity stops at 20% so an object remains recoverable on the board.
- Preview is derived rendering only: it never writes draft appearance to storage
  or history. Undo/redo and switching boards dismiss pending previews.

## Validation

Run from `woodles.space`:

```powershell
pnpm --filter whiteboard test
pnpm --filter whiteboard check
pnpm --filter whiteboard build
$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\brian\AppData\Local\ms-playwright'
pnpm exec playwright test --config e2e/whiteboard.config.ts
```

The browser configuration serves this checkout on port 5199, and every test uses
an isolated browser context. The five scenarios cover preview/cancel and focus,
Apply/undo/redo/reload, multi-selection/copy/paste/saved colours, the narrow layout
and wheel handling, original image asset/edit preservation, and HomeSuite's
context-command flow. Desktop and narrow screenshots are written to `test-results`.

## Next increments from the handoff

This is the first reviewable increment, not all of Release 1. Standalone lettering,
layer order, locking, alignment, grouping, and material treatments remain next.
Object rotation must be implemented together with rotated bounds, connector
attachment, resizing, hit testing, and fitting. Grouping and attachment semantics
must be defined before either is introduced. Drawing, scrapbook kits, pages,
and export remain Releases 2 and 3.
