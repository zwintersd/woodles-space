import type { Category, ChildLevel, FieldDef } from './types';

/**
 * Builds the prompt a person copies out to any model. Every field a category
 * knows about is included — no picker, unlike Spores' version (see
 * types.ts's header for why).
 */

function fieldValue(field: FieldDef): string {
	return field.example ?? '(or unknown)';
}

function buildChildLevel(level: ChildLevel): Record<string, unknown> {
	const child: Record<string, unknown> = { kind: level.kind, title: '(required)' };
	for (const field of level.fields) {
		if (field.key === 'title') continue;
		child[field.key] = fieldValue(field);
	}
	if (level.children) child[level.children.arrayKey] = [buildChildLevel(level.children)];
	return child;
}

function buildSkeleton(category: Category, subject: string, disambiguation: string): Record<string, unknown> {
	const skeleton: Record<string, unknown> = {
		woodles: 'thinking-about-spell-v1',
		kind: category.rootKind,
		title: subject
	};
	if (disambiguation) skeleton.disambiguation = disambiguation;
	for (const field of category.rootFields) skeleton[field.key] = fieldValue(field);
	if (category.children) skeleton[category.children.arrayKey] = [buildChildLevel(category.children)];
	return skeleton;
}

/** Assemble the prompt for the anime relationship graph — its own shape, same as Spores'. */
function assembleGraphSpell(category: Category, subject: string, disambiguation: string): string {
	const subjectLine = disambiguation ? `Subject: ${subject} (${disambiguation})` : `Subject: ${subject}`;

	const skeleton: Record<string, unknown> = {
		woodles: 'thinking-about-spell-v1',
		kind: category.rootKind,
		title: subject
	};
	for (const field of category.rootFields) skeleton[field.key] = fieldValue(field);
	skeleton.nodes = [
		{
			id: 'snake_case_character_id',
			name: 'Character Full Name',
			type: 'character',
			role: 'protagonist | antagonist | deuteragonist | supporting | minor',
			faction: 'Primary group or affiliation',
			description: '1–2 sentence character summary'
		}
	];
	skeleton.edges = [
		{
			from: 'id_of_source_character',
			to: 'id_of_target_character',
			type: 'bond | friendship | rivalry | romance | family | ally | enemy | mentor',
			label: 'brief relationship description'
		}
	];

	const rules = [
		'Return ONLY the JSON object above. No preamble, no markdown fences, no commentary.',
		'Include all major characters — aim for 10–20 nodes covering the main and supporting cast.',
		'Node "id" must be unique snake_case strings (e.g., "eren_yeager"). Never reuse an id.',
		'Include all meaningful relationships — aim for 15–30 edges between major characters.',
		'Every "from" and "to" value must exactly match an existing node id.',
		'Use "unknown" for any uncertain fields rather than fabricating.'
	];

	return [
		`You are a careful research assistant. ${subjectLine}.`,
		'',
		'Return ONLY valid JSON in this exact shape — expand nodes[] and edges[] to include the full cast and their relationships:',
		'',
		JSON.stringify(skeleton, null, 2),
		'',
		'RULES:',
		rules.map((r, i) => `${i + 1}. ${r}`).join('\n')
	].join('\n');
}

export function assembleSpell(category: Category, subject: string, disambiguation = ''): string {
	if (category.rootKind === 'anime-relationship-graph') {
		return assembleGraphSpell(category, subject, disambiguation);
	}

	const subjectLine = disambiguation ? `Subject: ${subject} (${disambiguation})` : `Subject: ${subject}`;
	const rules = [
		'Return ONLY the JSON object above. No preamble, no markdown fences, no commentary.',
		'Use the literal string "unknown" wherever information is uncertain — never fabricate.',
		'Dates: use YYYY-MM-DD when known, YYYY-MM or YYYY when that is all that is certain.',
		'Order children canonically (release order, season/episode order, publication order).',
		'Keep titles exactly as officially published.'
	];

	return [
		`You are a careful research assistant. ${subjectLine}.`,
		'',
		'Return ONLY valid JSON in this exact shape (fill every field; use "unknown" for anything uncertain):',
		'',
		JSON.stringify(buildSkeleton(category, subject, disambiguation), null, 2),
		'',
		'RULES:',
		rules.map((r, i) => `${i + 1}. ${r}`).join('\n')
	].join('\n');
}
