/**
 * How far along an entry is. Ported from the Ologypedia Textbook, where it was
 * the point that a **seed is a legitimate finished state** — a title and a link
 * you meant to leave, not a nag. Forward-only in the UI so it never becomes
 * something to manage.
 */
export type SporeStatus = 'seed' | 'growing' | 'grown';

export const SPORE_STATUSES: SporeStatus[] = ['seed', 'growing', 'grown'];

/** Cover accents, named rather than hex so a stored spore never pins a palette. */
export type SporeAccent = 'rose' | 'sage' | 'gold' | 'dust' | 'plum';

export const SPORE_ACCENTS: SporeAccent[] = ['rose', 'sage', 'gold', 'dust', 'plum'];

export type Spore = {
	id: string;
	title: string;
	body: string;
	data: Record<string, unknown>;
	spellbookIds: string[];
	tags: string[];
	created: string;
	updated: string;
	/** Absent on spores written before the Textbook merge; see `sporeStatus()`. */
	status?: SporeStatus;
	/** Cover overrides. All optional — a cover needs no design step. */
	accent?: SporeAccent;
	glyph?: string;
	blurb?: string;
};

export type Spellbook = {
	id: string;
	title: string;
	archetype: 'plain' | 'diary' | 'media' | string;
	created: string;
	updated: string;
};

export type Flight = {
	id: string;
	from: string;
	to: string;
	label?: string;
	created: string;
};

export type GardenSettings = {
	passphrase?: string;
	customCategories?: import('./spells/types').Category[];
	onboarded?: boolean;
	/** The retired Dev Log has been folded in — see devlogImport.ts. */
	devlogImported?: boolean;
	/** The Ologypedia Textbook has been folded in — see textbookImport.ts. */
	textbookImported?: boolean;
};

export type GardenBlob = {
	spores: Spore[];
	spellbooks: Spellbook[];
	flights: Flight[];
	settings: GardenSettings;
};

export type GardenView = 'garden' | 'spellbook' | 'spore' | 'spell' | 'tag';

// First-run onboarding — the guided first cast. See onboarding/Onboarding.svelte.
export type OnboardingStep = 'welcome' | 'subject' | 'wizard' | 'cast' | 'grown' | 'done';
