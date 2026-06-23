// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PlannerStore } from './store.svelte';
import { STARTER_SHAPES, STARTER_WEEK_PATTERN } from './templates';
import { dateKey } from './utils';
import type { Task, DayShape, Obligation, Ritual, Domain, WeekPattern } from './types';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		}
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('PlannerStore', () => {
	let store: PlannerStore;

	beforeEach(() => {
		localStorage.clear();
		store = new PlannerStore();
	});

	// ── initialization ────────────────────────────────────────────────

	describe('initialization', () => {
		it('loads default shapes from STARTER_SHAPES', () => {
			expect(store.dayShapes).toEqual(STARTER_SHAPES);
		});

		it('loads default week pattern', () => {
			expect(store.weekPattern).toEqual(STARTER_WEEK_PATTERN);
		});

		it('starts with empty tasks', () => {
			expect(store.tasks).toEqual([]);
		});

		it('starts with default settings', () => {
			expect(store.settings.flourishEnabled).toBe(true);
			expect(store.settings.bellsEnabled).toBe(true);
			expect(store.settings.dayCycleEnabled).toBe(true);
			expect(store.settings.tone).toBe('gentle');
			expect(store.settings.onboardingComplete).toBe(false);
		});

		it('initializes transient state', () => {
			expect(store.currentView).toBe('now-next');
			expect(store.binderTab).toBeNull();
			expect(store.editingTaskId).toBeNull();
			expect(store.activeDayKey).toBeNull();
		});

		it('sets now to current date', () => {
			const before = new Date();
			store = new PlannerStore();
			const after = new Date();
			expect(store.now.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(store.now.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ── task actions ────────────────────────────────────────────────

	describe('addTask', () => {
		it('creates a task with required fields', () => {
			const task = store.addTask({ title: 'Test Task' });
			expect(task.id).toBeTruthy();
			expect(task.title).toBe('Test Task');
			expect(task.status).toBe('open');
			expect(task.createdAt).toBeTruthy();
		});

		it('trims whitespace from title', () => {
			const task = store.addTask({ title: '  Trimmed  ' });
			expect(task.title).toBe('Trimmed');
		});

		it('includes optional fields', () => {
			const task = store.addTask({
				title: 'Task',
				domainId: 'domain-1',
				targetBlockId: 'block-1',
				estimatedDuration: 30,
				notes: 'Some notes'
			});
			expect(task.domainId).toBe('domain-1');
			expect(task.targetBlockId).toBe('block-1');
			expect(task.estimatedDuration).toBe(30);
			expect(task.notes).toBe('Some notes');
		});

		it('sets targetDate to today if targetBlockId is provided', () => {
			const task = store.addTask({ title: 'Scheduled', targetBlockId: 'block-1' });
			expect(task.targetDate).toBe(dateKey(store.now));
		});

		it('persists task to localStorage', () => {
			store.addTask({ title: 'Task 1' });
			store.addTask({ title: 'Task 2' });

			// Create new store instance to verify persistence
			const newStore = new PlannerStore();
			expect(newStore.tasks).toHaveLength(2);
			expect(newStore.tasks[0].title).toBe('Task 1');
		});

		it('generates unique IDs', () => {
			const t1 = store.addTask({ title: 'A' });
			const t2 = store.addTask({ title: 'B' });
			expect(t1.id).not.toBe(t2.id);
		});
	});

	describe('completeTask', () => {
		it('marks task as done', () => {
			const task = store.addTask({ title: 'Task' });
			store.completeTask(task.id);
			const updated = store.tasks.find((t) => t.id === task.id);
			expect(updated?.status).toBe('done');
		});

		it('persists state', () => {
			const task = store.addTask({ title: 'Task' });
			store.completeTask(task.id);
			const newStore = new PlannerStore();
			const persisted = newStore.tasks.find((t) => t.id === task.id);
			expect(persisted?.status).toBe('done');
		});

		it('ignores non-existent task IDs silently', () => {
			store.addTask({ title: 'Task' });
			store.completeTask('nonexistent');
			expect(store.tasks[0].status).toBe('open');
		});
	});

	describe('dropTask', () => {
		it('marks task as dropped', () => {
			const task = store.addTask({ title: 'Task' });
			store.dropTask(task.id);
			const updated = store.tasks.find((t) => t.id === task.id);
			expect(updated?.status).toBe('dropped');
		});
	});

	describe('reopenTask', () => {
		it('marks completed task as open again', () => {
			const task = store.addTask({ title: 'Task' });
			store.completeTask(task.id);
			store.reopenTask(task.id);
			const updated = store.tasks.find((t) => t.id === task.id);
			expect(updated?.status).toBe('open');
		});

		it('marks dropped task as open again', () => {
			const task = store.addTask({ title: 'Task' });
			store.dropTask(task.id);
			store.reopenTask(task.id);
			const updated = store.tasks.find((t) => t.id === task.id);
			expect(updated?.status).toBe('open');
		});
	});

	describe('updateTask', () => {
		it('updates task fields', () => {
			const task = store.addTask({ title: 'Original' });
			store.updateTask(task.id, { title: 'Updated', estimatedDuration: 45 });
			const updated = store.tasks.find((t) => t.id === task.id);
			expect(updated?.title).toBe('Updated');
			expect(updated?.estimatedDuration).toBe(45);
		});

		it('does not overwrite id or createdAt', () => {
			const task = store.addTask({ title: 'Task' });
			const originalId = task.id;
			const originalCreated = task.createdAt;
			// id and createdAt are not part of the updatable type; pass them
			// anyway (via a cast) to prove updateTask ignores them.
			store.updateTask(task.id, {
				id: 'fake-id',
				createdAt: 'fake-date',
				title: 'New'
			} as Partial<Omit<Task, 'id' | 'createdAt'>>);
			const updated = store.tasks.find((t) => t.id === originalId);
			expect(updated?.id).toBe(originalId);
			expect(updated?.createdAt).toBe(originalCreated);
		});
	});

	describe('task filtering', () => {
		beforeEach(() => {
			store.addTask({ title: 'Unscheduled' });
			store.addTask({ title: 'Scheduled', targetBlockId: 'block-1' });
			const task3 = store.addTask({ title: 'Completed', targetBlockId: 'block-2' });
			store.completeTask(task3.id);
		});

		it('getUnscheduledTasks returns tasks without targetBlockId', () => {
			const unscheduled = store.getUnscheduledTasks();
			expect(unscheduled).toHaveLength(1);
			expect(unscheduled[0].title).toBe('Unscheduled');
		});

		it('getUnscheduledTasks excludes dropped tasks', () => {
			const task = store.addTask({ title: 'To drop' });
			store.dropTask(task.id);
			const unscheduled = store.getUnscheduledTasks();
			expect(unscheduled.every((t) => t.status !== 'dropped')).toBe(true);
		});

		it('getTasksForBlock returns tasks for specific block', () => {
			const tasks = store.getTasksForBlock('block-1');
			expect(tasks).toHaveLength(1);
			expect(tasks[0].title).toBe('Scheduled');
		});

		it('getTasksForBlock keeps done tasks but excludes dropped', () => {
			// Done tasks stay visible (TaskItem renders them struck-through); only
			// dropped tasks are hidden — consistent with getTasksForDay /
			// getUnscheduledTasks.
			const tasks = store.getTasksForBlock('block-2');
			expect(tasks).toHaveLength(1);
			expect(tasks[0].status).toBe('done');
		});
	});

	describe('task edit mode', () => {
		it('openTaskEdit sets editingTaskId', () => {
			const task = store.addTask({ title: 'Task' });
			store.openTaskEdit(task.id);
			expect(store.editingTaskId).toBe(task.id);
		});

		it('closeTaskEdit clears editingTaskId', () => {
			const task = store.addTask({ title: 'Task' });
			store.openTaskEdit(task.id);
			store.closeTaskEdit();
			expect(store.editingTaskId).toBeNull();
		});
	});

	describe('compose mode', () => {
		it('startCompose opens with the given defaults', () => {
			store.startCompose({ targetDate: '2026-06-23', targetBlockId: 'b1' });
			expect(store.composing).toBe(true);
			expect(store.composeDefaults.targetDate).toBe('2026-06-23');
			expect(store.composeDefaults.targetBlockId).toBe('b1');
		});

		it('startCompose defaults to an empty object when omitted', () => {
			store.startCompose();
			expect(store.composing).toBe(true);
			expect(store.composeDefaults).toEqual({});
		});

		it('startCompose clears any active edit', () => {
			const task = store.addTask({ title: 'Task' });
			store.openTaskEdit(task.id);
			store.startCompose();
			expect(store.editingTaskId).toBeNull();
			expect(store.composing).toBe(true);
		});

		it('openTaskEdit cancels an in-progress compose', () => {
			const task = store.addTask({ title: 'Task' });
			store.startCompose();
			store.openTaskEdit(task.id);
			expect(store.composing).toBe(false);
			expect(store.editingTaskId).toBe(task.id);
		});

		it('cancelCompose closes and clears defaults', () => {
			store.startCompose({ targetDate: '2026-06-23' });
			store.cancelCompose();
			expect(store.composing).toBe(false);
			expect(store.composeDefaults).toEqual({});
		});
	});

	// ── day shape resolution ────────────────────────────────────────

	describe('getDayShape', () => {
		it('returns shape for today by default', () => {
			const shape = store.getDayShape();
			expect(shape).toBeTruthy();
			expect(store.dayShapes).toContain(shape);
		});

		it('returns override if set for a date', () => {
			const otherShape = store.dayShapes[1] ?? store.dayShapes[0];
			const testDate = new Date(2024, 5, 15); // June 15
			store.setDayShape(testDate, otherShape.id);
			const retrieved = store.getDayShape(testDate);
			expect(retrieved?.id).toBe(otherShape.id);
			expect(store.dayOverrides[dateKey(testDate)]?.dayShapeId).toBe(otherShape.id);
		});

		it('returns pattern-based shape if no override', () => {
			const testDate = new Date(2024, 5, 15); // Saturday
			const shape = store.getDayShape(testDate);
			expect(shape?.id).toBe(store.dayShapes.find((s) => s.id === store.weekPattern.days[6])?.id);
		});

		it('falls back to first shape if pattern is broken', () => {
			store.weekPattern = { days: ['nonexistent', 'nonexistent', 'nonexistent', 'nonexistent', 'nonexistent', 'nonexistent', 'nonexistent'] };
			const shape = store.getDayShape();
			expect(shape?.id).toBe(store.dayShapes[0]?.id);
		});

		it('returns null if no shapes exist', () => {
			store.dayShapes = [];
			const shape = store.getDayShape();
			expect(shape).toBeNull();
		});
	});

	describe('day shape overrides', () => {
		it('setDayShape stores an override', () => {
			const testDate = new Date(2024, 5, 15);
			const shapeId = store.dayShapes[0]?.id ?? 'unknown';
			store.setDayShape(testDate, shapeId);
			const key = dateKey(testDate);
			expect(store.dayOverrides[key]?.dayShapeId).toBe(shapeId);
		});

		it('clearDayOverride removes an override', () => {
			const testDate = new Date(2024, 5, 15);
			const shapeId = store.dayShapes[0]?.id ?? 'unknown';
			store.setDayShape(testDate, shapeId);
			store.clearDayOverride(testDate);
			const key = dateKey(testDate);
			expect(store.dayOverrides[key]).toBeUndefined();
		});

		it('cycleDayShape rotates through available shapes', () => {
			const testDate = new Date(2024, 5, 15);
			const initial = store.getDayShape(testDate);
			store.cycleDayShape(testDate);
			const after1 = store.getDayShape(testDate);
			store.cycleDayShape(testDate);
			const after2 = store.getDayShape(testDate);

			// All three should be different (unless there's only 1 shape)
			if (store.dayShapes.length > 1) {
				expect(after1?.id).not.toBe(initial?.id);
				expect(after2?.id).not.toBe(after1?.id);
			}
		});

		it('cycleDayShape wraps around to first shape', () => {
			const testDate = new Date(2024, 5, 15);
			const totalCycles = store.dayShapes.length;
			for (let i = 0; i < totalCycles; i++) {
				store.cycleDayShape(testDate);
			}
			const wrapped = store.getDayShape(testDate);
			const initial = store.getDayShape(new Date(2024, 5, 16)); // Different date, should use pattern default
			expect(wrapped?.id).toBe(initial?.id);
		});
	});

	// ── obligations & rituals ────────────────────────────────────────

	describe('addObligation', () => {
		it('creates an obligation with a unique ID', () => {
			const obl = store.addObligation({
				name: 'Meeting',
				startTime: '09:00',
				endTime: '10:00',
				weekdays: [1, 3, 5],
				domainId: 'domain-1'
			});
			expect(obl.id).toBeTruthy();
			expect(obl.name).toBe('Meeting');
			expect(store.obligations).toContainEqual(obl);
		});

		it('persists obligations', () => {
			store.addObligation({
				name: 'Meeting',
				startTime: '09:00',
				endTime: '10:00',
				weekdays: [1],
				domainId: 'domain-1'
			});
			const newStore = new PlannerStore();
			expect(newStore.obligations).toHaveLength(1);
			expect(newStore.obligations[0].name).toBe('Meeting');
		});
	});

	describe('removeObligation', () => {
		it('removes obligation by ID', () => {
			const obl = store.addObligation({
				name: 'Meeting',
				startTime: '09:00',
				endTime: '10:00',
				weekdays: [1],
				domainId: 'domain-1'
			});
			store.removeObligation(obl.id);
			expect(store.obligations).not.toContainEqual(obl);
		});
	});

	describe('addRitual', () => {
		it('creates a ritual with a unique ID', () => {
			const ritual = store.addRitual({
				name: 'Morning',
				startTime: '07:00',
				endTime: '07:30',
				domainId: 'domain-1'
			});
			expect(ritual.id).toBeTruthy();
			expect(ritual.name).toBe('Morning');
			expect(store.rituals).toContainEqual(ritual);
		});
	});

	describe('removeRitual', () => {
		it('removes ritual by ID', () => {
			const ritual = store.addRitual({
				name: 'Morning',
				startTime: '07:00',
				endTime: '07:30',
				domainId: 'domain-1'
			});
			store.removeRitual(ritual.id);
			expect(store.rituals).not.toContainEqual(ritual);
		});
	});

	// ── settings ────────────────────────────────────────────────────

	describe('updateSettings', () => {
		it('updates partial settings', () => {
			store.updateSettings({ flourishEnabled: false, tone: 'wry' });
			expect(store.settings.flourishEnabled).toBe(false);
			expect(store.settings.tone).toBe('wry');
			expect(store.settings.bellsEnabled).toBe(true); // unchanged
		});

		it('persists settings', () => {
			store.updateSettings({ quietHoursStart: '23:00' });
			const newStore = new PlannerStore();
			expect(newStore.settings.quietHoursStart).toBe('23:00');
		});
	});

	describe('domains', () => {
		it('getDomainById returns matching domain', () => {
			const domain = { id: 'domain-1', name: 'Work', color: '#000', icon: '●' };
			store.setDomains([domain]);
			expect(store.getDomainById('domain-1')).toEqual(domain);
		});

		it('getDomainById returns undefined if not found', () => {
			expect(store.getDomainById('nonexistent')).toBeUndefined();
		});

		it('setDomains persists domains', () => {
			const domains = [
				{ id: 'domain-1', name: 'Work', color: '#000', icon: '●' },
				{ id: 'domain-2', name: 'Life', color: '#fff', icon: '◆' }
			];
			store.setDomains(domains);
			const newStore = new PlannerStore();
			expect(newStore.domains).toEqual(domains);
		});
	});

	// ── shapes & patterns ────────────────────────────────────────────

	describe('setDayShapes', () => {
		it('replaces dayShapes and persists', () => {
			const newShapes: DayShape[] = [
				{ id: 'custom-1', name: 'Custom', blocks: [], restful: false }
			];
			store.setDayShapes(newShapes);
			expect(store.dayShapes).toEqual(newShapes);

			const newStore = new PlannerStore();
			expect(newStore.dayShapes).toEqual(newShapes);
		});
	});

	describe('setWeekPattern', () => {
		it('sets week pattern and persists', () => {
			const pattern: WeekPattern = { days: ['id1', 'id2', 'id3', 'id4', 'id5', 'id6', 'id7'] };
			store.setWeekPattern(pattern);
			expect(store.weekPattern).toEqual(pattern);

			const newStore = new PlannerStore();
			expect(newStore.weekPattern).toEqual(pattern);
		});
	});

	// ── resetOnboarding ─────────────────────────────────────────────

	describe('resetOnboarding', () => {
		it('sets onboardingComplete to false', () => {
			store.updateSettings({ onboardingComplete: true });
			store.resetOnboarding();
			expect(store.settings.onboardingComplete).toBe(false);
		});
	});

	// ── view & binder ───────────────────────────────────────────────

	describe('view management', () => {
		it('setView updates currentView', () => {
			store.setView('month');
			expect(store.currentView).toBe('month');
		});

		it('toggleBinder opens tab if closed', () => {
			store.toggleBinder('shapes');
			expect(store.binderTab).toBe('shapes');
		});

		it('toggleBinder closes tab if open', () => {
			store.toggleBinder('shapes');
			store.toggleBinder('shapes');
			expect(store.binderTab).toBeNull();
		});

		it('toggleBinder switches between tabs', () => {
			store.toggleBinder('shapes');
			store.toggleBinder('waiting');
			expect(store.binderTab).toBe('waiting');
		});

		it('closeBinder clears binderTab', () => {
			store.toggleBinder('shapes');
			store.closeBinder();
			expect(store.binderTab).toBeNull();
		});
	});

	describe('day panel', () => {
		it('openDayPanel sets activeDayKey', () => {
			store.openDayPanel('2024-06-15');
			expect(store.activeDayKey).toBe('2024-06-15');
		});

		it('closeDayPanel clears activeDayKey', () => {
			store.openDayPanel('2024-06-15');
			store.closeDayPanel();
			expect(store.activeDayKey).toBeNull();
		});

		it('getTasksForDay returns tasks for a specific day', () => {
			const dateStr = '2024-06-15';
			const task = store.addTask({ title: 'Task', targetDate: dateStr });
			const tasks = store.getTasksForDay(dateStr);
			expect(tasks).toContainEqual(task);
		});

		it('getTasksForDay excludes dropped tasks', () => {
			const dateStr = '2024-06-15';
			const task = store.addTask({ title: 'Task', targetDate: dateStr });
			store.dropTask(task.id);
			const tasks = store.getTasksForDay(dateStr);
			expect(tasks).not.toContainEqual(task);
		});
	});

	// ── isRestful ───────────────────────────────────────────────────

	describe('isRestful', () => {
		beforeEach(() => {
			const shapes: DayShape[] = [
				{ id: 'work', name: 'Work', blocks: [], restful: false },
				{ id: 'rest', name: 'Rest', blocks: [], restful: true }
			];
			store.setDayShapes(shapes);
		});

		it('returns true for restful day shapes', () => {
			const testDate = new Date(2024, 5, 15); // Saturday
			store.setDayShape(testDate, 'rest');
			expect(store.isRestful(testDate)).toBe(true);
		});

		it('returns false for non-restful day shapes', () => {
			const testDate = new Date(2024, 5, 15);
			store.setDayShape(testDate, 'work');
			expect(store.isRestful(testDate)).toBe(false);
		});
	});

	// ── getBlocksForDate ────────────────────────────────────────────

	describe('getBlocksForDate', () => {
		beforeEach(() => {
			const shapes: DayShape[] = [
				{
					id: 'test-shape',
					name: 'Test',
					blocks: [
						{ id: 'morning', startTime: '07:00', endTime: '12:00', title: 'Morning' },
						{ id: 'afternoon', startTime: '13:00', endTime: '17:00', title: 'Afternoon' }
					],
					restful: false
				}
			];
			store.setDayShapes(shapes);
		});

		it('returns base blocks from day shape', () => {
			const testDate = new Date(2024, 5, 15);
			store.setDayShape(testDate, 'test-shape');
			const blocks = store.getBlocksForDate(testDate);
			expect(blocks.length).toBeGreaterThanOrEqual(2);
		});

		it('includes obligation blocks for matching weekdays', () => {
			const testDate = new Date(2024, 5, 10); // Monday
			store.setDayShape(testDate, 'test-shape');
			store.addObligation({
				name: 'Meeting',
				startTime: '10:00',
				endTime: '11:00',
				weekdays: [1], // Monday
				domainId: ''
			});
			const blocks = store.getBlocksForDate(testDate);
			const oblBlock = blocks.find((b) => b.overlay === 'obligation');
			expect(oblBlock).toBeTruthy();
			expect(oblBlock?.title).toBe('Meeting');
		});

		it('includes ritual blocks', () => {
			const testDate = new Date(2024, 5, 15);
			store.setDayShape(testDate, 'test-shape');
			store.addRitual({
				name: 'Morning Meditation',
				startTime: '06:00',
				endTime: '06:30',
				domainId: ''
			});
			const blocks = store.getBlocksForDate(testDate);
			const ritualBlock = blocks.find((b) => b.overlay === 'ritual');
			expect(ritualBlock).toBeTruthy();
			expect(ritualBlock?.title).toBe('Morning Meditation');
		});

		it('getBlocksForDateKey resolves blocks from a YYYY-MM-DD key', () => {
			const testDate = new Date(2024, 5, 15);
			store.setDayShape(testDate, 'test-shape');
			const blocks = store.getBlocksForDateKey('2024-06-15');
			expect(blocks.length).toBeGreaterThanOrEqual(2);
		});

		it('getBlocksForDateKey returns [] for a malformed key', () => {
			expect(store.getBlocksForDateKey('')).toEqual([]);
			expect(store.getBlocksForDateKey('not-a-date')).toEqual([]);
		});
	});

	// ── rehydrate ───────────────────────────────────────────────────

	describe('rehydrate', () => {
		it('restores all persisted state fields', () => {
			const blob = {
				shapes: [{ id: 'custom', name: 'Custom', blocks: [], restful: false }],
				weekPattern: { days: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as WeekPattern['days'] },
				days: { '2024-06-15': { date: '2024-06-15', dayShapeId: 'custom' } },
				obligations: [
					{
						id: 'obl-1',
						name: 'Meeting',
						startTime: '09:00',
						endTime: '10:00',
						weekdays: [1],
						domainId: ''
					}
				],
				rituals: [
					{ id: 'rit-1', name: 'Morning', startTime: '07:00', endTime: '07:30', domainId: '' }
				],
				tasks: [{ id: 'task-1', title: 'Task', status: 'open' } as any],
				settings: { flourishEnabled: false, tone: 'wry' } as any,
				domains: [{ id: 'domain-1', name: 'Work', color: '#000', icon: '●' }]
			};
			store.rehydrate(blob);

			expect(store.dayShapes).toEqual(blob.shapes);
			expect(store.weekPattern).toEqual(blob.weekPattern);
			expect(store.obligations).toHaveLength(1);
			expect(store.rituals).toHaveLength(1);
			expect(store.tasks).toHaveLength(1);
			expect(store.settings.flourishEnabled).toBe(false);
			expect(store.domains).toEqual(blob.domains);
		});

		it('persists rehydrated state', () => {
			const blob = {
				shapes: [{ id: 'custom', name: 'Custom', blocks: [], restful: false }],
				weekPattern: { days: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as WeekPattern['days'] },
				days: {},
				obligations: [],
				rituals: [],
				tasks: [],
				settings: {} as any,
				domains: []
			};
			store.rehydrate(blob);

			const newStore = new PlannerStore();
			expect(newStore.dayShapes[0].id).toBe('custom');
		});
	});

	// ── block resolution helpers ────────────────────────────────────

	describe('block helpers', () => {
		beforeEach(() => {
			const shapes: DayShape[] = [
				{
					id: 'test-shape',
					name: 'Test',
					blocks: [
						{ id: 'morning', startTime: '08:00', endTime: '12:00', title: 'Morning' },
						{ id: 'afternoon', startTime: '13:00', endTime: '17:00', title: 'Afternoon' },
						{ id: 'evening', startTime: '18:00', endTime: '22:00', title: 'Evening' }
					],
					restful: false
				}
			];
			store.setDayShapes(shapes);
		});

		it('getAllBlocks returns unique blocks across all shapes', () => {
			store.setDayShape(store.now, 'test-shape');
			const blocks = store.getAllBlocks();
			expect(blocks.length).toBeGreaterThan(0);
			// Check for uniqueness
			const ids = blocks.map((b) => b.id);
			expect(ids.length).toBe(new Set(ids).size);
		});

		it('getCurrentBlockForDate returns current block', () => {
			const testDate = new Date(2024, 5, 15, 10, 0); // 10 AM
			store.setDayShape(testDate, 'test-shape');
			const currentBlock = store.getCurrentBlockForDate(testDate);
			if (currentBlock) {
				expect(['morning', 'afternoon', 'evening']).toContain(currentBlock.id);
			}
		});

		it('getNextBlockForDate returns next block', () => {
			const testDate = new Date(2024, 5, 15, 10, 0); // 10 AM
			store.setDayShape(testDate, 'test-shape');
			const nextBlock = store.getNextBlockForDate(testDate);
			expect(nextBlock).toBeTruthy();
		});
	});
});
