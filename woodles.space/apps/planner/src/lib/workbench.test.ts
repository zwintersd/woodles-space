// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerStore } from './store.svelte';
import { mergePlannerBlobs } from './sync.svelte';
import { buildCommitments } from './commitments';
import type { PlannerBlob, DayShape } from './types';

const pile: DayShape = {
	id: 'home',
	name: 'Home day',
	blocks: [
		{ id: 'read', title: 'Read', startTime: '09:00', endTime: '10:00' },
		{ id: 'walk', title: 'Walk', startTime: '12:00', endTime: '12:30', flexible: true }
	]
};
function blob(store: PlannerStore): PlannerBlob {
	return {
		shapes: store.dayShapes,
		weekPattern: store.weekPattern,
		days: store.dayOverrides,
		obligations: [],
		rituals: [],
		tasks: store.tasks,
		settings: store.settings,
		domains: [],
		routines: store.routines,
		routinePractices: store.routinePractices,
		surgeDrafts: store.surgeDrafts
	};
}
describe('Carillon editable workspaces', () => {
	let store: PlannerStore;
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 8, 19, 12));
		store = new PlannerStore();
		store.setDayShapes([pile]);
		store.setWeekPattern({ days: Array(7).fill('home') as PlannerBlob['weekPattern']['days'] });
	});
	afterEach(() => vi.useRealTimers());
	it('isolates one-day changes, excludes flexible blocks from the clock, and persists both', () => {
		store.saveDayPlan('2026-09-19', [
			{ ...pile.blocks[0], startTime: '11:00', endTime: '12:00' },
			pile.blocks[1]
		]);
		store.savePile({ ...pile, name: 'Renamed template' });
		const loaded = new PlannerStore();
		expect(loaded.getBlocksForDateKey('2026-09-19').map((b) => b.startTime)).toEqual(['11:00']);
		expect(loaded.getBlocksForDateKey('2026-09-20')[0].startTime).toBe('09:00');
		expect(loaded.getDayShape(new Date(2026, 8, 19))?.name).toBe('Home day');
	});
	it('freezes a dated plan when recording and publishes edited times to linked apps', () => {
		store.observeInterval({ date: '2026-09-19', intervalStart: '09:00', kind: 'rest' });
		store.savePile({
			...pile,
			blocks: [{ ...pile.blocks[0], startTime: '14:00', endTime: '15:00' }]
		});
		expect(store.getBlocksForDateKey('2026-09-19')[0].startTime).toBe('09:00');
		store.saveDayPlan('2026-09-19', [{ ...pile.blocks[0], startTime: '11:00', endTime: '12:00' }]);
		const task = store.addTask({
			title: 'Read book',
			targetDate: '2026-09-19',
			targetBlockId: 'read',
			thinkingAboutEntryId: 'book'
		});
		expect(
			buildCommitments([task], store.getAllBlocks(), undefined, (date) =>
				store.getBlocksForDateKey(date)
			).commitments[0].time
		).toBe('11:00');
	});
	it('keeps day snapshots when a template is deleted and never resurrects it from sync', () => {
		store.saveDayPlan('2026-09-19', pile.blocks);
		const stale = JSON.parse(JSON.stringify(blob(store)));
		store.deletePile('home');
		expect(store.getDayShape(new Date(2026, 8, 19))?.blocks).toHaveLength(2);
		expect(store.weekPattern.days).toEqual(Array(7).fill(''));
		const merged = mergePlannerBlobs(blob(store), stale);
		expect(merged.shapes[0].deletedAt).toBeTruthy();
	});
	it('preserves legacy practice labels through routine edits and deletion', () => {
		const routine = store.addRoutine('Arrival', ['Open notes', 'Set up'], 'After arriving')!;
		const practice = store.recordRoutinePractice(routine.id, {
			[routine.steps[0].id]: 'independent',
			[routine.steps[1].id]: 'prompted'
		})!;
		// Simulate a practice created before snapshots existed.
		store.routinePractices = [{ ...practice, steps: undefined, routineName: undefined }];
		store.updateRoutine(routine.id, {
			name: 'New arrival',
			steps: [{ ...routine.steps[0], label: 'Revised step' }]
		});
		const stale = JSON.parse(JSON.stringify(blob(store)));
		store.deleteRoutine(routine.id);
		const loaded = new PlannerStore();
		expect(loaded.routinePractices[0].routineName).toBe('Arrival');
		expect(loaded.routinePractices[0].steps?.map((s) => s.label)).toEqual(['Open notes', 'Set up']);
		expect(
			mergePlannerBlobs(blob(store), stale).routines?.find((r) => r.id === routine.id)?.deletedAt
		).toBeTruthy();
	});
	it('extracts multiple tasks without losing the idea or its existing task links', () => {
		const idea = store.addSurgeDraft('Book project', 'Longer notes')!;
		store.updateSurgeDraft(idea.id, {
			title: 'Revised book',
			body: 'Keep these notes',
			reviewDate: '2026-10-01'
		});
		const tasks = store.extractSurgeTasks(idea.id, ['Outline', 'Read references']);
		expect(tasks.every((t) => !t.targetDate)).toBe(true);
		store.extractSurgeTasks(idea.id, ['Write first page'], '2026-09-20');
		store.discardSurgeDraft(idea.id);
		store.restoreSurgeDraft(idea.id);
		const loaded = new PlannerStore();
		expect(loaded.surgeDrafts[0]).toMatchObject({
			body: 'Keep these notes',
			reviewDate: '2026-10-01'
		});
		expect(loaded.surgeDrafts[0].promotedTaskIds).toHaveLength(3);
		expect(loaded.tasks.at(-1)?.targetDate).toBe('2026-09-20');
	});
	it('persists review notes without replacing customized activities', () => {
		store.saveDayPlan('2026-09-19', [pile.blocks[1]]);
		store.saveDayNote('2026-09-19', 'Start later next time.');
		const loaded = new PlannerStore();
		expect(loaded.dayOverrides['2026-09-19'].note).toBe('Start later next time.');
		expect(loaded.dayOverrides['2026-09-19'].blocks?.[0].id).toBe('walk');
	});
});
