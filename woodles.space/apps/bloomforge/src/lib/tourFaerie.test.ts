import { describe, expect, it } from 'vitest';
import { ADVANCED_TOUR_STEPS, TOUR_STEPS, type TourTarget } from './tour.svelte.js';
import { resolveTourTarget, TOUR_PLACEMENT, tourSelector } from './tourFaerie.js';

function root(matches: Record<string, string[]>) {
	return {
		queried: [] as string[],
		querySelectorAll(selector: string) {
			this.queried.push(selector);
			return (matches[selector] ?? []) as unknown as Element[];
		}
	};
}

describe('tour faerie', () => {
	it('places Faerie for every target either tour can point at', () => {
		const targets = new Set<TourTarget>([...TOUR_STEPS, ...ADVANCED_TOUR_STEPS].map((step) => step.target));
		for (const target of targets) expect(TOUR_PLACEMENT[target], target).toBeDefined();
	});

	it('selects on a whole token, so one element can serve two targets', () => {
		expect(tourSelector('playtest')).toBe('[data-tour~="playtest"]');
	});

	it('prefers the button inside an open panel over its tab', () => {
		const tab = 'tab';
		const button = 'button';
		const dom = root({ [tourSelector('playtest')]: [tab, button] });
		expect(resolveTourTarget('playtest', dom)).toBe(button);
	});

	it('falls back to the tab when the panel is closed', () => {
		const dom = root({ [tourSelector('balance')]: ['tab'] });
		expect(resolveTourTarget('balance', dom)).toBe('tab');
	});

	it('returns null when the target is not on the page', () => {
		expect(resolveTourTarget('inspector', root({}))).toBeNull();
	});
});
