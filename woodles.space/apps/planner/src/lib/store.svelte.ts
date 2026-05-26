import type {
	Task,
	DayInstance,
	DayShape,
	WeekPattern,
	PlannerSettings,
	View,
	BinderTab,
	Domain,
	Block
} from './types';
import {
	STARTER_SHAPES,
	STARTER_WEEK_PATTERN,
	getCurrentBlock,
	getNextBlock
} from './templates';
import { dateKey, nowMinutes, uid, timeToMinutes } from './utils';
import { playBell } from './bells';

// ── persistence helpers ───────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw !== null ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function save<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Ignore quota / disabled storage
	}
}

const DEFAULT_SETTINGS: PlannerSettings = {
	flourishEnabled: true,
	quietHoursStart: '22:00',
	quietHoursEnd: '07:00',
	leadTimeMinutes: 5,
	bellsEnabled: true,
	dayCycleEnabled: true,
	fixedPaletteMode: null,
	onboardingComplete: true // layer 2 will flip default to false
};

// ── store class (Svelte 5 runes, class pattern) ───────────────────

class PlannerStore {
	// Persisted — schedule data (new in layer 1)
	dayShapes = $state<DayShape[]>(load('planner.shapes.v1', STARTER_SHAPES));
	weekPattern = $state<WeekPattern>(load('planner.weekPattern.v1', STARTER_WEEK_PATTERN));
	dayOverrides = $state<Record<string, DayInstance>>(load('planner.days.v2', {}));

	// Persisted — user data
	tasks = $state<Task[]>(load('planner.tasks.v1', []));
	settings = $state<PlannerSettings>({
		...DEFAULT_SETTINGS,
		...load('planner.settings.v1', {} as Partial<PlannerSettings>)
	});
	domains = $state<Domain[]>(load('planner.domains.v1', []));

	// Transient
	currentView = $state<View>('now-next');
	binderTab = $state<BinderTab>(null);
	now = $state<Date>(new Date());
	editingTaskId = $state<string | null>(null);
	activeDayKey = $state<string | null>(null);

	// ── shape resolution ────────────────────────────────────────────

	getDayShape(date: Date = this.now): DayShape | null {
		const key = dateKey(date);
		const overrideId = this.dayOverrides[key]?.dayShapeId;
		const patternId = this.weekPattern.days[date.getDay()];
		const id = overrideId ?? patternId;
		return this.dayShapes.find((s) => s.id === id) ?? this.dayShapes[0] ?? null;
	}

	getBlocksForDate(date: Date = this.now): Block[] {
		return this.getDayShape(date)?.blocks ?? [];
	}

	isRestful(date: Date = this.now): boolean {
		return this.getDayShape(date)?.restful === true;
	}

	getAllBlocks(): Block[] {
		const seen = new Set<string>();
		const out: Block[] = [];
		for (const shape of this.dayShapes) {
			for (const b of shape.blocks) {
				if (!seen.has(b.id)) {
					seen.add(b.id);
					out.push(b);
				}
			}
		}
		return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}

	getTasksForBlock(blockId: string, dateStr?: string): Task[] {
		const dk = dateStr ?? dateKey(this.now);
		return this.tasks.filter(
			(t) =>
				t.status !== 'dropped' &&
				t.targetBlockId === blockId &&
				(!t.targetDate || t.targetDate === dk)
		);
	}

	getUnscheduledTasks(): Task[] {
		return this.tasks.filter((t) => t.status !== 'dropped' && !t.targetBlockId);
	}

	getDomainById(id: string): Domain | undefined {
		return this.domains.find((d) => d.id === id);
	}

	// ── task actions ────────────────────────────────────────────────

	addTask(partial: Partial<Task> & { title: string }): Task {
		const t: Task = {
			id: uid(),
			title: partial.title.trim(),
			status: 'open',
			domainId: partial.domainId,
			targetBlockId: partial.targetBlockId,
			targetDate: partial.targetDate ?? (partial.targetBlockId ? dateKey(this.now) : undefined),
			estimatedDuration: partial.estimatedDuration,
			notes: partial.notes,
			recurrenceRule: partial.recurrenceRule,
			createdAt: new Date().toISOString()
		};
		this.tasks = [...this.tasks, t];
		save('planner.tasks.v1', this.tasks);
		return t;
	}

	completeTask(id: string): void {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, status: 'done' as const } : t));
		save('planner.tasks.v1', this.tasks);
	}

	dropTask(id: string): void {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, status: 'dropped' as const } : t));
		save('planner.tasks.v1', this.tasks);
	}

	reopenTask(id: string): void {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, status: 'open' as const } : t));
		save('planner.tasks.v1', this.tasks);
	}

	updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): void {
		this.tasks = this.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t));
		save('planner.tasks.v1', this.tasks);
	}

	openTaskEdit(id: string): void {
		this.editingTaskId = id;
	}

	closeTaskEdit(): void {
		this.editingTaskId = null;
	}

	// ── day-shape actions ───────────────────────────────────────────

	setDayShape(date: Date, dayShapeId: string): void {
		const key = dateKey(date);
		this.dayOverrides = { ...this.dayOverrides, [key]: { date: key, dayShapeId } };
		save('planner.days.v2', this.dayOverrides);
	}

	clearDayOverride(date: Date): void {
		const key = dateKey(date);
		const { [key]: _, ...rest } = this.dayOverrides;
		this.dayOverrides = rest;
		save('planner.days.v2', this.dayOverrides);
	}

	cycleDayShape(date: Date): void {
		if (this.dayShapes.length === 0) return;
		const current = this.getDayShape(date);
		const idx = current ? this.dayShapes.findIndex((s) => s.id === current.id) : -1;
		const next = this.dayShapes[(idx + 1) % this.dayShapes.length];
		this.setDayShape(date, next.id);
	}

	saveDayShapes(): void {
		save('planner.shapes.v1', this.dayShapes);
	}

	saveWeekPattern(): void {
		save('planner.weekPattern.v1', this.weekPattern);
	}

	saveSettings(): void {
		save('planner.settings.v1', this.settings);
	}

	saveDomains(): void {
		save('planner.domains.v1', this.domains);
	}

	// ── view + binder ───────────────────────────────────────────────

	setView(v: View): void {
		this.currentView = v;
	}

	toggleBinder(tab: BinderTab): void {
		this.binderTab = this.binderTab === tab ? null : tab;
	}

	closeBinder(): void {
		this.binderTab = null;
	}

	openDayPanel(dateStr: string): void {
		this.activeDayKey = dateStr;
	}

	closeDayPanel(): void {
		this.activeDayKey = null;
	}

	getTasksForDay(dateStr: string): Task[] {
		return this.tasks.filter((t) => t.status !== 'dropped' && t.targetDate === dateStr);
	}

	// ── clock + bell ────────────────────────────────────────────────

	#lastBellMinuteKey = '';

	tick(): void {
		this.now = new Date();

		if (!this.settings.bellsEnabled) return;

		const mins = nowMinutes(this.now);
		const minuteKey = `${dateKey(this.now)}-${mins}`;
		if (minuteKey === this.#lastBellMinuteKey) return;

		const blocks = this.getBlocksForDate(this.now);
		for (const block of blocks) {
			const startMins = timeToMinutes(block.startTime);
			const diff = startMins - mins;
			if (diff === this.settings.leadTimeMinutes) {
				playBell('lead-time');
				this.#lastBellMinuteKey = minuteKey;
				break;
			}
			if (diff === 0) {
				playBell(block.bellId ?? 'block-start');
				this.#lastBellMinuteKey = minuteKey;
				break;
			}
		}
	}

	// ── shape-relative wrappers (convenience for views) ─────────────

	getCurrentBlockForDate(date: Date = this.now): Block | null {
		return getCurrentBlock(this.getBlocksForDate(date), date);
	}

	getNextBlockForDate(date: Date = this.now): Block | null {
		return getNextBlock(this.getBlocksForDate(date), date);
	}

	constructor() {
		if (typeof window !== 'undefined') {
			setInterval(() => this.tick(), 30_000);
		}
	}
}

export const store = new PlannerStore();
