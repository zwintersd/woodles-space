# local-first persistence contract

`@woodles/persistence` owns storage mechanics, not application state. Domain
stores keep their own types, mutations, validation rules, and sync adapters.

## contract

A durable local document should have all of these:

1. A named schema version and an explicit migration path from every supported
   older version.
2. A runtime validator at the app boundary. TypeScript types alone do not make
   browser storage or imported JSON safe.
3. A last-known-good backup. A valid primary is copied before it is replaced;
   an invalid primary is restored from that backup on load.
4. A visible failure state. Quota, disabled-storage, and write errors are
   returned to the app rather than swallowed.
5. An envelope-based JSON export and a validated import path that use the same
   migrator as browser storage.
6. Tests for migration, corrupt-primary recovery, invalid import rejection,
   export/import round trips, and write failure.

The shared package provides `createVersionedStorage`, UTF-8 size reporting,
human-readable byte formatting, and the browser storage estimate API. It does
not know what a note, creature, task, spore, or world is.

## current adopters

- `notebook` is the reference localStorage adoption. Its four legacy v1 keys
  migrate into one schema-v2 workspace document. The UI exposes save/recovery
  state plus JSON export and import.
- `bestiary` keeps its image-heavy collection in IndexedDB. It validates the
  stored collection, keeps a last-known-good shelf, reports collection and
  origin usage, and exposes write failures in the existing sync/export panel.

Other stores should adopt this contract when they are next changed. Migrate
one domain at a time; do not centralize the domain stores or couple their
release schedules.

## reference shape

```ts
const persistence = createVersionedStorage<MyDocument>({
  key: 'my-app.document.v2',
  version: 2,
  fallback: createEmptyDocument,
  validate: isMyDocument,
  migrate: migrateMyDocument
});

const loaded = persistence.load();
const saved = persistence.save(document);
const exported = persistence.exportText(document);
const imported = persistence.importText(exported);
```

The app must render `loaded.issue` and `saved.issue` when present. A fallback
value is for continuity, not evidence that persistence succeeded.
