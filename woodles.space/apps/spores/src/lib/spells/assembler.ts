import type { Category, SpellDraft, FieldDef, ChildLevel, Modifier } from './types';

// ── spell assembly ─────────────────────────────────────────────────
// Builds the prompt string the user pastes into any LLM.

function fieldPath(level: string, key: string): string {
	return `${level}.${key}`;
}

function selectedAt(draft: SpellDraft, level: string, key: string): boolean {
	return draft.selectedFields.includes(fieldPath(level, key));
}

function levelIncluded(draft: SpellDraft, kind: string): boolean {
	return draft.includedLevels.includes(kind);
}

// Render a field value for the skeleton JSON (example or placeholder)
function fieldValue(field: FieldDef, required = true): string {
	if (field.example) return field.example;
	return required ? '(required)' : '(or unknown)';
}

// Build the skeleton JSON object that instructs the LLM what shape to return
function buildSkeleton(
	draft: SpellDraft,
	category: Category,
	injectedFields: Record<string, FieldDef[]>
): Record<string, unknown> {
	const obj: Record<string, unknown> = {
		woodles: 'garden-import-v1',
		kind: category.rootKind,
		title: draft.subject
	};

	if (draft.disambiguation) {
		obj.disambiguation = draft.disambiguation;
	}

	// Root fields
	const rootInject = injectedFields['root'] ?? [];
	const allRootFields = [...category.rootFields, ...rootInject];
	for (const f of allRootFields) {
		if (selectedAt(draft, 'root', f.key)) {
			obj[f.key] = fieldValue(f, f.default ?? false);
		}
	}

	// Child levels (recursive)
	function buildChildLevel(level: ChildLevel): Record<string, unknown> {
		const child: Record<string, unknown> = {
			kind: level.kind,
			title: '(required)'
		};
		const inject = injectedFields[level.kind] ?? [];
		const allFields = [...level.fields.filter((f) => f.key !== 'title'), ...inject];
		for (const f of allFields) {
			if (selectedAt(draft, level.kind, f.key)) {
				child[f.key] = fieldValue(f, f.default ?? false);
			}
		}
		if (level.children && levelIncluded(draft, level.children.kind)) {
			child[level.children.arrayKey] = [buildChildLevel(level.children)];
		}
		return child;
	}

	if (category.children && levelIncluded(draft, category.children.kind)) {
		obj[category.children.arrayKey] = [buildChildLevel(category.children)];
	}

	return obj;
}

// Collect injected fields and rules from active modifiers
function collectModifierInjections(
	draft: SpellDraft,
	category: Category
): { fields: Record<string, FieldDef[]>; rules: string[] } {
	const fields: Record<string, FieldDef[]> = {};
	const rules: string[] = [];

	for (const mod of category.modifiers ?? []) {
		if (!draft.modifiers.includes(mod.id)) continue;
		for (const { path, field } of mod.injectFields ?? []) {
			fields[path] = [...(fields[path] ?? []), field];
		}
		rules.push(...(mod.injectRules ?? []));
	}

	return { fields, rules };
}

export function buildSpell(draft: SpellDraft, category: Category): string {
	const { fields: injectedFields, rules: modifierRules } = collectModifierInjections(
		draft,
		category
	);

	const skeleton = buildSkeleton(draft, category, injectedFields);
	const skeletonJson = JSON.stringify(skeleton, null, 2);

	const subjectLine = draft.disambiguation
		? `Subject: ${draft.subject} (${draft.disambiguation})`
		: `Subject: ${draft.subject}`;

	const baseRules = [
		'Return ONLY the JSON object above. No preamble, no markdown fences, no commentary.',
		'Use the literal string "unknown" wherever information is uncertain — never fabricate.',
		'Dates: use YYYY-MM-DD when known, YYYY-MM or YYYY when that is all that is certain.',
		'Order children canonically (release order, season/episode order, publication order).',
		'Keep titles exactly as officially published. Never edit titles to encode disambiguation or versions.'
	];

	const allRules = [...baseRules, ...modifierRules];
	const rulesText = allRules.map((r, i) => `${i + 1}. ${r}`).join('\n');

	return [
		`You are a careful research assistant. ${subjectLine}.`,
		'',
		'Return ONLY valid JSON in this exact shape (fill every (required) field; use "unknown" for anything uncertain):',
		'',
		skeletonJson,
		'',
		'RULES:',
		rulesText
	].join('\n');
}
