import type { FaeriePlacement } from '@woodles/faerie';
import type { TourTarget } from './tour.svelte.js';

/**
 * Where Faerie perches for each tour target.
 *
 * The tour's spotlight is a class the owner of each target applies; Faerie
 * can't see that, so each target also carries `data-tour="<target>"`. The
 * attribute is a space-separated token list, so one element can serve two
 * targets without either knowing about the other.
 */

/** The side of the target Faerie hovers on — toward the middle of the studio, away from the edge it's pinned to. */
export const TOUR_PLACEMENT: Record<TourTarget, FaeriePlacement> = {
	'sidebar-currency': 'right',
	'sidebar-generator': 'right',
	'sidebar-upgrade': 'right',
	playtest: 'top',
	balance: 'top',
	inspector: 'left'
};

export function tourSelector(target: TourTarget): string {
	return `[data-tour~="${target}"]`;
}

/** The slice of `document` the resolver needs — narrow so tests can hand it a plain object. */
export interface TourRoot {
	querySelectorAll(selector: string): ArrayLike<Element>;
}

/**
 * Finds the element a step is pointing at.
 *
 * Takes the **last** match. The playtest and balance targets are a dock tab
 * *and* the button inside that tab's panel; the button is the thing the step
 * wants pressed, and it comes after its tab in the document. When the panel
 * isn't open only the tab exists, so Faerie falls back to it — the same
 * thing the spotlight ring does.
 */
export function resolveTourTarget(target: TourTarget, root: TourRoot): Element | null {
	const matches = root.querySelectorAll(tourSelector(target));
	return matches.length ? matches[matches.length - 1] : null;
}
