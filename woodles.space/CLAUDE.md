# working in this repo

read [ARCHITECTURE.md](./ARCHITECTURE.md) first — it's the source of truth
for how the workspace fits together, and points to the other docs that
matter for a given change: [REFACTORING.md](./REFACTORING.md) for
consolidation candidates, [CONVERGENCE.md](./CONVERGENCE.md) for why apps
merged the way they did, [HANDOFF.md](./HANDOFF.md) for the reference-spine
narrative, and each app's own `*.md` files for anything scoped to one app.

## before you end a session

if you shipped something a reader of woodles.space would notice — a new
route, a new feature, a real fix — add a dated entry to
[CHANGELOG.md](./CHANGELOG.md). it's hosted at
[woodles.space/changelog](https://woodles.space/changelog); that file's own
header has the convention. skip it for a pure internal refactor nobody
outside the repo would see, unless the refactor was the whole session.

## style

lowercase headers, terse prose, no filler, no restating what a well-named
identifier already says. match the voice already in ARCHITECTURE.md and the
rest of the docs rather than defaulting to a generic one.
