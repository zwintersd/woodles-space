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
import { TuningState, cloneTuningGroups, TUNING_GROUP_KEYS } from './tuning.svelte';

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
