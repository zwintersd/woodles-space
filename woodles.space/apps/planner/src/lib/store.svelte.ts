import type { Task, DayInstance, DayType, PlannerSettings, View, BinderTab, Domain } from './types';
import { getTemplate, defaultDayType, getCurrentBlock, getNextBlock } from './templates';
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
	fixedPaletteMode: null
};

const DEFAULT_DOMAINS: Domain[] = [
	{ id: 'appointments', name: 'appointments', color: '#7c9e7a', icon: '⊕' },
	{ id: 'car',          name: 'car',          color: '#c8900a', icon: '◎' },
	{ id: 'household',    name: 'household',    color: '#b07858', icon: '⌂' },
	{ id: 'financial',    name: 'financial',    color: '#5e8b8c', icon: '◈' },
	{ id: 'health',       name: 'health',       color: '#9b8ea0', icon: '✦' },
	{ id: 'kp-career',    name: 'kp/career',    color: '#c4a882', icon: '❏' },
	{ id: 'creative',     name: 'creative',     color: '#b5a47a', icon: '✎' },
	{ id: 'social',       name: 'social',       color: '#8878a8', icon: '◦' },
	{ id: 'pets',         name: 'pets',         color: '#a0785a', icon: '❦' }
];

// ── store class (Svelte 5 runes, class pattern) ───────────────────

class PlannerStore {
	// Persisted
	tasks = $state<Task[]>(load('planner.tasks.v1', []));
	dayOverrides = $state<Record<string, DayInstance>>(load('planner.days.v1', {}));
	settings = $state<PlannerSettings>(load('planner.settings.v1', DEFAULT_SETTINGS));
	domains = $state<Domain[]>(load('planner.domains.v1', DEFAULT_DOMAINS));

	// Transient
	currentView = $state<View>('now-next');
	binderTab = $state<BinderTab>(null);
	now = $state<Date>(new Date());
	editingTaskId = $state<string | null>(null);
	activeDayKey = $state<string | null>(null);

	// ── derived helpers ─────────────────────────────────────────────

	getDayType(date: Date = this.now): DayType {
		const key = dateKey(date);
		return this.dayOverrides[key]?.dayType ?? defaultDayType(date);
	}

	getBlocksForDate(date: Date = this.now) {
		return getTemplate(this.getDayType(date));
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

	// ── actions ────────────────────────────────────────────────────

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

	setDayType(date: Date, dayType: DayType): void {
		const key = dateKey(date);
		this.dayOverrides = { ...this.dayOverrides, [key]: { date: key, dayType } };
		save('planner.days.v1', this.dayOverrides);
	}

	toggleDayType(date: Date): void {
		const current = this.getDayType(date);
		this.setDayType(date, current === 'weekday-work' ? 'day-off' : 'weekday-work');
	}

	setView(v: View): void {
		this.currentView = v;
	}

	toggleBinder(tab: BinderTab): void {
		this.binderTab = this.binderTab === tab ? null : tab;
	}

	closeBinder(): void {
		this.binderTab = null;
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

		const blocks = getTemplate(this.getDayType(this.now));
		for (const block of blocks) {
			const startMins = timeToMinutes(block.startTime);
			const diff = startMins - mins;
			if (diff === this.settings.leadTimeMinutes) {
				playBell('lead-time');
				this.#lastBellMinuteKey = minuteKey;
				break;
			}
			if (diff === 0) {
				playBell(block.bellId);
				this.#lastBellMinuteKey = minuteKey;
				break;
			}
		}
	}

	constructor() {
		if (typeof window !== 'undefined') {
			setInterval(() => this.tick(), 30_000);
		}
	}
}

export const store = new PlannerStore();
