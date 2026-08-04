import { cozyGarden, deriveEdges, validateGameDef, type GameDef } from '@woodles/incremental-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyConnection } from './connect.js';

let def: GameDef;

beforeEach(() => {
	def = structuredClone(cozyGarden);
});

const edgeExists = (kind: string, source: string, target: string) =>
	deriveEdges(def).some((edge) => edge.kind === kind && edge.source === source && edge.target === target);

describe('drawing an edge edits the def', () => {
	it('repoints a generator at the currency it was dragged to', () => {
		const outcome = applyConnection(def, 'petal-farm', 'rebirth-petals');
		expect(outcome.ok).toBe(true);
		expect(def.generators[0].producesCurrencyId).toBe('rebirth-petals');
		// The proof that edges are derived: the graph moved because the *data*
		// moved, with nothing edge-shaped stored anywhere.
		expect(edgeExists('production', 'petal-farm', 'rebirth-petals')).toBe(true);
		expect(edgeExists('production', 'petal-farm', 'soft-petals')).toBe(false);
	});

	it('reprices a generator when the drag runs the other way', () => {
		expect(applyConnection(def, 'rebirth-petals', 'cloud-nursery').ok).toBe(true);
		expect(def.generators[1].cost.currencyId).toBe('rebirth-petals');
	});

	it('adds an effect when an upgrade is dragged onto a generator', () => {
		const before = def.upgrades[0].effects.length;
		expect(applyConnection(def, 'green-thumb', 'cloud-nursery').ok).toBe(true);
		expect(def.upgrades[0].effects).toHaveLength(before + 1);
		expect(def.upgrades[0].effects.at(-1)?.target).toEqual({ type: 'generator', id: 'cloud-nursery' });
		expect(edgeExists('modifier', 'green-thumb', 'cloud-nursery')).toBe(true);
	});

	it('adds a currency-wide effect when dragged onto a currency', () => {
		expect(applyConnection(def, 'green-thumb', 'soft-petals').ok).toBe(true);
		expect(def.upgrades[0].effects.at(-1)?.target).toEqual({ type: 'currency', id: 'soft-petals' });
	});

	it('adds a reveal when an unlock is dragged onto anything', () => {
		expect(applyConnection(def, 'unlock-nursery', 'green-thumb').ok).toBe(true);
		expect(def.unlocks[0].reveals).toContain('green-thumb');
	});

	it('repoints a prestige layer and stops it resetting its own reward', () => {
		def.prestigeLayers[0].resets.push('rebirth-petals');
		expect(applyConnection(def, 'rebirth', 'rebirth-petals').ok).toBe(true);
		expect(def.prestigeLayers[0].currencyId).toBe('rebirth-petals');
		// A layer that wipes the currency it pays out in pays out nothing.
		expect(def.prestigeLayers[0].resets).not.toContain('rebirth-petals');
	});
});

describe('drags that mean nothing are refused', () => {
	it('refuses a node connecting to itself', () => {
		expect(applyConnection(def, 'petal-farm', 'petal-farm')).toMatchObject({ ok: false });
	});

	it('refuses a pair with no sensible reading', () => {
		const outcome = applyConnection(def, 'one-million', 'petal-farm');
		expect(outcome.ok).toBe(false);
		expect(outcome.message).toMatch(/cannot connect/);
	});

	it('refuses an end that is not on the canvas', () => {
		expect(applyConnection(def, 'ghost', 'petal-farm')).toMatchObject({ ok: false });
	});

	it('refuses a duplicate effect rather than stacking two edges', () => {
		const outcome = applyConnection(def, 'green-thumb', 'petal-farm');
		expect(outcome.ok).toBe(false);
		expect(outcome.message).toMatch(/already boosts/);
	});

	it('refuses a duplicate reveal', () => {
		expect(applyConnection(def, 'unlock-nursery', 'cloud-nursery')).toMatchObject({ ok: false });
	});

	it('leaves the def untouched when it refuses', () => {
		const before = JSON.stringify(def);
		applyConnection(def, 'one-million', 'petal-farm');
		applyConnection(def, 'green-thumb', 'petal-farm');
		expect(JSON.stringify(def)).toBe(before);
	});
});

describe('what a connection leaves behind', () => {
	it('never produces a def the engine would refuse', () => {
		for (const [source, target] of [
			['petal-farm', 'rebirth-petals'],
			['green-thumb', 'cloud-nursery'],
			['unlock-nursery', 'green-thumb'],
			['rebirth', 'soft-petals']
		]) {
			applyConnection(def, source, target);
			expect(validateGameDef(def).filter((issue) => issue.severity === 'error'), `${source}->${target}`).toEqual([]);
		}
	});
});
