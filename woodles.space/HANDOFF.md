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

Six steps, six commits, all on `claude/carillon-thinking-about-connect-9xuh3n`.

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
  run against a temporary config that sets
  `launchOptions.executablePath`, and delete it after. Do not commit one, and
  do not run `playwright install`.
- **`e2e/carillon-thinking-about.spec.ts` seeds localStorage only when
  absent.** `addInitScript` runs on every navigation, so unconditional seeding
  silently resets state on reload and hides exactly the persistence a test is
  checking. It also stubs third-party fonts with an empty 200 — an `abort()`
  is itself a failed request and trips `expectNoPageErrors`.
- **A cross-app integration test per ledger is not optional.** Every unit test
  passed while step 2 was broken. Each half was correct about what it wrote
  and what it read, and the two still failed to meet.

---

## 3. Write, `#`, and `@`

The ask: while writing, `#` reaches a piece of media you're thinking about and
`@` reaches a specific event, time, or day. Both are references in prose —
which is the same problem the spine already solves, with one genuinely new
constraint.

### 3.1 what is already done for you

- **The shelf is the `#` index.** It already lists every active entry with an
  id, title, colour and column. Nothing new needs publishing.
- **Commitments are half the `@` index.** Dates, times, block titles, status.
- **`entityHref` makes a reference clickable** without hardcoding a path, and
  both apps already accept deep links, so `#Piranesi` can open the board on
  that entry and `@Thursday` can open the planner on that day.
- **The reader mechanics are shared.** `readLocalLedger` / `pullLedger` in
  `@woodles/sync` are plain functions; only the `$state` wrapper is app-local.
  Write's version is ~40 lines, mostly copied from
  `thinkingAboutShelf.svelte.ts`.

### 3.2 the constraint that decides the design

**Write publishes to Echoes, and Echoes is public.**

`apps/write/src/lib/publish.ts` filters letters with `public === true` and
`api/public.ts` serves them to anyone, unauthenticated, cached for five
minutes. So a reference embedded in prose has two failure modes that do not
exist anywhere else in this spine:

1. **Leakage.** `#Piranesi` in a published letter tells a stranger what you're
   reading. The reference's *display text* is the leak, not the id — and the
   display text is the part you actually wrote.
2. **Dangling resolution.** A published letter rendered in a stranger's browser
   cannot resolve `data-ref-id` against a shelf that only exists in your
   localStorage. Anything that renders live will render nothing.

Both point the same way: **a reference must degrade to the words you typed.**

```html
<a class="ref" data-ref-app="thinking-about" data-ref-kind="entry"
   data-ref-id="e-piranesi">Piranesi</a>
```

The display text is inside the element, not looked up. Strip the attributes
and you still have a sentence. That mirrors the Task decision — the link is
disposable, the writing is not — and it is the opposite of Spores, which
renders `[[wikilinks]]` as *segments* precisely so there is no sanitizer on
the read path. Write can't take that route: its body is a rich
contenteditable, so a reference has to survive `sanitizeHtml`.

Which is fine, because that policy is **already parameterised**: `@woodles/text`
takes whether to keep `data-anchor` as an argument rather than picking a winner
(REFACTORING.md's note on the two divergences). Adding `data-ref-*` to the
allowed set is the same shape of change, not a fork.

**The publish path should flatten by default.** `publish.ts` gets a pass that
turns every `.ref` into its own text content before the letter reaches
`/api/public`. Opt in per draft if you ever want the links public; default to
plain prose. This is the one decision I would not defer — it is much easier to
add before anyone has published a letter containing a reference.

### 3.3 what `@` should mean

`#` is unambiguous: it names a thing on the shelf. `@` is not, and the
temptation is to make it mean everything. Three candidates, in the order I'd
build them:

1. **A day.** `@2026-08-13`, rendered "Thursday". A date is the one identity
   every app in this workspace already shares — Carillon keys observations,
   sleep logs and commitments by `YYYY-MM-DD`, Thinking About dates every
   session. It needs no new ledger at all, and it is the reference most likely
   to still make sense a year later.
2. **A commitment.** `@read a chapter` resolving to a scheduled task, from the
   commitments ledger. Useful, already published, but narrow — it only covers
   tasks that are about media.
3. **An observation or a block.** Tempting and probably wrong: an observation
   is a fifteen-minute sample, and prose almost never wants that granularity.
   A day is the unit people actually write about.

Start with the day. It's the cheapest and the most durable.

### 3.4 the fourth ledger, and why it's the interesting part

If Write publishes **what it wrote about** — `{ draftId, title, refs: [{app,
kind, id}], dates: [...] }` — then the spine closes a loop it hasn't yet:

- Carillon's Edition Review could show *"you wrote about this day"* beside the
  observations for it.
- Thinking About could show *"you wrote about this"* on an entry, next to the
  sittings and the scheduled times.

That is the same shape as the other three (one writer, derived from drafts on
save, deterministic ids), and it's what would make Write feel like part of the
suite rather than a consumer of it. It is also where the privacy question
sharpens: this ledger rides `/api/sync` behind the passphrase and must never
be confused with the public Echoes blob. Keep them in separate files for the
same reason `crossAppBlobs.ts` sits beside `publicBlobs.ts` rather than inside
it.

### 3.5 suggested order

| # | step | notes |
| --- | --- | --- |
| 1 | `data-ref-*` through `@woodles/text`'s sanitizer, as a parameter | the enabling change; nothing works without it |
| 2 | flatten refs on publish | do this *before* step 3, so no letter can ever publish a live reference |
| 3 | `#` picker over the shelf, reference stored with display text | reuse `thinkingAboutShelf.svelte.ts` almost verbatim |
| 4 | `@` picker over dates | no new ledger; render `YYYY-MM-DD` as a weekday |
| 5 | a "what I wrote about" ledger, read by Carillon and Thinking About | the loop closes |

### 3.6 things that will bite

- **Write's layers are never unmounted** — each contenteditable *is* the
  storage between saves, and a page is hidden with CSS rather than removed.
  Anything that re-renders a reference must not remount a layer.
- **Drafts don't sync.** Write's sync adapter is a no-op used only for
  passphrase gating. A reference in a draft is same-device until that changes
  — though the *ledgers* sync, so resolution works even where the draft
  doesn't travel.
- **A cold reference in prose must stay readable.** Test it the way the arrival
  sheet is tested: delete the entry, then look at the sentence.
- **`#` and `@` are typed characters.** A person writing "#1 priority" or an
  email address must not get a picker. Trigger on the character *plus* a
  boundary, and let Escape dismiss without eating the keystroke.
- **The manifest tripwire is real.** If Write becomes addressable, declare the
  kind in `addressableBy` *and* read that parameter, or the contract test
  fails. It matches the parameter name as a quoted literal anywhere in the
  app's source, so naming it in a constant is fine.
