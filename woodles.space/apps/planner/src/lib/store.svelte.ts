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
	SleepLog,
	SleepQuality,
	SignalEntry,
	SignalKind,
	LoggedSession,
	OpenLoop,
	LoopEvent,
	LoopEventType,
	ClosureReflection,
	FiveContactsRound,
	LoopReminder,
	BellMark,
	BellSoundSettings
} from './types';
import {
	STARTER_SHAPES,
	STARTER_WEEK_PATTERN,
	getCurrentBlock,
	getNextBlock,
	mergeBlocks
} from './templates';
import {
	CARILLON_COMMITMENTS_STORAGE_KEY,
	CARILLON_SESSIONS_STORAGE_KEY,
	mirrorLedgerLocally
} from '@woodles/sync';
import { buildCommitments } from './commitments';
import { buildSessions } from './sessions';
import { thinkingAboutShelf } from './thinkingAboutShelf.svelte';
import { dateKey, nowMinutes, uid, timeToMinutes } from './utils';
import { after, getBell, installAudioUnlock, levelFor, playNotes, registryNotes, voiceWithStrikes, watchAudioReadiness, watchSounding, type AudioReadiness, type PlayResult, type SoundKind } from './bells';
import {
	BELL_PRESETS, CHIME_GRACE_MINUTES, CLOCK_MARKS, DEFAULT_BELL_VOLUME, audible, bellMinuteClaimed, bellsResting, claimBellMinute,
	cleanVolume, countsHours, dueChime, markReminderRung, markSound, reminderRung, startOfMinute, type ChimeEvent
} from './chimes';
import { notesEnd, type BellNote, type BellVoiceId } from './bellVoices';
import { activeContacts, isLifecycleEvent, latestLifecycleEvent, projectLoopLifecycle, retainContactBoundary } from './openLoops';
import { cleanRhythmDays, dueReminders, isQuietMinute, liveReminders, rhythmDueAt } from './reminders';
import {
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

const BELL_VOLUME_KEY = 'planner.bellVolume.v1';
const BELL_PAUSE_KEY = 'planner.bellPause.v1';

/**
 * Deciding, playing and claiming a bell is one step across every tab on the
 * device: two tabs whose clocks tick in the same instant must not both ring.
 * Where Web Locks are missing the step simply runs (a rare double ring).
 */
function withBellLock(run: () => Promise<void>): Promise<void> {
	const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
	return locks?.request ? locks.request('carillon-bell', run).then(() => undefined) : run();
}

function loadPause(): string | null {
	const value = load<unknown>(BELL_PAUSE_KEY, null);
	return typeof value === 'string' && Number.isFinite(new Date(value).getTime()) ? value : null;
}

function loadRoutines(): Routine[] {
	const routines = load<Routine[]>('planner.routines.v1', []);
	const withoutSeededExamples = routines.filter((routine) => routine.createdAt !== 'starter');
	if (withoutSeededExamples.length !== routines.length) {
		save('planner.routines.v1', withoutSeededExamples);
	}
	return withoutSeededExamples;
}

const DEFAULT_SETTINGS: PlannerSettings = {
	flourishEnabled: false,
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
	tone: 'minimal'
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
	// Routines are personal checklists. Begin empty so setup only shows the
	// routines a person deliberately adds.
	routines = $state<Routine[]>(loadRoutines());
	routinePractices = $state<RoutinePractice[]>(
		load('planner.routinePractices.v1', [])
	);
	surgeDrafts = $state<SurgeDraft[]>(load('planner.surgeDrafts.v1', []));
	sporeEvents = $state<SporeEvent[]>(load('planner.carillonSpores.v1', []));
	sleepLogs = $state<SleepLog[]>(load('planner.sleepLogs.v1', []));
	signalEntries = $state<SignalEntry[]>(load('planner.signals.v1', []));
	loggedSessions = $state<LoggedSession[]>(load('planner.loggedSessions.v1', []));
	openLoops = $state<OpenLoop[]>(load('planner.openLoops.v1', []));
	loopEvents = $state<LoopEvent[]>(load('planner.loopEvents.v1', []));
	closureReflections = $state<ClosureReflection[]>(load('planner.closureReflections.v1', []));
	fiveContactsRounds = $state<FiveContactsRound[]>(load('planner.fiveContactsRounds.v1', []));
	loopReminders = $state<LoopReminder[]>(load('planner.loopReminders.v1', []));

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
		const day = this.dayOverrides[key];
		const shape = this.dayShapes.find((s) => s.id === id && !s.deletedAt) ?? null;
		if (day?.blocks) return { id, name: day.name ?? shape?.name ?? 'Day plan', blocks: day.blocks };
		return shape;
	}

	getBlocksForDate(date: Date = this.now): Block[] {
		const shape = this.getDayShape(date);
		const base = (shape?.blocks ?? []).filter((block) => !block.flexible);
		const weekday = date.getDay();
		const skipped = new Set(this.dayOverrides[dateKey(date)]?.skippedRecurring?.map((item) => item.blockId) ?? []);

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

		return mergeBlocks(base, [
			...obligationBlocks.filter((block) => !skipped.has(block.id)),
			...ritualBlocks.filter((block) => !skipped.has(block.id)),
			...this.standingBlocksForWeekday(weekday)
		]);
	}

	/**
	 * Overlay blocks derived from Thinking About's standing slots — a Thursday
	 * watch date appearing on the calendar without anyone creating an
	 * obligation by hand.
	 *
	 * Derived on read, never stored: the slot lives in the app that owns it, and
	 * a copy here would be a second truth free to drift. The consequence is that
	 * on a device where the shelf hasn't arrived yet the overlay simply isn't
	 * there — acceptable for something that draws a block, and the reason
	 * nothing is *minted* from it.
	 */
	standingBlocksForWeekday(weekday: number): Block[] {
		return thinkingAboutShelf.entries
			.filter((entry) => entry.standing?.weekdays.includes(weekday))
			.map((entry) => ({
				id: `ta-${entry.id}`,
				startTime: entry.standing!.startTime,
				endTime: entry.standing!.endTime,
				title: entry.title,
				overlay: 'standing' as const
			}));
	}

	isRestful(date: Date = this.now): boolean {
		return this.getDayShape(date)?.restful === true;
	}

	getAllBlocks(): Block[] {
		const seen = new Set<string>();
		const out: Block[] = [];
		for (const shape of this.dayShapes.filter((shape) => !shape.deletedAt)) {
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

	// ── sittings offered to Thinking About ──────────────────────────

	/**
	 * The Thinking About entries a given interval is plausibly about: the ones
	 * referenced by tasks scheduled into the block that covers it.
	 *
	 * This is what turns an observation into an offer. It reads the plan, not
	 * the observation — Carillon knows you meant to read Piranesi in the evening
	 * block; whether you actually were is what the mark says.
	 */
	linkedEntryIdsForInterval(dateStr: string, intervalStart: string): string[] {
		const minute = timeToMinutes(intervalStart);
		const block = this.getBlocksForDateKey(dateStr)
			.filter((candidate) => {
				const start = timeToMinutes(candidate.startTime);
				let end = timeToMinutes(candidate.endTime);
				if (end <= start) end += 1440;
				return minute >= start && minute < end;
			})
			.pop();
		if (!block) return [];

		return [
			...new Set(
				this.getTasksForBlock(block.id, dateStr)
					.map((task) => task.thinkingAboutEntryId)
					.filter((id): id is string => typeof id === 'string')
			)
		];
	}

	/**
	 * `linkedEntryIdsForInterval` plus whatever the moment itself was tagged
	 * with while writing it — the sitting offer shouldn't require a task to
	 * have been scheduled first. This is what the offer in the instrument
	 * actually shows.
	 */
	offerableEntryIdsForInterval(dateStr: string, intervalStart: string): string[] {
		const tagged = this.getObservation(dateStr, intervalStart)?.thinkingAboutEntryId;
		return [
			...new Set([...this.linkedEntryIdsForInterval(dateStr, intervalStart), ...(tagged ? [tagged] : [])])
		];
	}

	loggedSessionId(entryId: string, dateStr: string): string {
		return `session-${entryId}-${dateStr}`;
	}

	hasLoggedSession(entryId: string, dateStr: string): boolean {
		const id = this.loggedSessionId(entryId, dateStr);
		return this.loggedSessions.some((session) => session.id === id);
	}

	/**
	 * Record that a sitting should be logged in Thinking About. Idempotent by
	 * deterministic id — a day is one sitting however many bells it covered, and
	 * tapping twice can't produce two.
	 */
	logThinkingAboutSession(entryId: string, dateStr: string): LoggedSession {
		const id = this.loggedSessionId(entryId, dateStr);
		const existing = this.loggedSessions.find((session) => session.id === id);
		if (existing) return existing;

		const session: LoggedSession = {
			id,
			entryId,
			date: dateStr,
			createdAt: new Date().toISOString()
		};
		this.loggedSessions = [...this.loggedSessions, session];
		this.#saveLoggedSessions();
		return session;
	}

	/** Undo an offer taken by mistake, before the other app has been opened. */
	unlogThinkingAboutSession(entryId: string, dateStr: string): void {
		const id = this.loggedSessionId(entryId, dateStr);
		this.loggedSessions = this.loggedSessions.filter((session) => session.id !== id);
		this.#saveLoggedSessions();
	}

	#saveLoggedSessions(): void {
		save('planner.loggedSessions.v1', this.loggedSessions);
		this.publishSessionsLocally();
	}

	/** Mirror the sittings ledger for same-origin readers. Idempotent. */
	publishSessionsLocally(): void {
		mirrorLedgerLocally(CARILLON_SESSIONS_STORAGE_KEY, buildSessions(this.loggedSessions));
	}

	/**
	 * Persist tasks, and rebuild the commitments ledger from them.
	 *
	 * Every task write goes through here so the two can't drift: the ledger is
	 * derived, and there is no path that changes a task without changing what
	 * Thinking About should be told about it.
	 */
	#saveTasks(): void {
		save('planner.tasks.v1', this.tasks);
		this.publishCommitmentsLocally();
	}

	/**
	 * Mirror the commitments ledger for same-origin readers.
	 *
	 * Public and callable on load as well as on save: the ledger is derived, so
	 * a planner nobody has touched since this shipped would otherwise hold
	 * linked tasks and no ledger, and Thinking About would show nothing
	 * scheduled for something plainly on the plan. Idempotent.
	 */
	publishCommitmentsLocally(): void {
		mirrorLedgerLocally(
			CARILLON_COMMITMENTS_STORAGE_KEY,
			buildCommitments(this.tasks, this.getAllBlocks(), undefined, (date) => this.getBlocksForDateKey(date))
		);
	}

	/**
	 * Every task about one Thinking About entry, soonest first, undated last.
	 *
	 * Dropped tasks are excluded but done ones are kept — "you already read a
	 * chapter on Tuesday" is exactly the answer someone arriving from that app
	 * is asking for, and hiding it would make Carillon look like it had
	 * forgotten.
	 */
	getTasksForThinkingAboutEntry(entryId: string): Task[] {
		return this.tasks
			.filter((t) => t.thinkingAboutEntryId === entryId && t.status !== 'dropped')
			.sort((a, b) => (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99'));
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
			thinkingAboutEntryId: partial.thinkingAboutEntryId,
			createdAt: timestamp,
			updatedAt: timestamp
		};
		this.tasks = [...this.tasks, t];
		this.#saveTasks();
		return t;
	}

	completeTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'done' as const, updatedAt } : t
		);
		this.#saveTasks();
	}

	dropTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'dropped' as const, updatedAt } : t
		);
		this.#saveTasks();
	}

	reopenTask(id: string): void {
		const updatedAt = new Date().toISOString();
		this.tasks = this.tasks.map((t) =>
			t.id === id ? { ...t, status: 'open' as const, updatedAt } : t
		);
		this.#saveTasks();
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
		this.#saveTasks();
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
		trackerAnswers?: IntervalObservation['trackerAnswers'];
		noticings?: IntervalObservation['noticings'];
		linkedLoopIds?: IntervalObservation['linkedLoopIds'];
		details?: IntervalObservation['details'];
		sampleTag?: IntervalObservation['sampleTag'];
		date?: string;
		intervalStart: string;
		kind: IntervalKind;
		label?: string;
		note?: string;
		source?: 'live' | 'paper' | 'recall';
		/** Span of the mark. A recall stretch may cover several bells as one sample. */
		intervalMinutes?: number;
		thinkingAboutEntryId?: string;
	}): IntervalObservation {
		const date = input.date ?? dateKey(this.now);
		if (!this.dayOverrides[date]?.blocks) {
			const [y, m, d] = date.split('-').map(Number);
			const shape = this.getDayShape(new Date(y, m - 1, d, 12));
			this.saveDayPlan(date, shape?.blocks ?? [], shape?.name);
		}
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
			trackerAnswers: input.trackerAnswers === undefined ? existing?.trackerAnswers : input.trackerAnswers.map(a => ({ tracker: { ...a.tracker }, value: a.value })),
			noticings: input.noticings === undefined ? existing?.noticings : input.noticings.map(noticing => {
				const links = [...new Set(noticing.linkedLoopIds ?? [])];
				return { channel: noticing.channel, note: noticing.note.trim(), ...(links.length ? { linkedLoopIds: links } : {}) };
			}),
			linkedLoopIds: input.linkedLoopIds === undefined ? existing?.linkedLoopIds : [...new Set(input.linkedLoopIds)],
			details: input.details === undefined ? existing?.details : { ...input.details },
			sampleTag: input.sampleTag === undefined ? existing?.sampleTag : input.sampleTag ? { ...input.sampleTag } : null,
			id,
			date,
			intervalStart: input.intervalStart,
			source: existing?.source ?? input.source ?? 'live',
			kind: input.kind,
			label: input.label?.trim() || kindLabel(input.kind),
			plannedLabel,
			note: input.note?.trim() || undefined,
			thinkingAboutEntryId: input.thinkingAboutEntryId,
			intervalMinutes:
				existing?.intervalMinutes ?? input.intervalMinutes ?? this.settings.samplingIntervalMinutes,
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

	// ── optional open-loop notebook ──────────────────────────────────

	createOpenLoop(title: string): OpenLoop | null {
		const cleanTitle = title.trim();
		if (!cleanTitle) return null;
		const timestamp = new Date().toISOString();
		const loop: OpenLoop = { id: `loop-${uid()}`, title: cleanTitle, status: 'open', createdAt: timestamp, updatedAt: timestamp };
		this.openLoops = [...this.openLoops, loop];
		this.recordLoopEvent({ loopId: loop.id, type: 'noticed' });
		return loop;
	}

	recordLoopEvent(input: { loopId?: string; type: LoopEventType; note?: string; occurredAt?: string; sourceMomentId?: string }): LoopEvent | null {
		const loop = input.loopId ? this.openLoops.find(item => item.id === input.loopId) : undefined;
		if (input.loopId && !loop) return null;
		const lifecycle = ['paused', 'closed', 'released', 'reopened'].includes(input.type);
		if (lifecycle && !loop) return null;
		// Repeated resolution taps are retries, not a second resolution.
		if (loop?.status === 'resolved' && ['closed', 'released', 'paused'].includes(input.type)) return null;
		if (input.type === 'paused' && loop?.status === 'paused') return null;
		if (input.type === 'reopened' && loop?.status === 'open') return null;
		const timestamp = new Date().toISOString();
		const occurrence = input.occurredAt === undefined ? timestamp : new Date(input.occurredAt);
		if (occurrence instanceof Date && !Number.isFinite(occurrence.getTime())) return null;
		const event: LoopEvent = {
			id: `loop-event-${uid()}`, loopId: input.loopId, type: input.type,
			occurredAt: occurrence instanceof Date ? occurrence.toISOString() : occurrence,
			recordedAt: timestamp,
			sequence: this.loopEvents.reduce((max, item) => Math.max(max, item.sequence ?? 0), 0) + 1,
			note: input.note?.trim() || undefined,
			sourceMomentId: input.sourceMomentId
		};
		this.loopEvents = [...this.loopEvents, event];
		this.openLoops = projectLoopLifecycle(this.openLoops, this.loopEvents);
		save('planner.loopEvents.v1', this.loopEvents);
		save('planner.openLoops.v1', this.openLoops);
		if (event.type === 'closed' && loop) this.#ensureRhythmReminder(loop.id);
		return event;
	}

	/**
	 * Rename a loop or change whether it recurs. Lifecycle is untouched: it
	 * stays a projection of the event ledger.
	 */
	updateOpenLoop(id: string, patch: { title?: string; recurring?: boolean; rhythmDays?: number | string | null; remindAfterClosure?: boolean }): OpenLoop | null {
		const loop = this.openLoops.find(item => item.id === id);
		if (!loop) return null;
		const title = patch.title === undefined ? loop.title : patch.title.trim();
		if (!title) return null;
		const recurring = patch.recurring ?? Boolean(loop.recurring);
		const rhythmDays = !recurring ? undefined : patch.rhythmDays === undefined ? loop.rhythmDays : cleanRhythmDays(patch.rhythmDays ?? undefined);
		const remindAfterClosure = Boolean(recurring && rhythmDays && (patch.remindAfterClosure ?? loop.remindAfterClosure));
		const timestamp = new Date().toISOString();
		const updated: OpenLoop = {
			...loop, title, recurring: recurring || undefined, rhythmDays,
			remindAfterClosure: remindAfterClosure || undefined, editedAt: timestamp, updatedAt: timestamp
		};
		this.openLoops = projectLoopLifecycle(this.openLoops.map(item => item.id === id ? updated : item), this.loopEvents);
		save('planner.openLoops.v1', this.openLoops);
		if (remindAfterClosure) this.#ensureRhythmReminder(id);
		else this.#cancelRhythmReminders(id);
		return this.openLoops.find(item => item.id === id) ?? null;
	}

	/**
	 * Correct a saved event: when it happened, its note, or — for observations
	 * that are not lifecycle changes — which loop it belongs to. The entry time
	 * and the first occurrence time are kept, so a correction stays visible.
	 */
	updateLoopEvent(id: string, patch: { occurredAt?: string; note?: string | null; loopId?: string | null }): LoopEvent | null {
		const event = this.loopEvents.find(item => item.id === id);
		if (!event) return null;
		let occurredAt = event.occurredAt;
		if (patch.occurredAt !== undefined) {
			const time = new Date(patch.occurredAt);
			// An occurrence can be corrected into the past, not into the future.
			if (!Number.isFinite(time.getTime()) || time.getTime() > Date.now() + 60_000) return null;
			occurredAt = time.toISOString();
		}
		let loopId = event.loopId;
		if (patch.loopId !== undefined && (patch.loopId || undefined) !== event.loopId) {
			if (isLifecycleEvent(event.type)) return null;
			if (patch.loopId && !this.openLoops.some(loop => loop.id === patch.loopId)) return null;
			loopId = patch.loopId || undefined;
		}
		const note = patch.note === undefined ? event.note : patch.note?.trim() || undefined;
		if (occurredAt === event.occurredAt && loopId === event.loopId && note === event.note) return event;
		const timestamp = new Date().toISOString();
		const updated: LoopEvent = {
			...event, occurredAt, loopId, note, updatedAt: timestamp,
			originalOccurredAt: occurredAt !== event.occurredAt ? event.originalOccurredAt ?? event.occurredAt : event.originalOccurredAt
		};
		this.loopEvents = this.loopEvents.map(item => item.id === id ? updated : item);
		this.openLoops = projectLoopLifecycle(this.openLoops, this.loopEvents);
		save('planner.loopEvents.v1', this.loopEvents);
		save('planner.openLoops.v1', this.openLoops);
		if (occurredAt !== event.occurredAt) {
			// A between-cycles reminder follows its closure's corrected time.
			const shift = new Date(occurredAt).getTime() - new Date(event.occurredAt).getTime();
			this.#writeReminders(this.loopReminders.map(reminder => reminder.afterEventId === id && !reminder.endedAt
				? { ...reminder, dueAt: new Date(new Date(reminder.dueAt).getTime() + shift).toISOString(), updatedAt: timestamp } : reminder));
		}
		return updated;
	}

	// ── reminders: only ever the ones the person asked for ─────────────

	createLoopReminder(loopId: string, dueAt: string, note?: string): LoopReminder | null {
		const loop = this.openLoops.find(item => item.id === loopId);
		const due = new Date(dueAt);
		if (!loop || loop.status === 'resolved' || !Number.isFinite(due.getTime()) || due.getTime() < Date.now() - 60_000) return null;
		const timestamp = new Date().toISOString();
		const reminder: LoopReminder = { id: `reminder-${uid()}`, loopId, dueAt: due.toISOString(), note: note?.trim() || undefined, createdAt: timestamp, updatedAt: timestamp };
		this.#writeReminders([...this.loopReminders, reminder]);
		return reminder;
	}

	/** Thanks or cancel: either way the reminder is finished and never repeats. */
	endLoopReminder(id: string, ending: 'acknowledged' | 'cancelled'): void {
		const timestamp = new Date().toISOString();
		this.#writeReminders(this.loopReminders.map(reminder => reminder.id === id && !reminder.endedAt
			? { ...reminder, endedAt: timestamp, ending, updatedAt: timestamp } : reminder));
	}

	/** Move a reminder to a specific later time. */
	moveLoopReminder(id: string, dueAt: Date): void {
		if (!Number.isFinite(dueAt.getTime())) return;
		const timestamp = new Date().toISOString();
		this.#writeReminders(this.loopReminders.map(reminder => reminder.id === id && !reminder.endedAt
			? { ...reminder, dueAt: dueAt.toISOString(), updatedAt: timestamp } : reminder));
	}

	getLiveReminders(loopId?: string): LoopReminder[] {
		return liveReminders(this.loopReminders, this.openLoops, this.loopEvents).filter(reminder => !loopId || reminder.loopId === loopId);
	}

	getDueReminders(now: Date = this.now): LoopReminder[] {
		return dueReminders(this.loopReminders, this.openLoops, this.loopEvents, now);
	}

	#writeReminders(reminders: LoopReminder[]): void {
		this.loopReminders = reminders;
		save('planner.loopReminders.v1', this.loopReminders);
	}

	/** Deterministic id, so a retry or a second device cannot double it. */
	#ensureRhythmReminder(loopId: string): void {
		const loop = this.openLoops.find(item => item.id === loopId);
		const closure = latestLifecycleEvent(loopId, this.loopEvents);
		if (!loop?.recurring || !loop.remindAfterClosure || !loop.rhythmDays || loop.status !== 'resolved' || closure?.type !== 'closed') return;
		const id = `reminder-after-${closure.id}`;
		const dueAt = rhythmDueAt(closure.occurredAt, loop.rhythmDays);
		const existing = this.loopReminders.find(reminder => reminder.id === id);
		const timestamp = new Date().toISOString();
		if (existing && (existing.endedAt || existing.dueAt === dueAt)) return;
		const reminder: LoopReminder = existing
			? { ...existing, dueAt, updatedAt: timestamp }
			: { id, loopId, dueAt, afterEventId: closure.id, createdAt: timestamp, updatedAt: timestamp };
		this.#writeReminders(existing ? this.loopReminders.map(item => item.id === id ? reminder : item) : [...this.loopReminders, reminder]);
	}

	#cancelRhythmReminders(loopId: string): void {
		if (!this.loopReminders.some(reminder => reminder.loopId === loopId && reminder.afterEventId && !reminder.endedAt)) return;
		const timestamp = new Date().toISOString();
		this.#writeReminders(this.loopReminders.map(reminder => reminder.loopId === loopId && reminder.afterEventId && !reminder.endedAt
			? { ...reminder, endedAt: timestamp, ending: 'cancelled', updatedAt: timestamp } : reminder));
	}

	/**
	 * Browser notifications are opt-in, respect quiet hours, and fire once per
	 * due time. The in-app card shows due reminders either way.
	 */
	#deliverReminders(): void {
		if (!this.settings.reminderNotifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
		if (isQuietMinute(nowMinutes(this.now), this.settings.quietHoursStart, this.settings.quietHoursEnd)) return;
		const pending = this.getDueReminders().filter(reminder => reminder.notifiedFor !== reminder.dueAt);
		if (!pending.length) return;
		for (const reminder of pending) {
			const title = this.openLoops.find(loop => loop.id === reminder.loopId)?.title ?? 'An open loop';
			try {
				new Notification('Carillon', { body: `A reminder you asked for: ${title}${reminder.note ? ` — ${reminder.note}` : ''}`, tag: reminder.id });
			} catch {
				// Some mobile browsers only notify through a service worker; the in-app card still shows it.
			}
		}
		const ids = new Set(pending.map(reminder => reminder.id));
		// Not an edit: updatedAt stays put so this never outranks a snooze from another device.
		this.#writeReminders(this.loopReminders.map(reminder => ids.has(reminder.id) ? { ...reminder, notifiedFor: reminder.dueAt } : reminder));
	}

	/** An offer or idea waved away stays away. */
	dismissOffer(key: string): void {
		const dismissed = this.settings.dismissedOffers ?? [];
		if (dismissed.includes(key)) return;
		this.updateSettings({ dismissedOffers: [...dismissed, key].slice(-300) });
	}

	saveClosureReflection(eventId: string, input: { descriptors: string[]; note?: string; nextFeelsPossible?: 'something' | 'rest' | 'nothing' }): ClosureReflection | null {
		const event = this.loopEvents.find(item => item.id === eventId);
		if (!event || !['closed', 'released'].includes(event.type)) return null;
		const descriptors = [...new Set(input.descriptors.map(item => item.trim()).filter(Boolean))];
		const note = input.note?.trim() || undefined;
		if (!descriptors.length && !note && !input.nextFeelsPossible) return null;
		const existing = this.closureReflections.find(item => item.loopEventId === eventId);
		const timestamp = new Date().toISOString();
		const reflection: ClosureReflection = {
			id: `closure-reflection-${eventId}`, loopEventId: eventId,
			descriptors, note, nextFeelsPossible: input.nextFeelsPossible,
			recordedAt: existing?.recordedAt ?? timestamp, updatedAt: timestamp
		};
		this.closureReflections = existing
			? this.closureReflections.map(item => item.id === existing.id ? reflection : item)
			: [...this.closureReflections, reflection];
		save('planner.closureReflections.v1', this.closureReflections);
		return reflection;
	}

	// ── Five Contacts: a bounded commitment, independent of loop status ──

	startFiveContactsRound(): FiveContactsRound {
		const active = this.fiveContactsRounds.find(item => item.status === 'active');
		if (active) return active;
		const timestamp = new Date().toISOString();
		const round: FiveContactsRound = { id: `contacts-${uid()}`, startedAt: timestamp, updatedAt: timestamp, status: 'active', contacts: [] };
		this.fiveContactsRounds = [...this.fiveContactsRounds, round];
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
		return round;
	}

	countContact(roundId: string, input: { note?: string; linkedLoopId?: string } = {}): boolean {
		const round = this.fiveContactsRounds.find(item => item.id === roundId);
		if (!round || round.status !== 'active' || activeContacts(round).length >= 5) return false;
		if (input.linkedLoopId && !this.openLoops.some(loop => loop.id === input.linkedLoopId)) return false;
		const timestamp = new Date().toISOString();
		const contact = { id: `contact-${uid()}`, at: timestamp, sequence: round.contacts.reduce((max, item) => Math.max(max, item.sequence ?? 0), 0) + 1, note: input.note?.trim() || undefined, linkedLoopId: input.linkedLoopId };
		const contacts = [...round.contacts, contact];
		const completed = activeContacts({ ...round, contacts }).length === 5;
		this.fiveContactsRounds = this.fiveContactsRounds.map(item => item.id === roundId
			? { ...item, contacts, status: completed ? 'completed' : 'active', endedAt: completed ? timestamp : undefined, updatedAt: timestamp }
			: item);
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
		return true;
	}

	undoContact(roundId: string): void {
		const round = this.fiveContactsRounds.find(item => item.id === roundId);
		if (!round || round.status === 'stopped') return;
		const contact = activeContacts(round).at(-1);
		if (!contact) return;
		const timestamp = new Date().toISOString();
		const contacts = retainContactBoundary(round.contacts).map(entry => entry.id === contact.id ? { ...entry, removedAt: timestamp } : entry);
		const counted = activeContacts({ ...round, contacts });
		this.fiveContactsRounds = this.fiveContactsRounds.map(item => item.id === roundId ? {
			...item, contacts, status: counted.length === 5 ? 'completed' : 'active',
			endedAt: counted.length === 5 ? counted[4].at : undefined, updatedAt: timestamp
		} : item);
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
	}

	stopFiveContactsRound(roundId: string): void {
		const timestamp = new Date().toISOString();
		this.fiveContactsRounds = this.fiveContactsRounds.map(item => item.id === roundId && item.status === 'active'
			? { ...item, status: 'stopped', endedAt: timestamp, updatedAt: timestamp } : item);
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
	}

	reflectFiveContactsRound(roundId: string, note: string): void {
		const timestamp = new Date().toISOString();
		this.fiveContactsRounds = this.fiveContactsRounds.map(item => item.id === roundId
			? { ...item, reflectionNote: note.trim() || undefined, reflectionUpdatedAt: timestamp, updatedAt: timestamp } : item);
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
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
			routineName: routine.name,
			steps: routine.steps.map((step) => ({ ...step })),
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

	// ── capacity: sleep + ongoing signals ───────────────────────────

	getSleepLog(date: string): SleepLog | null {
		return this.sleepLogs.find((log) => log.date === date) ?? null;
	}

	recordSleep(quality: SleepQuality, date = dateKey(this.now)): SleepLog {
		const id = `sleep-${date}`;
		const existing = this.sleepLogs.find((log) => log.id === id);
		const timestamp = new Date().toISOString();
		const log: SleepLog = {
			id,
			date,
			quality,
			recordedAt: existing?.recordedAt ?? timestamp,
			updatedAt: timestamp
		};
		this.sleepLogs = existing
			? this.sleepLogs.map((item) => (item.id === id ? log : item))
			: [...this.sleepLogs, log];
		save('planner.sleepLogs.v1', this.sleepLogs);
		return log;
	}

	addSignalEntry(input: {
		kind: SignalKind;
		date: string;
		endDate?: string;
		label?: string;
		note?: string;
	}): SignalEntry | null {
		if (input.kind === 'custom' && !input.label?.trim()) return null;
		const timestamp = new Date().toISOString();
		const entry: SignalEntry = {
			id: uid(),
			kind: input.kind,
			date: input.date,
			endDate: input.endDate,
			label: input.label?.trim() || undefined,
			note: input.note?.trim() || undefined,
			createdAt: timestamp,
			updatedAt: timestamp
		};
		this.signalEntries = [...this.signalEntries, entry];
		save('planner.signals.v1', this.signalEntries);
		return entry;
	}

	/** Closes an open illness/custom span without inventing a new entry. */
	endSignalEntry(id: string, endDate = dateKey(this.now)): void {
		const updatedAt = new Date().toISOString();
		this.signalEntries = this.signalEntries.map((entry) =>
			entry.id === id ? { ...entry, endDate, updatedAt } : entry
		);
		save('planner.signals.v1', this.signalEntries);
		save('planner.loggedSessions.v1', this.loggedSessions);
		this.publishSessionsLocally();
	}

	removeSignalEntry(id: string): void {
		this.signalEntries = this.signalEntries.filter((entry) => entry.id !== id);
		save('planner.signals.v1', this.signalEntries);
		save('planner.loggedSessions.v1', this.loggedSessions);
		this.publishSessionsLocally();
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
				draft.status === 'captured'
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
		this.#saveTasks();
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

	savePile(input: DayShape): boolean {
		if (!input.name.trim() || input.blocks.some((block) => !block.title.trim() ||
			(!block.flexible && (!/^\d{2}:\d{2}$/.test(block.startTime) || !/^\d{2}:\d{2}$/.test(block.endTime) || block.endTime <= block.startTime)))) return false;
		const shape = { ...input, name: input.name.trim(), blocks: input.blocks.map((block) => ({ ...block })), updatedAt: new Date().toISOString() };
		this.setDayShapes(this.dayShapes.some((item) => item.id === shape.id)
			? this.dayShapes.map((item) => item.id === shape.id ? shape : item)
			: [...this.dayShapes, shape]);
		this.publishCommitmentsLocally();
		return true;
	}

	archivePile(id: string, archived = true): void {
		const shape = this.dayShapes.find((item) => item.id === id);
		if (shape) this.savePile({ ...shape, archived });
	}

	deletePile(id: string): void {
		const shape = this.dayShapes.find((item) => item.id === id);
		if (!shape) return;
		// Retain dated plans independently of the template being removed.
		for (const day of Object.values(this.dayOverrides)) {
			if (day.dayShapeId === id && !day.blocks) this.saveDayPlan(day.date, shape.blocks, shape.name);
		}
		const timestamp = new Date().toISOString();
		this.setDayShapes(this.dayShapes.map((item) => item.id === id
			? { ...item, blocks: [], deletedAt: timestamp, updatedAt: timestamp } : item));
		this.setWeekPattern({ days: this.weekPattern.days.map((value) => value === id ? '' : value) as WeekPattern['days'], updatedAt: timestamp });
	}

	saveDayPlan(date: string, blocks: Block[], name?: string): void {
		const [y, m, d] = date.split('-').map(Number);
		const shape = this.getDayShape(new Date(y, m - 1, d, 12));
		this.dayOverrides = { ...this.dayOverrides, [date]: {
			...this.dayOverrides[date], date, dayShapeId: shape?.id ?? '',
			name: name ?? shape?.name ?? 'Day plan', blocks: blocks.map((block) => ({ ...block })), updatedAt: new Date().toISOString()
		} };
		save('planner.days.v2', this.dayOverrides);
		this.publishCommitmentsLocally();
	}

	skipRecurring(date: string, blockId: string, reason = ''): void {
		const block = this.getBlocksForDateKey(date).find((item) => item.id === blockId);
		if (!block || (block.overlay !== 'obligation' && block.overlay !== 'ritual')) return;
		const [y, m, d] = date.split('-').map(Number);
		this.dayOverrides = { ...this.dayOverrides, [date]: {
			...this.dayOverrides[date],
			date, dayShapeId: this.dayOverrides[date]?.dayShapeId ?? this.getDayShape(new Date(y, m - 1, d, 12))?.id ?? '',
			skippedRecurring: [...(this.dayOverrides[date]?.skippedRecurring ?? []), { blockId, title: block.title, reason: reason.trim() }],
			updatedAt: new Date().toISOString()
		} };
		save('planner.days.v2', this.dayOverrides);
		this.publishCommitmentsLocally();
	}

	restoreRecurring(date: string, blockId: string): void {
		const day = this.dayOverrides[date];
		if (!day?.skippedRecurring?.some((item) => item.blockId === blockId)) return;
		this.dayOverrides = { ...this.dayOverrides, [date]: { ...day,
			skippedRecurring: day.skippedRecurring.filter((item) => item.blockId !== blockId),
			updatedAt: new Date().toISOString()
		} };
		save('planner.days.v2', this.dayOverrides);
		this.publishCommitmentsLocally();
	}

	saveDayNote(date: string, note: string): void {
		const [y, m, d] = date.split('-').map(Number);
		this.dayOverrides = { ...this.dayOverrides, [date]: {
			...this.dayOverrides[date], date, dayShapeId: this.dayOverrides[date]?.dayShapeId ?? this.getDayShape(new Date(y, m - 1, d, 12))?.id ?? '', note, updatedAt: new Date().toISOString()
		} };
		save('planner.days.v2', this.dayOverrides);
	}

	updateRoutine(id: string, patch: Partial<Routine>): void {
		const original = this.routines.find((item) => item.id === id);
		if (!original) return;
		// Upgrade legacy practices before replacing labels or removing the analysis.
		this.routinePractices = this.routinePractices.map((practice) => practice.routineId === id && !practice.steps
			? { ...practice, routineName: original.name, steps: original.steps.map((step) => ({ ...step })) } : practice);
		save('planner.routinePractices.v1', this.routinePractices);
		this.routines = this.routines.map((item) => item.id === id
			? { ...item, ...patch, id, updatedAt: new Date().toISOString() } : item);
		save('planner.routines.v1', this.routines);
	}

	deleteRoutine(id: string): void {
		this.updateRoutine(id, { deletedAt: new Date().toISOString(), archived: true, steps: [] });
	}

	updateSurgeDraft(id: string, patch: Pick<SurgeDraft, 'title' | 'body' | 'reviewDate'>): void {
		if (!patch.title.trim()) return;
		this.surgeDrafts = this.surgeDrafts.map((draft) => draft.id === id
			? { ...draft, ...patch, title: patch.title.trim(), updatedAt: new Date().toISOString() } : draft);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
	}

	extractSurgeTasks(id: string, titles: string[], targetDate?: string): Task[] {
		const draft = this.surgeDrafts.find((item) => item.id === id && item.status !== 'discarded');
		if (!draft) return [];
		const timestamp = new Date().toISOString();
		const tasks = titles.map((title) => title.trim()).filter(Boolean).map((title): Task => ({
			id: uid(), title, status: 'open', targetDate,
			notes: `From idea: ${draft.title}\n\n${draft.body}`, createdAt: timestamp, updatedAt: timestamp
		}));
		if (!tasks.length) return [];
		this.tasks = [...this.tasks, ...tasks];
		this.surgeDrafts = this.surgeDrafts.map((item) => item.id === id ? {
			...item, status: 'promoted', promotedAt: timestamp, updatedAt: timestamp,
			promotedTaskIds: [...(item.promotedTaskIds ?? []), ...tasks.map((task) => task.id)]
		} : item);
		this.#saveTasks();
		save('planner.surgeDrafts.v1', this.surgeDrafts);
		return tasks;
	}

	setDayShape(date: Date, dayShapeId: string): void {
		const key = dateKey(date);
		this.dayOverrides = {
			...this.dayOverrides,
			[key]: { ...this.dayOverrides[key], date: key, dayShapeId, blocks: undefined, name: undefined, updatedAt: new Date().toISOString() }
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
		const active = this.dayShapes.filter(s => !s.archived && !s.deletedAt);
		if (!active.length) return;
		const idx = current ? active.findIndex((s) => s.id === current.id) : -1;
		const next = active[(idx + 1) % active.length];
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

	/**
	 * Every change stamps the keys whose value actually changed, so sync keeps
	 * the newer edit per setting. A form that re-saves values it read earlier
	 * (onboarding's steps) must not stamp them as new.
	 */
	updateSettings(patch: Partial<PlannerSettings>): void {
		const stampedAt = new Date().toISOString();
		const stamps = { ...(this.settings.settingsStamps ?? {}) };
		const current = this.settings as Record<string, unknown>;
		for (const [key, value] of Object.entries(patch)) {
			if (key !== 'settingsStamps' && JSON.stringify(current[key]) !== JSON.stringify(value)) stamps[key] = stampedAt;
		}
		this.settings = { ...this.settings, ...patch, settingsStamps: stamps };
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
		this.sleepLogs = blob.sleepLogs ?? this.sleepLogs;
		this.signalEntries = blob.signals ?? this.signalEntries;
		this.loggedSessions = blob.loggedSessions ?? this.loggedSessions;
		this.loopEvents = blob.loopEvents ?? this.loopEvents;
		this.openLoops = projectLoopLifecycle(blob.openLoops ?? this.openLoops, this.loopEvents);
		this.closureReflections = blob.closureReflections ?? this.closureReflections;
		this.fiveContactsRounds = blob.fiveContactsRounds ?? this.fiveContactsRounds;
		this.loopReminders = blob.loopReminders ?? this.loopReminders;
		save('planner.shapes.v1', this.dayShapes);
		save('planner.weekPattern.v1', this.weekPattern);
		save('planner.days.v2', this.dayOverrides);
		save('planner.obligations.v1', this.obligations);
		save('planner.rituals.v1', this.rituals);
		this.#saveTasks();
		save('planner.settings.v1', this.settings);
		save('planner.domains.v1', this.domains);
		save('planner.observations.v1', this.intervalObservations);
		save('planner.routines.v1', this.routines);
		save('planner.routinePractices.v1', this.routinePractices);
		save('planner.surgeDrafts.v1', this.surgeDrafts);
		save('planner.carillonSpores.v1', this.sporeEvents);
		save('planner.sleepLogs.v1', this.sleepLogs);
		save('planner.signals.v1', this.signalEntries);
		save('planner.loggedSessions.v1', this.loggedSessions);
		save('planner.openLoops.v1', this.openLoops);
		save('planner.loopEvents.v1', this.loopEvents);
		save('planner.closureReflections.v1', this.closureReflections);
		save('planner.fiveContactsRounds.v1', this.fiveContactsRounds);
		save('planner.loopReminders.v1', this.loopReminders);
		this.publishSessionsLocally();
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

	#lastChimeCheck: Date | null = null;
	/** The last bell this tab actually sounded, for the Today status line. */
	lastChime = $state<{ mark: BellMark; at: string } | null>(null);
	/** Master bell volume on this device — speakers differ, so it never syncs. */
	bellVolume = $state<number>(cleanVolume(load<unknown>(BELL_VOLUME_KEY, DEFAULT_BELL_VOLUME), DEFAULT_BELL_VOLUME));
	/** A pause on this device; every tab here follows it. */
	bellPausedUntil = $state<string | null>(loadPause());
	/** Whether the browser is letting this page make sound yet. */
	audioReadiness = $state<AudioReadiness>('suspended');
	/** What is sounding now — a preview, an automatic bell — or null. */
	bellSounding = $state<SoundKind | null>(null);
	/** Bell runs in this tab happen one after another, never interleaved. */
	#ringing: Promise<void> = Promise.resolve();

	tick(now: Date = new Date()): void {
		this.now = now;
		this.#deliverReminders();
		// A focus and a visibility tick can land together; the second waits for the first.
		this.#ringing = this.#ringing.then(() => withBellLock(() => this.#ringDueBells(now))).catch(() => {});
	}

	/** Resolves once every bell this tab has started deciding on is decided. */
	bellsSettled(): Promise<void> {
		return this.#ringing;
	}

	pausedUntil(): Date | null {
		const until = this.bellPausedUntil ? new Date(this.bellPausedUntil) : null;
		return until && Number.isFinite(until.getTime()) ? until : null;
	}

	/**
	 * One sequence per tick: this minute's chime (unless another tab or a
	 * reload already rang it), then a reminder sound if one came due. Claims
	 * are written only once the sound was actually scheduled, so a tab the
	 * browser is still holding never takes a bell from one that can play.
	 */
	async #ringDueBells(now: Date): Promise<void> {
		const event = dueChime({ lastChecked: this.#lastChimeCheck, now, settings: this.settings, blocksFor: date => this.getBlocksForDate(date), pausedUntil: this.pausedUntil() });
		this.#lastChimeCheck = now;
		const chime = event && !bellMinuteClaimed(event.at) ? this.chimeNotes(event) : [];
		const reminders = this.#freshReminderSound(now);
		const notes = [...chime, ...after(reminders.notes, chime.length ? notesEnd(chime) + 0.3 : 0)];
		if (!notes.length) return;
		const result = await playNotes(notes, this.bellVolume);
		if (result !== 'scheduled') return;
		if (event && chime.length) {
			claimBellMinute(event.at);
			this.#announce(event.mark, event.at, event.parts[0].sound.voice);
		}
		if (reminders.keys.length) {
			markReminderRung(reminders.keys);
			if (!chime.length) this.#announce('reminder', now, markSound(this.settings.bellSounds, 'reminder').voice);
		}
	}

	/** Note a bell that sounded — for Today's "rang" line and anything listening on the page. */
	#announce(mark: BellMark, at: Date, voice: BellVoiceId): void {
		this.lastChime = { mark, at: at.toISOString() };
		if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('carillon:bell', { detail: { mark, voice, at: at.toISOString() } }));
	}

	/**
	 * The notes for one resolved minute at the person's mix: the clock chime,
	 * then a block's bell once it has faded. Each part's level is baked into
	 * its notes so the whole minute plays as one sequence.
	 */
	chimeNotes(event: ChimeEvent): BellNote[] {
		const notes: BellNote[] = [];
		let offset = 0;
		for (const part of event.parts) {
			const own = part.blockBellId && getBell(part.blockBellId)
				? registryNotes(part.blockBellId)
				: voiceWithStrikes(part.sound.voice, { minute: event.at.getMinutes(), strikeHour: part.strikeHour });
			if (!own.length) continue;
			const scale = levelFor(part.sound.volume);
			notes.push(...after(own, offset).map(note => ({ ...note, gain: note.gain * scale })));
			offset += notesEnd(own) + 0.3;
		}
		return notes;
	}

	/**
	 * A due loop reminder may also make a sound, if one was chosen for it —
	 * only while Carillon is open when it comes due, once per device.
	 */
	#freshReminderSound(now: Date): { notes: BellNote[]; keys: string[] } {
		const sound = markSound(this.settings.bellSounds, 'reminder');
		if (!audible(sound) || bellsResting(this.settings, now, this.pausedUntil())) return { notes: [], keys: [] };
		const keys = this.getDueReminders(now)
			.filter(reminder => now.getTime() - new Date(reminder.dueAt).getTime() <= CHIME_GRACE_MINUTES * 60_000)
			.map(reminder => `${reminder.id}@${reminder.dueAt}`)
			.filter(key => !reminderRung(key));
		if (!keys.length) return { notes: [], keys: [] };
		const notes = voiceWithStrikes(sound.voice, { minute: now.getMinutes() }).map(note => ({ ...note, gain: note.gain * levelFor(sound.volume) }));
		return { notes, keys };
	}

	/** Hear one mark as it would ring now, ignoring quiet hours and pauses — an explicit request. */
	previewMark(mark: BellMark): Promise<PlayResult> {
		const sound = markSound(this.settings.bellSounds, mark);
		const minute = mark === 'hour' ? 0 : mark === 'half' ? 30 : mark === 'quarter' ? 15 : this.now.getMinutes();
		const strikeHour = mark === 'hour' && countsHours(this.settings.bellSounds) ? 3 : undefined;
		const notes = voiceWithStrikes(sound.voice, { minute, strikeHour }).map(note => ({ ...note, gain: note.gain * levelFor(sound.volume) }));
		return playNotes(notes, this.bellVolume, 'preview');
	}

	/** Change the synced bell mix. Unknown values from newer versions are kept as they are. */
	updateBellSounds(patch: Partial<BellSoundSettings>): void {
		this.updateSettings({ bellSounds: { ...(this.settings.bellSounds ?? {}), ...patch } });
	}

	setMarkSound(mark: BellMark, sound: { voice?: BellVoiceId; volume?: number }): void {
		const marks = this.settings.bellSounds?.marks;
		const current = marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
		const entry = current[mark] && typeof current[mark] === 'object' ? current[mark] : {};
		this.updateBellSounds({ marks: { ...current, [mark]: { ...entry, ...sound } } });
	}

	/** Set hour, half, quarter and sample voices together. Levels stay as they are. */
	applyBellPreset(id: string): void {
		const preset = BELL_PRESETS.find(item => item.id === id);
		if (!preset) return;
		const marks = this.settings.bellSounds?.marks;
		const current = marks && typeof marks === 'object' && !Array.isArray(marks) ? { ...marks } : {};
		for (const mark of CLOCK_MARKS) current[mark] = { ...(current[mark] ?? {}), voice: preset.voices[mark] };
		this.updateBellSounds({ marks: current });
	}

	setBellVolume(volume: number): void {
		this.bellVolume = cleanVolume(volume, this.bellVolume);
		save(BELL_VOLUME_KEY, this.bellVolume);
	}

	/** Rest the bells on this device until a minute (rounded down, so that minute's bell rings), or resume with null. */
	pauseBells(until: Date | null): void {
		this.bellPausedUntil = until ? startOfMinute(until).toISOString() : null;
		save(BELL_PAUSE_KEY, this.bellPausedUntil);
	}

	#clockStarted = false;

	/**
	 * Start the clock once, from the app root. Ticks land just after each
	 * wall-clock minute (the delay is recomputed every time, so clock jumps
	 * correct themselves), a tab coming back into view checks at once, and
	 * other tabs' volume and pause changes are followed.
	 */
	startClock(): () => void {
		if (this.#clockStarted || typeof window === 'undefined') return () => {};
		this.#clockStarted = true;
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			timer = setTimeout(() => { this.tick(); schedule(); }, 60_000 - (Date.now() % 60_000) + 150);
		};
		schedule();
		const wake = () => { if (document.visibilityState !== 'hidden') this.tick(); };
		const storage = (event: StorageEvent) => {
			if (event.key === BELL_PAUSE_KEY) this.bellPausedUntil = loadPause();
			if (event.key === BELL_VOLUME_KEY) this.bellVolume = cleanVolume(load<unknown>(BELL_VOLUME_KEY, DEFAULT_BELL_VOLUME), DEFAULT_BELL_VOLUME);
		};
		document.addEventListener('visibilitychange', wake);
		window.addEventListener('pageshow', wake);
		window.addEventListener('focus', wake);
		window.addEventListener('storage', storage);
		const stopReadiness = watchAudioReadiness(state => { this.audioReadiness = state; });
		const stopSounding = watchSounding(kind => { this.bellSounding = kind; });
		const stopUnlock = installAudioUnlock(() => this.settings.bellsEnabled === true);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', wake);
			window.removeEventListener('pageshow', wake);
			window.removeEventListener('focus', wake);
			window.removeEventListener('storage', storage);
			stopReadiness(); stopSounding(); stopUnlock();
			this.#clockStarted = false;
		};
	}

	// ── shape-relative wrappers (convenience for views) ─────────────

	getCurrentBlockForDate(date: Date = this.now): Block | null {
		return getCurrentBlock(this.getBlocksForDate(date), date);
	}

	getNextBlockForDate(date: Date = this.now): Block | null {
		return getNextBlock(this.getBlocksForDate(date), date);
	}

}

export const store = new PlannerStore();
