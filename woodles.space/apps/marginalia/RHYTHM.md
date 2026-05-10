# ✦ marginalia — rhythm mechanics, progress notes

Layered on top of the clicker baseline. Each tier turns a click into a more
attentive act of reading. This file tracks where we are against the original
pitch.

## Status overview

| Version | Mechanic              | Status      | Lives in                                   |
|---------|-----------------------|-------------|--------------------------------------------|
| v1.0    | The reading pass      | Shipped     | `lib/components/rhythm/ReadingPass.svelte` |
| v1.5    | The dispute           | Shipped     | `lib/components/rhythm/Dispute.svelte`     |
| v2.0    | The contested passage | Shipped     | `lib/components/rhythm/ContestedPassage.svelte` |
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

## v2.0 — the contested passage (shipped)

Boss-style encounter. Unlocks via the `contested_passage` upgrade
(10 apparatus). Five-minute cooldown between encounters; the cooldown is
persisted in the save so it survives reloads.

- 30-second timer. A passage of 5–6 lines sits in the centre.
- Glyph rain spawns at random arena edges and drifts toward random points
  inside the passage box.
- The reading caret (a blinking `|`) tracks the pointer; arrow keys also work.
  Collision radius is 22 px.
- Helpful glyphs (☞ ¶ * ⁋ ✦) caught by the caret become marginal notes that
  fade in at the edges of the passage box.
- Corrupting glyphs († ‡ ⸿ ⁂) caught by the caret deface a random word —
  they replace one non-whitespace character with a corruption block (█ ▒ ░ …).
  Three corruptions ends the encounter as a collapse (no rewards).
- Surviving the duration is a "passage holds" win: apparatus reward is
  `5 + 0.5·caught − corrupted` (floor 1), and the first time a passage is read
  intact it joins the player's `canonicalCitations`.
- `Esc` abandons the encounter (counts as a collapse).

`canonicalCitations` and `passagesRead` cross prestige (the reader carries
their citations with them); they only clear on `hardReset()`. The current
schema for them is permissive — older saves without these fields fall back to
empty arrays in `fromSave()`.

Files: `lib/content/passages.ts` (corpus), `lib/content/glyphs.ts` (glyphs +
corruption chars), `lib/components/rhythm/ContestedPassage.svelte` (the
overlay), `state/game.svelte.ts` (`canBeginContestedPassage`,
`beginContestedPassage`, `completeContestedPassage`,
`contestedCooldownLeftMs`).

## Files touched so far

```
lib/rhythm/
  timing.ts          # windows + classifyHit (v1.0)
  recorder.ts        # localStorage circular buffer (v1.0, feeds v2.5)
lib/content/
  corpus.ts          # passages + CHARGED_TOKENS for reading pass (v1.0)
  readers.ts         # previous-reader personalities for dispute (v1.5)
  passages.ts        # contested-passage corpus (v2.0)
  glyphs.ts          # marginal glyphs + corruption chars (v2.0)
lib/components/rhythm/
  ReadingPass.svelte      # v1.0
  Dispute.svelte          # v1.5
  ContestedPassage.svelte # v2.0
state/
  game.svelte.ts     # glossFromReadingPass, resourcesFromDispute,
                     # beginContestedPassage / completeContestedPassage
content/upgrades.ts  # reading_pass, dispute, contested_passage
```

## Next after v2.0 lands

1. Begin v2.5 — the recitation / séance. The recorder has been collecting
   click timings since v1.0 shipped, so distillation
   (clustering timestamps into rhythmic fragments) is the missing piece.
   Then a séance component that replays a fragment as a beat pattern and
   rewards in-time clicks with bonus apparatus and a "they are remembered"
   line in the canonical opening of the next run.
2. Eventually generalise the rhythm engine into a shared module — today the
   rAF loop / spawn / collision pattern is duplicated across
   `Dispute.svelte` and `ContestedPassage.svelte`. After v2.5 we'll have a
   third caller and the right shape will be obvious.
3. v3.0 — multiple previous readers (the methodist, the marginal heretic,
   the unlearned hand), more contested passages, achievements, sound design.
