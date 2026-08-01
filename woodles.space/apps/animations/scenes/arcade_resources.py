"""Small, transparent motion studies for the Marginalia Arcade workshop.

These scenes are deliberately visual-only. They know nothing about game state,
rewards, timing loops, collision, or any individual cabinet game. Rendered
previews are reviewed in Hygge before any still or frame sequence is promoted
into Marginalia.
"""

from manim import (
    AnimationGroup,
    Arc,
    ArcBetweenPoints,
    Circle,
    Create,
    Dot,
    DrawBorderThenFill,
    Ellipse,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    LaggedStart,
    Line,
    ORIGIN,
    PI,
    Polygon,
    Rotate,
    Scene,
    TAU,
    VGroup,
    config,
    linear,
    smooth,
)
import numpy as np


# A square logical stage keeps the studies useful as icons, overlays, or future
# frame sequences. Pixel dimensions and frame rate stay in arcade-catalog.json.
config.frame_width = 6.4
config.frame_height = 6.4
config.background_opacity = 0.0

INK = "#34281d"
ROSE = "#b8506c"
DEEP_ROSE = "#7c3349"
SAGE = "#5f7a52"
MUTED_ROSE = "#8a5568"
PARCHMENT = "#f3ecda"


def radial_point(radius: float, angle: float) -> np.ndarray:
    return np.array([radius * np.cos(angle), radius * np.sin(angle), 0.0])


def four_point_star(radius: float = 0.38, color: str = ROSE) -> Polygon:
    points = []
    for index in range(8):
        angle = PI / 2 + index * PI / 4
        point_radius = radius if index % 2 == 0 else radius * 0.27
        points.append(radial_point(point_radius, angle))
    return Polygon(
        *points,
        color=color,
        stroke_width=2.2,
        fill_color=PARCHMENT,
        fill_opacity=0.96,
    )


def make_ink_bloom():
    core = Dot(ORIGIN, radius=0.14, color=DEEP_ROSE)
    wash = Circle(
        radius=0.32,
        stroke_width=0,
        fill_color=ROSE,
        fill_opacity=0.24,
    )
    rings = VGroup(
        Circle(radius=0.48, color=DEEP_ROSE, stroke_width=4.2),
        Circle(radius=0.72, color=MUTED_ROSE, stroke_width=2.8),
        Circle(radius=0.94, color=SAGE, stroke_width=2.0),
    )
    rays = VGroup()
    droplets = VGroup()
    for index in range(12):
        angle = index * TAU / 12
        start = radial_point(0.5, angle)
        end = radial_point(1.35 if index % 2 == 0 else 1.05, angle)
        rays.add(Line(start, end, color=INK, stroke_width=2.0).set_opacity(0.72))
        droplets.add(
            Dot(
                radial_point(0.74, angle + 0.08),
                radius=0.055 if index % 3 else 0.08,
                color=ROSE if index % 2 else SAGE,
            )
        )
    return core, wash, rings, rays, droplets


def make_orbiting_motes():
    arcs = VGroup(
        Arc(radius=1.12, start_angle=0.08, angle=1.45, color=SAGE, stroke_width=3.0),
        Arc(radius=1.12, start_angle=2.18, angle=1.02, color=ROSE, stroke_width=3.0),
        Arc(radius=1.12, start_angle=4.08, angle=1.37, color=MUTED_ROSE, stroke_width=3.0),
        Arc(radius=0.72, start_angle=0.62, angle=2.25, color=INK, stroke_width=1.7),
    )
    arcs.set_opacity(0.76)
    motes = VGroup()
    mote_specs = (
        (1.12, 0.12, 0.095, ROSE),
        (1.12, 2.22, 0.07, SAGE),
        (1.12, 4.14, 0.075, MUTED_ROSE),
        (0.72, 0.68, 0.06, INK),
        (0.72, 3.04, 0.05, ROSE),
    )
    for radius, angle, size, color in mote_specs:
        motes.add(Dot(radial_point(radius, angle), radius=size, color=color))
    center = VGroup(
        Circle(radius=0.26, color=SAGE, stroke_width=2.0).set_opacity(0.64),
        Dot(radius=0.065, color=ROSE),
    )
    return VGroup(arcs, motes), center


def make_margin_flourish():
    stem = ArcBetweenPoints(
        np.array([-2.0, -0.82, 0.0]),
        np.array([1.48, 0.76, 0.0]),
        angle=-0.38,
        color=INK,
        stroke_width=4.2,
    )
    echo = ArcBetweenPoints(
        np.array([-1.65, -1.02, 0.0]),
        np.array([1.7, 0.48, 0.0]),
        angle=-0.27,
        color=MUTED_ROSE,
        stroke_width=1.7,
    ).set_opacity(0.52)
    leaf_specs = (
        (-1.08, -0.47, 0.44, 0.18, 0.48, SAGE),
        (-0.45, -0.13, 0.52, 0.2, -0.58, ROSE),
        (0.26, 0.25, 0.46, 0.18, 0.5, SAGE),
        (0.88, 0.56, 0.42, 0.17, -0.55, MUTED_ROSE),
    )
    leaves = VGroup()
    for x, y, width, height, angle, color in leaf_specs:
        leaf = Ellipse(
            width=width,
            height=height,
            color=color,
            stroke_width=1.8,
            fill_color=color,
            fill_opacity=0.38,
        )
        leaf.rotate(angle).move_to(np.array([x, y, 0.0]))
        leaves.add(leaf)
    star = four_point_star().move_to(np.array([1.68, 0.98, 0.0]))
    dust = VGroup(
        Dot(np.array([1.15, 1.14, 0.0]), radius=0.045, color=SAGE),
        Dot(np.array([1.94, 0.54, 0.0]), radius=0.055, color=ROSE),
        Dot(np.array([1.95, 1.35, 0.0]), radius=0.035, color=INK),
    )
    return stem, echo, leaves, star, dust


class InkBloom(Scene):
    """A compact, one-shot impact or reveal accent."""

    def construct(self):
        core, wash, rings, rays, droplets = make_ink_bloom()
        rings.set_opacity(0.0)

        self.play(GrowFromCenter(wash), GrowFromCenter(core), run_time=0.22)
        self.play(
            LaggedStart(*(Create(ray) for ray in rays), lag_ratio=0.025),
            LaggedStart(*(FadeIn(dot, scale=0.4) for dot in droplets), lag_ratio=0.025),
            AnimationGroup(
                *(
                    ring.animate.set_opacity(0.78).scale(1.05 + index * 0.08)
                    for index, ring in enumerate(rings)
                )
            ),
            run_time=0.48,
        )
        self.play(
            *(
                ring.animate.scale(2.0 + index * 0.18).set_opacity(0.0)
                for index, ring in enumerate(rings)
            ),
            *(
                dot.animate.shift(dot.get_center() * 1.35).scale(0.25).set_opacity(0.0)
                for dot in droplets
            ),
            FadeOut(rays, scale=1.35),
            FadeOut(core, scale=0.2),
            FadeOut(wash, scale=2.4),
            run_time=0.82,
            rate_func=smooth,
        )
        self.wait(0.08)


class OrbitingMotes(Scene):
    """A full-turn loop whose first and last frames share the same geometry."""

    def construct(self):
        orbit, center = make_orbiting_motes()
        self.add(orbit, center)
        self.play(
            Rotate(orbit, angle=TAU, about_point=ORIGIN, rate_func=linear),
            Rotate(center[0], angle=-TAU, about_point=ORIGIN, rate_func=linear),
            run_time=3.2,
        )


class MarginFlourish(Scene):
    """A hand-drawn reveal mark for rooms, mastery, or discoveries."""

    def construct(self):
        stem, echo, leaves, star, dust = make_margin_flourish()

        self.play(Create(stem), Create(echo), run_time=0.66, rate_func=smooth)
        self.play(
            LaggedStart(*(GrowFromCenter(leaf) for leaf in leaves), lag_ratio=0.13),
            run_time=0.54,
        )
        self.play(
            DrawBorderThenFill(star),
            LaggedStart(*(FadeIn(dot, scale=0.25) for dot in dust), lag_ratio=0.1),
            run_time=0.4,
        )
        self.play(
            FadeOut(VGroup(stem, echo, leaves), shift=np.array([0.16, 0.06, 0.0])),
            FadeOut(star, scale=1.35),
            FadeOut(dust, scale=0.2),
            run_time=0.38,
        )
        self.wait(0.06)


class InkBloomPoster(Scene):
    """Representative still for reduced motion and a completed one-shot."""

    def construct(self):
        core, wash, rings, rays, droplets = make_ink_bloom()
        rings.set_opacity(0.78)
        wash.scale(1.15)
        self.add(wash, rings, rays, droplets, core)


class OrbitingMotesPoster(Scene):
    """Representative still for the charged-state loop."""

    def construct(self):
        orbit, center = make_orbiting_motes()
        self.add(orbit, center)


class MarginFlourishPoster(Scene):
    """Representative still for the completed discovery flourish."""

    def construct(self):
        stem, echo, leaves, star, dust = make_margin_flourish()
        self.add(stem, echo, leaves, star, dust)
