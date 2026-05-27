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
};

export type DayShape = {
	id: string;
	name: string;
	blocks: Block[];
	restful?: boolean; // hints to UI that this is "off-like" (styling, badges)
};

// Indexed by Date.getDay() — 0=Sun .. 6=Sat. Each slot is a DayShape id.
export type WeekPattern = {
	days: [string, string, string, string, string, string, string];
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
};

export type ToneName = 'wry' | 'gentle' | 'minimal' | 'earnest';

export type PlannerSettings = {
	flourishEnabled: boolean;
	quietHoursStart: string; // "HH:MM"
	quietHoursEnd: string;
	leadTimeMinutes: number;
	bellsEnabled: boolean;
	dayCycleEnabled: boolean;
	fixedPaletteMode: string | null;
	onboardingComplete: boolean;
	wakeAnchor: string; // "HH:MM" — when the day actually starts
	sleepAnchor: string;
	tone: ToneName;
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
	| null;
