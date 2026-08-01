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
	PlannerBlob,
	IntervalKind,
	IntervalObservation,
	Routine,
	RoutinePractice,
	RoutineStepResult,
	SurgeDraft,
	SporeEvent,
	MomentumLevel
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
import {
	STARTER_ROUTINES,
	intervalKey,
	kindLabel,
	routineIndependence
} from './instrument';

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
	samplingIntervalMinutes: 15,
	bellsEnabled: true,
	dayCycleEnabled: true,
	fixedPaletteMode: null,
	onboardingComplete: false,
	wakeAnchor: '07:00',
	sleepAnchor: '22:30',
	tone: 'gentle'
};

function migrateCarillonPiles(): DayShape[] {
	const stored = load('planner.shapes.v1', STARTER_SHAPES);
	if (typeof localStorage === 'undefined') return stored;
	if (load('planner.carillonPiles.v1', false)) return stored;

	const starterById = new Map(STARTER_SHAPES.map((shape) => [shape.id, shape]));
	const migrated = stored.map((shape) => {
		const starter = starterById.get(shape.id);
		if (!starter) return shape;
		const starterBlocks = new Map(starter.blocks.map((block) => [block.id, block]));
		return {
			...shape,
			blocks: shape.blocks.map((block) => {
				const starterBlock = starterBlocks.get(block.id);
				return {
					...block,
					momentum: block.momentum ?? starterBlock?.momentum ?? 'steady',
					sampleKind: block.sampleKind ?? starterBlock?.sampleKind
				};
			})
		};
	});
	const existingIds = new Set(migrated.map((shape) => shape.id));
	for (const starter of STARTER_SHAPES) {
		if (!existingIds.has(starter.id)) migrated.push(starter);
	}

	save('planner.shapes.v1', migrated);
	save('planner.carillonPiles.v1', true);
	return migrated;
}

// ── store class (Svelte 5 runes, class pattern) ───────────────────

export class PlannerStore {
	// Persisted — schedule data
	dayShapes = $state<DayShape[]>(migrateCarillonPiles());
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

	// Persisted — the observed day instrument. These are deliberately separate
	// from blocks/tasks: recording reality never edits the plan.
	intervalObservations = $state<IntervalObservation[]>(
		load('planner.observations.v1', [])
	);
	routines = $state<Routine[]>(load('planner.routines.v1', STARTER_ROUTINES));
	routinePractices = $state<RoutinePractice[]>(
		load('planner.routinePractices.v1', [])
	);
	surgeDrafts = $state<SurgeDraft[]>(load('planner.surgeDrafts.v1', []));
	sporeEvents = $state<SporeEvent[]>(load('planner.carillonSpores.v1', []));

	// Transient
	readonly sessionId = uid();
	currentView = $state<View>('now-next');
	binderTab = $state<BinderTab>(null);
	now = $state<Date>(new Date());
	editingTaskId = $state<string | null>(null);
	activeDayKey = $state<string | null>(null);
	// Compose flow — a brand-new task being filled in (guided "when/where" sheet).
	composing = $state<boolean>(false);
	composeDefaults = $state<Partial<Task>>({});

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

	// Blocks for a "YYYY-MM-DD" key — the shape that day actually resolves to,
	// including obligation/ritual overlays. Used by the composer so picking a
	// future date surfaces that day's real blocks rather than today's.
	getBlocksForDateKey(dateStr: string): Block[] {
		const [y, m, d] = dateStr.split('-').map(Number);
		if (!y || !m || !d) return [];
		return this.getBlocksForDate(new Date(y, m - 1, d));
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
		const timestamp = new Date().toISOString();
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
			createdAt: timestamp,
			updatedAt: timestamp
		};
		this.tasks = [...this.tasks, t];
		save('planner.tasks.v1', this.tasks);
		return t;
	}

	completeTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'done' as const, updatedAt } : t
		);
		save('planner.tasks.v1', this.tasks);
	}

	dropTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'dropped' as const, updatedAt } : t
		);
		save('planner.tasks.v1', this.tasks);
	}

	reopenTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'open' as const, updatedAt } : t
		);
		save('planner.tasks.v1', this.tasks);
	}

	updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): void {
		// id and createdAt are immutable once a task exists — guard them even if a
		// caller forces them through (the type already forbids it).
		this.tasks = this.tasks.map((t) =>
			t.id === id
				? {
						...t,
						...changes,
						id: t.id,
						createdAt: t.createdAt,
						updatedAt: new Date().toISOString()
					}
				: t
		);
		save('planner.tasks.v1', this.tasks);
	}

	openTaskEdit(id: string): void {
		this.composing = false;
		this.editingTaskId = id;
	}

	closeTaskEdit(): void {
		this.editingTaskId = null;
	}

	// Open the guided composer for a brand-new task. Defaults pre-fill the
	// "when" (date), "where" (block), and domain so any view can hand off a
	// sensible starting point — e.g. NowNext seeds today + the current block.
	startCompose(defaults: Partial<Task> = {}): void {
		this.editingTaskId = null;
		this.composeDefaults = defaults;
		this.composing = true;
	}

	cancelCompose(): void {
		this.composing = false;
		this.composeDefaults = {};
	}

	// ── interval observations + reinforcement ──────────────────────

	getObservationsForDate(dateStr: string): IntervalObservation[] {
		return this.intervalObservations
			.filter((observation) => observation.date === dateStr)
			.sort((a, b) => a.intervalStart.localeCompare(b.intervalStart));
	}

	getObservation(dateStr: string, intervalStart: string): IntervalObservation | undefined {
		const id = `observation-${intervalKey(dateStr, intervalStart)}`;
		return this.intervalObservations.find((observation) => observation.id === id);
	}

	observeInterval(input: {
		date?: string;
		intervalStart: string;
		kind: IntervalKind;
		label?: string;
		note?: string;
		source?: 'live' | 'paper';
	}): IntervalObservation {
		const date = input.date ?? dateKey(this.now);
		const id = `observation-${intervalKey(date, input.intervalStart)}`;
		const existing = this.intervalObservations.find((observation) => observation.id === id);
		const minute = timeToMinutes(input.intervalStart);
		const plannedBlocks = this.getBlocksForDateKey(date).filter((block) => {
			const start = timeToMinutes(block.startTime);
			const end = timeToMinutes(block.endTime);
			return minute >= start && minute < end;
		});
		const plannedLabel = existing
			? existing.plannedLabel
			: plannedBlocks[plannedBlocks.length - 1]?.title;
		const timestamp = new Date().toISOString();

		const observation: IntervalObservation = {
			id,
			date,
			intervalStart: input.intervalStart,
			source: existing?.source ?? input.source ?? 'live',
			kind: input.kind,
			label: input.label?.trim() || kindLabel(input.kind),
			plannedLabel,
			note: input.note?.trim() || undefined,
			intervalMinutes: existing?.intervalMinutes ?? this.settings.samplingIntervalMinutes,
			capturedAt: existing?.capturedAt ?? timestamp,
			updatedAt: timestamp
		};

		this.intervalObservations = existing
			? this.intervalObservations.map((item) => (item.id === id ? observation : item))
			: [...this.intervalObservations, observation];

		const sporeId = `carillon-spore-${id}`;
		const existingSpore = this.sporeEvents.find((event) => event.id === sporeId);
		const spore: SporeEvent = {
			id: sporeId,
			observationId: id,
			date,
			kind: input.kind,
			amount: 1,
			createdAt: existingSpore?.createdAt ?? timestamp
		};
		this.sporeEvents = existingSpore
			? this.sporeEvents.map((event) => (event.id === sporeId ? spore : event))
			: [...this.sporeEvents, spore];

		save('planner.observations.v1', this.intervalObservations);
		save('planner.carillonSpores.v1', this.sporeEvents);
		return observation;
	}

	// ── prompt-fading routines ──────────────────────────────────────

	addRoutine(name: string, stepLabels: string[], cue?: string): Routine | null {
		const cleanName = name.trim();
		const cleanSteps = stepLabels.map((step) => step.trim()).filter(Boolean);
		if (!cleanName || cleanSteps.length === 0) return null;
		const timestamp = new Date().toISOString();

		const routine: Routine = {
			id: uid(),
			name: cleanName,
			cue: cue?.trim() || undefined,
			steps: cleanSteps.map((label) => ({ id: uid(), label })),
			createdAt: timestamp,
			updatedAt: timestamp
		};
		this.routines = [...this.routines, routine];
		save('planner.routines.v1', this.routines);
		return routine;
	}

	archiveRoutine(id: string): void {
		const updatedAt = new Date().toISOString();
		this.routines = this.routines.map((routine) =>
			routine.id === id ? { ...routine, archived: true, updatedAt } : routine
		);
		save('planner.routines.v1', this.routines);
	}

	recordRoutinePractice(
		routineId: string,
		results: Record<string, RoutineStepResult>,
		date = dateKey(this.now)
	): RoutinePractice | null {
		const routine = this.routines.find((item) => item.id === routineId);
		if (!routine) return null;
		const id = `practice-${routineId}-${date}`;
		const practice: RoutinePractice = {
			id,
			routineId,
			date,
			results,
			independence: routineIndependence(routine, results),
			recordedAt: new Date().toISOString()
		};
		const existing = this.routinePractices.some((item) => item.id === id);
		this.routinePractices = existing
			? this.routinePractices.map((item) => (item.id === id ? practice : item))
			: [...this.routinePractices, practice];
		save('planner.routinePractices.v1', this.routinePractices);
		return practice;
	}

	// ── surge quarantine ────────────────────────────────────────────

	addSurgeDraft(title: string, body: string): SurgeDraft | null {
		const cleanTitle = title.trim();
		const cleanBody = body.trim();
		if (!cleanTitle && !cleanBody) return null;
		const timestamp = new Date().toISOString();
		const draft: SurgeDraft = {
			id: uid(),
			title: cleanTitle || cleanBody.split(/\r?\n/)[0].slice(0, 80) || 'untitled surge',
			body: cleanBody,
			status: 'captured',
			createdAt: timestamp,
			updatedAt: timestamp,
			createdSessionId: this.sessionId
		};
		this.surgeDrafts = [draft, ...this.surgeDrafts];
		save('planner.surgeDrafts.v1', this.surgeDrafts);
		return draft;
	}

	canPromoteSurgeDraft(id: string): boolean {
		const draft = this.surgeDrafts.find((item) => item.id === id);
		return Boolean(
			draft &&
				draft.status === 'captured' &&
				draft.createdSessionId !== this.sessionId
		);
	}

	promoteSurgeDraft(id: string): SurgeDraft | null {
		const draft = this.surgeDrafts.find((item) => item.id === id);
		if (!draft || !this.canPromoteSurgeDraft(id)) return null;
		const timestamp = new Date().toISOString();
		const taskId = `surge-task-${draft.id}`;
		const task: Task = {
			id: taskId,
			title: draft.title,
			status: 'open',
			notes:
				`Promoted from Surge · drafted ${draft.createdAt}\n\n${draft.body}`.trim(),
			createdAt: timestamp,
			updatedAt: timestamp
		};
		if (!this.tasks.some((item) => item.id === taskId)) {
			this.tasks = [...this.tasks, task];
		}
		const promoted: SurgeDraft = {
			...draft,
			status: 'promoted',
			promotedAt: timestamp,
			updatedAt: timestamp,
			promotedTaskIds: [taskId]
		};
		this.surgeDrafts = this.surgeDrafts.map((item) => (item.id === id ? promoted : item));
		save('planner.tasks.v1', this.tasks);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
		return promoted;
	}

	discardSurgeDraft(id: string): void {
		const discardedAt = new Date().toISOString();
		this.surgeDrafts = this.surgeDrafts.map((draft) =>
			draft.id === id
				? { ...draft, status: 'discarded' as const, discardedAt, updatedAt: discardedAt }
				: draft
		);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
	}

	restoreSurgeDraft(id: string): void {
		const updatedAt = new Date().toISOString();
		this.surgeDrafts = this.surgeDrafts.map((draft) =>
			draft.id === id
				? {
						...draft,
						status: 'captured' as const,
						createdSessionId: this.sessionId,
						discardedAt: undefined,
						updatedAt
					}
				: draft
		);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
	}

	// ── day-shape actions ───────────────────────────────────────────

	setDayShape(date: Date, dayShapeId: string): void {
		const key = dateKey(date);
		this.dayOverrides = {
			...this.dayOverrides,
			[key]: { date: key, dayShapeId, updatedAt: new Date().toISOString() }
		};
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

	updateBlockMomentum(
		dayShapeId: string,
		blockId: string,
		momentum: MomentumLevel
	): void {
		this.dayShapes = this.dayShapes.map((shape) =>
			shape.id === dayShapeId
				? {
						...shape,
						updatedAt: new Date().toISOString(),
						blocks: shape.blocks.map((block) =>
							block.id === blockId ? { ...block, momentum } : block
						)
					}
				: shape
		);
		save('planner.shapes.v1', this.dayShapes);
	}

	/**
	 * Put high-probability blocks first while preserving the pile's authored
	 * time slots. Fixed obligations are overlays, so they are never reordered.
	 */
	sequenceDayPile(dayShapeId: string): void {
		const rank: Record<MomentumLevel, number> = { easy: 0, steady: 1, stretch: 2 };
		this.dayShapes = this.dayShapes.map((shape) => {
			if (shape.id !== dayShapeId) return shape;
			const slots = [...shape.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
			const sequenced = [...shape.blocks].sort(
				(a, b) => rank[a.momentum ?? 'steady'] - rank[b.momentum ?? 'steady']
			);
			return {
				...shape,
				updatedAt: new Date().toISOString(),
				blocks: sequenced.map((block, index) => ({
					...block,
					startTime: slots[index]?.startTime ?? block.startTime,
					endTime: slots[index]?.endTime ?? block.endTime
				}))
			};
		});
		save('planner.shapes.v1', this.dayShapes);
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
		this.updateSettings({ onboardingComplete: false, onboardingStep: undefined });
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
		this.intervalObservations = blob.observations ?? this.intervalObservations;
		this.routines = blob.routines ?? this.routines;
		this.routinePractices = blob.routinePractices ?? this.routinePractices;
		this.surgeDrafts = blob.surgeDrafts ?? this.surgeDrafts;
		this.sporeEvents = blob.spores ?? this.sporeEvents;
		save('planner.shapes.v1', this.dayShapes);
		save('planner.weekPattern.v1', this.weekPattern);
		save('planner.days.v2', this.dayOverrides);
		save('planner.obligations.v1', this.obligations);
		save('planner.rituals.v1', this.rituals);
		save('planner.tasks.v1', this.tasks);
		save('planner.settings.v1', this.settings);
		save('planner.domains.v1', this.domains);
		save('planner.observations.v1', this.intervalObservations);
		save('planner.routines.v1', this.routines);
		save('planner.routinePractices.v1', this.routinePractices);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
		save('planner.carillonSpores.v1', this.sporeEvents);
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

		const quietStart = timeToMinutes(this.settings.quietHoursStart);
		const quietEnd = timeToMinutes(this.settings.quietHoursEnd);
		const inQuietHours =
			quietStart <= quietEnd
				? mins >= quietStart && mins < quietEnd
				: mins >= quietStart || mins < quietEnd;
		if (inQuietHours) return;

		const samplingInterval = Math.max(1, this.settings.samplingIntervalMinutes || 15);
		if (mins % samplingInterval === 0) {
			playBell('block-start');
			this.#lastBellMinuteKey = minuteKey;
			return;
		}

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
