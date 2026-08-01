"""Render the checked-in Manim studies to stable, deployable preview paths."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "arcade-catalog.json"
MEDIA_DIR = ROOT / "media" / "arcade-catalog"
EXPORT_DIR = ROOT / "exports" / "arcade"
SVG_RECIPE_VERBS = {
    "draw",
    "style",
    "checkpoint",
    "transform",
    "restore",
    "fade",
    "wait",
}


def canonical_source_hash(path: Path) -> str:
    normalized = (
        path.read_text(encoding="utf-8")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .rstrip("\n")
        .encode("utf-8")
    )
    return hashlib.sha256(normalized).hexdigest()


def load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_catalog(
    catalog: dict[str, Any], *, require_outputs: bool = False
) -> list[dict[str, Any]]:
    if catalog.get("schemaVersion") != 1:
        raise ValueError("arcade-catalog.json must use schemaVersion 1")

    render = catalog.get("render")
    if not isinstance(render, dict):
        raise ValueError("catalog.render must be an object")
    for key in ("width", "height", "fps", "format", "transparent"):
        if key not in render:
            raise ValueError(f"catalog.render is missing {key!r}")

    studies = catalog.get("studies")
    if not isinstance(studies, list) or not studies:
        raise ValueError("catalog.studies must be a non-empty list")

    seen: set[str] = set()
    for study in studies:
        for key in (
            "id",
            "name",
            "scene",
            "posterScene",
            "source",
            "preview",
            "poster",
            "behavior",
            "durationMs",
            "status",
            "description",
            "useCases",
            "palette",
        ):
            if key == "durationMs":
                if not isinstance(study.get(key), int) or study[key] <= 0:
                    raise ValueError(
                        f"catalog study needs a positive integer {key!r}: {study}"
                    )
            elif not study.get(key):
                raise ValueError(f"catalog study is missing {key!r}: {study}")

        for key in ("useCases", "palette"):
            values = study[key]
            if not isinstance(values, list) or not all(
                isinstance(value, str) and value for value in values
            ):
                raise ValueError(
                    f"catalog study {key!r} must be a non-empty string array: {study}"
                )

        study_id = study["id"]
        if study_id in seen:
            raise ValueError(f"duplicate study id: {study_id}")
        seen.add(study_id)

        source_path = ROOT / study["source"]
        if not source_path.is_file():
            raise ValueError(f"missing source for {study_id}: {source_path}")

        source_asset = study.get("sourceAsset")
        if source_asset:
            if not isinstance(source_asset, str):
                raise ValueError(f"sourceAsset for {study_id} must be a string")
            source_asset_path = ROOT / source_asset
            if not source_asset_path.is_file():
                raise ValueError(
                    f"missing source asset for {study_id}: {source_asset_path}"
                )

        recipe_path_value = study.get("recipe")
        if recipe_path_value:
            if not source_asset:
                raise ValueError(f"recipe study {study_id} needs sourceAsset")
            if not isinstance(recipe_path_value, str):
                raise ValueError(f"recipe for {study_id} must be a string")
            recipe_path = ROOT / recipe_path_value
            if not recipe_path.is_file():
                raise ValueError(f"missing recipe for {study_id}: {recipe_path}")
            with recipe_path.open(encoding="utf-8") as handle:
                recipe = json.load(handle)
            if recipe.get("schemaVersion") != 1:
                raise ValueError(f"recipe for {study_id} must use schemaVersion 1")
            if recipe.get("id") != study_id:
                raise ValueError(
                    f"recipe id for {study_id} must match the catalog id"
                )
            recipe_source = recipe.get("source")
            if not isinstance(recipe_source, dict):
                raise ValueError(f"recipe for {study_id} needs a source object")
            if recipe_source.get("path") != source_asset:
                raise ValueError(
                    f"recipe source path for {study_id} must match sourceAsset"
                )
            if recipe_source.get("sha256") != canonical_source_hash(source_asset_path):
                raise ValueError(
                    f"recipe source hash for {study_id} does not match sourceAsset"
                )
            if not isinstance(recipe.get("parts"), list) or not recipe["parts"]:
                raise ValueError(f"recipe for {study_id} needs at least one part")
            timeline = recipe.get("timeline")
            if not isinstance(timeline, list) or not timeline:
                raise ValueError(f"recipe for {study_id} needs a timeline")
            for index, step in enumerate(timeline):
                if not isinstance(step, dict) or step.get("verb") not in SVG_RECIPE_VERBS:
                    raise ValueError(
                        f"recipe step {index + 1} for {study_id} uses an unsupported verb"
                    )
                if step["verb"] != "checkpoint":
                    duration = step.get("duration", 0)
                    if not isinstance(duration, (int, float)) or duration < 0:
                        raise ValueError(
                            f"recipe step {index + 1} for {study_id} needs a non-negative duration"
                        )

        expected_preview = f"/animations/exports/arcade/{study_id}.{render['format']}"
        if study["preview"] != expected_preview:
            raise ValueError(
                f"preview for {study_id} must be {expected_preview!r}, "
                f"not {study['preview']!r}"
            )

        expected_poster = f"/animations/exports/arcade/{study_id}.png"
        if study["poster"] != expected_poster:
            raise ValueError(
                f"poster for {study_id} must be {expected_poster!r}, "
                f"not {study['poster']!r}"
            )

        if require_outputs:
            for output_key in ("preview", "poster"):
                output_path = ROOT / study[output_key].removeprefix("/animations/")
                if not output_path.is_file():
                    raise ValueError(
                        f"missing checked-in {output_key} for {study_id}: {output_path}"
                    )

        source_text = source_path.read_text(encoding="utf-8")
        for scene_key in ("scene", "posterScene"):
            class_marker = f"class {study[scene_key]}("
            if class_marker not in source_text:
                raise ValueError(
                    f"scene class {study[scene_key]!r} was not found in {source_path.name}"
                )

    return studies


def render_output(
    study: dict[str, Any],
    render: dict[str, Any],
    *,
    scene_key: str,
    extension: str,
    label: str,
    save_last_frame: bool = False,
) -> Path:
    study_id = study["id"]
    command = [
        sys.executable,
        "-m",
        "manim",
        "render",
        "--resolution",
        f"{render['width']},{render['height']}",
        "--fps",
        str(render["fps"]),
        "--format",
        extension,
        "--media_dir",
        str(MEDIA_DIR),
        "--output_file",
        study_id,
        "--verbosity",
        "WARNING",
        "--progress_bar",
        "none",
    ]
    if save_last_frame:
        command.append("--save_last_frame")
    if render["transparent"]:
        command.append("--transparent")
    command.extend((str(ROOT / study["source"]), study[scene_key]))

    print(f"rendering {study_id} {label} ...", flush=True)
    environment = os.environ.copy()
    recipe_path_value = study.get("recipe")
    if recipe_path_value:
        environment["WOODLES_SVG_RECIPE"] = str((ROOT / recipe_path_value).resolve())
    else:
        environment.pop("WOODLES_SVG_RECIPE", None)
    subprocess.run(command, cwd=ROOT, env=environment, check=True)

    matches = list(MEDIA_DIR.rglob(f"{study_id}.{extension}"))
    if not matches:
        raise FileNotFoundError(f"Manim did not produce {study_id}.{extension}")

    rendered = max(matches, key=lambda path: path.stat().st_mtime_ns)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    published = EXPORT_DIR / f"{study_id}.{extension}"
    shutil.copy2(rendered, published)
    print(f"published {published.relative_to(ROOT)}", flush=True)
    return published


def render_study(study: dict[str, Any], render: dict[str, Any]) -> tuple[Path, Path]:
    preview = render_output(
        study,
        render,
        scene_key="scene",
        extension=render["format"],
        label="motion",
    )
    poster = render_output(
        study,
        render,
        scene_key="posterScene",
        extension="png",
        label="poster",
        save_last_frame=True,
    )
    return preview, poster


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate or render the Manim studies in arcade-catalog.json."
    )
    parser.add_argument("ids", nargs="*", help="one or more study ids to render")
    parser.add_argument("--all", action="store_true", help="render every catalog study")
    parser.add_argument("--check", action="store_true", help="validate without rendering")
    parser.add_argument("--list", action="store_true", help="list catalog studies")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog = load_catalog()
    studies = validate_catalog(catalog, require_outputs=args.check)

    if args.list:
        for study in studies:
            print(f"{study['id']:<18} {study['scene']:<18} {study['behavior']}")
        return 0

    if args.check:
        print(f"catalog ok: {len(studies)} studies")
        return 0

    by_id = {study["id"]: study for study in studies}
    if args.all:
        targets = studies
    elif args.ids:
        unknown = [study_id for study_id in args.ids if study_id not in by_id]
        if unknown:
            raise ValueError(f"unknown study id(s): {', '.join(unknown)}")
        targets = [by_id[study_id] for study_id in args.ids]
    else:
        raise ValueError("choose one or more study ids, --all, --check, or --list")

    for study in targets:
        render_study(study, catalog["render"])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
