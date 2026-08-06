import type { LayerId } from './types';

/**
 * Write is the writing surface for everything made of words, fiction and
 * nonfiction alike — not only letters. A draft's kind names what it is
 * becoming, and the editor dresses itself for that kind: placeholders,
 * the untitled fallback, the eyebrow. A kind is a lens, not a cage —
 * switching one costs nothing and loses nothing.
 *
 * `letter` stays first because it is where this app started, and because a
 * draft from before kinds existed has no `kind` field at all: absent means
 * letter, so nothing stored ever needs rewriting.
 */
export type WritingKind = 'letter' | 'essay' | 'story' | 'poem' | 'note';

export const WRITING_KINDS: readonly WritingKind[] = ['letter', 'essay', 'story', 'poem', 'note'];

export type KindSpec = {
	id: WritingKind;
	label: string;
	/** The fallback title, e.g. "untitled letter". */
	untitled: string;
	/** One line naming the moment this kind is for. */
	moment: string;
	placeholders: Record<LayerId, string>;
};

const SPECS: Record<WritingKind, KindSpec> = {
	letter: {
		id: 'letter',
		label: 'letter',
		untitled: 'untitled letter',
		moment: 'words meant for someone',
		placeholders: {
			foreground: 'Begin writing your letter…',
			midground: 'thinking, working notes, what shaped this…',
			background: 'the impulse. the thing only you know.'
		}
	},
	essay: {
		id: 'essay',
		label: 'essay',
		untitled: 'untitled essay',
		moment: 'a case, made carefully',
		placeholders: {
			foreground: 'Make the case…',
			midground: 'evidence, sources, the counterargument you owe an answer…',
			background: 'what you actually believe, before the argument dressed it up.'
		}
	},
	story: {
		id: 'story',
		label: 'story',
		untitled: 'untitled story',
		moment: 'people who do not exist, doing things that matter',
		placeholders: {
			foreground: 'Once, and then what happened…',
			midground: 'characters, places, threads — the world behind this scene…',
			background: 'the feeling this story is circling.'
		}
	},
	poem: {
		id: 'poem',
		label: 'poem',
		untitled: 'untitled poem',
		moment: 'compression until it rings',
		placeholders: {
			foreground: 'First line first. Or last line first…',
			midground: 'images, sounds, lines that might belong…',
			background: 'the moment that asked for a poem.'
		}
	},
	note: {
		id: 'note',
		label: 'note',
		untitled: 'untitled note',
		moment: 'put it down before it fades',
		placeholders: {
			foreground: 'Put it down before it fades…',
			midground: 'context, links, where this might belong…',
			background: 'why it snagged you.'
		}
	}
};

export function kindSpec(kind: WritingKind): KindSpec {
	return SPECS[kind];
}

/** Absent or unrecognized kinds read as `letter` — the pre-kinds default. */
export function coerceKind(value: unknown): WritingKind {
	return WRITING_KINDS.includes(value as WritingKind) ? (value as WritingKind) : 'letter';
}

/**
 * A word goal is how fiction gets to 50,000 and an essay stays under 2,000.
 * Stored per draft, optional, and never scolding — the label reports where
 * the count stands, nothing more.
 */
export function coerceGoal(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	return rounded >= 1 ? rounded : null;
}

/** Parse what a person typed into a goal box. Blank or nonsense clears it. */
export function parseGoalInput(raw: string): number | null {
	const cleaned = raw.replace(/[,\s]/g, '');
	if (!cleaned) return null;
	const parsed = Number.parseInt(cleaned, 10);
	return coerceGoal(parsed);
}

export function goalLabel(words: number, goal: number | null): string {
	const base = `${words} word${words === 1 ? '' : 's'}`;
	if (goal === null) return base;
	const pct = Math.min(999, Math.floor((words / goal) * 100));
	return `${words} / ${goal} words · ${pct}%`;
}
