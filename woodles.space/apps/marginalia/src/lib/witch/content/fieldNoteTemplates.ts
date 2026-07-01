// Field notes — a live, per-event observation log, distinct from the big
// scripted journal beats (journal.ts). Short lines, drafted in Brianna's
// register but templated so they don't need one hand-written entry per life;
// edit freely, nothing here gates progress. See DESIGN.md's "I'll draft, you
// edit" convention.

import type { LifeCategory, LifeDomain } from './life';

// stage numbers duplicated here (not imported from book.svelte.ts) to keep
// this module framework-free and importable from a plain test file.
const STAGE_OBSERVED = 1;
const STAGE_STUDIED = 2;
const STAGE_KNOWN = 3;

type StageTemplates = Partial<Record<number, string[]>>;

const byDomain: Record<LifeDomain, StageTemplates> = {
	plant: {
		[STAGE_OBSERVED]: [
			'{name} — she stopped to look longer than she meant to.',
			"{name}. she's watching it now, properly."
		],
		[STAGE_STUDIED]: [
			'{name} keeps a pattern. she is starting to see it.',
			"she's found the shape of {name}'s days."
		],
		[STAGE_KNOWN]: [
			'she knows {name} now — knows it well enough to leave it alone.',
			'{name}, understood. the hard part was not touching it sooner.'
		]
	},
	animal: {
		[STAGE_OBSERVED]: [
			'{name} noticed her noticing. neither of them moved.',
			"first real look at {name}. it didn't flinch."
		],
		[STAGE_STUDIED]: [
			'{name} has habits now, in her notes if nowhere else.',
			"she's learning what {name} decides, and when."
		],
		[STAGE_KNOWN]: [
			"{name} — known. she could guide it now. she's deciding if she should.",
			'she understands {name} well enough to leave a door open, not push it through.'
		]
	},
	ecosystem: {
		[STAGE_OBSERVED]: [
			'{name}. more happening under it than she expected.',
			'first look at {name} — there is more of it than she thought.'
		],
		[STAGE_STUDIED]: [
			"{name} is more connected than it looks. she's tracing the threads.",
			'the shape of {name} keeps surprising her.'
		],
		[STAGE_KNOWN]: [
			"{name}, known. she trusts what she can't fully see, now.",
			"she understands {name} — which mostly means she's stopped needing to."
		]
	},
	geology: {
		[STAGE_OBSERVED]: [
			'{name}. it moves so slowly she almost missed it moving at all.',
			'first real look at {name} — patient work, this.'
		],
		[STAGE_STUDIED]: [
			"{name} keeps its own time. she's learning to read it.",
			'the record in {name} goes back further than she does.'
		],
		[STAGE_KNOWN]: [
			'{name}, known. she could shape it now — slow, monumental work.',
			'she understands {name}. whatever she changes here, everything downstream changes with it.'
		]
	},
	weather: {
		[STAGE_OBSERVED]: [
			'{name}. she watched it happen without asking for it.',
			'first look at {name} — it came and went on its own schedule.'
		],
		[STAGE_STUDIED]: [
			"{name} has a rhythm. she can't set it, only read it.",
			'she is learning when {name} tends to arrive.'
		],
		[STAGE_KNOWN]: [
			'{name}, known. she can invoke it now — ask, and wait to see if it answers.',
			"she understands {name}. she still can't command it. that seems right."
		]
	}
};

export const equilibriumFieldNotes: string[] = [
	"it's holding itself. she is trying very hard not to help.",
	'nothing needed her, for a while. that felt like something.',
	'the world balanced on its own today. she watched and did not touch it.'
];

export const quietFieldNotes: string[] = [
	'it has gone quiet. not gone — quiet.',
	'the world is thinning at the edges. she is still here.',
	'quiet, now. she is staying anyway.'
];

export const categoryMasteryFieldNotes: Record<LifeCategory, string[]> = {
	aquatic: [
		'the water, fully known. she could close her eyes and still find her way through it.',
		'every tide she watches for now answers to a name.'
	],
	terrestrial: [
		'the land, fully known. it stopped being ground and became a place.',
		'she knows the land now the way you know a room in the dark.'
	],
	atmospheric: [
		'the sky, fully known. she has stopped waiting for it to explain itself.',
		'the weather no longer surprises her. it still moves her.'
	]
};

// The template options for a domain crossing into a given stage, or an
// empty array if there is nothing written for that combination (e.g. Noticed
// — emergence already has its own text on the card).
export function stageFieldNoteOptions(domain: LifeDomain, stage: number): string[] {
	return byDomain[domain]?.[stage] ?? [];
}

export function fillTemplate(template: string, name: string): string {
	return template.replace('{name}', name);
}

// Deterministic-friendly picker — pass Math.random() at the call site, or a
// fixed value in tests.
export function pickLine(options: readonly string[], r: number): string | null {
	if (options.length === 0) return null;
	const idx = Math.min(options.length - 1, Math.floor(r * options.length));
	return options[idx];
}
