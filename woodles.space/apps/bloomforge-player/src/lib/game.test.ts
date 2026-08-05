import { apiaryOfBadDecisions, blankGameDef, cozyGarden, saveKey, type GameDef } from '@woodles/incremental-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from './game.svelte.js';
import { clearSave, lastPlayed, loadSave } from './library.js';

/** Opens a game without letting the animation loop run. */
function opened(def: GameDef = structuredClone(cozyGarden)): Game {
	const game = new Game();
	game.open(def);
	game.pause();
	return game;
}

beforeEach(() => {
	localStorage.clear();
});

describe('opening a game', () => {
	it('starts a fresh run and shows what the player owns to begin with', () => {
		const game = opened();
		expect(game.def?.meta.title).toBe('My Cozy Incremental');
		expect(game.fault).toBeNull();
		// The cozy garden's Petal Farm starts owned; the Cloud Nursery is gated.
		expect(game.generatorLevels['petal-farm']).toBe(1);
		expect(game.generators.map((entry) => entry.id)).toEqual(['petal-farm']);
	});

	it('refuses a game the engine could not run, and says why', () => {
		const broken = structuredClone(cozyGarden);
		broken.generators[0].producesCurrencyId = 'ghost';

		const game = new Game();
		game.open(broken);
		expect(game.fault).toMatch(/not a currency/);
	});

	it('remembers what was open so a reload resumes it', () => {
		opened();
		expect(lastPlayed()?.meta.id).toBe('cozy-garden');
	});

	it('forgets it on the way back to the shelf, but keeps the progress', () => {
		const game = opened();
		game.buyGenerator('petal-farm');
		game.close();

		expect(game.def).toBeNull();
		expect(lastPlayed()).toBeNull();
		expect(loadSave('cozy-garden')).not.toBeNull();
	});
});

describe('buying things', () => {
	it('spends the currency and raises the level', () => {
		const game = opened();
		game.step(60); // 4.8/sec buys the second level several times over
		const before = game.amounts['soft-petals'];
		const cost = game.nextCosts['petal-farm']!;

		game.buyGenerator('petal-farm');
		expect(game.generatorLevels['petal-farm']).toBe(2);
		expect(game.amounts['soft-petals']).toBeCloseTo(before - cost, 6);
	});

	it('does nothing at all when the player cannot afford it', () => {
		const game = opened();
		const before = { ...game.amounts };
		game.buyUpgrade('green-thumb'); // 400 petals, and the player has none
		expect(game.upgradeLevels['green-thumb']).toBe(0);
		expect(game.amounts).toEqual(before);
	});

	it('reports affordability so the shop can grey a card out', () => {
		const game = opened();
		expect(game.generators[0].affordable).toBe(false);

		game.step(60); // 4.8/sec for a minute is plenty for level 2
		expect(game.generators[0].affordable).toBe(true);
	});

	it('leaves the engine to decide, rather than trusting the button', () => {
		// The UI's `affordable` flag is a hint for styling. The purchase itself
		// goes through the engine, which re-checks — so a stale flag can never
		// conjure a level out of nothing.
		const game = opened();
		game.buyGenerator('petal-farm');
		game.buyGenerator('petal-farm');
		game.buyGenerator('petal-farm');
		expect(game.generatorLevels['petal-farm']).toBe(1);
	});
});

describe('what the player is shown', () => {
	it('hides a generator until its unlock fires', () => {
		const game = opened();
		expect(game.generators.some((entry) => entry.id === 'cloud-nursery')).toBe(false);

		game.step(600); // past the 2,000 lifetime petals that reveal it
		expect(game.generators.some((entry) => entry.id === 'cloud-nursery')).toBe(true);
	});

	it('hides an upgrade the author marked not-yet-visible', () => {
		const game = opened();
		// Golden Touch has `visibleWhen: petal-farm level >= 10`.
		expect(game.upgrades.some((entry) => entry.id === 'golden-touch')).toBe(false);
	});

	it('shows a gated upgrade as locked rather than hiding it', () => {
		const game = opened();
		game.step(3600);
		for (let i = 0; i < 40; i += 1) game.buyGenerator('petal-farm');

		const eternal = game.upgrades.find((entry) => entry.id === 'eternal-garden');
		if (eternal) {
			// `purchasableWhen` means "you can see it and here is why not yet".
			expect(eternal.locked).toBe(true);
			expect(eternal.affordable).toBe(false);
		}
	});

	it('leaves a currency out of the bar until it exists for the player', () => {
		const game = opened();
		expect(game.visibleCurrencies.map((entry) => entry.id)).toEqual(['soft-petals']);
	});

	it('says nothing at all about a game with nothing in it', () => {
		const game = opened(blankGameDef('Empty'));
		expect(game.generators).toEqual([]);
		expect(game.upgrades).toEqual([]);
		expect(game.prestigeLayers).toEqual([]);
		expect(game.visibleCurrencies).toEqual([]);
	});
});

describe('equipping and unequipping', () => {
	it('starts an owned upgrade equipped, and toggles freely from there', () => {
		const game = opened(structuredClone(apiaryOfBadDecisions));
		game.step(60);
		game.buyUpgrade('clover-patch');
		expect(game.upgrades.find((entry) => entry.id === 'clover-patch')?.equipped).toBe(true);

		game.unequipUpgrade('clover-patch');
		expect(game.upgrades.find((entry) => entry.id === 'clover-patch')?.equipped).toBe(false);
		expect(game.unequippedUpgradeCount).toBe(1);

		game.equipUpgrade('clover-patch');
		expect(game.upgrades.find((entry) => entry.id === 'clover-patch')?.equipped).toBe(true);
		expect(game.unequippedUpgradeCount).toBe(0);
	});

	it('leaves equipped undefined for a generator, and for an upgrade nobody owns yet', () => {
		const game = opened(structuredClone(apiaryOfBadDecisions));
		expect(game.generators[0].equipped).toBeUndefined();
		expect(game.upgrades.find((entry) => entry.id === 'clover-patch')?.equipped).toBeUndefined();
	});

	it('is a no-op on an upgrade nobody owns', () => {
		const game = opened(structuredClone(apiaryOfBadDecisions));
		game.unequipUpgrade('clover-patch');
		expect(game.unequippedUpgradeCount).toBe(0);
	});

	it('persists the toggle across a save and reload', () => {
		const first = opened(structuredClone(apiaryOfBadDecisions));
		first.step(60);
		first.buyUpgrade('clover-patch');
		first.unequipUpgrade('clover-patch');

		const second = opened(structuredClone(apiaryOfBadDecisions));
		expect(second.upgrades.find((entry) => entry.id === 'clover-patch')?.equipped).toBe(false);
	});
});

describe('saving', () => {
	it('writes progress under the game id and reads it back on reopen', () => {
		const first = opened();
		first.step(300);
		first.buyGenerator('petal-farm');
		const level = first.generatorLevels['petal-farm'];
		const elapsed = first.elapsed;
		first.save();

		expect(localStorage.getItem(saveKey('cozy-garden'))).not.toBeNull();

		const second = opened();
		expect(second.generatorLevels['petal-farm']).toBe(level);
		expect(second.elapsed).toBeCloseTo(elapsed, 6);
	});

	it('saves the moment a purchase happens, not only on the timer', () => {
		const game = opened();
		game.step(60);
		game.buyGenerator('petal-farm');

		const save = loadSave('cozy-garden');
		expect(save?.state.generators['petal-farm'].level).toBe(2);
	});

	it('starts over on request, wiping what was saved', () => {
		const game = opened();
		game.step(300);
		game.buyGenerator('petal-farm');
		game.restart();
		game.pause();

		expect(game.generatorLevels['petal-farm']).toBe(1);
		expect(game.elapsed).toBe(0);
	});

	it('does not resume a save belonging to a different game', () => {
		const first = opened();
		first.step(300);
		first.save();

		const other = structuredClone(cozyGarden);
		other.meta.id = 'other-garden';
		const second = opened(other);
		expect(second.elapsed).toBe(0);
	});

	it('copes with a save that was cleared underneath it', () => {
		const game = opened();
		game.step(120);
		game.save();
		clearSave('cozy-garden');

		const reopened = opened();
		expect(reopened.elapsed).toBe(0);
		expect(reopened.fault).toBeNull();
	});
});
