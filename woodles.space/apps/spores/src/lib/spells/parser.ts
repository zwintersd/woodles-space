import type { ImportResult } from './types';
import type { Spore } from '../types';
import { uid, now } from '../utils';

// ── fence-stripping ────────────────────────────────────────────────

function stripFences(raw: string): string {
	// Remove ```json ... ``` or ``` ... ``` wrappers
	const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
	// Find first { and last } to isolate the JSON
	const start = fenced.indexOf('{');
	const end = fenced.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return fenced;
	return fenced.slice(start, end + 1);
}

// ── truncation repair ──────────────────────────────────────────────

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
			else return null; // mismatched close — not safely repairable
		}
	}

	if (stack.length === 0 && !inString) return raw; // already valid

	// Bounded repair: close at most 50 levels deep
	if (stack.length > 50) return null;

	let repaired = raw;
	if (inString) repaired += '"'; // close open string
	while (stack.length > 0) repaired += stack.pop()!;
	return repaired;
}

// ── date normalization ─────────────────────────────────────────────

function looksLikeDate(v: string): boolean {
	return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v) || /^\d{4}[–\-–]/.test(v);
}

function normalizeValue(v: unknown): unknown {
	if (typeof v === 'string') {
		const trimmed = v.trim();
		// Coerce common "unknown" synonyms to canonical sentinel
		if (/^(n\/a|not\s*available|not\s*known|none|null|-|—|–)$/i.test(trimmed)) return 'unknown';
		return trimmed;
	}
	if (Array.isArray(v)) return v.map(normalizeValue);
	if (v !== null && typeof v === 'object') return normalizeObj(v as Record<string, unknown>);
	return v;
}

function normalizeObj(obj: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		out[k] = normalizeValue(v);
	}
	return out;
}

// ── body extraction ────────────────────────────────────────────────

function extractBody(data: Record<string, unknown>): string {
	for (const key of ['bio', 'description', 'summary', 'overview', 'synopsis', 'notes']) {
		const v = data[key];
		if (typeof v === 'string' && v !== 'unknown') return v;
	}
	return '';
}

// ── value-position repairs ─────────────────────────────────────────

// A common LLM drift: emitting a list or object as a quoted string —
//   "genres": "["a","b"]"   instead of   "genres": ["a","b"]
// Unwrap those at value positions. Best-effort, and only used as a
// fallback after a normal parse fails, so it can't alter valid JSON.
function unwrapStringifiedContainers(s: string): string {
	return s
		.replace(/(:\s*)"(\[[\s\S]*?\])"(\s*[,}\]])/g, '$1$2$3')
		.replace(/(:\s*)"(\{[\s\S]*?\})"(\s*[,}\]])/g, '$1$2$3');
}

// ── parse helper ───────────────────────────────────────────────────

type ParseAttempt = { ok: true; value: unknown } | { ok: false; error: string };

function tryParse(s: string): ParseAttempt {
	try {
		return { ok: true, value: JSON.parse(s) };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
	}
}

// ── main parse ─────────────────────────────────────────────────────

export function parseImport(raw: string): ImportResult {
	const warnings: string[] = [];
	const stripped = stripFences(raw);

	// Be forgiving on intake, strict on shape.
	let parsed: unknown;
	const first = tryParse(stripped);

	if (first.ok) {
		parsed = first.value;
	} else {
		let recoveredValue: unknown = undefined;
		let recovered = false;
		let parseError = first.error;
		let working = stripped;
		let lookedTruncated = false;

		// Repair 1 — unwrap stringified arrays/objects ("[...]" → [...]).
		const unwrapped = unwrapStringifiedContainers(working);
		if (unwrapped !== working) {
			const r = tryParse(unwrapped);
			if (r.ok) {
				recoveredValue = r.value;
				recovered = true;
				warnings.push(
					'Some list fields arrived wrapped in quotes — Spores unwrapped them. Check the data before planting.'
				);
			} else {
				working = unwrapped; // carry the improvement into the next repair
				parseError = r.error;
			}
		}

		// Repair 2 — bounded truncation repair (close open strings/containers).
		if (!recovered) {
			const repaired = repairTruncated(working);
			if (repaired && repaired !== working) {
				lookedTruncated = true;
				const r = tryParse(repaired);
				if (r.ok) {
					recoveredValue = r.value;
					recovered = true;
					warnings.push(
						'The response appeared truncated — Spores repaired it. Check the data before planting.'
					);
				} else {
					parseError = r.error;
				}
			}
		}

		if (recovered) {
			parsed = recoveredValue;
		} else {
			const errors = lookedTruncated
				? [
						'The response looks cut off — re-run the spell or paste the rest and try again.',
						'If this keeps happening, ask the LLM to be more concise or narrow the scope.'
					]
				: ['This isn’t valid JSON yet — fix the spot flagged below, then try again.'];
			if (parseError) errors.push(`Where it broke: ${parseError}`);
			return { ok: false, errors, recoverableText: raw };
		}
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return {
			ok: false,
			errors: ['Expected a JSON object at the top level.'],
			recoverableText: raw
		};
	}

	const obj = parsed as Record<string, unknown>;

	// Validate envelope
	if (obj.woodles !== 'garden-import-v1') {
		if ('kind' in obj && 'title' in obj) {
			warnings.push('Missing "woodles" envelope marker — accepting anyway.');
		} else {
			return {
				ok: false,
				errors: [
					'This doesn\'t look like a garden-import-v1 response.',
					'Make sure you pasted the LLM\'s full response and that it returned JSON (not prose).'
				],
				recoverableText: raw
			};
		}
	}

	const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : null;

	if (!title) {
		return {
			ok: false,
			errors: ['Missing "title" field in the response.'],
			recoverableText: raw
		};
	}

	// Normalize the whole object
	const normalized = normalizeObj(obj);
	const body = extractBody(normalized);

	const spore: Spore = {
		id: uid(),
		title,
		body,
		data: normalized,
		spellbookIds: [],
		created: now(),
		updated: now()
	};

	return { ok: true, spore, warnings };
}
