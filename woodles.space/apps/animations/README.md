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

The current scenes use Manim geometry and Pango text only; LaTeX is not needed.

## The Arcade-study catalog

`arcade-catalog.json` is the browser-readable source of truth for workshop
previews. `tools/render_catalog.py` validates it and publishes stable files out
of Manim's ignored scratch `media/` tree:

```powershell
.\.venv\Scripts\python.exe tools\render_catalog.py --check
.\.venv\Scripts\python.exe tools\render_catalog.py --list
.\.venv\Scripts\python.exe tools\render_catalog.py ink-bloom
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
