import { blankGameDef, cozyGarden, emptyGameDef, type GameDef } from '@woodles/incremental-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasTunedGenerator, stepState, Tour, TOUR_STEPS, type TourContext } from './tour.svelte.js';
import { Studio } from './studio.svelte.js';

function context(overrides: Partial<TourContext> = {}): TourContext {
	return { def: blankGameDef(), selectedId: null, elapsed: 0, balanceRuns: 0, ...overrides };
}

/**
 * A project in exactly the state the tour leaves it after step 2 — built with
 * the real factory, so the "fresh generator" the tune step compares against
 * stays honest if that factory ever changes.
 */
function withFreshGenerator(): GameDef {
	const studio = new Studio();
	studio.open('test', blankGameDef());
	studio.create('currency');
	studio.create('generator');
	// Through the studio's own serializer, which already unwraps the rune proxy.
	return JSON.parse(studio.toJSON()) as GameDef;
}

/** The state a learner is in after finishing every step. */
function allDone(): TourContext {
	return context({ def: cozyGarden, selectedId: 'petal-farm', elapsed: 12, balanceRuns: 2 });
}

beforeEach(() => {
	localStorage.clear();
});

describe('the steps themselves', () => {
	it('starts with none of them satisfied on a blank canvas', () => {
		// The tour opens a genuinely empty project precisely so this holds — on
		// the default starter, two steps would already be ticked before you did
		// anything, which reads as the tour lying to you.
		const ctx = context();
		for (const step of TOUR_STEPS) expect(step.done(ctx), step.id).toBe(false);
	});

	it('would skip ahead on the default starter, which is why it does not use one', () => {
		const ctx = context({ def: emptyGameDef() });
		expect(TOUR_STEPS[0].done(ctx)).toBe(true);
		expect(TOUR_STEPS[1].done(ctx)).toBe(true);
	});

	it('ends with all of them satisfied', () => {
		const ctx = allDone();
		for (const step of TOUR_STEPS) expect(step.done(ctx), step.id).toBe(true);
	});

	it('does not count merely selecting a generator as tuning it', () => {
		// Creating a generator selects it, so a step that turned on selection
		// would tick itself before the learner had looked at anything.
		const step = TOUR_STEPS.find((entry) => entry.id === 'curve')!;
		const fresh = withFreshGenerator();

		expect(step.done(context({ def: fresh, selectedId: 'gen' }))).toBe(false);

		const tuned = structuredClone(fresh);
		tuned.generators[0].baseRate = 4.8;
		expect(step.done(context({ def: tuned, selectedId: null }))).toBe(true);
	});

	it('counts a change to the cost or the curve shape as tuning too', () => {
		const costed = withFreshGenerator();
		costed.generators[0].cost.base = 15;
		expect(hasTunedGenerator(costed)).toBe(true);

		const reshaped = withFreshGenerator();
		reshaped.generators[0].rateCurve = { kind: 'geometric', growth: 1.1 };
		expect(hasTunedGenerator(reshaped)).toBe(true);

		expect(hasTunedGenerator(withFreshGenerator())).toBe(false);
	});

	it('gives every step a distinct id, a hint and a target', () => {
		expect(new Set(TOUR_STEPS.map((step) => step.id)).size).toBe(TOUR_STEPS.length);
		for (const step of TOUR_STEPS) {
			expect(step.title.length, step.id).toBeGreaterThan(0);
			expect(step.hint.length, step.id).toBeGreaterThan(0);
			expect(step.target.length, step.id).toBeGreaterThan(0);
		}
	});
});

describe('advancing', () => {
	it('does nothing until the learner actually does the thing', () => {
		const tour = new Tour();
		tour.start();
		expect(tour.index).toBe(0);

		tour.observe(context());
		expect(tour.index).toBe(0);
		expect(tour.step?.id).toBe('currency');
	});

	it('moves on when the def gains a currency', () => {
		const tour = new Tour();
		tour.start();

		const withCurrency: GameDef = { ...blankGameDef(), currencies: cozyGarden.currencies };
		tour.observe(context({ def: withCurrency }));
		expect(tour.step?.id).toBe('generator');
	});

	it('skips past everything already true, in one pass', () => {
		// Someone who wandered off and built half a game shouldn't be walked
		// through steps they've already completed.
		const tour = new Tour();
		tour.start();
		// The cozy garden has currencies, generators, tuned rates and upgrades —
		// so everything but the balance run is already behind them.
		tour.observe(context({ def: cozyGarden, elapsed: 5 }));
		expect(tour.step?.id).toBe('balance');
	});

	it('finishes when the last step lands', () => {
		const tour = new Tour();
		tour.start();
		tour.observe(allDone());
		expect(tour.finished).toBe(true);
		expect(tour.step).toBeNull();
		expect(tour.spotlight).toBeNull();
	});

	it('ignores the world while it is not running', () => {
		const tour = new Tour();
		expect(tour.active).toBe(false);
		tour.observe(allDone());
		expect(tour.index).toBe(0);
		expect(tour.finished).toBe(false);
	});

	it('never advances past the end, however many times it is told', () => {
		const tour = new Tour();
		tour.start();
		for (let i = 0; i < 5; i += 1) tour.observe(allDone());
		expect(tour.index).toBeLessThan(TOUR_STEPS.length);
		expect(tour.finished).toBe(true);
	});
});

describe('the spotlight', () => {
	it('points at whatever the current step is about', () => {
		const tour = new Tour();
		tour.start();
		expect(tour.spotlight).toBe('sidebar-currency');

		tour.observe(context({ def: { ...blankGameDef(), currencies: cozyGarden.currencies } }));
		expect(tour.spotlight).toBe('sidebar-generator');
	});

	it('goes dark when the tour is not running', () => {
		const tour = new Tour();
		expect(tour.spotlight).toBeNull();
		tour.start();
		tour.skip();
		expect(tour.spotlight).toBeNull();
	});
});

describe('remembering the visitor', () => {
	it('welcomes someone who has never been here', () => {
		const tour = new Tour();
		tour.boot();
		expect(tour.showWelcome).toBe(true);
	});

	it('does not welcome them twice', () => {
		const first = new Tour();
		first.boot();
		first.dismissWelcome();

		const second = new Tour();
		second.boot();
		expect(second.showWelcome).toBe(false);
	});

	it('treats starting the tour as having been welcomed', () => {
		const first = new Tour();
		first.boot();
		first.start();

		const second = new Tour();
		second.boot();
		expect(second.showWelcome).toBe(false);
	});

	it('lets the tour be taken again after it was skipped', () => {
		// Skipping means "not now", never "never again" — the ? button has to
		// keep working.
		const tour = new Tour();
		tour.start();
		tour.skip();
		expect(tour.active).toBe(false);

		tour.start();
		expect(tour.active).toBe(true);
		expect(tour.index).toBe(0);
		expect(tour.finished).toBe(false);
	});
});

describe('progress pips', () => {
	it('marks what is behind, at, and ahead of the learner', () => {
		expect(stepState(0, 2, false)).toBe('done');
		expect(stepState(2, 2, false)).toBe('current');
		expect(stepState(3, 2, false)).toBe('todo');
	});

	it('fills every pip once the tour is finished', () => {
		for (let i = 0; i < TOUR_STEPS.length; i += 1) expect(stepState(i, 0, true)).toBe('done');
	});
});
