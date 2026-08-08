export type Block = {
	id: string;
	startTime: string; // "HH:MM" 24h
	endTime: string;
	title: string;
	bellId?: string;
	voicePrompt?: string;
	flourishEligible?: boolean;
	domainId?: string;
	// Overlay metadata — set only on blocks synthesized from obligations/rituals.
	overlay?: 'obligation' | 'ritual';
	// The behavioral-momentum position of this block inside a day pile.
	// `easy` blocks are high-probability on-ramps; `stretch` blocks are the
	// lower-probability work the on-ramp is meant to carry.
	momentum?: MomentumLevel;
	// A suggested sampling category. The observation is still allowed to differ.
	sampleKind?: IntervalKind;
};

export type MomentumLevel = 'easy' | 'steady' | 'stretch';

export type DayShape = {
	id: string;
	name: string;
	blocks: Block[];
	restful?: boolean; // hints to UI that this is "off-like" (styling, badges)
	updatedAt?: string;
};

// Indexed by Date.getDay() — 0=Sun .. 6=Sat. Each slot is a DayShape id.
export type WeekPattern = {
	days: [string, string, string, string, string, string, string];
	updatedAt?: string;
};

// A recurring weekday-bound commitment ("past you made an agreement").
// Resolved into Blocks per-day by store.getBlocksForDate().
export type Obligation = {
	id: string;
	name: string;
	weekdays: number[]; // 0=Sun..6=Sat (Date.getDay() index)
	startTime: string; // "HH:MM"
	endTime: string;
	domainId?: string;
};

// A small repeated thing that's yours — applies to every day.
export type Ritual = {
	id: string;
	name: string;
	startTime: string;
	endTime: string;
	domainId?: string;
};

export type Task = {
	id: string;
	title: string;
	status: 'open' | 'done' | 'dropped';
	domainId?: string;
	targetBlockId?: string;
	targetDate?: string; // YYYY-MM-DD
	estimatedDuration?: number; // minutes
	notes?: string;
	recurrenceRule?: string;
	/**
	 * The Thinking About entry this task is about, if it came from the shelf.
	 *
	 * A reference rather than a copied title, so a rename over there doesn't
	 * leave this lying, and so marking the block observed later knows exactly
	 * which entry it was. The title is still stored on the task in its own
	 * right: if the entry is archived or deleted the link goes **cold**, and
	 * the task keeps the words that were typed (REFERENCES.md §3) — unlike
	 * marginalia's sprite bindings, which are dropped, because a binding with
	 * no sprite renders nothing while a task with no link is still a task.
	 */
	thinkingAboutEntryId?: string;
	createdAt: string;
	updatedAt?: string;
};

export type TaskRelationship = {
	id: string;
	fromTaskId: string;
	toTaskId: string;
	type: 'blocks' | 'waiting-on' | 'soft';
};

export type Domain = {
	id: string;
	name: string;
	color: string;
	icon: string;
};

export type DayInstance = {
	date: string; // YYYY-MM-DD
	dayShapeId: string;
	updatedAt?: string;
};

export type ToneName = 'wry' | 'gentle' | 'minimal' | 'earnest';

// A saved checkpoint in Carillon's first-run flow. It deliberately lives with
// settings so a draft can travel with the rest of a planner profile.
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export type PlannerSettings = {
	flourishEnabled: boolean;
	quietHoursStart: string; // "HH:MM"
	quietHoursEnd: string;
	leadTimeMinutes: number;
	samplingIntervalMinutes: number;
	bellsEnabled: boolean;
	dayCycleEnabled: boolean;
	fixedPaletteMode: string | null;
	onboardingComplete: boolean;
	/** The next setup question to show when onboarding is resumed. */
	onboardingStep?: OnboardingStep;
	wakeAnchor: string; // "HH:MM" — when the day actually starts
	sleepAnchor: string;
	tone: ToneName;
	/** Notebook's tasks have been taken over — see notebookTasks.ts. */
	notebookTasksImported?: boolean;
};

export type Bell = {
	id: string;
	name: string;
	filePath: string;
	defaultVolume: number;
};

export type View = 'now-next' | 'today' | 'week' | 'month' | 'year';
export type BinderTab =
	| 'domains'
	| 'waiting'
	| 'upcoming'
	| 'year-scroll'
	| 'holidays'
	| 'shapes'
	| 'week-pattern'
	| 'sync'
	| null;

// ── Carillon instrument data ─────────────────────────────────────

export type IntervalKind =
	| 'clinic'
	| 'writing'
	| 'build'
	| 'movement'
	| 'care'
	| 'rest'
	| 'elsewhere';

/**
 * One momentary-time-sampling mark. It records what was happening without
 * mutating the plan that supplied `plannedLabel`.
 *
 * `live` was answered at the bell, `paper` transcribed from a printed sheet,
 * and `recall` remembered in-app after the fact. A recall mark may cover a
 * whole stretch via `intervalMinutes` — one memory is one sample, however
 * many bells it spans.
 */
export type IntervalObservation = {
	id: string;
	date: string; // YYYY-MM-DD
	intervalStart: string; // HH:MM
	source: 'live' | 'paper' | 'recall';
	kind: IntervalKind;
	label: string;
	plannedLabel?: string;
	note?: string;
	intervalMinutes?: number;
	capturedAt: string;
	updatedAt: string;
};

export type RoutineStep = {
	id: string;
	label: string;
};

export type Routine = {
	id: string;
	name: string;
	cue?: string;
	steps: RoutineStep[];
	createdAt: string;
	updatedAt?: string;
	archived?: boolean;
};

export type RoutineStepResult = 'independent' | 'prompted' | 'missed';

export type RoutinePractice = {
	id: string;
	routineId: string;
	date: string;
	results: Record<string, RoutineStepResult>;
	independence: number; // 0..1
	recordedAt: string;
};

export type RoutineScaffoldLevel = 'full' | 'faded' | 'mastered';

export type SurgeDraftStatus = 'captured' | 'promoted' | 'discarded';

export type SurgeDraft = {
	id: string;
	title: string;
	body: string;
	status: SurgeDraftStatus;
	createdAt: string;
	updatedAt?: string;
	createdSessionId: string;
	promotedAt?: string;
	discardedAt?: string;
	promotedTaskIds?: string[];
};

/**
 * The stable reinforcement/export event produced by an honest interval mark.
 * Echoes can consume this ledger later without learning the whole planner blob.
 */
export type SporeEvent = {
	id: string;
	observationId: string;
	date: string;
	kind: IntervalKind;
	amount: number;
	createdAt: string;
};

// ── capacity: a morning read, and the slower signals beside it ────

export type SleepQuality = 'rough' | 'okay' | 'good';

/** One per date — id is deterministic (`sleep-<date>`) so a re-log replaces, never doubles. */
export type SleepLog = {
	id: string;
	date: string; // YYYY-MM-DD
	quality: SleepQuality;
	recordedAt: string;
	updatedAt?: string;
};

/**
 * The three kinds Carillon knows how to read a phase out of — cycle day,
 * days to payday, an illness span — plus `custom` for anything else worth
 * remembering that doesn't need a formula, only a name and a date. Flexible
 * tracking without a schema change per new thing worth watching.
 */
export type SignalKind = 'cycle' | 'payday' | 'illness' | 'custom';

/**
 * One logged fact. `date` is the event itself: a period's start day, a known
 * pay date, the day an illness (or anything custom) began. `endDate` is only
 * meaningful for `illness`/`custom` spans — omitted while still ongoing.
 * `cycle` and `payday` ignore it; a cycle's length is derived from the gap
 * between consecutive starts, never logged directly.
 */
export type SignalEntry = {
	id: string;
	kind: SignalKind;
	date: string; // YYYY-MM-DD
	endDate?: string; // YYYY-MM-DD
	/** Required for `custom`; the other three kinds carry a fixed display label. */
	label?: string;
	note?: string;
	createdAt: string;
	updatedAt?: string;
};

export type PlannerBlob = {
	shapes: DayShape[];
	weekPattern: WeekPattern;
	days: Record<string, DayInstance>;
	obligations: Obligation[];
	rituals: Ritual[];
	tasks: Task[];
	settings: PlannerSettings;
	domains: Domain[];
	// Optional for backward compatibility with planner blobs written before the
	// interval-instrument redesign.
	observations?: IntervalObservation[];
	routines?: Routine[];
	routinePractices?: RoutinePractice[];
	surgeDrafts?: SurgeDraft[];
	spores?: SporeEvent[];
	sleepLogs?: SleepLog[];
	signals?: SignalEntry[];
};
