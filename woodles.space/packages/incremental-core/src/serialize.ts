import { DEFAULT_FORMAT } from './num.js';
import { SCHEMA_VERSION, type GameDef } from './types.js';
import { hasErrors, validateGameDef, type ValidationIssue } from './validate.js';

/**
 * The trust boundary. A def arriving from localStorage, a file drop, or a
 * fixture is untyped until it has been through here — `as GameDef` on a parsed
 * JSON blob is a lie the type system can't catch, and the engine's guarantees
 * all assume the shape actually holds.
 */

export interface ParseResult {
	def: GameDef;
	issues: ValidationIssue[];
}

export class GameDefParseError extends Error {
	readonly issues: ValidationIssue[];

	constructor(message: string, issues: ValidationIssue[] = []) {
		super(message);
		this.name = 'GameDefParseError';
		this.issues = issues;
	}
}

/**
 * Normalizes an unknown value into a GameDef, filling in arrays a hand-written
 * or older file may be missing. Throws when what's left still can't run —
 * warnings come back on `issues` for the editor to surface inline.
 */
export function parseGameDef(input: unknown): ParseResult {
	if (typeof input === 'string') return parseGameDef(parseJson(input));
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new GameDefParseError('this file does not contain a game definition');
	}

	const raw = input as Partial<GameDef> & Record<string, unknown>;
	if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) {
		throw new GameDefParseError(
			`this file uses schema version ${String(raw.schemaVersion)}; this build reads version ${SCHEMA_VERSION}`
		);
	}

	const def: GameDef = {
		schemaVersion: SCHEMA_VERSION,
		meta: {
			id: raw.meta?.id ?? 'untitled',
			title: raw.meta?.title ?? 'Untitled',
			...(raw.meta?.description === undefined ? {} : { description: raw.meta.description })
		},
		currencies: array(raw.currencies),
		generators: array(raw.generators),
		upgrades: array(raw.upgrades),
		prestigeLayers: array(raw.prestigeLayers),
		unlocks: array(raw.unlocks),
		milestones: array(raw.milestones),
		notes: array(raw.notes),
		layout: raw.layout && typeof raw.layout === 'object' ? { ...raw.layout } : {}
	};

	const issues = validateGameDef(def);
	if (hasErrors(issues)) {
		const first = issues.find((issue) => issue.severity === 'error');
		throw new GameDefParseError(first?.message ?? 'this game definition is not valid', issues);
	}
	return { def, issues };
}

/** Pretty-printed, so an exported project reads as a diffable text file. */
export function serializeGameDef(def: GameDef): string {
	return `${JSON.stringify(def, null, 2)}\n`;
}

/** A blank project: one currency to spend, one generator to make it. */
export function emptyGameDef(title = 'Untitled Game'): GameDef {
	return {
		schemaVersion: SCHEMA_VERSION,
		meta: { id: 'untitled', title },
		currencies: [
			{
				id: 'points',
				name: 'Points',
				symbol: '🌸',
				color: '#A78BFA',
				format: { ...DEFAULT_FORMAT }
			}
		],
		generators: [
			{
				id: 'seedling',
				name: 'Seedling',
				producesCurrencyId: 'points',
				baseRate: 1,
				rateCurve: { kind: 'polynomial', exponent: 1 },
				cost: { currencyId: 'points', base: 10, curve: { kind: 'geometric', growth: 1.15 } },
				startsOwned: 1
			}
		],
		upgrades: [],
		prestigeLayers: [],
		unlocks: [],
		milestones: [],
		notes: [],
		layout: { points: { x: 420, y: 60 }, seedling: { x: 220, y: 240 } }
	};
}

function array<T>(value: T[] | undefined): T[] {
	return Array.isArray(value) ? [...value] : [];
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch (cause) {
		throw new GameDefParseError(`could not read that file as JSON: ${(cause as Error).message}`);
	}
}
