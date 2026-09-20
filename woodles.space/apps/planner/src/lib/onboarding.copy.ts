// ── Carillon onboarding copy ───────────────────────────────────────
// All user-facing text for the onboarding flow.
// Edit this file to revise voice without touching component code.
// Voice: state the fact, explain the action, avoid interpreting the user.

import type { Block, DayShape, Domain, OnboardingStep } from './types';

// ── 6-step screen copy ─────────────────────────────────────────────

export type OnboardingStepCopy = {
	eyebrow: string;
	heading: string;
	subprompt: string;
	cta: string;
};

export const STEP_COPY: OnboardingStepCopy[] = [
	{
		eyebrow: 'ONE OF SIX',
		heading: 'When does your day start and end?',
		subprompt: 'Set the hours shown in Today. You can plan activities and record what happened throughout this window.',
		cta: 'Save hours →'
	},
	{
		eyebrow: 'TWO OF SIX',
		heading: 'What commitments repeat each week?',
		subprompt: 'Add fixed times on selected weekdays. These appear alongside your day pile; you can skip a commitment on an individual date.',
		cta: 'Save commitments →'
	},
	{
		eyebrow: 'THREE OF SIX',
		heading: 'What routines help you get started?',
		subprompt: 'Save reusable checklists with a cue and small steps. Link them to activities when you arrange your day piles.',
		cta: 'Save routines →'
	},
	{
		eyebrow: 'FOUR OF SIX',
		heading: 'Which categories do you use?',
		subprompt: 'Choose categories for your tasks. You can change these later.',
		cta: 'Save categories →'
	},
	{
		eyebrow: 'FIVE OF SIX',
		heading: 'Choose a default pile for each weekday.',
		subprompt: 'Edit a starter pile or create your own, then assign weekday defaults. Activities can have fixed times or stay flexible.',
		cta: 'Save week →'
	},
	{
		eyebrow: 'SIX OF SIX',
		heading: 'How often do you want to check in?',
		subprompt: 'Choose an observation interval, bell settings, and reminder detail. Today lets you record activities and moments; Editions brings those records together.',
		cta: 'Finish setup →'
	}
];

// ── Step placeholders ──────────────────────────────────────────────

export const PLACEHOLDERS = {
	wakeAnchor: '07:00',
	sleepAnchor: '22:30',
	obligationName: 'e.g. standup, clinic, school pickup',
	ritualName: 'e.g. morning coffee, evening walk, ten minutes of nothing'
};

// ── Welcome screen ─────────────────────────────────────────────────

export const WELCOME = {
	heading: 'Set up your week.',
	subheading: 'Set your hours, commitments, routines, categories, day piles, and check-in preferences.',
	cta: 'Start setup →'
};

// ── Completion screen ──────────────────────────────────────────────

export const COMPLETION = {
	heading: 'Your week is ready.',
	body: 'Add a task now, or open Today to adjust your plan and record what happens. Save ideas in Surge and turn them into tasks when ready.',
	cta: 'Add a task →',
	skipCta: 'open carillon'
};

// ── Empty states ───────────────────────────────────────────────────

export const EMPTY_STATES = {
	shapes: {
		heading: 'No day piles yet.',
		body: 'Create a template with activities you want to reuse.',
		cta: 'add a shape →'
	},
	weekPattern: {
		heading: 'The week is unassigned.',
		body: 'Choose a default pile for each weekday.',
		cta: 'assign days →'
	},
	today: {
		heading: 'No activities planned.',
		body: 'Add an activity or choose a day pile.',
		cta: 'add a block →'
	}
};

// ── Binder tab labels ──────────────────────────────────────────────

export const BINDER_LABELS = {
	shapes: 'day shapes',
	weekPattern: 'week pattern'
};

// ── Refresh: revisiting a slice of setup without starting over ─────

export type RefreshSection = {
	step: OnboardingStep;
	label: string;
	hint: string;
};

export const REFRESH_SECTIONS: RefreshSection[] = [
	{ step: 1, label: 'day anchors', hint: 'when the day starts and ends' },
	{ step: 2, label: 'commitments', hint: 'fixed commitments already on the calendar' },
	{ step: 3, label: 'routines and daily activities', hint: 'reusable checklists and daily fixed times' },
	{ step: 4, label: 'categories', hint: 'categories for your tasks' },
	{ step: 5, label: 'day piles and week', hint: 'which day pile fits which weekday' },
	{ step: 6, label: 'check-ins and reminders', hint: 'observation interval, bells, and reminder detail' }
];

// ── Tone presets ───────────────────────────────────────────────────

export type ToneName = 'wry' | 'gentle' | 'minimal' | 'earnest';

export type TonePreset = {
	id: ToneName;
	name: string;
	description: string;
	samples: string[];
};

export const TONES: TonePreset[] = [
 { id:'minimal', name:'Brief', description:'Activity and time.', samples:['{block_title}. {start_time}–{end_time}.','Next: {block_title}.','{weekday}. {block_count} activities.'] },
 { id:'gentle', name:'Standard', description:'A short reminder.', samples:['Coming up: {block_title}, at {start_time}.','Today’s pile: {day_shape_name}.'] },
 { id:'earnest', name:'Detailed', description:'Activity, timing, and day context.', samples:['{weekday}: {block_title}, {start_time}–{end_time}.','{day_shape_name}: {block_count} activities planned.'] },
 { id:'wry', name:'Compact', description:'Short schedule labels.', samples:['{start_time} · {block_title}','{day_shape_name} · {weekday}'] }
];
export const FLOURISH_FRAGMENTS: string[] = ['Next: {block_title}.','Today’s pile: {day_shape_name}.'];

// ── Starter domains (12 chips for step 4) ──────────────────────────

export const STARTER_DOMAINS: Domain[] = [
	{ id: 'health',    name: 'health',    color: '#8ecf9e', icon: '♡' },
	{ id: 'money',     name: 'money',     color: '#f4c07a', icon: '◈' },
	{ id: 'home',      name: 'home',      color: '#9ab8f0', icon: '⌂' },
	{ id: 'work',      name: 'work',      color: '#b09ee8', icon: '◻' },
	{ id: 'creative',  name: 'creative',  color: '#f09fc0', icon: '✦' },
	{ id: 'social',    name: 'social',    color: '#f0d978', icon: '◉' },
	{ id: 'learning',  name: 'learning',  color: '#7ed4d4', icon: '⬡' },
	{ id: 'errands',   name: 'errands',   color: '#c8b898', icon: '→' },
	{ id: 'movement',  name: 'movement',  color: '#f09898', icon: '○' },
	{ id: 'rest',      name: 'rest',      color: '#98a8d8', icon: '●' },
	{ id: 'care',      name: 'care',      color: '#d898d8', icon: '♦' },
	{ id: 'projects',  name: 'projects',  color: '#78c8b0', icon: '◧' }
];

// ── Starter day piles (5 for step 5) ───────────────────────────────
// Momentum is authored once here (and can be retuned in the pile rack). The
// day then begins with high-probability on-ramps before asking for stretch work.

const OFFICE_DAY_BLOCKS: Block[] = [
	{ id: 'office-morning',  startTime: '07:30', endTime: '08:30', title: 'Morning',     flourishEligible: true, sampleKind: 'care' },
	{ id: 'office-commute',  startTime: '08:30', endTime: '09:00', title: 'Commute', sampleKind: 'movement' },
	{ id: 'office-focus-1',  startTime: '09:00', endTime: '12:00', title: 'Clinic', sampleKind: 'clinic' },
	{ id: 'office-midday',   startTime: '12:00', endTime: '13:00', title: 'Midday',      flourishEligible: true, bellId: 'meal', sampleKind: 'rest' },
	{ id: 'office-focus-2',  startTime: '13:00', endTime: '17:00', title: 'Clinic', sampleKind: 'clinic' },
	{ id: 'office-wind',     startTime: '17:00', endTime: '17:30', title: 'Close notes', sampleKind: 'clinic' },
	{ id: 'office-commute-h',startTime: '17:30', endTime: '18:00', title: 'Commute home', sampleKind: 'movement' }
];

const MAKER_DAY_BLOCKS: Block[] = [
	{ id: 'maker-morning',   startTime: '08:00', endTime: '09:00', title: 'Open the workshop', flourishEligible: true, sampleKind: 'care' },
	{ id: 'maker-deep-1',    startTime: '09:00', endTime: '12:30', title: 'Build', flourishEligible: true, sampleKind: 'build' },
	{ id: 'maker-break',     startTime: '12:30', endTime: '13:30', title: 'Break', bellId: 'meal', sampleKind: 'rest' },
	{ id: 'maker-deep-2',    startTime: '13:30', endTime: '16:30', title: 'Build', flourishEligible: true, sampleKind: 'build' },
	{ id: 'maker-admin',     startTime: '16:30', endTime: '17:30', title: 'Small closures', sampleKind: 'care' },
	{ id: 'maker-evening',   startTime: '17:30', endTime: '19:00', title: 'Evening', flourishEligible: true, sampleKind: 'rest' }
];

const OUT_DAY_BLOCKS: Block[] = [
	{ id: 'out-morning',     startTime: '08:30', endTime: '09:30', title: 'Pack and leave', flourishEligible: true, sampleKind: 'care' },
	{ id: 'out-appts',       startTime: '09:30', endTime: '12:00', title: 'Appointments', sampleKind: 'clinic' },
	{ id: 'out-midday',      startTime: '12:00', endTime: '13:00', title: 'Midday', bellId: 'meal', sampleKind: 'rest' },
	{ id: 'out-about',       startTime: '13:00', endTime: '16:00', title: 'Out & about', sampleKind: 'movement' },
	{ id: 'out-decompress',  startTime: '16:00', endTime: '18:00', title: 'Decompression', flourishEligible: true, sampleKind: 'rest' },
	{ id: 'out-evening',     startTime: '18:00', endTime: '20:00', title: 'Evening', flourishEligible: true, sampleKind: 'care' }
];

const RECOVERY_DAY_BLOCKS: Block[] = [
	{ id: 'rec-slow',        startTime: '09:00', endTime: '10:30', title: 'Slow morning', flourishEligible: true, sampleKind: 'care' },
	{ id: 'rec-open-1',      startTime: '10:30', endTime: '12:30', title: 'One light thing', flourishEligible: true, sampleKind: 'care' },
	{ id: 'rec-midday',      startTime: '12:30', endTime: '13:30', title: 'Midday', bellId: 'meal', sampleKind: 'rest' },
	{ id: 'rec-open-2',      startTime: '13:30', endTime: '17:00', title: 'Open / light things', flourishEligible: true, sampleKind: 'rest' },
	{ id: 'rec-quiet',       startTime: '17:00', endTime: '20:00', title: 'Quiet evening', flourishEligible: true, bellId: 'wind-down', sampleKind: 'rest' }
];

const WRITING_DAY_BLOCKS: Block[] = [
	{ id: 'writing-tea', startTime: '08:00', endTime: '08:30', title: 'Tea + reread', sampleKind: 'care' },
	{ id: 'writing-notes', startTime: '08:30', endTime: '09:00', title: 'Loose notes', sampleKind: 'writing' },
	{ id: 'writing-draft', startTime: '09:00', endTime: '12:00', title: 'Draft', sampleKind: 'writing', flourishEligible: true },
	{ id: 'writing-walk', startTime: '12:00', endTime: '13:00', title: 'Walk + lunch', sampleKind: 'movement', bellId: 'meal' },
	{ id: 'writing-return', startTime: '13:00', endTime: '15:00', title: 'Return to the page', sampleKind: 'writing' },
	{ id: 'writing-close', startTime: '15:00', endTime: '16:00', title: 'Leave a door open', sampleKind: 'care' }
];

export const STARTER_OFFICE_DAY: DayShape = {
	id: 'starter-office',
	name: 'office day',
	blocks: OFFICE_DAY_BLOCKS
};
export const STARTER_MAKER_DAY: DayShape = {
	id: 'starter-maker',
	name: 'maker day',
	blocks: MAKER_DAY_BLOCKS
};
export const STARTER_OUT_DAY: DayShape = {
	id: 'starter-out',
	name: 'out day',
	blocks: OUT_DAY_BLOCKS
};
export const STARTER_RECOVERY_DAY: DayShape = {
	id: 'starter-recovery',
	name: 'recovery day',
	blocks: RECOVERY_DAY_BLOCKS,
	restful: true
};
export const STARTER_WRITING_DAY: DayShape = {
	id: 'starter-writing',
	name: 'writing day',
	blocks: WRITING_DAY_BLOCKS
};

export const STARTER_SHAPES_V2: DayShape[] = [
	STARTER_OFFICE_DAY,
	STARTER_MAKER_DAY,
	STARTER_OUT_DAY,
	STARTER_RECOVERY_DAY,
	STARTER_WRITING_DAY
];

// Short descriptions for the step-5 cards — not user-editable; pure UI copy.
export const SHAPE_DESCRIPTIONS: Record<string, string> = {
	'starter-office':   'Externally structured, commute-bounded, focus in the middle.',
	'starter-maker':    'Deep work front-loaded, admin in the late afternoon, protected morning.',
	'starter-out':      'Appointments, errands, external — high mobility, low fixed desk.',
	'starter-recovery': 'Light, open, minimal structure. Restores capacity rather than spends it.',
	'starter-writing':  'A soft on-ramp into a protected draft, with a walk before the return.'
};
