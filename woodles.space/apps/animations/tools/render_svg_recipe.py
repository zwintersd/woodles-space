"""Render one SVG motion recipe as an ignored local draft.

This deliberately stops before the Arcade-study catalog.  A draft only becomes
a checked-in workshop preview after its catalog entry is reviewed and rendered
with ``tools/render_catalog.py``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCENE_PATH = ROOT / "scenes" / "svg_recipe.py"
MEDIA_DIR = ROOT / "media" / "svg-recipe-drafts"
SAFE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def canonical_source_hash(path: Path) -> str:
    normalized = (
        path.read_text(encoding="utf-8")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .rstrip("\n")
        .encode("utf-8")
    )
    return hashlib.sha256(normalized).hexdigest()


def load_recipe(recipe_argument: str) -> tuple[Path, dict[str, Any]]:
    candidate = Path(recipe_argument)
    recipe_path = candidate if candidate.is_absolute() else ROOT / candidate
    recipe_path = recipe_path.resolve()
    if not recipe_path.is_file():
        raise ValueError(f"recipe does not exist: {recipe_path}")

    with recipe_path.open(encoding="utf-8") as handle:
        recipe = json.load(handle)
    if recipe.get("schemaVersion") != 1:
        raise ValueError("SVG motion recipes must use schemaVersion 1")

    recipe_id = recipe.get("id")
    if not isinstance(recipe_id, str) or not SAFE_ID.fullmatch(recipe_id):
        raise ValueError("recipe.id must be a lowercase, hyphenated identifier")

    source = recipe.get("source")
    if not isinstance(source, dict) or not isinstance(source.get("path"), str):
        raise ValueError("recipe.source.path must name an asset under apps/animations")
    source_path = (ROOT / source["path"]).resolve()
    if ROOT not in source_path.parents or not source_path.is_file():
        raise ValueError(f"recipe source is missing or outside animations: {source_path}")

    expected_hash = source.get("sha256")
    actual_hash = canonical_source_hash(source_path)
    if expected_hash != actual_hash:
        raise ValueError(
            "recipe source hash does not match the asset; reopen it in the SVG bench"
        )
    return recipe_path, recipe


def render(
    recipe_path: Path,
    recipe: dict[str, Any],
    *,
    scene: str,
    extension: str,
    save_last_frame: bool = False,
) -> Path:
    recipe_id = recipe["id"]
    output_name = f"{recipe_id}-draft"
    command = [
        sys.executable,
        "-m",
        "manim",
        "render",
        "--resolution",
        "320,320",
        "--fps",
        "30",
        "--format",
        extension,
        "--media_dir",
        str(MEDIA_DIR),
        "--output_file",
        output_name,
        "--verbosity",
        "WARNING",
        "--progress_bar",
        "none",
        "--transparent",
    ]
    if save_last_frame:
        command.append("--save_last_frame")
    command.extend((str(SCENE_PATH), scene))

    environment = os.environ.copy()
    environment["WOODLES_SVG_RECIPE"] = str(recipe_path)
    subprocess.run(command, cwd=ROOT, env=environment, check=True)

    matches = list(MEDIA_DIR.rglob(f"{output_name}.{extension}"))
    if not matches:
        raise FileNotFoundError(f"Manim did not produce {output_name}.{extension}")
    return max(matches, key=lambda path: path.stat().st_mtime_ns)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render an SVG motion recipe without publishing it to the catalog."
    )
    parser.add_argument("recipe", help="recipe path, relative to apps/animations or absolute")
    parser.add_argument(
        "--check", action="store_true", help="validate the recipe and source without rendering"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    recipe_path, recipe = load_recipe(args.recipe)
    if args.check:
        print(f"recipe ok: {recipe['id']} -> {recipe['source']['path']}")
        return 0

    print(f"rendering local draft for {recipe['id']} ...", flush=True)
    motion = render(
        recipe_path,
        recipe,
        scene="SvgRecipeScene",
        extension="webm",
    )
    poster = render(
        recipe_path,
        recipe,
        scene="SvgRecipePoster",
        extension="png",
        save_last_frame=True,
    )
    print(f"motion: {motion}")
    print(f"poster: {poster}")
    print("draft only: add a catalog entry before publishing this study")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
