# Carillon observation notebook release

Implemented 18 October 2026 from `CARILLON_CODEX_HANDOFF.md`.

## Architecture and scope

Carillon remains a Svelte 5 application. Today is composed by `TodayInstrument.svelte`; the interval composer is `MomentarySample.svelte`. `PlannerStore` owns localStorage and the existing sync adapter exchanges a whole JSON blob through `/api/sync` with version checks and merge retries. Observations remain separate from tasks, routines, and plans.

Phase 1 is implemented. Phase 2 includes Five Contacts, the detailed event vocabulary, and retrospective links on a saved moment. The default sampling interval in this checkout is 15 minutes, rather than the handoff's assumed five; existing settings and bell behavior are preserved. Five-minute sampling remains supported and is exercised in browser tests.

## Files

All paths below are relative to `apps/planner`, except the browser tests.

| File | Change |
| --- | --- |
| `src/lib/components/MomentarySample.svelte` | Neutral optional panel; draft/save/reopen support for noticings and chosen loop links. Keeps the note, labels, and empty-note rule. |
| `src/lib/components/MomentDetails.svelte` | Unselected body, attention, and actions chips with optional text. Explicit loop selection/creation. Legacy ratings and personal trackers inside Additional trackers; selected values are explicit, never defaulted. |
| `src/lib/components/MomentDayReview.svelte` | Displays and searches noticing text, original detail notes, and linked loop names. |
| `src/lib/components/TodayInstrument.svelte` | Places the two optional tools below the existing sampler without adding navigation. |
| `src/lib/components/LoopNotebook.svelte` | Loop creation; unattributed notices; approach, related action, progress, pause, close, release, and reopen events. Optional occurrence time at entry, event history, and skippable closure reflection. |
| `src/lib/components/FiveContacts.svelte` | Explicit start; five-contact counter; optional contact note/link; Undo; early stop; completion reflection; saved history and cross-device overflow disclosure. |
| `src/lib/types.ts` | Additive optional observation fields and notebook entities. Occurrence, entry, lifecycle, and reflection modification times remain distinct. |
| `src/lib/store.svelte.ts` | Local persistence, transitions, repeat-resolution guards, reflection upsert, five-contact boundary, Undo tombstones, and hydration. |
| `src/lib/openLoops.ts` | Projects lifecycle from the event ledger and merges nested contacts, permanent overflow exclusions, and independently timestamped round reflections. |
| `src/lib/momentDetails.ts` | Cleans explicit noticing categories without inventing a rating or a loop link. |
| `src/lib/momentDetails.test.ts` | Explicit empty noticing, normalization, absent ratings, and unchanged historical midpoint coverage. |
| `src/lib/openLoops.store.test.ts` | Local persistence, historical fields, links, transitions, time integrity, reflections, stopping at five, Undo, and early exit. |
| `src/lib/sync.svelte.ts` | Includes all new collections in reads and merges; unions stable event IDs and derives loop status from their history. |
| `src/lib/sync.test.ts` | Stale-device preservation, closure/reopen projection, contact union, Undo/overflow, and independent reflection clocks. |
| `../../e2e/carillon-open-loops.spec.ts` | Browser capture, closure/release/reopen, skip/negative outcomes, timestamps, Five Contacts, legacy retention, responsive proof, and a simulated version conflict through the actual sync client. |
| `../../e2e/carillon-workbench.spec.ts` | Updates tracker interactions and stale schedule-dock selectors to the current binder navigation. |

## Walkthrough

1. **Resting Today:** “What's happening now?” remains the main prompt. Enter words and Save moment, with no required extras. The right panel offers three unselected noticing chips. Additional trackers is closed initially; no emotional scale endpoints are visible. On a phone the optional panel stacks below the composer.
2. **Unlinked sensation:** Choose In my body, enter “tight shoulders,” and save the moment. No loop is needed. The note appears in Day so far, is searchable, and can be reopened. A saved moment can later be linked to an existing loop or an explicitly created one.
3. **Closure:** New loop → enter “Reply to Mom” → Save loop. Open Your loops and choose Close loop or Let go. “What changed, if anything?” offers multiple qualitative choices, including less comfortable and no noticeable change. No change excludes other descriptors. A note and what feels possible are optional; Skip reflection saves no answer. Closing, release, and reopening retain their own events.
4. **Five Contacts:** Start Five Contacts independently of a sample. Count tiny contacts, optionally recording a note or loop. Switching is allowed. Undo corrects the last counted contact, including the fifth. The fifth ends the round and offers an optional reflection. Done returns to the resting tool; another round requires Start. A laundry loop stays open throughout unless explicitly resolved elsewhere.

Screenshot evidence is generated by the browser tests: `today-neutral-desktop.png`, `today-neutral-mobile.png`, `loop-closure.png`, and `five-contacts-complete.png` in their Playwright output directories. Copies are also supplied with the implementation report.

## Data retention and rollout

- No SQL migration or new endpoint is required. The existing JSONB snapshot accepts the additive fields.
- New local keys: `planner.openLoops.v1`, `planner.loopEvents.v1`, `planner.closureReflections.v1`, and `planner.fiveContactsRounds.v1`. Old blobs without them load as empty collections; existing observations and tracker definitions are retained.
- Existing Mood/Energy/Coping numbers remain unchanged, including old midpoints. Their original intent cannot be reconstructed. New untouched ratings have no numeric field; opening a tracker does not record an answer.
- Loops, events, reflections, and rounds merge by stable IDs. Contacts merge individually; Undo records survive stale snapshots. A merged round counts at most five. Additional offline contacts remain visible as evidence and never automatically replace an undone contact.
- Round reflection text has its own modification timestamp, including deliberate clearing, so unrelated contact edits cannot erase it. Event occurrence time is independent of the sampling window and entry time. Lifecycle follows entry order so a newly entered retrospective event is explicit rather than silently reordered by the bell.
- **Refresh Carillon on connected devices before using the new notebook.** An older JavaScript client still uses its old whole-blob writer and can drop fields it does not recognize. Updated clients preserve new collections when merging older snapshots.
- Cloud behavior was exercised through a simulated `/api/sync` server with version-conflict responses. No production account, database, or deployment was changed or live-tested.

## Validation

- `npm run check` in `apps/planner`: 0 errors, 0 warnings.
- `npm run test` in `apps/planner`: 20 files, **575 tests passed**.
- `npm run build` in `apps/planner`: passed; static output generated in `dist`.
- `npm run check:e2e` at the repository root: passed.
- Chromium: **29 tests passed** across open loops, workbench, onboarding, Thinking About, and binder suites.
- `git diff --check`: passed. This package has no separate lint script.
- Screenshots inspected for neutral desktop/phone, closure, and completed Five Contacts states. Browser tests check keyboard focus after closure/completion, responsive overflow, and reduced-motion rendering; this was not a separate screen-reader audit.

An initial build encountered a Windows output-directory lock; a sequential rerun passed. The browser runner needed localhost/browser access outside the filesystem sandbox. Initial browser failures exposed stale test selectors and a counter whitespace assumption; the final complete suite passed after those were corrected.

## Follow-up: recurrence, reminders, patterns, attribution, corrections

Implemented 18 October 2026 at the owner's request, which stands in for the Phase 3 design review. Each feature keeps the Phase 1 principles: nothing is inferred into the record, nothing is pushed after a closure, and no copy says overdue, behind, or failed.

| Feature | Behavior | Guardrail |
| --- | --- | --- |
| Recurrence | Edit loop → *This is a recurring need*, optional rhythm in half-day steps. Closing ends one cycle (“Close this cycle”, recorded as `closed`); *Need is back* starts the next (recorded as `reopened`, shown as “Need returned”). | Nothing reopens by itself. Rhythm is descriptive. |
| Reminders | *Remind me* on an unresolved loop: quick picks or an exact time, optional note. Recurring loops can opt in to a reminder `rhythm` days after each closed cycle. Due reminders appear in a card below the sampler: *Thanks*, *In an hour*, *Tomorrow*; between-cycles reminders offer *Need is back* / *Not yet*. | Only reminders the person set. They never repeat, lapse once the loop resolves or the need is back, and browser notifications are a separate opt-in that respects quiet hours and fires once per due time. |
| Patterns | *Patterns in your loops* disclosure (rendered only when open): resolutions, reflection descriptors, what felt possible, color labels and noticings within 1/2/4 hours after a resolution beside other moments, Five Contacts rounds after resolutions, per-loop event counts, recurring gaps, linked vs unlinked noticings. | Shares always show their counts; comparisons are withheld below three resolutions; the caveat says neighbours aren't causes. No score or rank. |
| Inference | Offers only: a loop whose name shares words with the moment (*Link it* / *Not this*); a loop name when the moment's own words name an intention (“I should…”, “need to…”) which opens the create form prefilled; words recurring in unlinked notes on two or more days; a loop closed twice may be recurring; an observed rhythm. | Nothing is linked, created, or changed without a click. Dismissed pattern offers stay dismissed on every device. No sensor data exists to infer from. |
| Ideas | *Show ideas* in Patterns, up to three: a recurring rhythm that has passed, something noticed three times in two weeks without contact, the person's own “something else felt approachable” reflections, a long pause, eight or more open loops. | Shown only on request, never after a closure or round. Each names its evidence and includes letting go, rest, or leaving it. “Doing nothing is a fine choice too.” |
| Per-noticing links | Each body/attention/actions note has *Connect this note to a loop…*; links show as `Body: … → Loop` in Day so far and are searchable. | Independent from the moment's links; empty lists are not stored. |
| Event corrections | *Edit event* in Loop record: occurrence time, note, and — for noticed/approached/related/progress — which loop. | Future times are refused. `recordedAt` and the first `originalOccurredAt` are kept and shown. Lifecycle events stay with their loop, and lifecycle order still follows entry order, so a correction cannot silently reopen or close anything. |

### Files

| File | Change |
| --- | --- |
| `src/lib/types.ts` | `OpenLoop.recurring/rhythmDays/remindAfterClosure/editedAt`; `LoopEvent.updatedAt/originalOccurredAt`; `MomentNoticing.linkedLoopIds`; `LoopReminder`; settings `reminderNotifications`, `dismissedOffers`; blob `loopReminders`. |
| `src/lib/openLoops.ts` | Lifecycle helpers; `mergeOpenLoop` (metadata on its own `editedAt` clock); `mergeLoopEvent` (corrections win by `updatedAt`). |
| `src/lib/reminders.ts` | Liveness, due lists, rhythm due times, specific “later” times, quiet hours, reminder merge. |
| `src/lib/loopInference.ts` | Word matching, intention phrasing, repeated themes, recurrence and rhythm offers. |
| `src/lib/loopAnalysis.ts` | Descriptive pattern summary. |
| `src/lib/loopIdeas.ts` | On-request ideas. |
| `src/lib/store.svelte.ts` | `updateOpenLoop`, `updateLoopEvent`, reminder create/move/end, rhythm reminders with deterministic ids, opt-in notification delivery in `tick`, `dismissOffer`, hydration of `planner.loopReminders.v1`. |
| `src/lib/sync.svelte.ts` | Reminders in reads and merges; loop and event resolvers above; union of dismissed offers. |
| `src/lib/momentDetails.ts` | `cleanNoticings` keeps chosen per-noticing links. |
| `src/lib/components/LoopRow.svelte` | Loop row: cycle-aware actions, edit form, reminder form, notification opt-in. |
| `src/lib/components/LoopRecord.svelte` | Loop record entry with correction form. |
| `src/lib/components/LoopReminders.svelte` | Due-reminder card. |
| `src/lib/components/LoopPatterns.svelte` | Patterns, offers, ideas. |
| `src/lib/components/LoopNotebook.svelte`, `MomentDetails.svelte`, `MomentDayReview.svelte`, `TodayInstrument.svelte` | Wiring, per-noticing links, inline offers, placement. |
| tests | `loopInference`, `loopAnalysis`, `loopIdeas`, `reminders`, `loopFollowUps.store` unit tests; additions to `sync` and `momentDetails`; `../../e2e/carillon-loop-follow-ups.spec.ts`. |

### Data and sync

- No migration. New key `planner.loopReminders.v1`; everything else is additive optional fields. Older blobs load unchanged.
- Loop metadata merges on `editedAt`, so a rename on one device survives a closure from a stale copy. Corrected events win by `updatedAt`. Reminders merge by id; an ended reminder stays ended; notification state follows the due time it was shown for. Dismissed offers union.
- Between-cycles reminders use `reminder-after-<closure id>`, so retries and a second device cannot double them. Correcting the closure's time moves the reminder by the same amount.
- As before, refresh Carillon on every device: an older client does not know `loopReminders` and its whole-blob writer can drop them.

### Validation

- `npm run check`: 0 errors, 0 warnings. `npm run test`: 25 files, 613 tests. `npm run build`: passed. Root `check:e2e` and root vitest: passed.
- Chromium, all Carillon specs including the new one: 35 passed (run against the sandbox's pre-installed Chromium). The new spec covers recurring cycles and between-cycles reminders, plain reminders with *later* and finishing, event correction and re-attribution, refusing future times, per-noticing links, offers not acting on their own, patterns, ideas on request, axe (wcag2a/21a) on the notebook and patterns, 390px overflow, and reminders/edits reaching a simulated sync server.
- Unit tests for patterns and inference also pass under `America/New_York` and `Pacific/Auckland`.
- Not exercised: real OS notifications (the browser API is faked in unit tests), a live sync account, or a screen reader.

## Intentionally deferred

- A dedicated cross-date notebook search; editing Five Contacts contact times.
- Due dates, sensor inference, predictive models, causal claims, and gamification remain out of scope.

There is no new task creation, emotional measurement requirement, automatic next chore, escalating contact target, score, or streak in these tools.
