import type { Spore } from '../types';

export type FieldDef = {
	key: string;
	label: string;
	hint?: string;
	example?: string;
	default?: boolean;
};

export type ChildLevel = {
	kind: string;
	label: string;
	arrayKey: string; // JSON key holding children, e.g. 'albums'
	fields: FieldDef[];
	children?: ChildLevel;
};

export type Modifier = {
	id: string;
	label: string;
	hint?: string;
	injectFields?: { path: string; field: FieldDef }[];
	injectRules?: string[];
};

export type Category = {
	id: string;
	label: string;
	group: 'person' | 'media' | 'custom';
	glyph?: string;
	rootKind: string;
	rootFields: FieldDef[];
	children?: ChildLevel;
	modifiers?: Modifier[];
};

// Transient state accumulated by the wizard
export type SpellDraft = {
	categoryId: string;
	subject: string;
	disambiguation: string;
	selectedFields: string[]; // dotted paths e.g. 'root.bio', 'album.releaseDate'
	includedLevels: string[]; // child kinds the user kept
	modifiers: string[];
};

export type ImportResult =
	| { ok: true; spore: Spore; warnings: string[] }
	| { ok: false; errors: string[]; recoverableText: string };
