import {
	apiaryOfBadDecisions,
	blankGameDef,
	choirOfUnspokenNames,
	confessionBooth,
	cozyGarden,
	emptyGameDef,
	type GameDef
} from '@woodles/incremental-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADVANCED_TOUR_STEPS, hasTunedGenerator, stepState, Tour, TOUR_STEPS, type TourContext } from './tour.svelte.js';
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

describe('the advanced steps', () => {
	it('starts with none of them satisfied on a blank canvas', () => {
		const ctx = context();
		for (const step of ADVANCED_TOUR_STEPS) expect(step.done(ctx), step.id).toBe(false);
	});

	it('reads a tag on a generator, an upgrade, or a prestige layer as the same thing', () => {
		const step = ADVANCED_TOUR_STEPS.find((entry) => entry.id === 'tags')!;

		const onGenerator = blankGameDef();
		onGenerator.generators.push({
			id: 'g',
			name: 'G',
			producesCurrencyId: 'c',
			baseRate: 1,
			rateCurve: { kind: 'polynomial', exponent: 1 },
			cost: { currencyId: 'c', base: 1, curve: { kind: 'geometric', growth: 1.1 } },
			tags: ['devotional']
		});
		expect(step.done(context({ def: onGenerator }))).toBe(true);

		const onUpgrade = blankGameDef();
		onUpgrade.upgrades.push({
			id: 'u',
			name: 'U',
			cost: { currencyId: 'c', amount: 1 },
			effects: [],
			tags: ['devotional']
		});
		expect(step.done(context({ def: onUpgrade }))).toBe(true);

		// The real shipped sample this step is drawn from.
		expect(step.done(context({ def: choirOfUnspokenNames }))).toBe(true);
	});

	it('recognizes a populationBoost by either metric', () => {
		const step = ADVANCED_TOUR_STEPS.find((entry) => entry.id === 'population')!;
		expect(step.done(context({ def: apiaryOfBadDecisions }))).toBe(true); // unequippedUpgrades
		expect(step.done(context({ def: choirOfUnspokenNames }))).toBe(true); // taggedLevelSum
	});

	it('recognizes a spendTax and a converts as two separate steps', () => {
		const tax = ADVANCED_TOUR_STEPS.find((entry) => entry.id === 'spend-tax')!;
		const converts = ADVANCED_TOUR_STEPS.find((entry) => entry.id === 'converts')!;

		expect(tax.done(context({ def: confessionBooth }))).toBe(true);
		expect(converts.done(context({ def: confessionBooth }))).toBe(true);
		// Neither of the Confession Booth's own features is the other's.
		expect(tax.done(context({ def: choirOfUnspokenNames }))).toBe(false);
		expect(converts.done(context({ def: apiaryOfBadDecisions }))).toBe(false);
	});

	it('gives every advanced step a distinct id, a hint and a target', () => {
		expect(new Set(ADVANCED_TOUR_STEPS.map((step) => step.id)).size).toBe(ADVANCED_TOUR_STEPS.length);
		for (const step of ADVANCED_TOUR_STEPS) {
			expect(step.title.length, step.id).toBeGreaterThan(0);
			expect(step.hint.length, step.id).toBeGreaterThan(0);
			expect(step.target.length, step.id).toBeGreaterThan(0);
		}
	});

	it('shares no id with a core step', () => {
		const core = new Set(TOUR_STEPS.map((step) => step.id));
		for (const step of ADVANCED_TOUR_STEPS) expect(core.has(step.id), step.id).toBe(false);
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

describe('the advanced track', () => {
	/**
	 * No single shipped sample satisfies all four predicates at once — each was
	 * built to stress one or two of them. This stitches a minimal def where
	 * every step is done simultaneously, the way `allDone()` above leans on
	 * `cozyGarden` doing that for the core six.
	 */
	function allAdvancedDone(): TourContext {
		const def = blankGameDef();
		def.currencies.push(
			{ id: 'c1', name: 'C1', color: '#fff', format: { decimalPlaces: 0, notation: 'plain' }, spendTax: { intoCurrencyId: 'c2', rate: 1 } },
			{ id: 'c2', name: 'C2', color: '#fff', format: { decimalPlaces: 0, notation: 'plain' } }
		);
		def.generators.push(
			{
				id: 'g1',
				name: 'G1',
				producesCurrencyId: 'c1',
				baseRate: 1,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'c1', base: 1, curve: { kind: 'geometric', growth: 1.1 } },
				tags: ['devotional']
			},
			{
				id: 'g2',
				name: 'G2',
				producesCurrencyId: 'c2',
				baseRate: 1,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'c1', base: 1, curve: { kind: 'geometric', growth: 1.1 } },
				populationBoost: { metric: 'taggedLevelSum', tag: 'devotional', perUnit: 1 },
				converts: { fromCurrencyId: 'c1', ratio: 1 }
			}
		);
		return context({ def });
	}

	it('starts a fresh pass at index 0, unfinished', () => {
		const tour = new Tour();
		tour.start();
		tour.observe(allDone());
		expect(tour.finished).toBe(true);

		tour.startAdvanced();
		expect(tour.active).toBe(true);
		expect(tour.track).toBe('advanced');
		expect(tour.index).toBe(0);
		expect(tour.finished).toBe(false);
		expect(tour.step?.id).toBe('tags');
		expect(tour.total).toBe(ADVANCED_TOUR_STEPS.length);
	});

	it('observes against the advanced steps once switched, not the core ones', () => {
		const tour = new Tour();
		tour.start();
		tour.startAdvanced();

		// A currency and a generator alone satisfy every core step's early
		// stage, but none of the advanced ones — so this must not move at all.
		tour.observe(context({ def: cozyGarden, elapsed: 5, balanceRuns: 2 }));
		expect(tour.index).toBe(0);
		expect(tour.step?.id).toBe('tags');
	});

	it('advances one step per satisfied predicate, in order', () => {
		const tour = new Tour();
		tour.start();
		tour.startAdvanced();

		// choirOfUnspokenNames carries both tags and a taggedLevelSum
		// populationBoost, so one observe should clear the first two steps.
		tour.observe(context({ def: choirOfUnspokenNames }));
		expect(tour.step?.id).toBe('spend-tax');
	});

	it('finishes when the last advanced step lands', () => {
		const tour = new Tour();
		tour.start();
		tour.startAdvanced();
		tour.observe(allAdvancedDone());
		expect(tour.finished).toBe(true);
		expect(tour.step).toBeNull();
		expect(tour.spotlight).toBeNull();
	});

	it('never advances past the end of the advanced track either', () => {
		const tour = new Tour();
		tour.start();
		tour.startAdvanced();
		for (let i = 0; i < 5; i += 1) tour.observe(allAdvancedDone());
		expect(tour.index).toBeLessThan(ADVANCED_TOUR_STEPS.length);
	});

	it('goes back to the core track on the next start()', () => {
		const tour = new Tour();
		tour.start();
		tour.startAdvanced();
		expect(tour.track).toBe('advanced');

		tour.start();
		expect(tour.track).toBe('core');
		expect(tour.index).toBe(0);
		expect(tour.finished).toBe(false);
		expect(tour.step?.id).toBe('currency');
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
