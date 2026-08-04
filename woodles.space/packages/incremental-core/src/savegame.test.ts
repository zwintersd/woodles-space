import { describe, expect, it } from 'vitest';
import { captureSave, createSim } from './engine.js';
import { cozyGarden } from './fixtures/index.js';
import { greedy, idlePolicy } from './policies.js';
import { isSaveGame, restoreState, SAVE_VERSION, saveMatches, serializeState, type SaveGame } from './savegame.js';
import { initialState } from './state.js';
import { prestigeDef, toyDef } from './test-defs.js';

/** A run with something in it worth saving. */
function playedFor(seconds: number) {
	const sim = createSim(cozyGarden, greedy, 7);
	sim.step(seconds);
	return sim;
}

describe('round-tripping a run', () => {
	it('resumes exactly where it left off', () => {
		const first = playedFor(600);
		const save = captureSave(first);

		const resumed = createSim(cozyGarden, greedy, save.seed, save);
		expect(resumed.state()).toEqual(first.state());
		expect(resumed.state().gameTime).toBeCloseTo(600, 6);
	});

	it('carries on producing from where it stopped', () => {
		const first = playedFor(600);
		const save = captureSave(first);
		const resumed = createSim(cozyGarden, greedy, save.seed, save);

		first.step(60);
		resumed.step(60);
		// Same seed, same state, same policy — a resumed run is indistinguishable
		// from one that never stopped.
		expect(resumed.state()).toEqual(first.state());
	});

	it('resumes the stream of luck rather than rerolling it', () => {
		// Without the recorded RNG state a reload replays the crit rolls the run
		// made in its first second, which makes save-and-reload a way to reroll a
		// bad one. The save carries where the generator had got to.
		const first = playedFor(900);
		const save = captureSave(first);
		expect(save.rngState).toBeDefined();

		const faithful = createSim(cozyGarden, greedy, save.seed, save);
		const rerolled = createSim(cozyGarden, greedy, save.seed, { ...save, rngState: undefined });

		faithful.step(300);
		rerolled.step(300);
		first.step(300);

		expect(faithful.state()).toEqual(first.state());
		expect(rerolled.state()).not.toEqual(first.state());
	});

	it('keeps the milestone timeline across a save', () => {
		const first = playedFor(900);
		const save = captureSave(first);
		const resumed = createSim(cozyGarden, greedy, save.seed, save);
		expect(resumed.milestoneTimeline).toEqual(first.milestoneTimeline);
	});

	it('announces exactly what an uninterrupted run would have', () => {
		// The real property. Asserting "no unlocks fire right after a resume" would
		// be wrong: an unlock genuinely *due* on the next tick should still fire.
		// What must not happen is re-announcing one the player already saw.
		const first = playedFor(900);
		const save = captureSave(first);
		const resumed = createSim(cozyGarden, greedy, save.seed, save);

		expect(resumed.step(120)).toEqual(first.step(120));
	});

	it('never re-announces something already revealed when the save was made', () => {
		const first = playedFor(900);
		const save = captureSave(first);
		const alreadySeen = new Set(save.state.unlocked);
		expect(alreadySeen.size).toBeGreaterThan(0);

		const resumed = createSim(cozyGarden, greedy, save.seed, save);
		const reannounced = resumed
			.step(300)
			.filter((event) => event.kind === 'unlock')
			.filter((event) => {
				const unlock = cozyGarden.unlocks.find((entry) => entry.id === event.id);
				return unlock?.reveals.every((id) => alreadySeen.has(id)) ?? false;
			});
		expect(reannounced).toEqual([]);
	});

	it('does not replay milestones already in the timeline', () => {
		const first = playedFor(900);
		const save = captureSave(first);
		const reached = Object.entries(save.milestoneTimes)
			.filter(([, at]) => at !== null)
			.map(([id]) => id);
		expect(reached.length).toBeGreaterThan(0);

		const resumed = createSim(cozyGarden, greedy, save.seed, save);
		const replayed = resumed
			.step(60)
			.filter((event) => event.kind === 'milestone' && reached.includes(event.id));
		expect(replayed).toEqual([]);
	});

	it('survives JSON', () => {
		const save = captureSave(playedFor(300));
		const parsed = JSON.parse(JSON.stringify(save)) as SaveGame;
		expect(isSaveGame(parsed)).toBe(true);
		expect(restoreState(cozyGarden, parsed)).toEqual(restoreState(cozyGarden, save));
	});
});

describe('a save that outlived the design', () => {
	it('drops progress in entities the author deleted', () => {
		const save = captureSave(playedFor(600));

		const trimmed = structuredClone(cozyGarden);
		trimmed.generators = trimmed.generators.filter((entry) => entry.id !== 'cloud-nursery');
		trimmed.upgrades = trimmed.upgrades.filter((entry) => entry.id !== 'green-thumb');

		const state = restoreState(trimmed, save);
		expect(state.generators['cloud-nursery']).toBeUndefined();
		expect(state.upgrades['green-thumb']).toBeUndefined();
		expect(state.generators['petal-farm'].level).toBeGreaterThan(0);
	});

	it('starts entities the author added since the save at zero', () => {
		const save = captureSave(playedFor(300));

		const grown = structuredClone(cozyGarden);
		grown.currencies.push({
			id: 'dew',
			name: 'Dew',
			color: '#8FD3C7',
			format: { decimalPlaces: 2, notation: 'plain' }
		});

		const state = restoreState(grown, save);
		expect(state.currencies.dew).toEqual({ amount: 0, lifetime: 0 });
	});

	it('clamps a level the author has since capped', () => {
		const save = captureSave(playedFor(900));
		const capped = structuredClone(cozyGarden);
		capped.generators[0].maxLevel = 3;

		expect(restoreState(capped, save).generators['petal-farm'].level).toBe(3);
	});

	it('forgets a reveal whose entity is gone', () => {
		const save = captureSave(playedFor(900));
		expect(save.state.unlocked).toContain('cloud-nursery');

		const trimmed = structuredClone(cozyGarden);
		trimmed.generators = trimmed.generators.filter((entry) => entry.id !== 'cloud-nursery');
		expect(restoreState(trimmed, save).unlocked.has('cloud-nursery')).toBe(false);
	});

	it('refuses a save from a different game rather than mangling it', () => {
		const save = captureSave(playedFor(300));
		expect(saveMatches(cozyGarden, save)).toBe(true);
		expect(saveMatches(toyDef(), save)).toBe(false);

		// A mismatched save is ignored outright — the run starts fresh instead of
		// inheriting somebody else's numbers.
		const sim = createSim(toyDef(), idlePolicy, 1, save);
		expect(sim.state()).toEqual(initialState(toyDef()));
	});
});

describe('surviving a corrupt file', () => {
	const base = (): SaveGame => ({
		version: SAVE_VERSION,
		gameId: 'toy',
		savedAt: new Date().toISOString(),
		seed: 1,
		state: serializeState(initialState(toyDef())),
		milestoneTimes: {}
	});

	it('turns non-finite numbers into zero rather than poisoning the run', () => {
		const save = base();
		save.state.currencies.p = { amount: Number.NaN, lifetime: Number.POSITIVE_INFINITY };
		save.state.gameTime = Number.NaN;

		const state = restoreState(toyDef(), save);
		expect(state.currencies.p.amount).toBe(0);
		expect(state.currencies.p.lifetime).toBe(0);
		expect(state.gameTime).toBe(0);
	});

	it('refuses negative levels', () => {
		const save = base();
		save.state.generators.a = { level: -5 };
		expect(restoreState(toyDef(), save).generators.a.level).toBe(0);
	});

	it('copes with whole sections missing', () => {
		const save = base();
		delete (save.state as Partial<SaveGame['state']>).generators;
		delete (save.state as Partial<SaveGame['state']>).unlocked;
		expect(() => restoreState(toyDef(), save)).not.toThrow();
	});

	it('rejects things that are not saves at all', () => {
		expect(isSaveGame(null)).toBe(false);
		expect(isSaveGame({})).toBe(false);
		expect(isSaveGame({ version: 99, gameId: 'x', state: {} })).toBe(false);
		expect(isSaveGame(base())).toBe(true);
	});
});

describe('what a save records', () => {
	it('names the game and the seed it was played with', () => {
		const sim = createSim(prestigeDef(), idlePolicy, 42);
		sim.step(30);
		const save = captureSave(sim);

		expect(save.gameId).toBe('prestige-toy');
		expect(save.seed).toBe(42);
		expect(save.version).toBe(SAVE_VERSION);
		expect(Date.parse(save.savedAt)).not.toBeNaN();
	});

	it('keeps prestige counts through a reset and a reload', () => {
		const sim = createSim(prestigeDef(), idlePolicy, 1);
		sim.step(30);
		sim.apply({ type: 'prestige', layerId: 'reset' }, []);

		const resumed = createSim(prestigeDef(), idlePolicy, 1, captureSave(sim));
		expect(resumed.state().prestige.reset.count).toBe(1);
		expect(resumed.prestigeTotals.reset).toBe(1);
		expect(resumed.state().currencies.q.amount).toBe(3);
	});
});
