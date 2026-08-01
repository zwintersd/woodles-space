"""Small, inspectable Manim renderer for version 1 SVG motion recipes."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import numpy as np
from manim import (
    DrawBorderThenFill,
    FadeOut,
    LaggedStart,
    ORIGIN,
    Scene,
    SVGMobject,
    TAU,
    Transform,
    VGroup,
    VMobject,
    config,
    linear,
    smooth,
    there_and_back,
)


ROOT = Path(__file__).resolve().parents[1]
RECIPE_ENV = "WOODLES_SVG_RECIPE"

config.frame_width = 6.4
config.frame_height = 6.4
config.background_opacity = 0.0

RATE_FUNCTIONS = {
    "linear": linear,
    "smooth": smooth,
    "there_and_back": there_and_back,
}


def canonical_source_hash(path: Path) -> str:
    """Hash SVG text without platform line-ending or terminal-newline drift."""

    normalized = (
        path.read_text(encoding="utf-8")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .rstrip("\n")
        .encode("utf-8")
    )
    return hashlib.sha256(normalized).hexdigest()


def load_recipe() -> dict[str, Any]:
    """Read the explicitly selected recipe and verify its source contract."""

    recipe_value = os.environ.get(RECIPE_ENV)
    if not recipe_value:
        raise ValueError(
            f"set {RECIPE_ENV} to a recipe, or render through tools/render_catalog.py"
        )
    recipe_path = Path(recipe_value).resolve()
    if not recipe_path.is_file():
        raise ValueError(f"SVG motion recipe does not exist: {recipe_path}")

    with recipe_path.open(encoding="utf-8") as handle:
        recipe = json.load(handle)
    if recipe.get("schemaVersion") != 1:
        raise ValueError("SVG motion recipes must use schemaVersion 1")

    source = recipe.get("source")
    if not isinstance(source, dict) or not isinstance(source.get("path"), str):
        raise ValueError("recipe.source.path must be a string")
    source_path = (ROOT / source["path"]).resolve()
    if ROOT not in source_path.parents or not source_path.is_file():
        raise ValueError(f"recipe source is missing or outside animations: {source_path}")

    actual_hash = canonical_source_hash(source_path)
    if source.get("sha256") != actual_hash:
        raise ValueError(
            f"source hash changed for {source_path.name}; reopen it in the SVG bench"
        )
    recipe["_sourcePath"] = source_path
    return recipe


def group_colors(recipe: dict[str, Any]) -> dict[str, str]:
    groups = recipe.get("groups")
    if not isinstance(groups, list) or not groups:
        raise ValueError("recipe.groups must contain at least one named color group")
    colors: dict[str, str] = {}
    for group in groups:
        group_id = group.get("id")
        color = group.get("color")
        if not isinstance(group_id, str) or not isinstance(color, str):
            raise ValueError("each recipe group needs string id and color values")
        if group_id in colors:
            raise ValueError(f"duplicate recipe group: {group_id}")
        colors[group_id] = color
    return colors


def make_parts(
    recipe: dict[str, Any], *, colored: bool = False
) -> tuple[VGroup, dict[str, VMobject], dict[str, list[VMobject]]]:
    """Build only the source geometry explicitly named by ``recipe.parts``."""

    imported = SVGMobject(str(recipe["_sourcePath"]))
    expected_elements = recipe["source"].get("expectedElements")
    if expected_elements is not None and len(imported) != expected_elements:
        raise ValueError(
            f"{recipe['_sourcePath'].name} exposes {len(imported)} drawable elements; "
            f"the recipe expects {expected_elements}"
        )

    colors = group_colors(recipe)
    style = recipe.get("style", {})
    initial_fill = style.get("initialFill", "#f3ecda")
    fill_opacity = float(style.get("fillOpacity", 0.96))
    stroke = style.get("stroke", "#34281d")
    stroke_width = float(style.get("strokeWidth", 1.8))
    stroke_opacity = float(style.get("strokeOpacity", 0.88))

    parts = VGroup()
    by_id: dict[str, VMobject] = {}
    by_group: dict[str, list[VMobject]] = {group_id: [] for group_id in colors}
    part_specs = recipe.get("parts")
    if not isinstance(part_specs, list) or not part_specs:
        raise ValueError("recipe.parts must explicitly include at least one part")

    for spec in part_specs:
        part_id = spec.get("id")
        group_id = spec.get("group")
        source = spec.get("source")
        if not isinstance(part_id, str) or part_id in by_id:
            raise ValueError(f"invalid or duplicate part id: {part_id!r}")
        if group_id not in colors:
            raise ValueError(f"part {part_id!r} uses unknown group {group_id!r}")
        if not isinstance(source, dict) or not isinstance(source.get("element"), int):
            raise ValueError(f"part {part_id!r} needs a source element index")

        element_index = source["element"]
        if element_index < 0 or element_index >= len(imported):
            raise ValueError(f"part {part_id!r} source element is out of range")
        source_element = imported[element_index]
        subpath_index = source.get("subpath")
        if subpath_index is None:
            part = source_element.copy()
        else:
            if not isinstance(subpath_index, int):
                raise ValueError(f"part {part_id!r} subpath must be an integer or null")
            subpaths = source_element.get_subpaths()
            if subpath_index < 0 or subpath_index >= len(subpaths):
                raise ValueError(f"part {part_id!r} source subpath is out of range")
            part = VMobject()
            part.set_points(subpaths[subpath_index].copy())

        part.set_fill(colors[group_id] if colored else initial_fill, opacity=fill_opacity)
        part.set_stroke(stroke, width=stroke_width, opacity=stroke_opacity)
        parts.add(part)
        by_id[part_id] = part
        by_group[group_id].append(part)

    parts.set_height(float(style.get("height", 4.35)))
    parts.move_to(ORIGIN)
    return parts, by_id, by_group


class RecipeRuntime:
    def __init__(self, scene: Scene, recipe: dict[str, Any]) -> None:
        self.scene = scene
        self.recipe = recipe
        self.parts, self.by_id, self.by_group = make_parts(recipe)
        self.colors = group_colors(recipe)
        self.checkpoints: dict[str, dict[str, VMobject]] = {}

    def target_ids(self, target: str | None) -> list[str]:
        if target in (None, "all"):
            return list(self.by_id)
        if target in self.by_group:
            group_parts = self.by_group[target]
            return [
                part_id
                for part_id, part in self.by_id.items()
                if any(part is group_part for group_part in group_parts)
            ]
        if target in self.by_id:
            return [target]
        raise ValueError(f"unknown recipe target: {target!r}")

    def targets(self, step: dict[str, Any]) -> list[VMobject]:
        return [self.by_id[part_id] for part_id in self.target_ids(step.get("target"))]

    def rate_func(self, step: dict[str, Any]):
        name = step.get("ease", "smooth")
        if name not in RATE_FUNCTIONS:
            raise ValueError(f"unsupported recipe easing: {name!r}")
        return RATE_FUNCTIONS[name]

    def play(self, step: dict[str, Any]) -> None:
        verb = step.get("verb")
        if verb == "draw":
            self.draw(step)
        elif verb == "style":
            self.style(step)
        elif verb == "checkpoint":
            self.checkpoint(step)
        elif verb == "transform":
            self.transform(step)
        elif verb == "restore":
            self.restore(step)
        elif verb == "fade":
            self.fade(step)
        elif verb == "wait":
            self.scene.wait(float(step.get("duration", 0)))
        else:
            raise ValueError(f"unsupported recipe verb: {verb!r}")

    def draw(self, step: dict[str, Any]) -> None:
        targets = self.targets(step)
        if not targets:
            return
        self.scene.play(
            LaggedStart(
                *(DrawBorderThenFill(part) for part in targets),
                lag_ratio=float(step.get("staggerRatio", 0)),
            ),
            run_time=float(step["duration"]),
            rate_func=self.rate_func(step),
        )

    def style(self, step: dict[str, Any]) -> None:
        animations = []
        for part_id in self.target_ids(step.get("target")):
            part = self.by_id[part_id]
            group_id = next(
                spec["group"] for spec in self.recipe["parts"] if spec["id"] == part_id
            )
            animations.append(
                part.animate.set_fill(
                    step.get("fill", self.colors[group_id]),
                    opacity=float(step.get("fillOpacity", self.recipe["style"]["fillOpacity"])),
                )
            )
        if not animations:
            return
        self.scene.play(
            LaggedStart(
                *animations,
                lag_ratio=float(step.get("staggerRatio", 0)),
            ),
            run_time=float(step["duration"]),
            rate_func=self.rate_func(step),
        )

    def checkpoint(self, step: dict[str, Any]) -> None:
        name = step.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError("checkpoint steps need a name")
        self.checkpoints[name] = {
            part_id: self.by_id[part_id].copy()
            for part_id in self.target_ids(step.get("target"))
        }

    def transform(self, step: dict[str, Any]) -> None:
        targets = self.targets(step)
        if not targets:
            return
        mode = step.get("mode", "together")
        if mode == "together":
            group = VGroup(*targets)
            animation = group.animate
            shift = step.get("shift")
            if shift is not None:
                animation = animation.shift(np.array(shift, dtype=float))
            if "scale" in step:
                animation = animation.scale(float(step["scale"]))
            if "rotate" in step:
                animation = animation.rotate(float(step["rotate"]), about_point=ORIGIN)
            self.scene.play(
                animation,
                run_time=float(step["duration"]),
                rate_func=self.rate_func(step),
            )
            return

        if mode != "radial":
            raise ValueError(f"unsupported transform mode: {mode!r}")
        distance = float(step.get("distance", 0.6))
        distance_step = float(step.get("distanceStep", 0))
        rotation_step = float(step.get("rotationStep", 0))
        scale_base = float(step.get("scaleBase", 1))
        scale_step = float(step.get("scaleStep", 0))
        center_angle = np.deg2rad(float(step.get("centerAngleDegrees", 0)))
        animations = []
        for index, part in enumerate(targets):
            center = part.get_center()
            length = np.linalg.norm(center[:2])
            if length < 1e-6:
                angle = center_angle + index * TAU / max(1, len(targets))
                direction = np.array([np.cos(angle), np.sin(angle), 0.0])
            else:
                direction = center / length
            animations.append(
                part.animate.shift(direction * (distance + distance_step * (index % 3)))
                .rotate(((index % 3) - 1) * rotation_step)
                .scale(scale_base + scale_step * (index % 3))
            )
        self.scene.play(
            *animations,
            run_time=float(step["duration"]),
            rate_func=self.rate_func(step),
        )

    def restore(self, step: dict[str, Any]) -> None:
        name = step.get("name")
        checkpoint = self.checkpoints.get(name)
        if checkpoint is None:
            raise ValueError(f"unknown checkpoint: {name!r}")
        target_ids = set(self.target_ids(step.get("target")))
        animations = [
            Transform(self.by_id[part_id], saved.copy())
            for part_id, saved in checkpoint.items()
            if part_id in target_ids
        ]
        if not animations:
            return
        self.scene.play(
            *animations,
            run_time=float(step["duration"]),
            rate_func=self.rate_func(step),
        )

    def fade(self, step: dict[str, Any]) -> None:
        targets = self.targets(step)
        if not targets:
            return
        group = VGroup(*targets)
        self.scene.play(
            FadeOut(group, scale=float(step.get("scale", 1))),
            run_time=float(step["duration"]),
            rate_func=self.rate_func(step),
        )


class SvgRecipeScene(Scene):
    """Render the ordered, deliberately small motion recipe."""

    def construct(self) -> None:
        recipe = load_recipe()
        runtime = RecipeRuntime(self, recipe)
        for step in recipe["timeline"]:
            runtime.play(step)


class SvgRecipePoster(Scene):
    """Hold the assembled, group-colored source state."""

    def construct(self) -> None:
        recipe = load_recipe()
        parts, _, _ = make_parts(recipe, colored=True)
        self.add(parts)
