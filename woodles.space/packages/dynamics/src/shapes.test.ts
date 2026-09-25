// The registry claims a module per shape. If it can claim one that isn't
// there — or miss one that is — it's just a second place for the taxonomy to
// go stale, which is the thing it exists to prevent. So the claims are checked
// against the directory.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHAPES, SHAPE_IDS, shape, type ShapeId } from './shapes.js';

const srcDir = fileURLToPath(new URL('.', import.meta.url));

const moduleFiles = readdirSync(srcDir).filter(
	(f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts' && f !== 'shapes.ts'
);

describe('the registry is well formed', () => {
	it('runs A..M with no gaps, each keyed by its own id', () => {
		expect(SHAPE_IDS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']);
		for (const id of SHAPE_IDS) expect(SHAPES[id].id).toBe(id);
	});

	it('every shape is named and says what it does', () => {
		for (const id of SHAPE_IDS) {
			expect(SHAPES[id].name.length, id).toBeGreaterThan(0);
			// a sentence, not a label — this is the text a reader learns the shape from
			expect(SHAPES[id].does.length, id).toBeGreaterThan(30);
			expect(SHAPES[id].does.endsWith('.'), `${id} "does" should read as a sentence`).toBe(true);
		}
	});

	it('names are distinct', () => {
		const names = SHAPE_IDS.map((id) => SHAPES[id].name);
		expect(new Set(names).size).toBe(names.length);
	});

	it('shape() is the accessor for the same records', () => {
		for (const id of SHAPE_IDS) expect(shape(id)).toBe(SHAPES[id]);
	});
});

describe('the registry agrees with the modules on disk', () => {
	it('every claimed module exists', () => {
		for (const id of SHAPE_IDS) {
			const mod = SHAPES[id].module;
			if (mod === null) continue;
			expect(moduleFiles, `shape ${id} claims ${mod}, which is not in src/`).toContain(mod);
		}
	});

	it('every module is claimed by exactly one shape', () => {
		const claimed = SHAPE_IDS.map((id) => SHAPES[id].module).filter((m): m is string => m !== null);
		expect(new Set(claimed).size, 'two shapes claim the same module').toBe(claimed.length);

		const unclaimed = moduleFiles.filter((f) => !claimed.includes(f));
		expect(unclaimed, `implemented but not in the registry: ${unclaimed.join(', ')}`).toEqual([]);
	});

	it('M is the only shape without a module — a discipline, not code', () => {
		const without = SHAPE_IDS.filter((id: ShapeId) => SHAPES[id].module === null);
		expect(without).toEqual(['M']);
	});
});
