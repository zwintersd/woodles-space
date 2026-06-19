import type {
	Task,
	DayInstance,
	DayShape,
	WeekPattern,
	PlannerSettings,
	View,
	BinderTab,
	Domain,
	Block,
	Obligation,
	Ritual,
	ToneName,
	PlannerBlob
} from './types';
import {
	STARTER_SHAPES,
	STARTER_WEEK_PATTERN,
	getCurrentBlock,
	getNextBlock,
	mergeBlocks
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
	onboardingComplete: false,
	wakeAnchor: '07:00',
	sleepAnchor: '22:30',
	tone: 'gentle'
};

// ── store class (Svelte 5 runes, class pattern) ───────────────────

export class PlannerStore {
	// Persisted — schedule data
	dayShapes = $state<DayShape[]>(load('planner.shapes.v1', STARTER_SHAPES));
	weekPattern = $state<WeekPattern>(load('planner.weekPattern.v1', STARTER_WEEK_PATTERN));
	dayOverrides = $state<Record<string, DayInstance>>(load('planner.days.v2', {}));
	obligations = $state<Obligation[]>(load('planner.obligations.v1', []));
	rituals = $state<Ritual[]>(load('planner.rituals.v1', []));

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
		const shape = this.getDayShape(date);
		const base = shape?.blocks ?? [];
		const weekday = date.getDay();

		const obligationBlocks: Block[] = this.obligations
			.filter((o) => o.weekdays.includes(weekday))
			.map((o) => ({
				id: `obl-${o.id}`,
				startTime: o.startTime,
				endTime: o.endTime,
				title: o.name,
				domainId: o.domainId,
				overlay: 'obligation' as const
			}));

		const ritualBlocks: Block[] = this.rituals.map((r) => ({
			id: `rit-${r.id}`,
			startTime: r.startTime,
			endTime: r.endTime,
			title: r.name,
			domainId: r.domainId,
			overlay: 'ritual' as const
		}));

		return mergeBlocks(base, [...obligationBlocks, ...ritualBlocks]);
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
		// also include obligation/ritual overlay blocks as targetable
		for (const o of this.obligations) {
			const id = `obl-${o.id}`;
			if (!seen.has(id)) {
				seen.add(id);
				out.push({ id, startTime: o.startTime, endTime: o.endTime, title: o.name, overlay: 'obligation' });
			}
		}
		for (const r of this.rituals) {
			const id = `rit-${r.id}`;
			if (!seen.has(id)) {
				seen.add(id);
				out.push({ id, startTime: r.startTime, endTime: r.endTime, title: r.name, overlay: 'ritual' });
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
		// id and createdAt are immutable once a task exists — guard them even if a
		// caller forces them through (the type already forbids it).
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, ...changes, id: t.id, createdAt: t.createdAt } : t
		);
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

	// ── obligation / ritual actions ────────────────────────────────

	addObligation(o: Omit<Obligation, 'id'>): Obligation {
		const created: Obligation = { ...o, id: uid() };
		this.obligations = [...this.obligations, created];
		save('planner.obligations.v1', this.obligations);
		return created;
	}

	removeObligation(id: string): void {
		this.obligations = this.obligations.filter((o) => o.id !== id);
		save('planner.obligations.v1', this.obligations);
	}

	addRitual(r: Omit<Ritual, 'id'>): Ritual {
		const created: Ritual = { ...r, id: uid() };
		this.rituals = [...this.rituals, created];
		save('planner.rituals.v1', this.rituals);
		return created;
	}

	removeRitual(id: string): void {
		this.rituals = this.rituals.filter((r) => r.id !== id);
		save('planner.rituals.v1', this.rituals);
	}

	// ── settings + persistence ─────────────────────────────────────

	updateSettings(patch: Partial<PlannerSettings>): void {
		this.settings = { ...this.settings, ...patch };
		save('planner.settings.v1', this.settings);
	}

	setDomains(domains: Domain[]): void {
		this.domains = domains;
		save('planner.domains.v1', this.domains);
	}

	setDayShapes(shapes: DayShape[]): void {
		this.dayShapes = shapes;
		save('planner.shapes.v1', this.dayShapes);
	}

	setWeekPattern(pattern: WeekPattern): void {
		this.weekPattern = pattern;
		save('planner.weekPattern.v1', this.weekPattern);
	}

	// Wipe everything user-introductory — used by "redo onboarding" affordance.
	resetOnboarding(): void {
		this.updateSettings({ onboardingComplete: false });
	}

	// Apply a blob from the sync server to all persisted state fields.
	rehydrate(blob: PlannerBlob): void {
		this.dayShapes = blob.shapes;
		this.weekPattern = blob.weekPattern;
		this.dayOverrides = blob.days;
		this.obligations = blob.obligations;
		this.rituals = blob.rituals;
		this.tasks = blob.tasks;
		this.settings = { ...DEFAULT_SETTINGS, ...blob.settings };
		this.domains = blob.domains;
		save('planner.shapes.v1', this.dayShapes);
		save('planner.weekPattern.v1', this.weekPattern);
		save('planner.days.v2', this.dayOverrides);
		save('planner.obligations.v1', this.obligations);
		save('planner.rituals.v1', this.rituals);
		save('planner.tasks.v1', this.tasks);
		save('planner.settings.v1', this.settings);
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
