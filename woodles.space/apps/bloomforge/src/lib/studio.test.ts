import {
	blankGameDef,
	cozyGarden,
	emptyGameDef,
	entityIndex,
	idlePolicy,
	simulate,
	validateGameDef,
	type GameDef
} from '@woodles/incremental-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Studio } from './studio.svelte.js';
import { deleteProject, listProjects, loadProject, newProjectId, saveProject } from './projects.js';

function studioWith(def: GameDef = structuredClone(cozyGarden)): Studio {
	const studio = new Studio();
	studio.open(newProjectId(), def);
	return studio;
}

const errorsIn = (def: GameDef) => validateGameDef(def).filter((issue) => issue.severity === 'error');

beforeEach(() => {
	localStorage.clear();
});

describe('creating entities', () => {
	it('lands every kind valid, with a position and a selection', () => {
		const studio = studioWith();
		for (const kind of ['currency', 'generator', 'upgrade', 'prestige', 'unlock', 'milestone'] as const) {
			const id = studio.create(kind, { x: 10, y: 20 });
			expect(id, kind).not.toBeNull();
			expect(studio.selectedId).toBe(id);
			expect(studio.def.layout[id!]).toEqual({ x: 10, y: 20 });
			// Adding a node must never hand the author an error they didn't cause.
			expect(errorsIn(studio.def), kind).toEqual([]);
		}
	});

	it('makes a from-scratch game actually run', () => {
		// The first generator has to start owned, or nothing produces, nobody can
		// afford the thing that would produce, and pressing play shows a column of
		// zeroes forever. That deadlock is invisible until you try to play it.
		const studio = studioWith(blankGameDef());
		studio.create('currency');
		const generatorId = studio.create('generator');

		const def = JSON.parse(studio.toJSON()) as GameDef;
		expect(def.generators[0].startsOwned).toBe(1);

		const result = simulate(def, idlePolicy, { duration: 60, sampleEvery: 30, seed: 1 });
		expect(result.finalState.currencies[def.currencies[0].id].amount).toBeGreaterThan(0);
		expect(generatorId).not.toBeNull();
	});

	it('leaves later generators unowned, so they are something to buy', () => {
		const studio = studioWith(blankGameDef());
		studio.create('currency');
		studio.create('generator');
		studio.create('generator');
		expect(studio.def.generators.map((entry) => entry.startsOwned)).toEqual([1, 0]);
	});

	it('gives each new entity a distinct id and name', () => {
		const studio = studioWith();
		const first = studio.create('generator');
		const second = studio.create('generator');
		expect(first).not.toBe(second);
		expect(entityIndex(studio.def).size).toBe(entityIndex(cozyGarden).size + 2);
	});

	it('refuses a generator when there is no currency to produce', () => {
		const bare: GameDef = { ...emptyGameDef(), currencies: [], generators: [], layout: {} };
		const studio = studioWith(bare);
		expect(studio.create('generator')).toBeNull();
		expect(studio.create('upgrade')).toBeNull();
		expect(studio.create('currency')).not.toBeNull();
	});

	it('awards a different currency than it measures, where one exists', () => {
		const studio = studioWith();
		const id = studio.create('prestige');
		const layer = studio.def.prestigeLayers.find((entry) => entry.id === id);
		expect(layer?.currencyId).not.toBe(layer?.gainFormula.sourceCurrencyId);
		expect(validateGameDef(studio.def).some((issue) => issue.code === 'self-reset')).toBe(false);
	});
});

describe('deleting entities', () => {
	it('takes every reference with it', () => {
		const studio = studioWith();
		studio.remove('petal-farm');

		expect(studio.def.generators.some((entry) => entry.id === 'petal-farm')).toBe(false);
		expect(studio.def.layout['petal-farm']).toBeUndefined();
		// Green Thumb and Golden Touch both pointed at it; Rebirth reset it.
		for (const upgrade of studio.def.upgrades) {
			expect(upgrade.effects.every((effect) => effect.target.type === 'global' || effect.target.id !== 'petal-farm')).toBe(
				true
			);
		}
		expect(studio.def.prestigeLayers[0].resets).not.toContain('petal-farm');
	});

	it('leaves a def the engine will still run', () => {
		const studio = studioWith();
		// Conditions can still name a deleted entity — those are reported, not
		// silently rewritten, because guessing what the author meant is worse.
		studio.remove('cloud-nursery');
		expect(errorsIn(studio.def)).toEqual([]);
	});

	it('clears the selection when the selected thing goes', () => {
		const studio = studioWith();
		studio.select('green-thumb');
		studio.remove('green-thumb');
		expect(studio.selectedId).toBeNull();
	});

	it('drops the reveal from any unlock that pointed at it', () => {
		const studio = studioWith();
		studio.remove('cloud-nursery');
		expect(studio.def.unlocks.flatMap((unlock) => unlock.reveals)).not.toContain('cloud-nursery');
	});
});

describe('duplicating', () => {
	it('copies an entity under a fresh id, offset on the canvas', () => {
		const studio = studioWith();
		const copyId = studio.duplicate('green-thumb');
		expect(copyId).toBe('green-thumb-copy');

		const original = studio.def.upgrades.find((entry) => entry.id === 'green-thumb');
		const copy = studio.def.upgrades.find((entry) => entry.id === copyId);
		expect(copy?.effects).toEqual(original?.effects);
		expect(copy?.name).toBe('Green Thumb copy');
		expect(studio.def.layout[copyId!].x).toBe(studio.def.layout['green-thumb'].x + 40);
		expect(errorsIn(studio.def)).toEqual([]);
	});

	it('deep-copies, so editing the copy leaves the original alone', () => {
		const studio = studioWith();
		const copyId = studio.duplicate('green-thumb')!;
		const copy = studio.def.upgrades.find((entry) => entry.id === copyId)!;
		copy.effects[0].value = 99;
		expect(studio.def.upgrades.find((entry) => entry.id === 'green-thumb')!.effects[0].value).toBe(1.5);
	});
});

describe('renaming', () => {
	it('changes the display name, whatever kind the entity is', () => {
		const studio = studioWith();
		studio.rename('green-thumb', 'Verdant Fingers');
		expect(studio.def.upgrades.find((entry) => entry.id === 'green-thumb')?.name).toBe('Verdant Fingers');
	});

	it('leaves the id, and every reference to it, alone', () => {
		const studio = studioWith();
		const before = structuredClone(studio.def);
		studio.rename('petal-farm', 'Bloom Works');
		const after = studio.def;

		expect(after.generators.find((entry) => entry.id === 'petal-farm')?.id).toBe('petal-farm');
		expect(after.layout).toEqual(before.layout);
		for (const upgrade of after.upgrades) {
			expect(upgrade.effects.map((effect) => effect.target)).toEqual(
				before.upgrades.find((entry) => entry.id === upgrade.id)!.effects.map((effect) => effect.target)
			);
		}
	});

	it('does nothing for an id that does not exist', () => {
		const studio = studioWith();
		const before = structuredClone(studio.def);
		studio.rename('not-a-real-id', 'Ghost');
		expect(studio.def).toEqual(before);
	});
});

describe('undo and redo', () => {
	it('restores what an edit changed', () => {
		const studio = studioWith();
		expect(studio.canUndo).toBe(false);

		studio.remove('green-thumb');
		expect(studio.def.upgrades.some((entry) => entry.id === 'green-thumb')).toBe(false);

		studio.undo();
		expect(studio.def.upgrades.some((entry) => entry.id === 'green-thumb')).toBe(true);
		expect(studio.canRedo).toBe(true);

		studio.redo();
		expect(studio.def.upgrades.some((entry) => entry.id === 'green-thumb')).toBe(false);
	});

	it('drops the redo stack once a new edit happens', () => {
		const studio = studioWith();
		studio.remove('green-thumb');
		studio.undo();
		expect(studio.canRedo).toBe(true);

		studio.remove('bloom-boost');
		expect(studio.canRedo).toBe(false);
	});

	it('does nothing at either end of the stack', () => {
		const studio = studioWith();
		studio.undo();
		studio.redo();
		expect(studio.def).toEqual(cozyGarden);
	});

	it('caps history rather than growing without bound', () => {
		const studio = studioWith();
		for (let i = 0; i < 140; i += 1) studio.create('currency');
		// 140 edits, 100 kept: undoing everything available must not throw and
		// must leave a def that still validates.
		for (let i = 0; i < 140; i += 1) studio.undo();
		expect(studio.canUndo).toBe(false);
		expect(errorsIn(studio.def)).toEqual([]);
	});

	it('treats a drag as one undoable step, not one per frame', () => {
		const studio = studioWith();
		studio.beginGesture();
		for (let x = 0; x < 20; x += 1) studio.moveNode('petal-farm', { x, y: x });
		expect(studio.def.layout['petal-farm']).toEqual({ x: 19, y: 19 });

		studio.undo();
		expect(studio.def.layout['petal-farm']).toEqual(cozyGarden.layout['petal-farm']);
	});
});

describe('notes', () => {
	it('adds, edits, moves and removes a canvas note', () => {
		const studio = studioWith();
		const before = studio.def.notes.length;
		studio.addNote({ x: 5, y: 6 });
		const note = studio.def.notes.at(-1)!;
		expect(studio.def.notes).toHaveLength(before + 1);

		studio.updateNote(note.id, 'check the wall at level 60');
		expect(studio.def.notes.at(-1)?.text).toBe('check the wall at level 60');

		studio.moveNote(note.id, { x: 40, y: 50 });
		expect(studio.def.notes.at(-1)?.position).toEqual({ x: 40, y: 50 });

		studio.removeNote(note.id);
		expect(studio.def.notes).toHaveLength(before);
	});
});

describe('import and export', () => {
	it('round-trips a project through JSON', () => {
		const studio = studioWith();
		const text = studio.toJSON();
		const other = studioWith(emptyGameDef());
		other.importJSON(text);
		expect(other.def).toEqual(cozyGarden);
	});

	it('refuses a file the engine could not run, without losing the open one', () => {
		const studio = studioWith();
		const broken = structuredClone(cozyGarden);
		broken.generators[0].producesCurrencyId = 'ghost';

		expect(() => studio.importJSON(JSON.stringify(broken))).toThrow(/not a currency/);
		expect(studio.def.meta.title).toBe('My Cozy Incremental');
		expect(studio.def.generators[0].producesCurrencyId).toBe('soft-petals');
	});

	it('refuses a file that is not JSON at all', () => {
		const studio = studioWith();
		expect(() => studio.importJSON('not a game')).toThrow(/could not read that file as JSON/);
		expect(studio.def.meta.title).toBe('My Cozy Incremental');
	});

	it('fills in what a sparse but legal file leaves out', () => {
		// Not an error: a hand-written file with only a couple of fields opens as
		// a blank project rather than being rejected.
		const studio = studioWith();
		studio.importJSON('{"schemaVersion":1,"meta":{"id":"tiny","title":"Tiny"}}');
		expect(studio.def.meta.title).toBe('Tiny');
		expect(studio.def.generators).toEqual([]);
		expect(studio.def.layout).toEqual({});
	});
});

describe('validation surfacing', () => {
	it('reports issues against the entity the canvas should badge', () => {
		const studio = studioWith();
		studio.edit((def) => {
			def.generators[0].cost.base = -5;
		});
		expect(studio.errorCount).toBeGreaterThan(0);
		expect(studio.issuesFor('petal-farm').some((issue) => issue.code === 'invalid-number')).toBe(true);
		expect(studio.issuesFor('cloud-nursery')).toEqual([]);
	});
});

describe('project storage', () => {
	it('saves, lists, reloads and deletes', () => {
		const id = newProjectId();
		expect(saveProject(id, structuredClone(cozyGarden))).toBe(true);

		expect(listProjects().map((project) => project.id)).toContain(id);
		expect(listProjects().find((project) => project.id === id)?.title).toBe('My Cozy Incremental');
		expect(loadProject(id)).toEqual(cozyGarden);

		deleteProject(id);
		expect(listProjects().map((project) => project.id)).not.toContain(id);
		expect(loadProject(id)).toBeNull();
	});

	it('keeps projects apart from one another', () => {
		const first = newProjectId();
		const second = newProjectId();
		saveProject(first, structuredClone(cozyGarden));
		saveProject(second, emptyGameDef('Second Garden'));

		expect(loadProject(first)?.meta.title).toBe('My Cozy Incremental');
		expect(loadProject(second)?.meta.title).toBe('Second Garden');
		expect(listProjects()).toHaveLength(2);
	});

	it('reports a project that was never saved as missing rather than inventing one', () => {
		expect(loadProject('never-existed')).toBeNull();
	});
});
