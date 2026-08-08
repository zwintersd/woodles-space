# handoff — the reference spine, and where Write fits

what was built connecting Carillon and Thinking About, what to know before
touching it, and a design for extending the same spine into Write so that
writing can reach the things you're thinking about (`#`) and the days you're
living through (`@`).

read [REFERENCES.md](./REFERENCES.md) first for *why* any of this exists —
this file assumes it. [ARCHITECTURE.md](./ARCHITECTURE.md) is the source of
truth for how it's wired; anything here that contradicts it is out of date.

---

## 1. what landed

Six steps, on `claude/carillon-thinking-about-connect-9xuh3n`.

| # | what | where |
| --- | --- | --- |
| 1 | **addressing** — `entityHref(appId, kind, id)` → `<publicPath>?<kind>=<id>` | `packages/app-manifest` |
| 2 | **the shelf** — Thinking About publishes what you're in the middle of; Carillon picks from it in the task composer | `apps/thinking-about/src/lib/shelf.ts`, `apps/planner/src/lib/thinkingAboutShelf.svelte.ts` |
| 3 | **deep links both ways** — `?entry=`, `?thinking-about-entry=`; arriving shows what's already scheduled | `apps/*/src/lib/deepLink.ts`, `arrival.svelte.ts` |
| 4 | **commitments** — Carillon publishes when a thing is scheduled; the board shows it | `apps/planner/src/lib/commitments.ts` |
| 5 | **sittings** — observing offers to log a session, dated the day it happened | `apps/planner/src/lib/sessions.ts`, `apps/thinking-about/src/lib/sittings.ts` |
| 6 | **standing slots** — a Thursday watch date draws itself on the calendar | `StandingSlot` in Thinking About, derived in `store.getBlocksForDate` |

### the four ideas worth carrying forward

**A reference, never a copy.** A Carillon task stores `thinkingAboutEntryId`,
not a copied title — so a rename can't leave the planner lying, and marking a
block observed later knows exactly which entry it was. But the task keeps its
own title too, so when the reference goes **cold** (archived, deleted, not
synced here) the words somebody typed survive. That asymmetry is the whole
design: *the link is disposable, the writing is not.*

**One writer per ledger.** The app that owns data publishes it; a reader that
needs to answer gets its own ledger in the other direction. This is why
Carillon publishes commitments instead of writing sessions into Thinking
About's store — that store syncs with whole-blob `isNewer`, which would have
been free to clobber a foreign write. Step 4 is the case the rule was written
for in step 2.

**Derived, never authoritative.** Every ledger is rebuilt from its source on
each save *and on load*. The "on load" half is not redundant: a derived ledger
written only on save leaves an app that nobody has edited publishing nothing,
and a reader honestly reporting emptiness for a board plainly full of things.
That bug shipped in step 2 and was caught by the step-3 e2e test.

**Deterministic ids do the deduplication.** `session-<entryId>-<date>`,
`ta-<entryId>`, `carillon-spore-<id>`. No queue needs draining, because
re-reading a ledger produces the same ids and the reader recognises them.

### the three ledgers, at a glance

| ledger | writer → reader | sync key | localStorage |
| --- | --- | --- | --- |
| shelf | Thinking About → Carillon | `thinking-about-shelf` | `thinking-about.shelf.v1` |
| commitments | Carillon → Thinking About | `planner-commitments` | `planner.commitments.v1` |
| sittings | Carillon → Thinking About | `planner-sessions` | `planner.sessions.v1` |

Shapes and keys live in `packages/sync/src/crossAppBlobs.ts`; the machinery
(`createLedgerPublisher`, `readLocalLedger`, `pullLedger`,
`mirrorLedgerLocally`) in `packages/sync/src/ledger.ts`.

---

## 2. before you touch it

- **`pnpm test` stops at marginalia**, which has two pre-existing failures —
  timeouts in `src/lib/witch/sim.test.ts`, unrelated to any of this and
  present on a clean `main`. Filter to what you're changing.
- **e2e needs a Chromium override in some containers.** The repo's
  `playwright.config.ts` is correct; if the pinned browser build is missing,
  run against a temporary config that sets `launchOptions.executablePath`, and
  delete it after. Do not commit one, and do not run `playwright install`.
- **`e2e/carillon-thinking-about.spec.ts` seeds localStorage only when
  absent.** `addInitScript` runs on every navigation, so unconditional seeding
  silently resets state on reload and hides exactly the persistence a test is
  checking. It also stubs third-party fonts with an empty 200 — an `abort()`
  is itself a failed request and trips `expectNoPageErrors`.
- **A cross-app integration test per ledger is not optional.** Every unit test
  passed while step 2 was broken. Each half was correct about what it wrote
  and what it read, and the two still failed to meet.

---

## 3. Echoes stops being public — ✅ built

**Decided: nobody is reading it, and the thing that works about it is the
opposite of publishing.** An archive of finished writing that you re-read,
annotate and edit — by the self, for the self — is a different product from a
public reading room, and a better one. Making it private is mostly deletion,
and it unblocks the Write design in §5.

### 3.1 what actually has to move

`/api/public` has **two independent tenants**, so this is a tenant leaving,
not a demolition. Bestiary's gallery is genuinely public-facing and stays
exactly as it is.

| piece | today | after |
| --- | --- | --- |
| `write/publish.ts` | builds `EchoesPublicBlob`, filters `public === true` | gone; every letter is yours |
| `StoredLetter.public` | per-letter opt-in | gone |
| `EchoesPublicBlob`, `ECHOES_PUBLIC_SLUG` | `packages/sync/src/publicBlobs.ts` | retire; `PublicCreature` stays |
| `apps/letter/index.html` | hand-rolled unauthenticated fetch | same fetch, plus the passphrase |
| `marginalia` reading room (`echoesLibrary.svelte.ts`) | `pullPublic('echoes', …)` | authenticated pull, or drop the feature |
| letters storage | `published` table via `/api/public` | `/api/sync`, under a real `write` blob |

That last row is the quiet win. **Write currently has no private blob at all**
— its sync adapter's `read`/`write` are no-ops, kept only to reuse
`createAppSync`'s passphrase handling for gating the publish button. Moving
letters onto `/api/sync` gives that file a real job and deletes a stub.

`apps/letter/index.html` is static with no build step, which is why it
hand-rolls its fetch instead of importing `@woodles/sync`. That doesn't
change: it just adds an `Authorization: Bearer` header read from the shared
`woodles_sync_passphrase` key on the same origin. Echoes then shows nothing until the passphrase is
connected. That is the point rather than the price: the archive is private
magic, and it stays shut until it knows you.

### 3.2 what Echoes becomes

The annotation model is **already built**. `PublicLetter` carries
`annotations: { pocketNotes, marginNotes }`, designed for public display and
much better suited to private re-reading. Echoes as a self-archive is the job
that model was always shaped for:

- Write composes. Echoes is where a finished piece is **re-read over time**,
  annotated in the margins, and edited without the pressure of a draft.
- Because it's private, an Echoes letter can carry **live references** (§5) —
  which turns the archive into something navigable by what it's about:
  *everything I wrote about Piranesi*, *everything I wrote on this day.*

That last property is what makes killing publicity worth doing before the
Write work rather than after.

---

## 4. bestiary's card id, early — ✅ built

`?card=<id>` already exists — read in `apps/bestiary/src/routes/+layout.svelte`
and built by hand in `PublishedCardPanel.svelte:37` as
`` `${location.origin}/bestiary?card=${encodeURIComponent(creature.id)}` ``.
It is exactly the hardcoded-path pattern step 1 exists to replace.

The chore is ten minutes: `addressableBy: ['card']` on the bestiary manifest
entry, swap the string for `entityHref('bestiary', 'card', creature.id)`, and
the contract test starts covering it.

**Do it before the `#` picker, not after** — and for a structural reason, not
tidiness. A picker built against the shelf alone hardcodes one source. A
picker built against a **registry of reference sources** takes a second source
for free, and a creature is the obvious second thing you'd want to name in
prose after a book.

```ts
type ReferenceSource = {
  app: string;           // manifest app id
  kind: string;          // a kind that app declares in addressableBy
  sigil: '#' | '@';
  list(query: string): ReferenceCandidate[];   // for the picker
  resolve(id: string): ReferenceCandidate | null; // live, may be null
};
```

Three sources on day one — Thinking About entries, bestiary cards, dates —
and Echoes letters become a fourth almost free once §3 lands. Each is a few
lines because `readLocalLedger` / `pullLedger` already do the fetching.

---

## 5. Write, `#`, and `@` — ✅ built

### 5.1 what §3 changes about this

The earlier version of this design was built around a constraint that no
longer exists. When Write published to a public Echoes, a reference in prose
had two failure modes: it **leaked** what you were reading to a stranger, and
it **could not resolve** in a browser with no access to your shelf. Both
forced the same compromise — flatten every reference to plain text on publish,
and never render anything live.

With Echoes private, both evaporate. The only reader is you, on a device that
either has the ledgers or can pull them. So:

**References resolve live.** `#Piranesi` renders the entry's *current* title
and colour. Rename the book in Thinking About and every letter that mentions
it updates. That's the whole point of a reference over a copy, and it was
unavailable while the audience was strangers.

### 5.2 the one thing to keep from the old design

Store the display text anyway.

```html
<a class="ref" data-ref-app="thinking-about" data-ref-kind="entry"
   data-ref-id="e-piranesi">Piranesi</a>
```

Not for privacy any more — for **cold references**. Delete the entry and the
sentence still has to read as a sentence. Render the live title when it
resolves, fall back to the stored text when it doesn't. That is exactly
marginalia's binding pool (resolve against a pool that may not be there)
applied to prose, and exactly the Task decision from step 2: *the link is
disposable, the writing is not.*

It also means text pasted out of a letter still says something.

### 5.3 the sanitizer

Write's body is a rich contenteditable, so a reference has to survive
`sanitizeHtml`. Spores dodged this by storing `[[wikilinks]]` in plain text and
rendering *segments*, with no sanitizer on the read path at all — Write can't
take that route.

Fine, because the policy is **already parameterised**: `@woodles/text` takes
whether to keep `data-anchor` as an argument rather than picking a winner
(REFACTORING.md's two divergences). Allowing `data-ref-*` is the same shape of
change, not a fork.

### 5.4 what `@` should mean

`#` names a thing. `@` is ambiguous, and the temptation is to make it mean
everything. In build order:

1. **A day.** `@2026-08-13`, rendered "Thursday". A date is the one identity
   every app here already shares — Carillon keys observations, sleep logs and
   commitments by `YYYY-MM-DD`; Thinking About dates every session. No new
   ledger, and it's the reference most likely to still make sense in a year.
2. **A commitment.** `@read a chapter` from the commitments ledger. Already
   published, but narrow — only covers tasks that are about media.
3. **An observation or a block.** Probably wrong: an observation is a
   fifteen-minute sample, and prose almost never wants that granularity. A day
   is the unit people write about.

### 5.5 the fourth ledger, and the loop it closes

Once Write publishes **what it wrote about** — `{ draftId, title, refs: [{app,
kind, id}], dates: [...] }` — the spine closes in the direction still open:

- Carillon's Edition Review shows *"you wrote about this day"* beside the
  observations for it.
- Thinking About shows *"you wrote about this"* on an entry, beside the
  sittings and the scheduled times.
- Echoes, now private, becomes navigable **by reference**: every letter that
  mentions this book, this creature, this day.

Same shape as the other three: one writer, derived from drafts on save,
deterministic ids, rides `/api/sync` behind the passphrase.

### 5.6 suggested order

| # | step | notes |
| --- | --- | --- |
| 1 | ✅ **Echoes goes private** (§3) | mostly deletion; unblocks live references |
| 2 | ✅ **bestiary card through `entityHref`** (§4) | ten minutes, and forces the source registry |
| 3 | ✅ `data-ref-*` through `@woodles/text`'s sanitizer, as a parameter | the enabling change |
| 4 | ✅ reference source registry + `#` picker | entries and days wired; a card is a few lines |
| 5 | ✅ `@` picker over dates | no new ledger; renders `YYYY-MM-DD` as a weekday |
| 6 | ✅ "what I wrote about" ledger, read by Carillon and Thinking About | the loop closes |

### 5.7 things that will bite

- **Write's layers are never unmounted** — each contenteditable *is* the
  storage between saves, and a page is hidden with CSS rather than removed.
  Anything that re-renders a reference must not remount a layer.
- **Live rendering inside a contenteditable is genuinely fiddly.** Resolving a
  title must not move the caret or dirty the document. Prefer rendering the
  live title into a non-editable child (`contenteditable="false"`) so typing
  can't land inside it, and keep the stored text as the element's own content.
- **Drafts don't sync** (until §3 gives Write a real blob, and even then that's
  letters, not drafts). The *ledgers* sync, so resolution works on a device
  where the draft doesn't exist.
- **A cold reference in prose must stay readable.** Test it the way the arrival
  sheet is tested: delete the entry, then look at the sentence.
- **`#` and `@` are typed characters.** "#1 priority" and an email address must
  not open a picker. Trigger on the character plus a boundary, and let Escape
  dismiss without eating the keystroke.
- **The manifest tripwire is real.** If Write becomes addressable, declare the
  kind in `addressableBy` *and* read that parameter, or the contract test
  fails. It matches the parameter name as a quoted literal anywhere in the
  app's source, so naming it in a constant is fine.
- **Don't let `/api/public` rot.** Bestiary still uses it, and the 4 MB cap,
  the cache headers and the `authed()` split all still matter for that tenant.
  Removing Echoes from it is a deletion of *usage*, not of the endpoint.
