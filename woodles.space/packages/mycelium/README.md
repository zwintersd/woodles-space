# Mycelium people

Mycelium owns the canonical contact records. This framework independent package is the shared read boundary for the Mycelium editor, HomeSuite, Write, Data, and future Woodles apps. No app imports another app's source files. It creates no sample contacts and connects to no external address book.

## Identity and ownership

Use the full `WoodlesRef { app: 'mycelium', kind: 'person', id }` from `personRef(id)`. Names, emails, phones, tags, and card styling are editable content; none are identities. `updatePerson` keeps the person's ID and creation date. `resolvePerson` checks the app and kind as well as the ID, and returns `null` for a deleted person or a reference owned elsewhere. Each email, phone, and link also has its own stable ID.

Other apps store the reference and resolve the current person through this package. A picker or Data table may show a derived snapshot, but that snapshot does not become another canonical contact. Removing a reference, removing a person from a collection, or moving a folder must not delete or edit the source person. Permanent source deletion is an explicit Mycelium action. Existing references then remain unresolved; this package does not cascade into other apps' storage.

These are same-origin, local browser records. Storage sharing requires the same scheme, hostname, and port. There is no server, account sync, or cross-device sharing in this version. References and previews do not grant access to data on another origin. Contacts contain personal information; exports contain all fields, including notes and portraits.

## Stored format

`MYCELIUM_STORAGE_KEY` is `woodles.mycelium.people.v1`; `MYCELIUM_STORAGE_VERSION` is `1`.

```json
{ "format": "woodles-mycelium", "version": 1, "people": [] }
```

People have a stable ID, name, pronouns, role, organization, labeled emails/phones/links, location, birthday, tags, notes, optional portrait, favorite state, complete Bestiary-derived `CardStyle`, and ISO `createdAt`/`updatedAt`. Birthday is empty or `YYYY-MM-DD`. An untouched optional text field is an empty string; portrait is `null`; lists are empty. The complete card styling engine, option lists, presets, normalizer, and CSS resolvers are exported from `cardstyle.ts`; the default accent uses the house pink. Presentation fields never change identity or the plain information available to consumers.

Records, nested items, dates, style values, duplicate IDs, format, and version are validated. Persisted/imported objects must contain exactly the supported keys: unknown fields fail closed so this version cannot silently erase a future version's information. A malformed or unsupported save produces `loadPeople().issue`, and all mutations/export refuse to proceed. Reads never repair, reset, migrate, or write a corrupt save. The original serialized data remains available for recovery.

The app combines Bestiary's complete card workshop with Carillon's plum instrument, warm paper, blush, sage, and bell-brass. The added `moon garden` and `bell & paper` presets are presentation only. They do not change identity or contact fields; the app never reads or changes Carillon's saved settings.

Portraits accept raster PNG/JPEG/WebP/GIF data URLs up to `MAX_PORTRAIT_LENGTH` (500,000 characters). Resize/compress photos in the editor before calling the store. Browser quota is shared with other Woodles data. Quota or denied-storage errors are exposed, and a failed write never reports success. This package deliberately avoids duplicating large portraits into another localStorage backup. Use the explicit JSON export for backups.

## API

```ts
import {
  createPerson, updatePerson, deletePerson, loadPeople, listPeople, getPerson,
  personRef, resolvePerson, subscribePeople, exportPeople, importPeople
} from '@woodles/mycelium';

const { people, issue } = loadPeople();
const person = createPerson({ name: 'Alex' });
updatePerson(person.id, { notes: 'An editable note' });
const ref = personRef(person.id);
const current = resolvePerson(ref);
const unsubscribe = subscribePeople(({ people, issue }) => { /* Refresh view. */ });
unsubscribe();
```

All calls are synchronous. `loadPeople(): { people, issue }` is the nonthrowing load boundary; empty data with an issue must be shown as a load problem, not a new empty address book. `listPeople`, `getPerson`, mutations, and export throw `MyceliumError` with an `.issue` when canonical storage cannot be trusted. `getPerson` returns `null` for an absent ID; `deletePerson` returns whether a person existed. `PersonInput` requires only `name`; optional fields receive defaults. Identity and timestamps cannot be passed as editable fields. An update replaces provided arrays/style as a whole; omitted fields remain unchanged.

Every mutation re-reads the canonical save and applies only its own change, so a stale view cannot overwrite another tab's unrelated records or fields. A second read before writing rejects a change detected during preparation. localStorage has no atomic compare-and-swap: truly simultaneous writes from separate browser processes cannot be fully serialized by this synchronous API. This is a local store, not a distributed transaction system. `subscribePeople` listens to successful same-page writes and relevant cross-tab storage events, and returns a cleanup function. Reads always resolve current storage instead of holding a shared stale cache.

`exportPeople()` returns a versioned JSON document. `importPeople(json)` validates the entire document before writing, and returns `{ people, added, updated, unchanged }`. Import is additive by stable person ID: new IDs are added; a later `updatedAt` replaces the current record; equal/older timestamps keep the local record. The earliest creation date is preserved. Other local people stay present. Imports do not deduplicate by name/email, generate new IDs, or delete absent records. Importing an older backup can restore a previously deleted person because this version has no deletion tombstones. Updated rows merge as whole records, not individual contact fields.

`createPeopleStore({ storage, now, makeId, eventTarget })` provides isolated stores for tests or another compatible persistence host. Browser consumers use the default exported functions.
