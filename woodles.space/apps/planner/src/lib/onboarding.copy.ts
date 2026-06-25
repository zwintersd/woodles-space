// ── Carillon onboarding copy ───────────────────────────────────────
// All user-facing text for the onboarding flow.
// Edit this file to revise voice without touching component code.
// Tone reference: "the day has not yet decided what it is".

import type { Block, DayShape, Domain } from './types';

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
		heading: 'When does your day actually start?',
		subprompt: 'Not the alarm. The moment you stop pretending you might fall back asleep.',
		cta: 'set the edges →'
	},
	{
		eyebrow: 'TWO OF SIX',
		heading: 'What claims you before you’ve decided anything?',
		subprompt: 'The things already there, waiting — not because you chose them today, but because past you made agreements.',
		cta: 'noted →'
	},
	{
		eyebrow: 'THREE OF SIX',
		heading: 'What do you do on purpose?',
		subprompt: 'The small repeated things that are yours — not obligations, not crises. Just yours.',
		cta: 'these stay →'
	},
	{
		eyebrow: 'FOUR OF SIX',
		heading: 'What territories does your life move through?',
		subprompt: 'Pick the ones that actually come up. You can add more whenever the week surprises you.',
		cta: 'these are the territories →'
	},
	{
		eyebrow: 'FIVE OF SIX',
		heading: 'Does the week have a shape?',
		subprompt: 'Some days you’re a different person than other days. You can tell Carillon that.',
		cta: 'roughly this →'
	},
	{
		eyebrow: 'SIX OF SIX',
		heading: 'How should Carillon talk to you?',
		subprompt: 'You can change this anytime. The planner is not attached to its own personality.',
		cta: 'begin →'
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
	heading: 'The week is not yet named.',
	subheading: 'Carillon will help with that.',
	cta: 'let’s begin →'
};

// ── Completion screen ──────────────────────────────────────────────

export const COMPLETION = {
	heading: 'The structure is in place.',
	body: 'The day is yours to occupy.',
	cta: 'open carillon →'
};

// ── Empty states ───────────────────────────────────────────────────

export const EMPTY_STATES = {
	shapes: {
		heading: 'No shapes yet.',
		body: 'A day without a shape is still a day. But it might help to name it.',
		cta: 'add a shape →'
	},
	weekPattern: {
		heading: 'The week is unassigned.',
		body: 'This is neither good nor bad. It’s just open.',
		cta: 'assign days →'
	},
	today: {
		heading: 'The day has not yet decided what it is.',
		body: 'Neither have you. This seems fine.',
		cta: 'add a block →'
	}
};

// ── Binder tab labels ──────────────────────────────────────────────

export const BINDER_LABELS = {
	shapes: 'day shapes',
	weekPattern: 'week pattern'
};

// ── Tone presets ───────────────────────────────────────────────────

export type ToneName = 'wry' | 'gentle' | 'minimal' | 'earnest';

export type TonePreset = {
	id: ToneName;
	name: string;
	description: string;
	samples: string[];
};

export const TONES: TonePreset[] = [
	{
		id: 'wry',
		name: 'wry',
		description: 'Dry, world-weary, aware it’s a planner. Observes; doesn’t motivate.',
		samples: [
			'The {block_title} is happening. As scheduled. Whether or not you feel ready.',
			'It is {weekday}. The calendar has opinions. Here they are.',
			'{block_title} is next. You have done this before and survived, technically.',
			'The day has, against all odds, continued.',
			'A {day_shape_name}. You designed this. We’re not here to judge that.'
		]
	},
	{
		id: 'gentle',
		name: 'gentle',
		description: 'Warm, unhurried, treats you like someone doing their best.',
		samples: [
			'Here you are at the start of {weekday}. That’s enough for now.',
			'{block_title} is coming — you don’t have to arrive at it perfectly.',
			'The {domain_name} things are waiting, without urgency, for whenever you’re ready.',
			'The day has a shape. You made it. It’s allowed to hold you.',
			'There’s time. Or there will be. You’ve managed this kind of {weekday} before.'
		]
	},
	{
		id: 'minimal',
		name: 'minimal',
		description: 'No flourish. Just facts. The planner as instrument.',
		samples: [
			'{block_title}. {start_time}–{end_time}.',
			'Next: {block_title}.',
			'{weekday}. {block_count} blocks.',
			'{domain_name}: {item_count} pending.',
			'Updated.'
		]
	},
	{
		id: 'earnest',
		name: 'earnest',
		description: 'Sincere, not ironic. The friend who actually means it.',
		samples: [
			'Today includes {block_title}. You’ve been here before. You know how this goes.',
			'{weekday} is a reasonable day for {domain_name} things. You put it there for a reason.',
			'You built this schedule. It’s on your side.',
			'The plan is in place. Now it’s just time doing what time does.',
			'{block_title}: one of the things you decided matters. That’s why it’s here.'
		]
	}
];

// ── Templated flourish fragments (universal pool) ──────────────────
// Used regardless of tone — the day-cycle's quiet weirdness layer.

export const FLOURISH_FRAGMENTS: string[] = [
	'The {block_title} is doing what {block_title}s do. This is fine.',
	'{weekday}. The clock continues to behave as expected.',
	'You have arrived at {block_title}. Or it has arrived at you. Hard to say.',
	'{domain_name} is, for once, not pressing.',
	'It is the hour of {block_title}. The schedule knew before you did.',
	'The {day_shape_name} is in session. You are a participant.',
	'{weekday} has committed to being {weekday}. Respect that.',
	'This portion of the day is called {block_title}. You named it. Good name.',
	'The {domain_name} territory is on the map. You put it there.',
	'A {day_shape_name} awaits. It has no feelings about this. You may.',
	'Something from {domain_name} will make itself known. It usually does.',
	'Block incoming: {block_title}. The calendar is not nervous. Consider following its lead.',
	'{weekday} is the shape the week makes right now.',
	'The {block_title} window is open. What you do with it is between you and the time.',
	'Today is a {day_shape_name}. This was your call. Carillon supports you.',
	'You scheduled {block_title}. Past you thought this was a good idea. Future you will have opinions.',
	'{domain_name} exists. You acknowledged it. That’s already something.',
	'The day has a shape. Right now the shape includes {block_title}.',
	'{weekday} again. Still counts.',
	'The {block_title} block is not here to impress anyone. It is here to be done.',
	'Here at the edge of {block_title}: what happens next is entirely up to the next version of you.',
	'{day_shape_name}. The category has been assigned. Proceed accordingly.',
	'You are somewhere inside {block_title}. This is where you are.',
	'The {domain_name} items remain. Patient as ever.',
	'{weekday} is underway. No notes.',
	'From here: {block_title}. After that, a different part of the same day.',
	'The {day_shape_name} continues, neither worse nor better than anticipated.',
	'The clock doesn’t know what {block_title} means. You do. That’s the arrangement.',
	'{block_count} blocks. One of them is {block_title}. That one’s now.',
	'At {start_time} the day made a decision. The decision was {block_title}.'
];

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

// ── Starter day shapes (4 for step 5) ──────────────────────────────

const OFFICE_DAY_BLOCKS: Block[] = [
	{ id: 'office-morning',  startTime: '07:30', endTime: '08:30', title: 'Morning',     flourishEligible: true },
	{ id: 'office-commute',  startTime: '08:30', endTime: '09:00', title: 'Commute' },
	{ id: 'office-focus-1',  startTime: '09:00', endTime: '12:00', title: 'Focus' },
	{ id: 'office-midday',   startTime: '12:00', endTime: '13:00', title: 'Midday',      flourishEligible: true, bellId: 'meal' },
	{ id: 'office-focus-2',  startTime: '13:00', endTime: '17:00', title: 'Focus' },
	{ id: 'office-wind',     startTime: '17:00', endTime: '17:30', title: 'Wind-down' },
	{ id: 'office-commute-h',startTime: '17:30', endTime: '18:00', title: 'Commute home' }
];

const MAKER_DAY_BLOCKS: Block[] = [
	{ id: 'maker-morning',   startTime: '08:00', endTime: '09:00', title: 'Morning',     flourishEligible: true },
	{ id: 'maker-deep-1',    startTime: '09:00', endTime: '12:30', title: 'Deep work',   flourishEligible: true },
	{ id: 'maker-break',     startTime: '12:30', endTime: '13:30', title: 'Break',       bellId: 'meal' },
	{ id: 'maker-deep-2',    startTime: '13:30', endTime: '16:30', title: 'Deep work',   flourishEligible: true },
	{ id: 'maker-admin',     startTime: '16:30', endTime: '17:30', title: 'Admin' },
	{ id: 'maker-evening',   startTime: '17:30', endTime: '19:00', title: 'Evening',     flourishEligible: true }
];

const OUT_DAY_BLOCKS: Block[] = [
	{ id: 'out-morning',     startTime: '08:30', endTime: '09:30', title: 'Morning',     flourishEligible: true },
	{ id: 'out-appts',       startTime: '09:30', endTime: '12:00', title: 'Appointments' },
	{ id: 'out-midday',      startTime: '12:00', endTime: '13:00', title: 'Midday',      bellId: 'meal' },
	{ id: 'out-about',       startTime: '13:00', endTime: '16:00', title: 'Out & about' },
	{ id: 'out-decompress',  startTime: '16:00', endTime: '18:00', title: 'Decompression', flourishEligible: true },
	{ id: 'out-evening',     startTime: '18:00', endTime: '20:00', title: 'Evening',     flourishEligible: true }
];

const RECOVERY_DAY_BLOCKS: Block[] = [
	{ id: 'rec-slow',        startTime: '09:00', endTime: '10:30', title: 'Slow morning', flourishEligible: true },
	{ id: 'rec-open-1',      startTime: '10:30', endTime: '12:30', title: 'Open',         flourishEligible: true },
	{ id: 'rec-midday',      startTime: '12:30', endTime: '13:30', title: 'Midday',       bellId: 'meal' },
	{ id: 'rec-open-2',      startTime: '13:30', endTime: '17:00', title: 'Open / light things', flourishEligible: true },
	{ id: 'rec-quiet',       startTime: '17:00', endTime: '20:00', title: 'Quiet evening', flourishEligible: true, bellId: 'wind-down' }
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

export const STARTER_SHAPES_V2: DayShape[] = [
	STARTER_OFFICE_DAY,
	STARTER_MAKER_DAY,
	STARTER_OUT_DAY,
	STARTER_RECOVERY_DAY
];

// Short descriptions for the step-5 cards — not user-editable; pure UI copy.
export const SHAPE_DESCRIPTIONS: Record<string, string> = {
	'starter-office':   'Externally structured, commute-bounded, focus in the middle.',
	'starter-maker':    'Deep work front-loaded, admin in the late afternoon, protected morning.',
	'starter-out':      'Appointments, errands, external — high mobility, low fixed desk.',
	'starter-recovery': 'Light, open, minimal structure. Restores capacity rather than spends it.'
};
