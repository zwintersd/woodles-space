import { createVersionedStorage } from '@woodles/persistence';
import type { GameDef } from '@woodles/incremental-core';
import { untrack } from 'svelte';

/**
 * The first-run tour.
 *
 * Every step completes by **observing what actually happened** to the def and
 * the running simulation — never by clicking "next". That is the difference
 * between a tutorial and a slideshow: the tour cannot claim you did something
 * you didn't, and it cannot get out of step with the app, because it reads the
 * same stores everything else reads.
 *
 * It teaches exactly the loop the tool exists for: count something, make
 * something that produces it, watch it run, look at the curve, add a lever,
 * then find the wall.
 */

/** Which bit of chrome the current step is pointing at. */
export type TourTarget =
	| 'sidebar-currency'
	| 'sidebar-generator'
	| 'sidebar-upgrade'
	| 'playtest'
	| 'inspector'
	| 'balance';

/** Everything a step is allowed to look at to decide whether it's done. */
export interface TourContext {
	def: GameDef;
	selectedId: string | null;
	/** Game-seconds the playtest has advanced. */
	elapsed: number;
	/** How many balance runs have come back. */
	balanceRuns: number;
}

export interface TourStep {
	id: string;
	title: string;
	/** Why this matters — one sentence, no jargon the tour hasn't earned. */
	body: string;
	/** The action that completes it. */
	hint: string;
	target: TourTarget;
	done(ctx: TourContext): boolean;
}

/**
 * The shape a brand-new generator arrives in — see `newGenerator` in the studio
 * store. A generator that still matches it has been created but not yet looked
 * at, which is the distinction the "tune it" step turns on.
 */
const FRESH_GENERATOR = { baseRate: 1, costBase: 10, rateCurveKind: 'polynomial' } as const;

export function hasTunedGenerator(def: GameDef): boolean {
	return def.generators.some(
		(generator) =>
			generator.baseRate !== FRESH_GENERATOR.baseRate ||
			generator.cost.base !== FRESH_GENERATOR.costBase ||
			generator.rateCurve.kind !== FRESH_GENERATOR.rateCurveKind
	);
}

export const TOUR_STEPS: readonly TourStep[] = Object.freeze([
	{
		id: 'currency',
		title: 'Start with what you count',
		body: 'Every incremental game counts something — petals, atoms, biscuits. A currency is that something.',
		hint: 'Systems → Currencies → +',
		target: 'sidebar-currency',
		done: (ctx) => ctx.def.currencies.length > 0
	},
	{
		id: 'generator',
		title: 'Something has to make it',
		body: 'A generator produces your currency, second after second. New ones arrive already wired to the currency you just made.',
		hint: 'Systems → Generators → +',
		target: 'sidebar-generator',
		done: (ctx) => ctx.def.generators.length > 0
	},
	{
		id: 'play',
		title: 'Watch it run',
		body: 'The playtest runs your game at ten times speed, and the numbers on every card go live. Watching is the whole point — this is a feel you cannot get from a spreadsheet.',
		hint: 'Press ▶ Play in the Playtest dock',
		target: 'playtest',
		done: (ctx) => ctx.elapsed > 0
	},
	{
		id: 'curve',
		title: 'Tune it, and watch the curve move',
		body: 'Select the generator and change its base gain. The inspector plots cost against output as you type — the gap between those two lines is your entire pacing problem, drawn.',
		hint: 'Select the generator → change Base Gain',
		target: 'inspector',
		// Deliberately *not* "is a generator selected": creating one already
		// selects it, so that step would tick itself before the learner had
		// looked at anything. Changing a number is a thing they actually did.
		done: (ctx) => hasTunedGenerator(ctx.def)
	},
	{
		id: 'upgrade',
		title: 'Give the player a lever',
		body: 'An upgrade multiplies what a generator makes. Drag from an upgrade to any generator or currency to point it somewhere new — that drag edits the data, so the graph can never lie to you.',
		hint: 'Systems → Upgrades → +',
		target: 'sidebar-upgrade',
		done: (ctx) => ctx.def.upgrades.length > 0
	},
	{
		id: 'balance',
		title: 'Find the wall',
		body: 'Fast-forward hours of play twice over: once for a player who never buys anything, once for one who always buys the cheapest thing. The gap between them is the room your design has to breathe.',
		hint: 'Balance tab → ⏩ Fast-forward',
		target: 'balance',
		done: (ctx) => ctx.balanceRuns > 0
	}
]);

interface OnboardingPrefs {
	/** Whether the welcome has ever been shown. */
	welcomed: boolean;
	/** Whether the tour has been finished or skipped — either way, don't nag. */
	toured: boolean;
}

const prefsStore = createVersionedStorage<OnboardingPrefs>({
	key: 'bloomforge-onboarding',
	version: 1,
	fallback: () => ({ welcomed: false, toured: false }),
	validate: (value): value is OnboardingPrefs =>
		!!value && typeof value === 'object' && typeof (value as OnboardingPrefs).welcomed === 'boolean'
});

export class Tour {
	/** The welcome dialog, shown once ever. */
	showWelcome = $state(false);
	active = $state(false);
	index = $state(0);
	/** The "that's the loop" card at the end. */
	finished = $state(false);

	get step(): TourStep | null {
		return this.active && !this.finished ? (TOUR_STEPS[this.index] ?? null) : null;
	}

	get total(): number {
		return TOUR_STEPS.length;
	}

	/** What the current step is pointing at, for the spotlight ring. */
	get spotlight(): TourTarget | null {
		return this.step?.target ?? null;
	}

	/** Decides whether a first-time visitor gets the welcome. */
	boot(): void {
		this.showWelcome = !prefsStore.load().value.welcomed;
	}

	dismissWelcome(): void {
		this.showWelcome = false;
		this.#remember({ welcomed: true });
	}

	start(): void {
		this.showWelcome = false;
		this.active = true;
		this.index = 0;
		this.finished = false;
		this.#remember({ welcomed: true });
	}

	/** Leaves the tour without finishing it. Never offered as a dead end. */
	skip(): void {
		this.active = false;
		this.finished = false;
		this.#remember({ welcomed: true, toured: true });
	}

	close(): void {
		this.active = false;
		this.finished = false;
	}

	/**
	 * Advances past every step the learner has already satisfied. Called with a
	 * fresh context whenever the world changes; reads its own position outside
	 * the reactive graph so writing to it can't feed back into the effect that
	 * called it.
	 */
	observe(ctx: TourContext): void {
		if (!this.active || this.finished) return;

		const at = untrack(() => this.index);
		let next = at;
		while (next < TOUR_STEPS.length && TOUR_STEPS[next].done(ctx)) next += 1;
		if (next === at) return;

		if (next >= TOUR_STEPS.length) {
			this.index = TOUR_STEPS.length - 1;
			this.finished = true;
			this.#remember({ welcomed: true, toured: true });
			return;
		}
		this.index = next;
	}

	#remember(patch: Partial<OnboardingPrefs>): void {
		prefsStore.save({ ...prefsStore.load().value, ...patch });
	}
}

export const tour = new Tour();

/** Whether a step is behind, at, or ahead of where the learner is. */
export function stepState(index: number, current: number, finished: boolean): 'done' | 'current' | 'todo' {
	if (finished) return 'done';
	if (index < current) return 'done';
	return index === current ? 'current' : 'todo';
}
