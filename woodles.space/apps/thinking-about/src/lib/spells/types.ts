/**
 * Ported from Spores' `spells/` — the "ask a model for structured content and
 * paste it back" pipeline — trimmed to the half of it that fits here.
 *
 * Spores' version let a person pick which fields to include per cast (a
 * multi-step wizard) and layer on optional modifiers (citations, timeline
 * detail, air dates, voice actors). Thinking About doesn't rebuild that
 * picker: a cast always asks for every field a category knows about, no
 * modifiers. What's worth keeping is the schema-per-category idea itself and
 * the JSON-skeleton-prompt technique — Thinking About's own `SectionKey`
 * union (book, film, tv, anime, game, …) already names almost exactly the
 * categories Spores curated, so this is less a port than the two finally
 * meeting.
 */

export type FieldDef = {
	key: string;
	label: string;
	example?: string;
};

export type ChildLevel = {
	kind: string;
	label: string;
	arrayKey: string; // JSON key holding children, e.g. 'albums'
	fields: FieldDef[];
	children?: ChildLevel;
};

export type Category = {
	id: string;
	label: string;
	group: 'person' | 'media' | 'anime';
	glyph?: string;
	rootKind: string;
	rootFields: FieldDef[];
	children?: ChildLevel;
};

export type ParseResult =
	| { ok: true; data: Record<string, unknown>; warnings: string[] }
	| { ok: false; errors: string[] };
