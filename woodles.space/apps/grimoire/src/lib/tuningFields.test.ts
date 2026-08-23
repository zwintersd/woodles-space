// `tuningFields.ts` hand-writes ~70 paths into a nested object, and
// `fieldValue` walks them untyped — a typo'd path returns `undefined`, which
// renders as an input that silently edits nothing. That is a transcription
// risk, not a design one, and it is the same risk the engine's own
// `world1/def.test.ts` exists to catch:
//
//   "The risk in a file that hand-assembles fifty constants into nested
//    objects isn't a design error — it's a transcription one."
//
// Two directions matter. Every declared path must *resolve* (no typos), and
// every tunable number must be *declared* (no silent omissions) — so adding a
// knob to `MarginaliaDef` and forgetting to expose it here fails loudly
// instead of quietly shipping a panel that can't reach it.

import { describe, expect, it } from 'vitest';
import { world1Def } from '@woodles/witch-engine';
import { TUNING_GROUP_KEYS, cloneTuningGroups, type TuningGroupKey } from './tuning.svelte';
import { TUNING_GROUPS, fieldValue, setFieldValue, defaultFieldValue, type TuningField } from './tuningFields';

const allFields: TuningField[] = TUNING_GROUPS.flatMap((g) => g.fields);

const pathKey = (group: TuningGroupKey, path: (string | number)[]) => `${group}.${path.join('.')}`;

/** Every numeric leaf reachable in a plain data value, as a path. */
function numericLeafPaths(value: unknown, prefix: (string | number)[] = []): (string | number)[][] {
	if (typeof value === 'number') return [prefix];
	if (Array.isArray(value)) return value.flatMap((v, i) => numericLeafPaths(v, [...prefix, i]));
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([k, v]) => numericLeafPaths(v, [...prefix, k]));
	}
	return [];
}

/**
 * Numbers deliberately not exposed, with the reason. Anything else missing
 * from the panel is an oversight, and the coverage test below says so.
 */
const INTENTIONALLY_UNEXPOSED: Record<string, string> = {
	'stage.seconds.0': 'index 0 unused — Notice is automatic on emergence',
	'stage.insightMult.0': 'index 0 unused — nothing Noticed yields yet',
	'stage.activity.0': 'index 0 unused — unwitnessed life does not move the world'
};

describe('tuning group specs', () => {
	it('covers every tuning group, once', () => {
		const declared = TUNING_GROUPS.map((g) => g.key);
		expect([...declared].sort()).toEqual([...TUNING_GROUP_KEYS].sort());
		expect(new Set(declared).size).toBe(declared.length);
	});

	it('every field is filed under the group it declares', () => {
		for (const group of TUNING_GROUPS) {
			for (const field of group.fields) expect(field.group).toBe(group.key);
		}
	});

	it('no two fields address the same number', () => {
		const keys = allFields.map((f) => pathKey(f.group, f.path));
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('every field is labelled and usefully steppable', () => {
		for (const field of allFields) {
			expect(field.label.length).toBeGreaterThan(0);
			expect(field.step).toBeGreaterThan(0);
			if (field.min !== undefined && field.max !== undefined) {
				expect(field.min).toBeLessThan(field.max);
			}
		}
	});
});

describe('every declared path resolves', () => {
	it('reads a finite number out of world1Def', () => {
		for (const field of allFields) {
			const value = fieldValue(world1Def, field);
			expect(
				Number.isFinite(value),
				`${pathKey(field.group, field.path)} ("${field.label}") does not resolve to a number`
			).toBe(true);
		}
	});

	it('defaultFieldValue agrees with reading world1Def directly', () => {
		for (const field of allFields) {
			expect(defaultFieldValue(field)).toBe(fieldValue(world1Def, field));
		}
	});

	it("respects its own declared bounds — World 1's shipped numbers are in range", () => {
		for (const field of allFields) {
			const value = defaultFieldValue(field);
			const where = `${pathKey(field.group, field.path)} ("${field.label}")`;
			if (field.min !== undefined) expect(value, `${where} below its min`).toBeGreaterThanOrEqual(field.min);
			if (field.max !== undefined) expect(value, `${where} above its max`).toBeLessThanOrEqual(field.max);
		}
	});
});

describe('every tunable number is reachable', () => {
	it('declares a field for each numeric leaf in the twelve groups', () => {
		const declared = new Set(allFields.map((f) => pathKey(f.group, f.path)));

		const missing: string[] = [];
		for (const key of TUNING_GROUP_KEYS) {
			for (const path of numericLeafPaths(world1Def[key])) {
				const full = pathKey(key, path);
				if (declared.has(full) || full in INTENTIONALLY_UNEXPOSED) continue;
				missing.push(full);
			}
		}

		expect(missing, `not exposed by the tuning panel: ${missing.join(', ')}`).toEqual([]);
	});

	it('every documented exclusion is a real number that exists', () => {
		const leaves = new Set(
			TUNING_GROUP_KEYS.flatMap((key) => numericLeafPaths(world1Def[key]).map((p) => pathKey(key, p)))
		);
		for (const excluded of Object.keys(INTENTIONALLY_UNEXPOSED)) {
			expect(leaves.has(excluded), `${excluded} is excluded but no longer exists`).toBe(true);
		}
	});
});

describe('setFieldValue', () => {
	it('writes where fieldValue reads, for every field', () => {
		const groups = cloneTuningGroups(world1Def);
		for (const field of allFields) {
			const before = fieldValue(groups, field);
			setFieldValue(groups, field, before + 1);
			expect(fieldValue(groups, field), pathKey(field.group, field.path)).toBe(before + 1);
		}
	});

	it('leaves world1Def untouched — the shipped numbers are the reference', () => {
		const groups = cloneTuningGroups(world1Def);
		for (const field of allFields) setFieldValue(groups, field, 999);
		for (const field of allFields) {
			expect(defaultFieldValue(field), `${pathKey(field.group, field.path)} leaked into world1Def`).not.toBe(999);
		}
	});
});
