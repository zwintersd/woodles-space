// `TuningState` sits between the panel and the engine, and two of its
// properties are load-bearing in ways a type can't express:
//
//   - its working copy must be a *deep* clone, or editing a number in
//     Grimoire would mutate the shipped `world1Def` in-module and quietly
//     move the reference everything is compared against.
//   - `.def` has to survive `structuredClone`, because it crosses a
//     `postMessage` boundary to the balance worker. That works only while
//     the def stays plain data — the reason favor's multiplier is
//     `{base, perPoint}` and not a function.

import { describe, expect, it } from 'vitest';
import { world1Def } from '@woodles/witch-engine';
import { TuningState, cloneTuningGroups, TUNING_GROUP_KEYS, TUNING_STORAGE_KEY } from './tuning.svelte';

describe('cloneTuningGroups', () => {
	it('copies the values', () => {
		const copy = cloneTuningGroups(world1Def);
		for (const key of TUNING_GROUP_KEYS) {
			expect(copy[key]).toEqual(world1Def[key]);
		}
	});

	it('shares no structure with its source, however deep', () => {
		const copy = cloneTuningGroups(world1Def);
		expect(copy.stage.seconds).not.toBe(world1Def.stage.seconds);
		expect(copy.stock.bands).not.toBe(world1Def.stock.bands);
		expect(copy.stock.bands.nutrients).not.toBe(world1Def.stock.bands.nutrients);
		expect(copy.stock.leak).not.toBe(world1Def.stock.leak);
		expect(copy.favor.multiplier).not.toBe(world1Def.favor.multiplier);
		expect(copy.attention.costs).not.toBe(world1Def.attention.costs);
		expect(copy.restraint.loadWeight).not.toBe(world1Def.restraint.loadWeight);
	});
});

describe('TuningState', () => {
	it('starts at World 1, unmodified', () => {
		const tuning = new TuningState();
		for (const key of TUNING_GROUP_KEYS) {
			expect(tuning.isGroupModified(key)).toBe(false);
		}
	});

	it('an edit marks only its own group modified', () => {
		const tuning = new TuningState();
		tuning.groups.favor.baseTarget = 12;

		expect(tuning.isGroupModified('favor')).toBe(true);
		for (const key of TUNING_GROUP_KEYS) {
			if (key !== 'favor') expect(tuning.isGroupModified(key), key).toBe(false);
		}
	});

	it('editing never reaches through to world1Def', () => {
		const before = structuredClone(world1Def);
		const tuning = new TuningState();
		tuning.groups.stage.seconds[1] = 4242;
		tuning.groups.stock.bands.nutrients[0] = 7;
		tuning.groups.favor.multiplier.base = 0.1;
		tuning.groups.restraint.loadWeight.permanent = 9;

		expect(world1Def).toEqual(before);
	});

	it('resetGroup restores one group and leaves the others alone', () => {
		const tuning = new TuningState();
		tuning.groups.favor.baseTarget = 12;
		tuning.groups.focus.maxLevel = 99;

		tuning.resetGroup('favor');

		expect(tuning.isGroupModified('favor')).toBe(false);
		expect(tuning.groups.favor.baseTarget).toBe(world1Def.favor.baseTarget);
		expect(tuning.isGroupModified('focus')).toBe(true);
	});

	it('resetAll restores everything', () => {
		const tuning = new TuningState();
		tuning.groups.favor.baseTarget = 12;
		tuning.groups.focus.maxLevel = 99;

		tuning.resetAll();

		for (const key of TUNING_GROUP_KEYS) expect(tuning.isGroupModified(key), key).toBe(false);
	});

	it('signature changes on an edit and comes back on reset', () => {
		const tuning = new TuningState();
		const shipped = tuning.signature;

		tuning.groups.favor.baseTarget = 12;
		expect(tuning.signature).not.toBe(shipped);

		tuning.resetAll();
		expect(tuning.signature).toBe(shipped);
	});
});

describe('TuningState.def', () => {
	it('carries World 1 content through untouched', () => {
		const def = new TuningState().def;
		expect(def.life).toEqual(world1Def.life);
		expect(def.conditions).toEqual(world1Def.conditions);
		expect(def.emergences).toEqual(world1Def.emergences);
		expect(def.interventions).toEqual(world1Def.interventions);
		expect(def.worldspaces).toEqual(world1Def.worldspaces);
		expect(def.fieldNotes).toEqual(world1Def.fieldNotes);
	});

	it('substitutes the edited numbers', () => {
		const tuning = new TuningState();
		tuning.groups.favor.baseTarget = 12;

		expect(tuning.def.favor.baseTarget).toBe(12);
		// untouched groups still read as shipped
		expect(tuning.def.focus).toEqual(world1Def.focus);
	});

	it('is unmodified from a fresh state — the shipped def, rebuilt', () => {
		expect(new TuningState().def).toEqual(world1Def);
	});

	it('survives structuredClone — the balance worker contract', () => {
		const tuning = new TuningState();
		tuning.groups.stage.seconds[1] = 45;

		const sent = structuredClone(tuning.def);

		expect(sent).toEqual(tuning.def);
		expect(sent.stage.seconds[1]).toBe(45);
		// and the content survives the trip, which is what the run needs
		expect(sent.life.length).toBe(world1Def.life.length);
		expect(sent.conditions.length).toBe(world1Def.conditions.length);
	});
});

describe('persistence', () => {
	/** A fresh Storage per test, so one test's draft can't leak into another. */
	function freshStorage(): Storage {
		const items = new Map<string, string>();
		return {
			get length() {
				return items.size;
			},
			clear: () => items.clear(),
			getItem: (k: string) => items.get(k) ?? null,
			key: (i: number) => [...items.keys()][i] ?? null,
			removeItem: (k: string) => void items.delete(k),
			setItem: (k: string, v: string) => void items.set(k, v)
		} as Storage;
	}

	it('a fresh panel with nothing stored is World 1', () => {
		const tuning = new TuningState(freshStorage());
		expect(tuning.isModified).toBe(false);
		expect(tuning.def).toEqual(world1Def);
	});

	it('an edit survives a reload', () => {
		const storage = freshStorage();

		const first = new TuningState(storage);
		first.groups.favor.baseTarget = 12;
		first.groups.stage.seconds[1] = 45;
		first.save();

		const second = new TuningState(storage);
		expect(second.groups.favor.baseTarget).toBe(12);
		expect(second.groups.stage.seconds[1]).toBe(45);
		expect(second.isModified).toBe(true);
	});

	it('storing nothing is what an unmodified panel does', () => {
		const storage = freshStorage();

		const tuning = new TuningState(storage);
		tuning.groups.favor.baseTarget = 12;
		tuning.save();
		expect(storage.getItem(TUNING_STORAGE_KEY)).not.toBeNull();

		tuning.resetAll();
		tuning.save();
		expect(storage.getItem(TUNING_STORAGE_KEY)).toBeNull();
	});

	it('ignores a payload that is not an object', () => {
		for (const junk of ['null', '"hello"', '[1,2,3]', 'not json at all', '42']) {
			const storage = freshStorage();
			storage.setItem(TUNING_STORAGE_KEY, junk);
			const tuning = new TuningState(storage);
			expect(tuning.def, junk).toEqual(world1Def);
		}
	});

	it('keeps the values it recognises and falls back for the rest', () => {
		const storage = freshStorage();
		// one real field, one renamed away, one of the wrong type
		storage.setItem(
			TUNING_STORAGE_KEY,
			JSON.stringify({
				favor: { baseTarget: 12, someKnobThatNoLongerExists: 5 },
				focus: { maxLevel: 'six' },
				stage: { seconds: [0, 45] }
			})
		);

		const tuning = new TuningState(storage);
		expect(tuning.groups.favor.baseTarget).toBe(12);
		expect(tuning.groups.stage.seconds[1]).toBe(45);
		// the bad type and the untouched entries fall back to World 1
		expect(tuning.groups.focus.maxLevel).toBe(world1Def.focus.maxLevel);
		expect(tuning.groups.stage.seconds[2]).toBe(world1Def.stage.seconds[2]);
		expect(tuning.groups.vitality).toEqual(world1Def.vitality);
	});

	it('rejects a non-finite value rather than loading a def that cannot run', () => {
		const storage = freshStorage();
		storage.setItem(TUNING_STORAGE_KEY, JSON.stringify({ favor: { baseTarget: null }, focus: { maxLevel: 1e999 } }));

		const tuning = new TuningState(storage);
		expect(tuning.def).toEqual(world1Def);
	});

	it('works with no storage at all — a blocked or private context', () => {
		const tuning = new TuningState(null);
		tuning.groups.favor.baseTarget = 12;
		expect(() => tuning.save()).not.toThrow();
		expect(tuning.groups.favor.baseTarget).toBe(12);
	});

	it('survives a storage that throws on every access', () => {
		const hostile = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('quota');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		} as unknown as Storage;

		const tuning = new TuningState(hostile);
		expect(tuning.def).toEqual(world1Def);
		tuning.groups.favor.baseTarget = 12;
		expect(() => tuning.save()).not.toThrow();
	});
});
