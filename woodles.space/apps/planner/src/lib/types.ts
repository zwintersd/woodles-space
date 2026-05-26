export type Block = {
	id: string;
	startTime: string; // "HH:MM" 24h
	endTime: string;
	title: string;
	bellId?: string;
	voicePrompt?: string;
	flourishEligible?: boolean;
	domainId?: string;
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

export type PlannerSettings = {
	flourishEnabled: boolean;
	quietHoursStart: string; // "HH:MM"
	quietHoursEnd: string;
	leadTimeMinutes: number;
	bellsEnabled: boolean;
	dayCycleEnabled: boolean;
	fixedPaletteMode: string | null; // null = shift with time
	onboardingComplete: boolean;
};

export type Bell = {
	id: string;
	name: string;
	filePath: string;
	defaultVolume: number;
};

export type View = 'now-next' | 'today' | 'week' | 'month' | 'year';
export type BinderTab = 'domains' | 'waiting' | 'upcoming' | 'year-scroll' | 'holidays' | null;
