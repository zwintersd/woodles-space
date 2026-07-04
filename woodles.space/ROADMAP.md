# roadmap — opening the doors

a 10-week plan for bringing a public-facing feeling to **marginalia** and
**the bestiary**, drafted july 2026. woodles.space stays what it is — a
personal space, tailored to Z — but these two apps become exhibits a
stranger can walk into, wander, and leave with something.

read alongside [ARCHITECTURE.md](./ARCHITECTURE.md) (workspace shape),
[apps/marginalia/PROPOSAL.md](./apps/marginalia/PROPOSAL.md) /
[DESIGN.md](./apps/marginalia/DESIGN.md) (the witch game's arc), and
[apps/marginalia/src/lib/arcade/ARCADE_ROADMAP.md](./apps/marginalia/src/lib/arcade/ARCADE_ROADMAP.md)
(the cabinet's polish log).

## where things stand

the site is already public in the *reachable* sense — anyone can load any
app. but the experience is tailored to one person:

- **the sync layer is single-user and password-gated on both read and
  write.** `api/sync.ts` returns 401 to any request without the passphrase,
  including GETs. there is no way for a visitor to see anything Z has made.
- **the bestiary opens as an editor, not a gallery.** a visitor gets the
  seed deck (Driftling, Amoebe, …) and a workshop — which is lovely, but
  they never see the *actual* bestiary: Z's creatures live behind the sync
  password and in Z's IndexedDB.
- **marginalia's witch game is genuinely playable by anyone** (local-first,
  tutorial exists, no password needed) — but its diorama binds creatures
  from the *local* bestiary IndexedDB (`witch/bestiaryDb.ts`), so a
  visitor's world is populated by nothing, or by untouched seed cards.
- **echoes reads published letters from localStorage only** — so "published"
  currently means "published to whichever of Z's devices has synced."
  a true visitor sees an empty reading room.

so the single missing primitive is a **public read path**: a way for Z to
say "this part, the world can see," and for the site to serve it to anyone
with no password. almost everything below builds on that.

## principles (what does not change)

- **local-first stays.** visitors get the same architecture Z does:
  localStorage/IndexedDB is the source of truth, no accounts, no tracking.
  a visitor's bestiary is *theirs*, on their device.
- **publishing is explicit and curated.** nothing becomes public by
  default. Z picks what to publish, per creature / per letter / per pack.
  the sync password keeps guarding every write.
- **the bestiary's promise: anything you drop can belong.** the card
  editor is built so anyone — an over-earnest 7th grader with scribbled
  anthro characters, someone turning their favorite anime characters into
  playing creatures — can drop a transparent png of *anything* and the
  studio's affordances (the alpha-traced sticker outline above all, plus
  tints, finishes, borders, the whole FX drawer) pull it into a consistent
  style: a personal library where things feel like they belong. going
  public means this promise has to be *legible on first open*, not
  discovered by accident. the bar for entry is a png, not talent.
- **the thesis is protected.** marginalia's rule — *reward attention and
  restraint; never optimize them away* — applies to the public framing too.
  no leaderboards-first energy, no engagement mechanics. the public feeling
  is "a museum with the lights on," not "a platform."
- **no visitor writes to the server.** the only new server surface is
  unauthenticated *reads* of explicitly published snapshots. guestbooks,
  shared walls, and visitor uploads are out of scope for these ten weeks
  (they need moderation thinking that deserves its own pass).

---

## the ten weeks

each week is shippable on its own; later weeks degrade gracefully if an
earlier one slips. weeks 1–4 are the bestiary arc, 5–7 the marginalia arc,
8–10 the connective tissue and landing.

### week 1 — the public read path ✅ shipped

the primitive everything else needs.

- new `published` table (`api/schema.sql`) keyed `(app, slug)` with a JSON
  blob + version + `published_at`, separate from the `sync` table.
- `GET /api/public?app=<name>&slug=<slug>` — **no auth**, cacheable
  (`cache-control: public, max-age=300, stale-while-revalidate`), returns
  `{ blob, version, publishedAt }`. `POST /api/public` (upsert) and
  `DELETE` stay behind the existing passphrase check.
- a small `publish(app, slug, blob)` / `pullPublic(app, slug)` pair in
  `@woodles/sync`, alongside the existing private `pull`/`push`.
- define the first snapshot shapes as types: `BestiaryPublicBlob`
  (curated creature list) and `EchoesPublicBlob` (published letters).
- tests for the endpoint (auth on write, no auth on read, CAS-free upsert)
  and the client pair.

*decided up front:* each published creature carries **exactly two
assets** —

1. the **rendered card image** (the finished compact card, via the
   existing `cardImage.ts` / `render.ts` pipeline), and
2. the **isolated sprite** — the studio's "S" layer (`isolatedSprite`:
   the creature alone, cropped, on transparency), falling back to the
   plain `sprite` upload when a card was never built in the studio.

nothing else from the editor is published: no compositions, no layer
stacks, no card styles, no workshop prefs. the card image is what the
gallery and share links show; the sprite is what lets the creature *live*
in marginalia's diorama (week 5) — the diorama already resolves art as
`isolatedSprite ?? sprite`, so the published shape feeds it directly. one
snapshot serves both apps; no separate sprite-pack blob needed.

### week 2 — the bestiary publish flow ✅ shipped

Z-facing: choosing what the world sees.

- a "publish" section in the existing `SyncPanel` (it already owns the
  passphrase session): select creatures → preview the public set → push a
  `BestiaryPublicBlob` snapshot.
- publishing snapshots the two assets per creature (week 1's decision):
  the rendered compact card image and the isolated "S" sprite
  (`isolatedSprite ?? sprite`). everything else — compositions, layer
  stacks, card styles, workshop prefs, timestamps beyond `published` —
  stays private.
- the publish preview surfaces a creature that has a card but **no
  isolated sprite** (pre-studio uploads), so it's obvious which published
  creatures can appear in marginalia's diorama and which are card-only.
- one deliberate exception to "only two assets": a per-creature **"show
  the source" opt-in** that additionally publishes the raw dropped png,
  feeding week 3's before/after gallery spots. off by default, chosen
  card by card.
- a per-creature "published" marker in the collection view, so the
  curated set is visible at a glance while editing.
- republish is a whole-snapshot upsert (no per-card CAS) — simple,
  idempotent, matches the "curated exhibit" mental model.

### week 3 — the gallery, and the first open ✅ shipped

visitor-facing: the bestiary opens as an exhibit — and the exhibit's job
is to teach, in under a minute, what the app is asking of you: *bring a
png of anything; the studio will make it belong.*

the first-open arc, in order of what a stranger sees:

1. **the gallery as proof.** a gallery view loads the published snapshot
   and shows Z's curated cards — the codex/binder presentation the app
   already knows how to do (`CreatureCodex`, `Collection`), read-only, no
   password anywhere. a shelf of finished cards in one coherent style is
   the promise shown, not told.
2. **the before/after.** one or two gallery spots show a card's *raw
   source png next to its finished card* — deliberately including a
   rough one. this is the single clearest way to say "your art is
   enough"; nothing communicates the studio's power like a scribble that
   now looks like it was always meant to be there. (needs Z to pick/make
   the example pairs — they're published assets like any other.)
3. **the invitation.** the door out of the gallery is not a "start your
   own bestiary" button — it's the drop zone itself, the `SpriteInput`
   "drop a sprite, or click to choose" affordance, promoted to the
   gallery's threshold. the ask *is* the interface: drop a png.
4. **the first card, guided.** dropping something walks the visitor
   through the shortest path to belonging: sprite lands → the sticker
   outline traces it → pick a finish (matte → holo) → the card sits in
   their (new, local) collection next to the seed deck. three beats, each
   one an existing studio affordance surfaced at the right moment — no
   new mechanics, just sequencing and copy.

and the plumbing underneath:

- first-run routing: no local collection → the gallery arc above.
  returning designers land where they left off, exactly as today.
- empty/failed fetch degrades to today's behavior exactly (seed deck,
  editor) — the gallery is additive, never a gate.
- the seed deck's framing shifts for visitors: from "your starting cards"
  to worked examples sitting alongside their first card.
- copy pass: whose bestiary this is, the invitation, the guided beats.
  this is the heaviest ✍️ Z week in the plan — the words *are* the
  onboarding.

*if the week overflows:* the guided first-card beats (4) can slide into
week 4, which is card-focused anyway; the gallery + drop-zone threshold
(1–3) are the core and ship first.

### week 4 — cards that travel ⏸ deferred, not built

sharing is the public feeling, distilled to one card.

*week 10 note: this week was never picked up — the roadmap jumped from
week 3 straight to week 5, and no share route, export button, adopt
flow, or per-card OG exists in the app today. week 10's hardening pass
deliberately left it that way rather than building it under a "hardening,
not features" week; it's a real, scoped gap for a future session, not an
oversight to paper over. everything below is still the plan for when
that happens.*

- **share links**: `/bestiary?card=<slug>` resolves against the published
  snapshot and opens a single-card view — the card, large, with its
  stats, flavor, and a "see the whole bestiary" path.
- **export as image**: a "save card" button on the card view (visitors
  and Z alike) producing a PNG via the existing render pipeline —
  the thing people actually paste into chats.
- **adopt a card**: from the gallery, copy a published card into *your*
  local bestiary as a starting point to remix. it arrives marked with its
  lineage ("after a card by Z" — wording ✍️ Z) and is fully editable.
- OG meta for the share route so links unfurl with the card name +
  static art. (per-card unfurl images are a stretch goal — adapter-static
  makes dynamic OG images awkward; a single bestiary-wide unfurl image is
  the week-4 deliverable, per-card can ride along later if a prerender
  step proves cheap.)

### week 5 — marginalia: a world that's alive for everyone ✅ shipped

the witch's diorama should never be empty just because the visitor
hasn't drawn anything yet.

- no new publish surface needed: the published `BestiaryPublicBlob`
  already carries each creature's isolated "S" sprite (week 1's
  two-asset decision), which is exactly what the diorama renders
  (`isolatedSprite ?? sprite`, in `TheWorld`, `WorldCanvas`, `MiniHex`,
  `HexStage`).
- `witch/bestiaryDb.ts` grows a fallback chain: local bestiary IndexedDB
  first (Z and any visitor who's made creatures), then the published
  snapshot's sprites, then the current unbound placeholders. cached in
  IDB so the diorama works offline after first load.
- the binding UI in the witch game distinguishes "yours" from "from the
  bestiary at woodles.space" so a visitor understands the connection —
  and follows it: this is the natural cross-link from marginalia *into*
  the bestiary gallery.

### week 6 — marginalia: the visitor's first hour ✅ shipped

PROPOSAL.md part 0 asks "who plays it?" — this roadmap's answer is
"strangers, now," which raises the care bar on onboarding and saves.

- a cold-start playtest pass: tutorial overlay flow, the pacing of the
  first conditions → first life → first attend loop, and how the vital
  signs / ledger read to someone with no context. tune
  `tuning.ts` only where the first session drags — the long game's
  balance (DESIGN.md phases D–F) is out of scope here.
- **save discipline becomes policy**: existing `v: 1` saves must keep
  working across all public-era changes; every save-shape change lands
  with a migration in `persist.ts` + a test. write this rule into the
  app docs.
- mobile + small-viewport pass on the witch screen, the ledger, and the
  reading room toggle (the arcade already had its mobile pass).
- a visible "this is a game about witnessing; it saves in your browser"
  note at first run — set expectations, no account needed, export/import
  already exists for continuity.

### week 7 — the reading room, actually public ✅ shipped

echoes and marginalia's reading room become real publications.

- `write`'s publish action pushes an `EchoesPublicBlob` snapshot through
  the public path (behind the passphrase, as today's sync is) — publishing
  from the writing desk finally means *the world can read it*.
- `letter` (echoes) loads the published snapshot for visitors, keeping
  localStorage as a cache and as Z's fast path; the existing
  legacy-key migration stays.
- marginalia's reading room reads the same published set, so the witch's
  book and the letters share one public library.
- visibility flags carry through: only letters Z marks public are in the
  blob; drafts and private letters never leave the sync table.

### week 8 — the arcade, presentable ✅ shipped

the cabinet is already the most visitor-ready part of marginalia; finish
the presentability items from ARCADE_ROADMAP.md rather than adding games.

- durable run memory everywhere (`arcadeRecords.ts` best-runs coverage for
  the remaining games) — a returning visitor should be greeted by their
  own history.
- the input/accessibility sweep: keyboard controls for pointer-heavy
  games, canvas fallback text, pointer-capture fixes on mobile.
- coming-soon honesty pass stays honest (roadmap cards clearly labeled).
- a light "about the arcade" line for visitors — what insight is, what the
  pet perks do — reusing the compact pet-perk row work.

### week 9 — the front door and the threads between rooms ✅ shipped

the site-level pass that makes the public apps feel like one place.

- **landing page reframing**: marginalia and the bestiary presented as
  things to *visit* — a sentence each about what a stranger will find,
  not just app names. the bestiary's sentence carries the promise: bring
  a png of anything, leave with a card that belongs. voice: ✍️ Z.
- **cross-links as architecture**: bestiary gallery ↔ witch game bindings
  ↔ reading room ↔ echoes each acknowledge the others, so a visitor who
  arrives anywhere can find everywhere.
- OG/meta pass across the public surfaces (titles, descriptions, unfurl
  images for landing, marginalia, bestiary, echoes).
- a "what's public and what's mine" note — one honest paragraph, probably
  on the landing page or a small colophon, explaining the shape: Z's
  published things are the exhibit; anything you make here stays in your
  browser.

### week 10 — hardening, docs, and the quiet launch ✅ shipped

- cross-browser and mobile QA of every public flow (gallery, share links,
  adopt, published-sprite fallback, echoes, first-hour witch game) — including
  the degraded paths (public API down, empty snapshots).
- perf sanity: published blob sizes, image weights, cache headers,
  bundle-size check on marginalia (the biggest app).
- docs: update ARCHITECTURE.md (public read path joins the sync-layer
  section; doc inventory), per-app notes for the publish flows, and mark
  this file's shipped weeks.
- buffer for whatever weeks 1–9 revealed. if the buffer goes unused:
  begin the per-card OG unfurl stretch goal, or start the DESIGN.md
  phase-D (prestige) conversation for the now-public witch game.

*week 10 note: "share links" and "adopt" were dropped from the QA list —
week 4 (their home) was never built (see its header above), so there was
nothing there to test. everything else on this list was: gallery,
published-sprite fallback, echoes (write's publish, letter's reading,
marginalia's reading room), and first-hour onboarding, each across desktop
and mobile viewports, each including its degraded path. the mobile pass
also caught and fixed a real, pre-existing (not week-9's) bestiary sidebar
overflow at phone widths. perf sanity found one real gap — the published-
blob size budget was design-only, never enforced — and fixed it; bundle
size turned out fine on inspection (marginalia's biggest chunk is properly
lazy-loaded, not part of first paint). buffer went to those fixes, not the
stretch goals.*

---

## sequencing notes and risks

- **week 1 blocks 2, 3, 4, 5, 7.** if the public endpoint design stalls,
  weeks 6 and 8 (onboarding, arcade) can be pulled forward — they need no
  server work at all.
- **blob weight is the main technical risk.** creature art as data URLs
  can be large; the week-2 decision to publish rendered images (not
  compositions) plus a size budget per snapshot (~2–4 MB) keeps the
  public GET fast. if it's still heavy, split art into per-creature slugs
  fetched lazily from the gallery.
- **prose is the main schedule risk.** weeks 3, 4, 5, and 9 each want
  copy in Z's voice (gallery framing, card lineage, binding labels,
  landing rewrite). collecting those into one writing sitting — the way
  DESIGN.md §4 batches the witch's lines — keeps them off the critical
  path.
- **save compatibility is a hard rule from week 6 on**, but really from
  week 1: any visitor who starts playing during this arc is a save we
  must not break.
- **what this roadmap deliberately defers**: visitor-submitted anything
  (cards, notes, scores), accounts, per-card dynamic OG images, and the
  witch game's prestige arc (DESIGN.md phase D+). all real, all later.
