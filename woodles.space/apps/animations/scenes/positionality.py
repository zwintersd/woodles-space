from manim import *

config.background_color = "#faf6f0"  # woodles cream


def person(color=BLACK, scale=1.0):
    head = Circle(radius=0.18, color=color, stroke_width=2.5, fill_opacity=0)
    head.shift(UP * 0.18)
    body = Line(ORIGIN, DOWN * 0.55, color=color, stroke_width=2.5)
    l_arm = Line(DOWN * 0.15, DOWN * 0.15 + LEFT * 0.28 + DOWN * 0.22, color=color, stroke_width=2.5)
    r_arm = Line(DOWN * 0.15, DOWN * 0.15 + RIGHT * 0.28 + DOWN * 0.22, color=color, stroke_width=2.5)
    l_leg = Line(DOWN * 0.55, DOWN * 0.55 + LEFT * 0.22 + DOWN * 0.35, color=color, stroke_width=2.5)
    r_leg = Line(DOWN * 0.55, DOWN * 0.55 + RIGHT * 0.22 + DOWN * 0.35, color=color, stroke_width=2.5)
    fig = VGroup(head, body, l_arm, r_arm, l_leg, r_leg)
    fig.scale(scale)
    return fig


class PositionalityScene(Scene):
    """
    Positionality — where we stand shapes what we see.

    A person sits at the center of a circle (their world-view).
    A wedge represents their current vantage point — the slice of
    reality visible from where they're standing. The wedge sweeps
    around the circle to show that rotating perspective (positionality)
    changes what's illuminated.
    """

    def construct(self):
        # ── palette ────────────────────────────────────────────────────
        ink = "#2e2040"
        lapis = "#3a2d72"
        lavender = "#c9bfee"
        peach = "#f5c8a8"
        aqua = "#8eddd4"

        # ── person ─────────────────────────────────────────────────────
        figure = person(color=ink)
        figure.move_to(ORIGIN)

        # ── context circle ─────────────────────────────────────────────
        ring = Circle(radius=2.2, color=lapis, stroke_width=2)

        # ── positionality wedge ────────────────────────────────────────
        # The wedge represents a vantage point — a slice of the circle
        # visible from the person's position.
        wedge = Sector(
            inner_radius=0.5,
            outer_radius=2.2,
            angle=PI / 4,       # ~45° slice
            start_angle=PI / 2, # start pointing up
            color=lavender,
            fill_opacity=0.45,
            stroke_width=0,
        )

        # ── label: "positionality" ─────────────────────────────────────
        label = Text(
            "positionality",
            font="Georgia",
            color=ink,
            font_size=22,
            slant=ITALIC,
        ).to_edge(DOWN, buff=0.5)

        sublabel = Text(
            "where you stand shapes what you see",
            font="Georgia",
            color=lapis,
            font_size=14,
        ).next_to(label, DOWN, buff=0.12)

        # ── act 1: person appears ───────────────────────────────────────
        self.play(FadeIn(figure, scale=0.7), run_time=0.8)
        self.wait(0.3)

        # ── act 2: context circle grows ────────────────────────────────
        self.play(Create(ring), run_time=1.0)
        self.wait(0.2)

        # ── act 3: wedge fades in at starting position ─────────────────
        self.play(FadeIn(wedge), run_time=0.6)
        self.wait(0.4)

        # ── act 4: labels appear ───────────────────────────────────────
        self.play(
            Write(label),
            FadeIn(sublabel, shift=UP * 0.1),
            run_time=0.9,
        )
        self.wait(0.5)

        # ── act 5: wedge sweeps around — positionality in motion ───────
        self.play(
            Rotate(wedge, angle=TAU, about_point=ORIGIN),
            run_time=4.0,
            rate_func=linear,
        )
        self.wait(0.4)

        # ── act 6: wedge settles, then shrinks to show constraint ───────
        self.play(
            wedge.animate.scale(0.5).set_fill(peach, opacity=0.6),
            run_time=0.8,
        )
        self.play(
            wedge.animate.scale(2.0).set_fill(aqua, opacity=0.4),
            run_time=0.8,
        )
        self.play(
            wedge.animate.scale(1 / 1.0).set_fill(lavender, opacity=0.45),
            run_time=0.6,
        )

        self.wait(1.0)


class PositionalitySceneGif(PositionalityScene):
    """Same scene configured for GIF output (lower resolution, shorter)."""
    pass
