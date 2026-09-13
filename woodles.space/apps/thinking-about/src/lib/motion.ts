// The app's motion vocabulary — the JS half of it.
//
// Svelte's transition directives (fly/fade/scale) are driven by JS, not CSS,
// so the `@media (prefers-reduced-motion: reduce)` block in style/tokens.css
// that silences this app's CSS animations and transitions has no effect on
// them. Route every such transition's duration through here instead: every
// helper below already collapses to nothing when motion is reduced, so a
// caller never has to ask twice.
//
// Only *exits* live here. An entrance is a CSS animation on the element
// itself (`ta-rise`, `ta-pop`, and the rest of tokens.css's vocabulary),
// which runs whenever the element is created — on a fresh board and on a
// chip added an hour later alike, without depending on whether Svelte plays
// intro transitions on a hydrated page. A leaving element has no such
// moment: the node is gone before CSS could describe it, so the exits below
// are the directive kind.

import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

export function prefersReducedMotion(): boolean {
	if (typeof matchMedia !== 'function') return false;
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function motionDuration(ms: number): number {
	return prefersReducedMotion() ? 0 : ms;
}

/** One fleck of the burst thrown off by logging a sitting. */
export type Spark = {
	id: number;
	/** degrees around the button, 0 = due right */
	angle: number;
	/** how far out it travels, in px */
	distance: number;
	delay: number;
};

/**
 * The flecks for one burst — evenly spread around the circle, with the
 * distance and delay varied by index rather than randomly, so a burst looks
 * deliberate (and reads the same in a test) instead of scattershot.
 */
export function sparkBurst(count = 7): Spark[] {
	if (!Number.isFinite(count) || count < 1) return [];
	const total = Math.floor(count);
	return Array.from({ length: total }, (_, i) => ({
		id: i,
		angle: Math.round((360 / total) * i - 90),
		distance: 13 + (i % 3) * 5,
		delay: (i % 4) * 18
	}));
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

// The row-gap a leaving element is still holding open. Collapsing only its
// height would leave that gap behind until the node is actually removed,
// which reads as a snap at the very end of an otherwise smooth exit.
function heldGap(node: Element): { side: 'margin-bottom' | 'margin-top'; size: number } | null {
	const parent = node.parentElement;
	if (!parent || typeof getComputedStyle !== 'function') return null;
	const gap = parseFloat(getComputedStyle(parent).rowGap ?? '');
	if (!Number.isFinite(gap) || gap <= 0) return null;
	// The gap sits between two siblings, so which side it is on depends on
	// where in the list the leaving node was.
	if (node.nextElementSibling) return { side: 'margin-bottom', size: gap };
	if (node.previousElementSibling) return { side: 'margin-top', size: gap };
	return null;
}

/**
 * Put away: the thing being marked done floods with its own color, gives a
 * small nod, then folds the row shut behind it.
 *
 * The flood is published as `--ta-collect` (0 → 1) rather than painted here,
 * so each caller's own stylesheet decides what "flooding" looks like for it.
 * `overflow` is only set for the length of the transition, which is why a
 * chip can still throw sparks outside its own box the rest of the time.
 */
export function collect(
	node: Element,
	{ duration = 460, commitFraction = 0.34 }: { duration?: number; commitFraction?: number } = {}
): TransitionConfig {
	const height = (node as HTMLElement).offsetHeight || 0;
	const gap = heldGap(node);
	// A flood of no length would divide by zero below, and a flood that is
	// the whole exit never folds; either way the default is the honest answer.
	const split = commitFraction > 0 && commitFraction < 1 ? commitFraction : 0.34;

	return {
		duration: motionDuration(duration),
		// Deliberately un-eased: `t` arrives as raw progress, and the two
		// phases below do their own shaping. Easing here as well would bend
		// the curve twice and move where the flood hands over to the fold.
		css: (t) => {
			const elapsed = 1 - t;
			const commit = clamp01(elapsed / split);
			const fold = cubicOut(clamp01((elapsed - split) / (1 - split)));
			const held = gap ? `${gap.side}: ${-gap.size * fold}px;` : '';

			return `
				overflow: hidden;
				--ta-collect: ${commit};
				height: ${height * (1 - fold)}px;
				opacity: ${1 - fold * fold};
				transform: translateX(${6 * fold}px) scale(${1 - 0.04 * commit - 0.05 * fold});
				${held}
			`;
		}
	};
}
