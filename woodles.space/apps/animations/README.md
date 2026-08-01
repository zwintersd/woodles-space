# Manim playspace

`apps/animations` is the offline authoring side of the Woodles motion workshop.
Manim renders studies here; Hygge presents the checked-in previews at
`/hygge/motion`. A preview is not an Arcade dependency, and it does not become
one just because it looks promising.

## Local setup

Use Python 3.12 or newer. On Windows:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --editable .
```

On macOS or Linux:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --editable .
```

The current scenes use Manim geometry, SVG vector inputs, and Pango text only;
LaTeX is not needed.

### SVG studies

Keep original SVG inputs under `assets/` and resolve them relative to the scene
file. Manim writes a short-lived normalized SVG beside the input while parsing,
so source files must live in a writable authoring directory rather than being
loaded directly from Downloads or another read-only location.

`svg-recipes/` holds the small, versioned contract shared by the browser bench
and `scenes/svg_recipe.py`. A recipe names the source element and subpath for
every included part; omitted geometry remains visible as an explicit choice in
the bench. It then assigns human labels, groups, colors, style, and an ordered
timeline made from seven verbs: `draw`, `style`, `checkpoint`, `transform`,
`restore`, `fade`, and `wait`. The source hash and expected drawable count fail
the render early when an SVG has changed underneath its recipe. Hashing
normalizes CRLF/LF and ignores terminal newlines so Git's Windows line-ending
policy cannot invalidate unchanged geometry.

Triple corn is the compound-path case: one opaque source backdrop is deliberately
omitted and nine subpaths become named leaves, cobs, and kernels. Diamonds is the
unrelated control: one drawable and one part. Both render through the same scene
and catalog command, which is the useful seam; semantic inference, arbitrary
Manim expressions, and automatic Arcade promotion remain outside it.

The interactive authoring surface is `/hygge/motion/svg`. It makes the part map,
groups, palette, timing, recipe JSON, source hash, and exact render command
inspectable. Its SVG preview is intentionally fast and approximate. Download a
recipe into `svg-recipes/`, keep its SVG at the displayed `assets/` path, review
the diff, then use Manim for the authoritative local draft:

```powershell
.\.venv\Scripts\python.exe tools\render_svg_recipe.py svg-recipes\my-study.json
```

Drafts stay under ignored `media/svg-recipe-drafts/`. The browser and draft
helper never write to the catalog or promote an asset.

## The Arcade-study catalog

`arcade-catalog.json` is the browser-readable source of truth for workshop
previews. `tools/render_catalog.py` validates it and publishes stable files out
of Manim's ignored scratch `media/` tree:

```powershell
.\.venv\Scripts\python.exe tools\render_catalog.py --check
.\.venv\Scripts\python.exe tools\render_catalog.py --list
.\.venv\Scripts\python.exe tools\render_catalog.py ink-bloom
.\.venv\Scripts\python.exe tools\render_catalog.py triple-corn-svg diamonds-svg
.\.venv\Scripts\python.exe tools\render_catalog.py --all
```

Tracked WebM previews and transparent PNG keyframes land in `exports/arcade/`
and serve from `/animations/exports/arcade/`. The keyframes are the dependable
completed-state and reduced-motion fallback; the render dimensions, frame rate,
format, and transparency setting live once in the catalog.

## Promotion boundary

The workshop is an audition room, not an Arcade runtime:

1. Add a small visual-only scene and a catalog entry.
2. Render it and review its silhouette, scale, speed, backgrounds, and reduced-
   motion still in Hygge.
3. If two real game uses want the same asset shape, define the smallest stable
   delivery form for those uses (usually a still or frame sequence with
   intrinsic bounds and an anchor).
4. Copy only that approved artifact into
   `apps/marginalia/static/arcade/visuals/<id>/<revision>/`.
5. Keep placement, timing, collision, state, scoring, and reward logic in the
   individual game.

The older `render` Bash helper and `scenes/positionality.py` remain useful for
free-form concept animations that do not belong in the Arcade-study catalog.
