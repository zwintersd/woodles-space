import type { ParseResult } from './types';

/** Ported from Spores' `spells/parser.ts` — same forgiving intake, strict shape. */

function stripFences(raw: string): string {
	const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
	const start = fenced.indexOf('{');
	const end = fenced.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return fenced;
	return fenced.slice(start, end + 1);
}

function repairTruncated(raw: string): string | null {
	let inString = false;
	let escaped = false;
	const stack: string[] = [];

	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === '\\' && inString) {
			escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === '{') stack.push('}');
		else if (ch === '[') stack.push(']');
		else if (ch === '}' || ch === ']') {
			if (stack[stack.length - 1] === ch) stack.pop();
			else return null;
		}
	}

	if (stack.length === 0 && !inString) return raw;
	if (stack.length > 50) return null;

	let repaired = raw;
	if (inString) repaired += '"';
	while (stack.length > 0) repaired += stack.pop()!;
	return repaired;
}

function normalizeValue(v: unknown): unknown {
	if (typeof v === 'string') {
		const trimmed = v.trim();
		if (/^(n\/a|not\s*available|not\s*known|none|null|-|—|–)$/i.test(trimmed)) return 'unknown';
		return trimmed;
	}
	if (Array.isArray(v)) return v.map(normalizeValue);
	if (v !== null && typeof v === 'object') return normalizeObj(v as Record<string, unknown>);
	return v;
}

function normalizeObj(obj: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) out[k] = normalizeValue(v);
	return out;
}

// A common LLM drift: emitting a list or object as a quoted string. Unwrap at
// value positions — best-effort, only tried after a normal parse fails.
function unwrapStringifiedContainers(s: string): string {
	return s
		.replace(/(:\s*)"(\[[\s\S]*?\])"(\s*[,}\]])/g, '$1$2$3')
		.replace(/(:\s*)"(\{[\s\S]*?\})"(\s*[,}\]])/g, '$1$2$3');
}

type ParseAttempt = { ok: true; value: unknown } | { ok: false; error: string };

function tryParse(s: string): ParseAttempt {
	try {
		return { ok: true, value: JSON.parse(s) };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
	}
}

/**
 * Parse a model's answer into the `data` a spell attaches to an entry. The
 * category is supplied by the caller (whichever one the prompt was built
 * for) rather than trusted from the pasted JSON — a model can drift on
 * `kind`, but which category this cast belongs to is never in question.
 */
export function parseSpell(raw: string): ParseResult {
	const warnings: string[] = [];
	const stripped = stripFences(raw);

	let parsed: unknown;
	const first = tryParse(stripped);

	if (first.ok) {
		parsed = first.value;
	} else {
		let recoveredValue: unknown;
		let recovered = false;
		let parseError = first.error;
		let working = stripped;
		let lookedTruncated = false;

		const unwrapped = unwrapStringifiedContainers(working);
		if (unwrapped !== working) {
			const r = tryParse(unwrapped);
			if (r.ok) {
				recoveredValue = r.value;
				recovered = true;
				warnings.push('Some list fields arrived wrapped in quotes — unwrapped them. Check the data.');
			} else {
				working = unwrapped;
				parseError = r.error;
			}
		}

		if (!recovered) {
			const repaired = repairTruncated(working);
			if (repaired && repaired !== working) {
				lookedTruncated = true;
				const r = tryParse(repaired);
				if (r.ok) {
					recoveredValue = r.value;
					recovered = true;
					warnings.push('The response appeared truncated — repaired it. Check the data before keeping it.');
				} else {
					parseError = r.error;
				}
			}
		}

		if (recovered) {
			parsed = recoveredValue;
		} else {
			const errors = lookedTruncated
				? ['The response looks cut off — re-run the spell or paste the rest and try again.']
				: ["This isn't valid JSON yet — fix the spot flagged below, then try again."];
			if (parseError) errors.push(`Where it broke: ${parseError}`);
			return { ok: false, errors };
		}
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { ok: false, errors: ['Expected a JSON object at the top level.'] };
	}

	const obj = parsed as Record<string, unknown>;
	if (obj.woodles !== 'thinking-about-spell-v1' && !('kind' in obj && 'title' in obj)) {
		return {
			ok: false,
			errors: [
				"This doesn't look like a spell response.",
				'Make sure you pasted the full response and that it returned JSON, not prose.'
			]
		};
	}
	if (obj.woodles !== 'thinking-about-spell-v1') {
		warnings.push('Missing "woodles" envelope marker — accepting anyway.');
	}

	if (typeof obj.title !== 'string' || !obj.title.trim()) {
		return { ok: false, errors: ['Missing "title" field in the response.'] };
	}

	return { ok: true, data: normalizeObj(obj), warnings };
}
