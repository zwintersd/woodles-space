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
 */
export type IntervalObservation = {
	id: string;
	date: string; // YYYY-MM-DD
	intervalStart: string; // HH:MM
	source: 'live' | 'paper';
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
};
