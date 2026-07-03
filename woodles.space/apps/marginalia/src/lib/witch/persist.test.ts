import { beforeEach, describe, expect, it } from 'vitest';
import { emptySave, exportSave, importSave, load, save, wipe } from './persist';

// jsdom provides localStorage; reset between tests so cases stay isolated.
beforeEach(() => {
	localStorage.clear();
});

describe('emptySave', () => {
	it('starts at version 1 with empty collections', () => {
		const s = emptySave();
		expect(s.v).toBe(1);
		expect(s.attending).toEqual([]);
		expect(s.study).toEqual({});
		expect(s.writtenConditions).toEqual([]);
		expect(s.observation).toEqual({});
		expect(s.journalShown).toEqual([]);
		expect(s.worldShape.activeWorldspace).toBe('water');
		expect(s.worldShape.unlockedWorldspaces).toEqual(['water']);
		expect(s.worldShape.sedimentGrid.cells.length).toBeGreaterThan(0);
	});
	it('uses ATTENTION_START for capacity', () => {
		expect(emptySave().attentionCapacity).toBeGreaterThan(0);
	});
});

describe('export/import roundtrip', () => {
	it('survives a base64 roundtrip', () => {
		const s = emptySave();
		s.essence = 12;
		s.knowing = 3;
		s.attending = ['a', 'b'];
		s.study = { a: 1.5, b: 2.5 };
		const blob = exportSave(s);
		const back = importSave(blob);
		expect(back).toEqual(s);
	});
	it('rejects malformed blobs', () => {
		expect(importSave('not-base64!!')).toBeNull();
		expect(importSave('')).toBeNull();
	});
	it('rejects wrong-version payloads', () => {
		const wrongVersion = btoa(JSON.stringify({ v: 99, essence: 0 }));
		expect(importSave(wrongVersion)).toBeNull();
	});
	it('fills missing fields from emptySave', () => {
		const partial = btoa(JSON.stringify({ v: 1, essence: 7 }));
		const back = importSave(partial);
		expect(back?.essence).toBe(7);
		expect(back?.attending).toEqual([]);
		expect(back?.worldShape.activeWorldspace).toBe('water');
	});
	it('preserves worldShape through export/import', () => {
		const s = emptySave();
		s.worldShape.sedimentUnlocked = true;
		s.worldShape.sedimentGrid.cells[0] = 0.7;
		s.worldShape.placedFeatures = [
			{ id: 'shell_bed-1', featureId: 'shell_bed', x: 0.4, y: 0.8, rotation: 0, scale: 1 }
		];
		const blob = exportSave(s);
		const back = importSave(blob);
		expect(back?.worldShape.sedimentUnlocked).toBe(true);
		expect(back?.worldShape.sedimentGrid.cells[0]).toBe(0.7);
		expect(back?.worldShape.placedFeatures).toHaveLength(1);
	});
});

describe('load/save/wipe', () => {
	it('round-trips via localStorage', () => {
		const s = emptySave();
		s.essence = 42;
		s.worldShape.sedimentUnlocked = true;
		save(s);
		const back = load();
		expect(back?.essence).toBe(42);
		expect(back?.worldShape.sedimentUnlocked).toBe(true);
	});
	it('returns null when no save exists and no legacy data', () => {
		expect(load()).toBeNull();
	});
	it('discards wrong-version payloads', () => {
		localStorage.setItem('witch.book.save.v1', JSON.stringify({ v: 2, essence: 5 }));
		expect(load()).toBeNull();
	});
	it('wipe removes the save', () => {
		save(emptySave());
		wipe();
		expect(load()).toBeNull();
	});
});

describe('legacy migration', () => {
	it('inherits reading progress from marginalia.save.v1 when no v1 save exists', () => {
		localStorage.setItem(
			'marginalia.save.v1',
			JSON.stringify({ readingCompletedStars: 4, readingCumulativeMs: 100 })
		);
		const back = load();
		expect(back?.readingCompletedStars).toBe(4);
		expect(back?.readingCumulativeMs).toBe(100);
	});
	it('ignores legacy data when it has no reading progress', () => {
		localStorage.setItem('marginalia.save.v1', JSON.stringify({ irrelevant: true }));
		expect(load()).toBeNull();
	});
});
