# Folder organization

HomeSuite folders group top-level documents, boards, and Collections. Each file
has at most one folder; its app, kind, and id remain its identity. Organization
does not change source content, timestamps, Collection membership, or editor
undo history.

- **All files** shows every live file, with its folder path.
- **Unfiled** shows live files without a folder.
- A folder shows its immediate files and subfolders, with breadcrumbs to its
  ancestors. Its location is in `?folder=<id>`; `?folder=root` opens Unfiled.
- New files and folders are created inside the folder being viewed.
- File actions include **Move to folder…**. Checkboxes support moving multiple
  files together. Folder actions support rename, move, and removal.
- Removing a folder lifts files and subfolders to its parent. At the top level,
  files become Unfiled. Conflicting subfolder names receive a numeric suffix;
  nothing in an owning app is deleted.
- Trash hides files without clearing placement, so restoring a file returns it
  to the same folder. If its folder was removed, the lifted placement applies.

`src/lib/folders.ts` stores a versioned library at
`woodles.homesuite.folders.v1`, using `@woodles/persistence`. Every mutation reads
the current saved library, checks destinations and name conflicts, and reports
storage errors. The library validates references and the parent graph and
rejects cycles. Unreadable saves are never replaced with an empty library.
Storage events update other HomeSuite tabs, including an open editor's folder
context. Existing libraries need no migration: all files begin Unfiled.

This organization is local to the browser, like HomeSuite's existing libraries.
