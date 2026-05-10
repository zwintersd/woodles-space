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
| v2.5    | The recitation        | Shipped     | `lib/components/rhythm/Recitation.svelte` |
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

## v2.5 — the recitation (shipped)

The séance now exists. Unlocks via the `recitation` upgrade (1 recension) and
runs through a new `recitation` practice (200 g, 120 s cooldown). Selecting
the practice opens the Recitation overlay.

- The recorder (`lib/rhythm/recorder.ts`) has been collecting reading-pass
  click timings since v1.0. `distillFragments()` now walks the buffer and
  produces contiguous beat patterns: a new fragment starts whenever the gap
  between consecutive clicks exceeds `MAX_INTRA_FRAGMENT_GAP_MS` (1800 ms),
  which also handles cross-session boundaries (since `performance.now()`
  resets each load). Fragments must have ≥ 5 beats and are capped at 14.
- `pickFragment()` selects one at random; the overlay replays it with the
  *exact* original cadence — beats laid out at `peakTime = startTime + offset`.
- Hit window is generous (±220 ms) — the past is forgiving.
- Words appear as ghosts in the handwriting font, washed periwinkle, drifting
  toward a print-pink seam. Hits brighten the ghost; misses cross it through.
- Outcome:
  - `hits / total ≥ 0.8` → "they are remembered" — apparatus +5 and a line
    enters `canonicalRemembered`, surfaced in `Canonical.svelte` as a
    handwritten preface above the canonical opening.
  - `0.5 ≤ ratio < 0.8` → partial — apparatus +2, no canonical line.
  - `ratio < 0.5` → "the margin forgets itself" — no reward.
  - Esc breaks the séance (no reward).
- Empty-card fallback when no fragment can be distilled yet (the player
  hasn't logged enough rhythmic reading).
- Remembered lines persist across prestige (the reader carries them forward);
  cleared only on `hardReset()`.

Files added/modified for v2.5:
- `lib/components/rhythm/Recitation.svelte` (new)
- `lib/rhythm/recorder.ts` (added `RecitationFragment`, `distillFragments`,
  `pickFragment`, `hasFragments`)
- `lib/components/Canonical.svelte` (renders `canonicalRemembered` preface)
- `lib/components/PracticeBar.svelte` (filters out the recitation practice
  until the upgrade is owned)
- `state/game.svelte.ts` — `recitationActive`, `canonicalRemembered`,
  `beginRecitation`, `completeRecitation`

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
  recorder.ts        # circular buffer + fragment distillation (v1.0, v2.5)
lib/content/
  corpus.ts          # passages + CHARGED_TOKENS for reading pass (v1.0)
  readers.ts         # previous-reader personalities for dispute (v1.5)
  passages.ts        # contested-passage corpus (v2.0)
  glyphs.ts          # marginal glyphs + corruption chars (v2.0)
lib/components/rhythm/
  ReadingPass.svelte      # v1.0
  Dispute.svelte          # v1.5
  ContestedPassage.svelte # v2.0
  Recitation.svelte       # v2.5
state/
  game.svelte.ts     # glossFromReadingPass, resourcesFromDispute,
                     # beginContestedPassage / completeContestedPassage,
                     # beginRecitation / completeRecitation
content/upgrades.ts  # reading_pass, dispute, contested_passage, recitation
content/practices.ts # adds `recitation` (200 g, 120 s cooldown)
```

## Next

1. v3.0 — more reader personalities (the methodist, the marginal heretic, the
   unlearned hand), more contested passages, sound design, achievements.
2. Generalise the rhythm engine into a shared module. We now have four
   callers (`ReadingPass`, `Dispute`, `ContestedPassage`, `Recitation`) all
   running their own rAF loop / spawn / collision logic. The right shape is
   probably visible now.
3. Expand the recorder to also capture dispute-track clicks, so the recitation
   can summon disputes in addition to readings.
