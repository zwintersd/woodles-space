# woodles.space — Codebase Health & Tech-Debt Audit

*Read-only audit. No source files were modified. Date: 2026-06-19. Branch: `claude/festive-curie-7w5a9o`.*

> **Top-line context the brief didn't anticipate.** The audit prompt (and the
> repo's own docs) describe **three** SvelteKit apps (`write`, `marginalia`,
> `planner`) and **128 tests**. The repository on disk actually contains **six**
> SvelteKit apps — `write`, `marginalia`, `planner`, **`bestiary`**,
> **`spores`**, **`marginalia-devlog`** — plus a **`hygge`** static playground, an
> **`animations`** (Python/Manim) app, an **`api/`** Neon sync endpoint, and a
> **`packages/sync`** workspace package. There are **~507 passing tests**, not 128.
> Several README-listed static apps (`fonts`, `palette`, `motifs`, `scaffold`) no
> longer exist as directories. The single largest finding of this audit is that
> **the documentation describes a smaller, earlier version of this repo.**

---

## 1. Cross-App Duplication Inventory

The README/REFACTORING.md duplication list (HTML sanitization, anchor stamping,
margin notes, selection popovers across `write` + `marginalia`) is **accurate but
incomplete**. The same logic now exists in a *third* place, and an entirely
separate, undocumented duplication cluster (the sync layer) has appeared across
four apps.

- **Text-tools, copy 1 & 2 (tracked).** `write/src/lib/htmlTools.ts` and
  `marginalia/src/lib/reading/text.ts` independently implement the same
  primitives:
  - `ensureAnchorsOn` — near-identical, differs only by id prefix (`a-NNN`
    vs `p-NNN`) and selector order (`htmlTools.ts:32` vs `text.ts:68`).
  - sanitizer — `sanitizeHtml` (`htmlTools.ts:6`) vs `sanitizeNoteHtml`
    (`text.ts:166`): same strip-`style/color/face/size/bgcolor` + unwrap
    `FONT`/`SPAN` body; marginalia also strips `class`, write also strips
    `data-anchor`.
  - `stampAnchorsHtml` (`htmlTools.ts:59`) vs `stampLiveAnchors` (`text.ts:95`).
  - `countWords` (`htmlTools.ts:80`, HTML-in) vs `countWordsInText`
    (`text.ts:190`, text-in).
  - *Tracked* in `REFACTORING.md` "Cross-app duplication".
- **Text-tools, copy 3 (UNDOCUMENTED).** `apps/letter/index.html` (the static
  published-letter reader) reimplements the same logic inline:
  `function sanitize` (`index.html:1069`), `isEmptyHtml` (`:1102`),
  `stripTags` (`:1393`), `countWords` (`:1396`), `previewText` (`:1400`), plus
  `data-anchor` handling (`:1202`, `:1455`, `:1538`…). This is the read-side twin
  of `write`'s editor logic and is **not** mentioned in REFACTORING.md. It is
  also untested (static inline script).
- **Sync orchestration ×4 (UNDOCUMENTED).** `sync.svelte.ts` exists in
  `planner` (101 ln), `bestiary` (97), `spores` (94), `marginalia-devlog` (97).
  All four are near-identical wrappers around `@woodles/sync`'s
  `createSyncedStore` — same passphrase-in-localStorage persistence, same
  connect/disconnect/push glue. The *only* deltas: the imported store + blob
  type (`store`/`PlannerBlob` vs `bestiary`/`BestiaryBlob` vs `garden`/`GardenBlob`
  vs `devlog`/`DevlogBlob`), the `read()` field-mapping, an extra `isNewer`
  heuristic in bestiary (`sync.svelte.ts:38`), and a different `PASS_KEY` suffix
  in devlog. This ~90-line boilerplate is a strong candidate to fold into
  `@woodles/sync` as a helper, and it is **not** tracked anywhere.
- **Per-app `EditorToolbar` / margin notes / selection popover (tracked, now
  diverged in size).** `write/src/lib/EditorToolbar.svelte` (89 ln) vs
  `marginalia/.../reading/EditorToolbar.svelte` (113 ln);
  `write/src/lib/MarginNotes.svelte` (204) vs `marginalia/.../MarginNotes.svelte`
  (193); `write/src/lib/SelectionPopover.svelte` (58) vs
  `marginalia/.../SelectionBubble.svelte` (105).
- **Not duplication, but worth naming:** five per-app `src/lib/style/tokens.css`
  files play the same *role* but are deliberately divergent palettes (see §5).

---

## 2. Type Safety and TypeScript Coverage

Production type safety is **strong**: there is no `any` in any `.svelte` file and
no `any` in non-test `.ts`. `svelte-check` is clean for five of six apps. The one
exception (`planner`) fails entirely on **test-fixture** type drift, not
production code.

- **`any` is confined to tests** (all deliberate): `planner/src/lib/store.test.ts`
  (`as any` at `:192`, `:193`, `:640`, `:641`, `:663`),
  `planner/src/lib/bells.test.ts:29`. No `any` in app code.
- **`@ts-expect-error` only in tests:** `planner/src/lib/bells.test.ts`
  (`:151,167,202,214,227,256`), `bestiary/src/lib/bestiary.test.ts:70`.
- **`svelte-check` per app** (authoritative, clean runs):
  - `write` 0 errors / 0 warnings; `marginalia` 0/0; `bestiary` 0/0.
  - `spores` 0 errors / 4 warnings (autofocus — see §8).
  - `marginalia-devlog` 0 errors / 1 warning (`EntryList.svelte:519` line-clamp).
  - **`planner` 17 errors**, *all* in `store.test.ts` (8) and `voice.test.ts` (9):
    `Domain` now requires an `icon` field the fixtures omit
    (`store.test.ts:423,436`; `voice.test.ts:20,21,166,374`); `WeekPattern.days`
    is now a 7-tuple but fixtures pass `string[]` (`store.test.ts:460,644,666`);
    `'calendar'` is no longer a `View` (`:482`); `'tasks'` is no longer a
    `BinderTab` (`:499`); `addTask` rejects an `id` field (`:192`); a `reduce`
    `1|0` overload mismatch (`voice.test.ts:342`). **Zero production-code errors** —
    the app types evolved and the test fixtures were never updated.
- **`shared/library.js` typing.** Plain JS, no types; exported arrays
  (`palettes`/`motifs`/`fontPairs`/`templates`) are inferred. It is imported by
  **both** static apps at runtime (`letter/index.html:944`, `hygge/index.html:696`
  via `/shared/library.js`) **and** SvelteKit apps via `@shared/library.js`
  (`write/src/routes/+page.svelte:67`, `write/src/lib/Binder.svelte:13`).
  `Binder.svelte:14` already imports the `templates` *value* as a type. A typed
  contract is feasible **only via a `library.d.ts` sidecar** — converting to
  `library.ts` would break the static apps, which `import` the `.js` directly in
  the browser (no build step).

---

## 3. Test Coverage Gaps

The "128 tests" figure is stale. Current totals: **write 52, marginalia 89,
planner 209, spores 46, bestiary 111 ≈ 507 passing**, `marginalia-devlog 0`. But
`pnpm test` is **red**, for two distinct reasons, and the planner core store has
no working coverage.

- **`pnpm test` fails from a clean clone (ordering bug).** The per-app `test`
  script is a bare `vitest run` with no `svelte-kit sync` first. Each app's
  `tsconfig.json` `extends "./.svelte-kit/tsconfig.json"`, which doesn't exist
  until `sync` runs, so esbuild throws `TSConfckParseError: failed to resolve
  ".../.svelte-kit/tsconfig.json"`. Tests only pass *after* a `check`/`build`/`dev`
  has generated `.svelte-kit/`. CI/onboarding fragility.
- **`planner/src/lib/store.test.ts` crashes — `store.svelte.ts` is effectively
  0% covered.** Once sync exists, the suite still fails: `ReferenceError: $state
  is not defined` at `store.svelte.ts:65`, because `planner/vitest.config.ts`
  defines its own config (no Svelte plugin) and `store.svelte.ts` instantiates a
  **module-level singleton** (`export const store = new PlannerStore()` ~`:392`),
  so importing it evaluates `$state(...)` uncompiled. Result: 1 file failed / 5
  passed; the 209 "passing" tests are the *other* planner files. The core state
  module — persistence, migrations, the largest file in the app — has no passing
  test. (`spores` *avoids* this only by having **no** `vitest.config.ts`, so it
  inherits `vite.config.ts`'s SvelteKit plugin.)
- **Business-critical paths with zero coverage:**
  - `marginalia/src/lib/reading/text.ts` — the passage **sanitizer**
    (`sanitizePassageHtml`, `sanitizeNoteHtml`) and anchor stamping. Untested,
    while its `write` twin `htmlTools.ts` *is* tested (`htmlTools.test.ts`).
    Sanitization is security-relevant; this asymmetry is the most important gap.
  - `planner/src/lib/store.svelte.ts` — localStorage load/save + `rehydrate`
    (see above).
  - `bestiary/src/lib/idb.ts` — IndexedDB persistence; `bestiary/.../sync.svelte.ts`.
  - `marginalia/src/lib/witch/tick.ts` — idle-game economy loop.
  - `marginalia-devlog` — **no test runner at all** (no `vitest`, no `test`
    script); `devlog.svelte.ts`, `fontStore.svelte.ts`, `sync.svelte.ts` untested.
- **Well-covered (credit where due):** write drafts/htmlTools/letters; marginalia
  doc (v1→v3 migration), format, timer, persist, tuning, book; planner bells,
  calendar, dayCycle, utils, voice; bestiary card-render/prng/props/composer/frostgen;
  spores spell parser/assembler/tags.
- **Modules added since the refactor that lack tests:** the four `sync.svelte.ts`
  wrappers, `planner/onboarding.store.svelte.ts`, `spores/garden.svelte.ts`,
  `bestiary/studio.svelte.ts`.

---

## 4. Svelte 5 Runes Consistency

**Fully migrated — no findings.** A repo-wide search for Svelte 4 syntax returns
nothing.

- Zero `$:`, zero `export let`, zero `createEventDispatcher`, zero
  `svelte/internal` across all `.svelte` files.
- Zero `svelte/store` / `writable(` / `readable(` usage anywhere — so there are no
  `$store` auto-subscriptions to migrate. Components read rune-store state
  directly (e.g. `store.now`, `garden.currentView`, `book.title`,
  `bestiary.workshop`).
- `$state`/`$derived`/`$props`/`$effect` are used idiomatically throughout
  (e.g. `marginalia/.../book.svelte.ts:138–191`, `planner/.../NowNext.svelte:13–23`,
  `bestiary/.../CardEditor.svelte:22–58`).
- `planner/src/lib/store.svelte.ts` uses `$state`/`$derived` correctly (the §3
  crash is a *test-config* issue, not a runes issue — the app builds and runs).

---

## 5. Shared Design-Token Integrity

Token *references* are sound — but the headline is that the "shared palette" is
**not actually shared by most apps**, which contradicts the documented philosophy.

- **No silent-fallback tokens.** Of 237 distinct `var(--*)` references, 19 are not
  statically declared, but **all 19 are set at runtime** and are therefore not
  bugs: `--editor-display/-body/-mono` via `setProperty` (`write/.../+page.svelte:325–327`),
  `--letter-display/-body/-mono` (`letter/index.html:970–972`),
  `--cv-display/-body` (`hygge/index.html:746–747`), `--chip-color` via a Svelte
  `style:` directive (`planner/.../StepDomains.svelte:46`), and the bestiary card
  tokens (`--card-radius`, `--title-font`, `--plate-base`, `--card-border-color`,
  `--tex-opacity`, …) generated in `bestiary/src/lib/cardstyle.ts:259–263`
  (and tested in `cardstyle.test.ts`).
- **Themes match.** All 9 `library.js` palettes (`cream,dawn,dusk,midnight,forest,
  terracotta,inkwell,typewriter,paper`) have a `[data-theme='…']` block in
  `shared/palette.css` and vice-versa. ✔
- **Motifs match (but the README's mechanism is wrong).** All 5 `library.js`
  motifs (`blobs,aurora,mist,paper,clean`) have rules in `shared/motifs.css`. ✔
  However motifs are applied via **`class="motif-<id>"`** + blob/grain scaffold
  (`write/.../+page.svelte`, `letter/index.html`, `hygge/index.html`), **not** the
  `data-motif="<id>"` attribute the root README claims (only `hygge` uses
  `data-motif`, for its showcase toggles). `motifs.css`'s own header documents the
  class mechanism correctly.
- **The shared palette only reaches `write` + static apps.** Only `write` imports
  `shared/palette.css`. `marginalia`, `planner`, `spores`, `bestiary`,
  `marginalia-devlog` each ship an independent, root-scoped `src/lib/style/tokens.css`
  with its own namespace — `--p-*` (planner), `--g-*` (spores), `--b-*` (bestiary),
  bare `--bg/--text` redefined under `.marginalia-root`. `marginalia` imports
  **none** of the shared CSS. So `data-theme` switching and the 9 shared themes do
  not affect five of six SvelteKit apps. This directly contradicts "the
  lowest-level design tokens are shared from day one… all draw from the same
  palette."
- **Hardcoded colors** (hex/rgb/hsl) concentrate in apps with their *own* token
  systems, so they're less of a violation than they'd be in `write`, but they do
  reduce themeability: `marginalia-devlog/+layout.svelte` (29),
  `marginalia/lib/arcade/TwoZeroFourEight.svelte` (22) and `Arcade.svelte` (15)
  (self-contained game), `bestiary/.../CreatureCard.svelte` (19),
  `marginalia-devlog/.../EntryList.svelte` (10). The handful inside *quiet*
  themeable apps (`planner/.../TaskEditDrawer.svelte`, `DayPanel.svelte`,
  `spores` components) are the ones worth normalizing to tokens.
- **Phantom token in docs:** the README cites `--font-counter` as a shared font
  alternative; `shared/fonts.css` declares no such property.

---

## 6. Build and Dependency Health

`pnpm install` is clean and versions are perfectly consistent, but `pnpm audit`
surfaces **2 critical + 4 high** advisories (all in the dev/build toolchain), and
every core tool is one major version behind.

- **Install:** `pnpm install --frozen-lockfile` succeeds with **no peer-dependency
  warnings** and no resolution conflicts (112 packages).
- **`pnpm audit` — 14 vulnerabilities (2 critical, 4 high, 6 moderate, 2 low):**
  - **CRITICAL** `happy-dom` `<20.0.0` — VM context escape → RCE (installed 15.11.7;
    `write`/`marginalia`/`bestiary` devDep). GHSA-37j7-fg3j-429f.
  - **CRITICAL** `vitest` `<3.2.6` — UI server arbitrary file read/exec (installed
    3.2.4). GHSA-5xrq-8626-4rwp.
  - **HIGH** `happy-dom` `<20.8.9` (fetch-credentials) and `>=15.10.0` ESM-compiler
    code-exec; **HIGH** `devalue` (via `@sveltejs/kit`) sparse-array DoS; **HIGH**
    `vite` `<=7.3.4` `server.fs.deny` bypass (Windows).
  - Moderate/low: several `svelte` SSR-XSS/ReDoS/DOM-clobbering, `@sveltejs/kit`
    `query.batch`, `cookie`, `esbuild` file-read.
  - **Scope/severity note:** every advisory is in dev/build tooling (`happy-dom`,
    `vitest`, `vite`, `esbuild`) or in `@sveltejs/kit`'s SSR path. These apps ship
    **static** (`adapter-static`, no SSR), so the Svelte/Kit SSR-XSS items are
    largely not exploitable at runtime — but `happy-dom`/`vitest` run on dev/CI
    machines and should be bumped. Mitigations are simple version bumps.
- **Version consistency — no skew.** All six apps pin identical ranges and resolve
  identically: `@sveltejs/kit ^2.50.2`→2.59.0, `svelte ^5.51.0`→5.55.5,
  `vite ^7.3.1`→7.3.2, `vitest ^3.0.0`→3.2.4, `@sveltejs/adapter-static ^3.0.0`,
  `@sveltejs/vite-plugin-svelte ^6.2.4`, `svelte-check ^4.4.2`, `typescript ^5.9.3`.
- **adapter compatibility:** `adapter-static ^3` is compatible with `@sveltejs/kit 2.x`. ✔
- **Major updates available (currently pinned a major behind):** `vite` 7→8,
  `vitest` 3→4, `@sveltejs/vite-plugin-svelte` 6→7, `typescript` 5→6,
  `pdfjs-dist` 5.7→6.0 (marginalia), `happy-dom` 15→20 (also the security fix),
  `@neondatabase/serverless` 0.10→1.1 (root), `@types/node` 22→26 (keep on 22 to
  match the Node 22 runtime). The README's "Vite 7" claim is currently accurate.
- **`pnpm build` is green:** `planner` and `write` both build via
  `adapter-static` and emit `dist/index.html` + `_app/` (verified).

---

## 7. Vercel Deployment Correctness

Deployment wiring is **correct** — every app routes, and every `paths.base`
matches its rewrite. The mismatches are between the *docs* and `vercel.json`, not
between `vercel.json` and reality.

- **Every built app has a rewrite, and `paths.base` matches:** `write`→`/write`,
  `marginalia`→`/marginalia`, `planner`→`/planner`, `spores`→`/spores`,
  `bestiary`→`/bestiary`, `marginalia-devlog`→`/marginalia-devlog` — each
  `svelte.config.js` sets the matching `paths.base` and `adapter-static`
  `pages/assets: 'dist'`, and `vercel.json` rewrites `…/:path*` →
  `/apps/<name>/dist/:path*`. No app 404s for this reason.
- **`dist/` output matches `vercel.json`.** Builds emit `apps/<name>/dist/index.html`,
  exactly what the rewrites target (verified for write + planner).
- **The "missing" README apps don't 404 — they were consolidated.** `fonts`,
  `palette`, `motifs` all rewrite to `/apps/hygge/index.html`
  (`vercel.json:12–17`); `scaffold` rewrites to `/write` (`:18–19`). There is no
  `apps/fonts|palette|motifs|scaffold` directory, but the rewrites resolve, so
  these paths serve `hygge`/`write` rather than erroring.
- **`animations` caveat:** `/animations` → `apps/animations/index.html`
  (`:30–31`), but `animations` is a Python/Manim project whose rendered `media/`
  is git-ignored and whose render step is **not** in `vercel.json`'s
  `buildCommand`. In production `/animations` serves only the static `index.html`
  (no server-rendered media) unless media is pre-rendered and committed.
- **Cosmetic:** `vercel.json:32` (`/spores`) is mis-indented relative to its
  neighbors — valid JSON, just inconsistent.

---

## 8. Accessibility Quick Pass

A genuinely clean baseline: `svelte-check`'s a11y linting reports **0 errors**
across all six apps. The only flags are autofocus warnings.

- **Autofocus** (the only a11y warnings): `spores/.../SpellbookList.svelte:50`,
  `SpellbookView.svelte:64`, `SporeView.svelte:160`, `TagView.svelte:47`
  (`a11y_autofocus`).
- **Images:** all 6 `<img>` tags in the repo carry `alt` (none missing) —
  `bestiary` (SpriteInput, StudioStage, CreatureCard, AssetTray),
  `marginalia/.../TheWorld.svelte` (2), `animations/index.html`.
- **`tabindex`:** no values other than `0`/`-1` anywhere (no manual focus-order
  hacks).
- **Buttons:** raw counts of `<button>` without `aria-label` are high (spores 64,
  bestiary 53, marginalia 33, planner 26, write 6), but the icon-only heuristic
  found no obviously unlabeled icon buttons — most carry visible text. A focused
  manual pass on icon-only controls in `spores`/`bestiary` is the only follow-up
  worth doing; `svelte-check` already validates label/control association and
  click-without-keyboard, and is clean.
- `marginalia-devlog/.../EntryList.svelte:519` — `-webkit-line-clamp` without the
  standard `line-clamp` (compatibility warning, not a11y).

---

## 9. Known Dead Code and Stale Files

The *code* is tidy; the *docs* are the stale artifacts (see §10).

- **No orphaned modules.** Every `.ts`/`.svelte` under each app's `src/lib/` is
  imported somewhere in that app (whole-repo import scan: no orphans).
- **No build artifacts committed.** `git ls-files` tracks 0 files under any
  `dist/`, `.svelte-kit/`, or `node_modules/`. Root `.gitignore` covers them; the
  two app-local `.gitignore`s (`bestiary/screenshots/`, `animations/media/`) are
  appropriate.
- **No large commented-out blocks** (no run of ≥10 consecutive comment lines in
  any `.ts`/`.svelte`).
- **No `TODO`/`FIXME`/`XXX`/`HACK`** comments anywhere in the workspace.
- **Minor:** `marginalia/.../reading/text.ts:215` keeps a deliberate back-compat
  alias `export const splitParagraphs = paragraphsFromText` — intentional, low
  priority to remove.

---

## 10. Documentation Sync

This is the weakest area of the repo by a wide margin. All three docs describe an
earlier, smaller codebase, and the central refactoring plan is essentially
complete while still written in future tense.

- **`REFACTORING.md` describes finished work as "planned."** Its two "mega
  components" have already been split:
  - `write/src/routes/+page.svelte` is **1178 lines**, not the documented **2462**.
  - `marginalia/.../ReadingRoom.svelte` is **619 lines**, not **960**.
  - Every "recommended extraction" already exists: `Topbar`, `BottomBar`,
    `EditorToolbar`, `DraftsModal`, `PocketsPanel`, `MarginNotes`,
    `PublishOverlay`, `Binder`, `Clock`, `SelectionPopover` (write) and
    `PdfIntake`, `SelectionBubble` (marginalia), plus the `htmlTools.ts`/
    `drafts.ts`/`storage.ts` and `doc.ts`/`format.ts` lib extractions. The doc
    reads as a to-do list for work that's done.
  - Its "Cross-app duplication" note omits the two clusters from §1 (the `letter`
    inline copy and the four `sync.svelte.ts` wrappers).
- **Root `README.md` is materially wrong:**
  - App table lists `fonts`, `palette`, `motifs`, `scaffold` as separate static
    apps — none exist as directories (consolidated into `hygge` + `/write`).
  - Omits the apps that *do* exist: `bestiary`, `spores`, `marginalia-devlog`,
    `hygge`, `animations`.
  - Says "three SvelteKit apps" (there are six) and "128 tests" (~507).
  - Claims all apps share `shared/palette.css` (only `write` + static apps do; §5).
  - Says motifs apply via `data-motif` (actually `class="motif-<id>"`; §5).
  - Never mentions the `api/` sync endpoint or `packages/sync` (`@woodles/sync`).
- **`woodles.space/README.md` is the most stale file in the repo.** It documents a
  three-folder layout (`landing`, `fonts`, `woodles`), an empty `packages/` ("add
  when needed"), and "a SvelteKit app under `apps/woodles/` … not part of this
  deployment." There is no `apps/woodles/`; `packages/sync` exists and is consumed
  by four apps; six SvelteKit apps deploy. Its Vercel checklist (the substantive
  part) is still broadly valid.
- **`shared/library.js` header comment** lists consumers `apps/palette`,
  `apps/motifs`, `apps/scaffold` — all non-existent. Actual consumers are
  `write`, `letter`, `hygge` (`library.js:4`).
- **Accurate bits:** README's theme count (9 ✔), motif count (5 ✔), and the
  twelve font families in `shared/fonts.css` (✔); `letter`/`marginalia`/`planner`
  exist as described.

---

## Priority Triage

Ranked by impact. Items 1–3 are correctness/security; 4–5 are maintainability.

1. **`planner` is red on both `pnpm check` and `pnpm test`, and the failure hides
   `bestiary`.** 17 type errors (`store.test.ts`/`voice.test.ts` fixture drift:
   `Domain.icon`, `WeekPattern` 7-tuple, `View`/`BinderTab` unions) fail
   `svelte-check`, and because `pnpm -r check` bails on first failure, `bestiary`
   is never checked at all. Separately, `store.test.ts` throws `$state is not
   defined`, so the planner core store has **no working test**. The whole
   workspace's quality gate is effectively broken on `planner`. *Fix: update the
   fixtures to current types; give `planner` the Svelte plugin in its
   `vitest.config.ts` (or drop the config to inherit `vite.config.ts` like
   `spores`).*

2. **Critical/high security advisories in the toolchain.** `happy-dom <20`
   (RCE) and `vitest <3.2.6` (UI file read/exec) are **critical**; `vite`,
   `devalue`, and two more `happy-dom` issues are **high**. Dev/CI scope only
   (static deploys dodge the SSR ones), but criticals on machines running the
   tests. *Fix: bump `happy-dom`→≥20, `vitest`→≥3.2.6 (or 4), `vite`→≥7.3.5.*

3. **`pnpm test` fails from a clean clone, and sanitization is untested.** Bare
   `vitest run` with no `svelte-kit sync` means a fresh checkout can't run tests
   until something generates `.svelte-kit/`; and `marginalia`'s passage
   **sanitizer** (`reading/text.ts`) — security-relevant, the read-side twin of
   the *tested* `htmlTools.ts` — has zero coverage. *Fix: prefix test scripts with
   `svelte-kit sync &&`; add `text.test.ts`.*

4. **Three core docs describe an earlier, smaller repo.** README/REFACTORING/
   `woodles.space/README.md` are wrong on app count (3 vs 6), test count (128 vs
   ~507), missing apps (`bestiary`/`spores`/`marginalia-devlog`/`hygge`/
   `animations`), the now-complete refactor, the unmentioned sync layer
   (`api/` + `packages/sync`), and the claim that all apps share the palette.
   High onboarding/trust cost for a repo whose stated value is "kept close." *Fix:
   regenerate the app table from `vercel.json`; mark REFACTORING.md done.*

5. **Two undocumented duplication clusters.** The `sync.svelte.ts` wrapper is
   copy-pasted across four apps (~90 lines each), and `letter/index.html` is a
   third, inline, untested copy of the `write` text-tools. Both are invisible to
   REFACTORING.md's sharing plan. *Fix: fold the sync wrapper into `@woodles/sync`;
   fold `letter`'s sanitize/preview into a shared module once the contract with
   `write`/`marginalia` settles (consistent with "duplicate, learn, consolidate").*
