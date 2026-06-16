# woodles.space

> a little desktop of soft, made things — typefaces and letters,
> palettes and quiet timers. one repo, all the things, kept close.

A personal monorepo of small, hand-made web apps that all live at
**woodles.space**. Some are showcases for design tokens; others are
working tools. They share a palette, a font system, and a small
library of named typographic templates, but each app keeps its own
shape.

---

## Repo layout

```
.
├── .gitignore
├── README.md                  ← you are here
└── woodles.space/             ← the actual pnpm workspace
    ├── package.json           ← workspace root (test / check / build fan out)
    ├── pnpm-workspace.yaml
    ├── pnpm-lock.yaml
    ├── vercel.json            ← rewrites every app to its sub-path
    ├── REFACTORING.md         ← live extraction plan for the bigger apps
    ├── README.md              ← Vercel deployment notes (root-dir, framework)
    ├── shared/                ← cross-app design system + data registry
    │   ├── palette.css        ← 9 named themes, switched via [data-theme]
    │   ├── fonts.css          ← --font-display / --font-body / --font-mono
    │   ├── motifs.css         ← ambient backdrop classes
    │   └── library.js         ← palettes / motifs / fontPairs / templates
    └── apps/
        ├── landing/           ← static · the homepage
        ├── fonts/             ← static · typeface viewer
        ├── palette/           ← static · color system showcase
        ├── motifs/            ← static · backdrop showcase
        ├── scaffold/          ← static · templates for /write
        ├── digits/            ← static · animated SVG pen
        ├── letter/            ← static · published letter viewer (Echoes)
        ├── write/             ← SvelteKit · the letter editor
        ├── marginalia/        ← SvelteKit · a witch writes worlds (+ reading room)
        └── planner/           ← SvelteKit · Carillon, the day held quietly
```

The wrapper repo holds only this README and a `.gitignore`; everything
else lives in `woodles.space/`. The split exists so the deployed site
is rooted exactly one directory deep — see `woodles.space/README.md`
for the Vercel settings that depend on this.

---

## The apps

woodles.space is a desktop of small surfaces. Each app has its own
voice and most of its own code, but they all draw from the same palette
and font system.

| Path             | Name         | What it is                                          |
| ---------------- | ------------ | --------------------------------------------------- |
| `/`              | woodles      | the homepage — a quiet shelf of the apps below      |
| `/fonts`         | Font Library | twelve typefaces, on one sheet                      |
| `/palette`       | Palette      | named themes & color systems                        |
| `/motifs`        | Motifs       | ambient backdrops, drift & grain                    |
| `/scaffold`      | Scaffold     | a small catalog of templates for `/write`           |
| `/digits`        | digits       | an SVG pen that writes the time                     |
| `/write`         | Write        | compose, save, send a letter (the editor)           |
| `/letter`        | Echoes       | letters left here, words that stayed (the reader)   |
| `/marginalia`    | Marginalia   | a witch writes worlds into being (idle world-game)  |
| `/marginalia#…`  | Reading Room | a quiet timer, read for stars (lives inside it)     |
| `/planner`       | Carillon     | the day, held quietly                               |

**Two app shapes** coexist in the same workspace:

- **Static apps** are one HTML file plus inline CSS and a sprinkle of
  module JS. No build step. `vercel.json` serves them as-is and
  rewrites the friendly path (`/fonts`) to the file
  (`/apps/fonts/index.html`). They consume `shared/` at runtime via
  `<link href="/shared/palette.css">` and `import from
  "/shared/library.js"`.

- **SvelteKit apps** (`write`, `marginalia`, `planner`) use
  Svelte 5 runes + Vite 7 + `@sveltejs/adapter-static`. Their build
  output lands in `apps/<name>/dist/`; `vercel.json`'s build command
  is just `pnpm --filter <name> build` for each. They consume
  `shared/` via the `@shared` Vite alias declared in each
  `svelte.config.js`.

---

## What's shared (and what isn't)

There's a deliberate gradient: the lowest-level design tokens are
shared from day one, the mid-level data is shared from day one, and
**components are deliberately not shared yet** — each app's UI
extractions live in its own `src/lib/` and migrate to `shared/` only
once the shape stops moving.

### `shared/palette.css` — themes

Nine named themes (`cream`, `dawn`, `dusk`, `midnight`, `forest`,
`terracotta`, `inkwell`, `typewriter`, `paper`) defined as CSS custom
properties. Switch by setting `data-theme="<id>"` on `<html>` or
`<body>`. Apps refer to the tokens, not the values — so
`var(--accent)`, `var(--bg)`, `var(--text)`, `var(--rule)`, etc. carry
the same role through every theme.

Concrete color names (`--lavender`, `--aqua`, `--peach`, `--lilac`,
`--plum`, `--lapis`) are also stable across themes — each theme just
remaps what those names point to, so an app that hard-codes
"lavender" still looks at home everywhere.

### `shared/fonts.css` — typography custom properties

Defines `--font-display`, `--font-body`, `--font-mono`, plus a few
named alternatives (`--font-counter`, etc.). The actual `@font-face`
sources are Google Fonts links loaded per-app; this file is purely
the variable layer that lets apps swap fonts without re-stating
fallbacks.

### `shared/motifs.css` — ambient backdrops

The five motifs (`blobs`, `aurora`, `mist`, `paper`, `clean`). Apply
by setting `data-motif="<id>"` on the surface element; the rules
underneath handle blob positioning, grain overlay, and animation.

### `shared/library.js` — the named-things registry

Plain ES module, no UI. The source of truth for what palettes,
motifs, font pairings, and starter templates exist:

```js
import {
  palettes, motifs, fontPairs, templates,
  findPalette, findMotif, findFont, findTemplate
} from '/shared/library.js';     // static apps
// or
import { … } from '@shared/library.js';  // SvelteKit apps
```

`write` uses it for theme/motif/font pickers and `?template=` URL
loading; `letter` uses it when rendering published letters;
`palette`, `motifs`, `scaffold`, and `fonts` use it as their
showcase data. Adding a palette here makes it appear everywhere.

### Per-app libs (not yet shared)

After a recent round of refactoring, the bigger apps moved their
internal helpers into `src/lib/` modules with their own tests:

- **`apps/write/src/lib/`** — `htmlTools.ts` (sanitize, anchor
  stamping, preview/word counts), `drafts.ts` (full localStorage
  draft system + legacy migration), `letters.ts` (published letters
  + issue counter), `storage.ts` (key constants), `types.ts`
  (LayerId, PocketNote, MarginNote, etc.), plus 11 Svelte
  components (Topbar, BottomBar, EditorToolbar, DraftsModal,
  PocketsPanel, MarginNotes, SelectionPopover, Binder,
  PublishOverlay, Clock).
- **`apps/marginalia/src/lib/`** — `reading/doc.ts` (v1→v2→v3 session
  doc migration), `reading/format.ts` (formatHms, formatMin),
  `reading/text.ts`, `reading/pdf.ts`, `reading/timer.ts`,
  `witch/persist.ts` (witch's-book save), `witch/tuning.ts`
  (balance constants), plus components for the reading room
  (Passage, MarginNotes, EditorToolbar, PdfIntake,
  SelectionBubble, Star, StarShelf).
- **`apps/planner/src/lib/`** — `utils.ts`, `calendar.ts`,
  `dayCycle.ts` (time-of-day palette interpolation), `bells.ts`,
  `templates.ts`, `store.svelte.ts`, `voice.ts`, `types.ts`.

There's real overlap across these — HTML sanitization, anchor
stamping, margin notes, and selection popovers exist in both `write`
and `marginalia`. They are **deliberately not consolidated** until
each app has stopped iterating on its local copy. See
`woodles.space/REFACTORING.md` for the cross-app sharing notes.

---

## Running things locally

From `woodles.space/`:

```sh
pnpm install            # one install for the whole workspace
pnpm test               # vitest in every SvelteKit app (128 tests)
pnpm check              # svelte-check in every app
pnpm build              # build write / marginalia / planner
```

To work on one app:

```sh
cd woodles.space/apps/<name>
pnpm dev                # SvelteKit apps
# or just open apps/<name>/index.html in a browser (static apps)
```

The static apps need to be served (not opened as `file://`) for the
`/shared/*` imports to resolve. Any quick server works:

```sh
cd woodles.space
python3 -m http.server 8000        # then visit /apps/fonts/index.html
```

---

## Deployment

A single Vercel project serves the whole site. It runs the three
SvelteKit build commands, then ships everything from
`woodles.space/` as static files. Friendly paths are wired by
`vercel.json` rewrites: `/write` → `/apps/write/dist/index.html`,
`/fonts` → `/apps/fonts/index.html`, and so on.

There are a few non-obvious Vercel settings (Root Directory matters,
framework preset must be "Other") — they're documented in
`woodles.space/README.md` along with a checklist for when `/fonts`
404s.

---

## Philosophy

A few habits this repo tries to keep:

**One repo, all the things, kept close.** No npm-publishing, no
private registry, no cross-repo coordination. Apps that want each
other's code can reach across `apps/`, and the shared design system
sits at the same depth so nothing is "above" anything else.

**Tokens before components.** The palette, the fonts, and the named
registry are shared because their *shape* is stable — they're just
data. Components are not shared until two apps have independently
built the same thing and converged on a contract. Premature sharing
freezes an API before the two apps have stopped diverging; better to
duplicate, learn, then consolidate.

**Lowercase, on purpose.** The writing voice in every app is lowercase
and slow — "a quiet room", "tuck a thought in", "the day, held
quietly". Type that matches: serif display fonts (Cormorant Garamond,
Lora), mono fonts for the chrome, soft accents over hard ones. Not a
brand — a temperature.

**Pure logic into testable modules.** Every recent refactor pulled
side-effect-free helpers out of `.svelte` files and into `lib/*.ts`
modules with vitest coverage. localStorage I/O is isolated to small,
mocked-storage units; everything else is plain function-in,
function-out.

**Static when it can be, SvelteKit when it has to be.** A page that
just shows a thing is one HTML file. Pages that need editing,
persistence, or live state become SvelteKit apps with
`adapter-static`. There is no SSR — every app ships as a static
bundle.

**A working desk, not a glass case.** Quoting `marginalia` to itself.
Tools you can actually use beat tools that look used.
