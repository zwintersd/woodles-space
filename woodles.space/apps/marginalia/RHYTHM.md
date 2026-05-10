# ✦ marginalia — rhythm mechanics, progress notes

Layered on top of the clicker baseline. Each tier turns a click into a more
attentive act of reading. This file tracks where we are against the original
pitch.

## Status overview

| Version | Mechanic              | Status      | Lives in                                   |
|---------|-----------------------|-------------|--------------------------------------------|
| v1.0    | The reading pass      | Shipped     | `lib/components/rhythm/ReadingPass.svelte` |
| v1.5    | The dispute           | Shipped — polishing | `lib/components/rhythm/Dispute.svelte`     |
| v2.0    | The contested passage | Not started | —                                          |
| v2.5    | The recitation        | Recorder running, séance not built | `lib/rhythm/recorder.ts` |
| v3.0    | More readers, sound   | Not started | —                                          |

## v1.0 — the reading pass (shipped)

Single line of text drifts horizontally past a vertical seam. Click when a word
crosses the seam.

- Three timing windows: **wide** (±250 ms, 1×), **tight** (±80 ms, 5×),
  **luminous** (tight + charged token, 25× and 0.5 % free commentary chance).
- Charged tokens (italicised, archaic, repeated, capitalised) are seeded from
  `lib/content/corpus.ts` (`CHARGED_TOKENS`).
- Replaces `ClickRegion` once the `reading_pass` upgrade is purchased
  (1 commentary). The legacy "click" button graduates into a "→ next line"
  skip affordance.
- Tally marks and `ductus` combo carry across from the old click loop, so the
  existing economy still works.
- All movement is driven from `transform: translateX()` directly off rune
  state — no Svelte transitions, frame-locked. Clicks are timestamped on
  `pointerdown` with `performance.now()` to minimise input lag.

Hit detection in `lib/rhythm/timing.ts`:
- `classifyHit(absOffsetMs, isCharged)` returns `'luminous' | 'tight' | 'wide' | 'miss'`.
- Resource grants flow through `game.glossFromReadingPass(quality)`.

## v1.5 — the dispute (shipped, polishing now)

Two parallel tracks. The upper track plays back the rhythmic markers of a
previous reader (`lib/content/readers.ts`). The lower track is the player's.
Clicking near a beat classifies the click as one of three modes:

| Mode          | Window from beat peak | Resource produced | Per hit     |
|---------------|-----------------------|-------------------|-------------|
| Agreement     | ±110 ms               | commentaries       | +1          |
| Disagreement  | 110–380 ms            | apparatus          | +0.1        |
| Counterpoint  | 380–640 ms (≈ ½-beat) | recensions         | +0.01       |

Outside ±640 ms registers nothing.

The reader (`unknown_hand`) has:
- A jittered ~1100 ms interval.
- Recurring marginal phrases (`see also`, `cf.`, `vid.`, `nota`, `q.v.`, etc.).
- Accent beats every 5th, drawn from a longer phrase pool
  (`the text wants to mean something else`, `compare`, `¶`, `☞`, …).

Unlocks via the `dispute` upgrade (2 apparatus). Lives in
`lib/components/rhythm/Dispute.svelte` and is mounted alongside `ReadingPass`
on the main page once owned.

### Polish pass (current work)
Issues identified that the polish commit addresses:
1. The mode label only says `+ apparatus` / `+ recension`, but the actual
   amounts are fractional (0.1, 0.01). This reads as a lie. Show the real gain.
2. Misses (clicks > 640 ms from the nearest beat) are silent — the player
   gets no feedback that anything registered.
3. The timing windows are invisible. Players have to guess by feel where
   "agreement" ends and "disagreement" begins. Visualise them at the seam.
4. Mode hint at bottom (`agree · disagree · counterpoint`) doesn't tell you
   *when* each happens. Make it explicit (on-beat / off-beat / half-beat).
5. No keyboard affordance shown, even though space/enter both work.
6. Track labels (`their hand`, `your hand`) sit at a low z-index and beats
   can pass right over them.

## v2.5 — the recitation (recorder running)

The click recorder (`lib/rhythm/recorder.ts`) writes every reading-pass hit
into a 500-entry circular buffer in `localStorage` under `marginalia.rhythm.v1`.
Format: `{ t, q, w }` (timestamp, quality letter, word slice).

This collects passively from v1.0 onward so that, when the séance is built in
v2.5, there is already a corpus of personal cadence to recite against.
Distillation (clustering timestamps into rhythmic fragments) is not yet
implemented.

## v2.0 — the contested passage (not started)

Boss-style encounter. Dense passage in the centre, glyph rain falling toward
it; the player moves a caret to catch helpful glyphs (`☞`, `¶`, `*`) and dodge
corrupting ones (`†`, `‡`, `⸿`). Three corruptions ends the encounter; an
intact read mints apparatus and adds the passage to that run's canonical
citations. Cooldown ~5 minutes. Needs:

- A glyph-rain engine (probably extending the rAF loop pattern from
  `Dispute.svelte`).
- A small contested-passage corpus (church fathers, gnostic gospels, decree
  drafts — generated, not curated).
- Caret control (mouse + arrow keys).
- Hookup to `game.canonical` so successful reads persist into the run's
  canonical text.

## Files touched so far

```
lib/rhythm/
  timing.ts          # windows + classifyHit (v1.0)
  recorder.ts        # localStorage circular buffer (v1.0, feeds v2.5)
lib/content/
  corpus.ts          # passages + CHARGED_TOKENS for reading pass
  readers.ts         # previous-reader personalities for dispute
lib/components/rhythm/
  ReadingPass.svelte # v1.0
  Dispute.svelte     # v1.5
state/
  game.svelte.ts     # glossFromReadingPass, resourcesFromDispute
content/upgrades.ts  # reading_pass, dispute upgrades
```

## Next after the v1.5 polish lands

1. Begin v2.0 — the contested passage. Most ambitious of the four because it's
   a new interaction model (caret, not click), but it can reuse the rAF /
   beat-tracking scaffolding the engine already has.
2. Begin distilling the recorder buffer into rhythmic fragments so that v2.5
   has something to recite when it ships.
3. Eventually generalise the rhythm engine into a shared module (today the
   logic is duplicated between `ReadingPass` and `Dispute`).
