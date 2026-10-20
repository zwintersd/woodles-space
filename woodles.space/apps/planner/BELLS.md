# carillon bells

how the bell decides what to ring, how it sounds, and what syncs. the code is
`src/lib/chimes.ts` (what rings when — pure), `src/lib/bellVoices.ts` (every
sound as a note list — pure), `src/lib/bells.ts` (the one Web Audio graph),
and the clock section of `src/lib/store.svelte.ts`. the panel is
`components/BellSettings.svelte`, in the binder under ♪, and Today's bell
status line opens it (the binder tabs are hidden on phones).

## what rings when

- **sampling bells follow Today's rows.** rows start at the wake anchor and step
  by the interval, so a bell is due where a row turns over:
  `(minute − wake) mod interval = 0`, all day, outside quiet hours. with the
  defaults (wake 07:00, 15 minutes) that is :00 :15 :30 :45 as before. a wake
  anchor off the hour moves the bells with the rows.
- **the clock face names them.** a sampling minute on :00 is the hour, :30 the
  half, :15/:45 a quarter, anything else an "other sample". "chime them anyway"
  adds :00/:15/:30/:45 between samples (no moment is asked).
- **a planned block's bell follows the chime it shares a minute with.** block
  start beats another block's lead time; lead time looks up the block's own
  day, so a 00:02 block warns at 23:57. the person's choice wins: silent
  silences every block, a chosen voice rings for every block, and a block's own
  registry bell (`meal`, `wind-down`) is heard only while block starts use the
  default bell.
- **silent, or a level of 0, means that mark doesn't ring.** count-the-hour
  still strikes when the hour's own voice is silent.
- **reminder sounds** are off unless a voice is chosen; they follow bells-on,
  quiet hours and pause, and sound only if Carillon is open within two minutes
  of the reminder coming due — once per device.

## when it rings

- `store.startClock()` (called once from `+layout.svelte`, never at store
  construction) ticks just after each wall-clock minute, recomputing the delay
  every time, and also on `visibilitychange`, `pageshow` and `focus`.
- each tick looks back over every minute since the last one, at most two
  minutes, and rings only the latest bell found — throttled background tabs
  catch up, a waking laptop never rings an old bell.
- one ring per minute per device: `planner.bellRungMinute.v1` holds the last
  minute rung (as an instant, so a fall-back hour is still two minutes). it is
  written only after the sound was scheduled, so a tab the browser is holding
  never takes a bell from one that can play. deciding, playing and claiming run
  under a Web Lock (`carillon-bell`), so two tabs ticking in the same instant
  ring once; within a tab, bell runs are queued, so a focus tick and a
  visibility tick never double a reminder.

## how it sounds

- every voice is synthesized; there are no audio files. voices are tuned to
  land within about 3.5 dB of the original bell on a small speaker (a test
  keeps them within 4), with summed peaks under budget so a Westminster hour
  with twelve strikes doesn't clip.
- one shared `AudioContext`. notes are scheduled only on a running context —
  a locked one's clock stands still and would release everything at once on
  the first tap. a context that wakes within half a second plays; otherwise the
  bell is let go and Today says "tap to let it sound".
- one sequence at a time. a preview fades whatever is sounding; an automatic
  bell fades a preview but waits for another automatic bell to finish, so a
  reminder never cuts a counted hour short. Escape (or "stop sound") fades
  whatever is sounding. there is no compressor on the output — every voice
  stays well under full scale, and a compressor's makeup gain would make every
  bell louder than the original.
- gesture listeners stay for the life of the page, because iOS suspends the
  context after calls and backgrounding. turning bells on unlocks audio from
  that same click. on iPhone bells follow the silent
  switch and only ring while Carillon is open.

## what syncs

- `settings.bellSounds` — voices, the per-mark mix, count-the-hour and
  chime-between-samples — syncs, read leniently: unknown voices, odd levels and
  garbled times fall back to defaults when read and are never rewritten.
- master volume (`planner.bellVolume.v1`) and pause (`planner.bellPause.v1`) stay
  on the device; tabs on the device follow each other through `storage` events.
- settings now merge per key: `updateSettings` stamps a key in
  `settings.settingsStamps` only when its value changed (a setup step re-sending
  every field claims nothing), and `mergeSettings` keeps the newer stamp. a
  newer remote stamp on a missing key is a clear, and clears locally. ties and
  unstamped keys (older clients) keep the old rule, remote wins. a stamp more
  than a day ahead of this device's clock counts as never stamped, so one
  device with a wrong clock can't win every key forever. this is what stops a
  stale laptop from switching bells back on after the phone turned them off.
- a push that loses the compare-and-swap merges the device's *current* state,
  re-read, with the server's — so a voice picked while the push was in flight
  survives (`packages/sync`, every app with a `merge`).

## defaults

classic, as before: the same bell at every mark, the lead-time bell a third
lower at 90%. "clock face" (bowl on the hour, chime at half past, bell at the
quarters, pip between) and "westminster" (the five changes; one phrase at :15,
two at :30, three at :45, four on the hour) are one tap away.
