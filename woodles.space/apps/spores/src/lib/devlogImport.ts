import type { GardenStore } from './garden.svelte';
import type { Spore } from './types';

/**
 * One-way import of the retired Dev Log app into the Garden.
 *
 * The Dev Log was dated entries of typed blocks — structurally a schema
 * registry plus a link type, which is what Spores already is, only
 * data-driven. Per CONVERGENCE.md §0 there is no chronological lens to
 * preserve: the date survives as an ordinary field, and nothing renders a
 * timeline. See also the worldbuilding pack in `spells/registry.ts`.
 *
 * Shape of what lands:
 *   - one Spellbook, "Dev Log", holding everything
 *   - one Spore per entry — prose blocks become its body
 *   - one Spore per typed block, with the block's fields in `data`
 *   - a Flight from each entry to the blocks it contained
 *   - a Flight for every SmartLink that resolves to an imported block
 */

export const DEVLOG_KEY = 'woodles_devlog';

const BLOCK_TYPES = [
	'prose',
	'creature',
	'biome',
	'ability',
	'stat',
	'minigame',
	'lore'
] as const;

type BlockType = (typeof BLOCK_TYPES)[number];

type RawBlock = Record<string, unknown> & { type?: unknown; id?: unknown };
type RawEntry = {
	id?: unknown;
	date?: unknown;
	title?: unknown;
	blocks?: unknown;
	createdAt?: unknown;
};

export type DevlogImportSummary = {
	/** Entry spores created. */
	entries: number;
	/** Typed-block spores created. */
	records: number;
	/** Flights created — containment plus resolved smart links. */
	flights: number;
	/** Smart links naming a block that wasn't in the export. */
	unresolvedLinks: number;
	spellbookId: string | null;
};

const EMPTY: DevlogImportSummary = {
	entries: 0,
	records: 0,
	flights: 0,
	unresolvedLinks: 0,
	spellbookId: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function blockType(block: RawBlock): BlockType | null {
	const type = str(block.type);
	return (BLOCK_TYPES as readonly string[]).includes(type) ? (type as BlockType) : null;
}

/** A block's display name — the field varies by type, as it did in the Dev Log. */
function blockLabel(block: RawBlock): string {
	return str(block.name).trim() || str(block.title).trim();
}

/**
 * A SmartLink was `{ kind, label }`; a field could hold one, several, or
 * nothing. Only that shape counts — a bare string is an ordinary field value
 * (a lore fragment, a climate note), not a reference to another block.
 */
function linkLabels(value: unknown): string[] {
	const one = (item: unknown): string[] =>
		isRecord(item) && typeof item.kind === 'string' && typeof item.label === 'string' && item.label.trim()
			? [item.label.trim()]
			: [];
	return Array.isArray(value) ? value.flatMap(one) : one(value);
}

/** Everything on a block except the plumbing, kept as the spore's `data`. */
function blockData(block: RawBlock, type: BlockType): Record<string, unknown> {
	const data: Record<string, unknown> = { kind: type };
	for (const [key, value] of Object.entries(block)) {
		if (key === 'id' || key === 'type' || key === 'name' || key === 'title') continue;
		data[key] = value;
	}
	return data;
}

function entryTitle(entry: RawEntry): string {
	const title = str(entry.title).trim();
	if (title) return title;
	const date = str(entry.date).trim();
	return date ? `Dev Log — ${date}` : 'Dev Log entry';
}

/** Parse the raw localStorage text. Returns null when there's nothing usable. */
export function readDevlogEntries(raw: string | null): RawEntry[] | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return null;
	const entries = parsed.entries.filter(isRecord) as RawEntry[];
	return entries.length > 0 ? entries : null;
}

/**
 * Import parsed entries into the Garden. Pure with respect to storage — it
 * only calls the store's own mutators, so it persists the same way any other
 * edit does.
 */
export function importDevlogEntries(
	garden: GardenStore,
	entries: RawEntry[]
): DevlogImportSummary {
	if (entries.length === 0) return { ...EMPTY };

	const book = garden.addSpellbook('Dev Log', 'plain');
	const summary: DevlogImportSummary = { ...EMPTY, spellbookId: book.id };

	// label → spore, for resolving smart links once every block exists.
	const byLabel = new Map<string, Spore>();
	const pendingLinks: { from: Spore; labels: string[]; field: string }[] = [];

	for (const entry of entries) {
		const rawBlocks = Array.isArray(entry.blocks) ? (entry.blocks.filter(isRecord) as RawBlock[]) : [];

		const prose = rawBlocks
			.filter((block) => blockType(block) === 'prose')
			.map((block) => str(block.content).trim())
			.filter(Boolean)
			.join('\n\n');

		const entrySpore = garden.addSpore({
			title: entryTitle(entry),
			body: prose,
			data: { kind: 'devlog-entry', date: str(entry.date) },
			tags: ['devlog'],
			spellbookIds: [book.id]
		});
		summary.entries += 1;

		for (const block of rawBlocks) {
			const type = blockType(block);
			if (!type || type === 'prose') continue;

			const label = blockLabel(block);
			// A lore block carried its text in `content`; everything else keeps
			// its prose in the typed fields, so the body stays empty.
			const body = type === 'lore' ? str(block.content) : '';

			const spore = garden.addSpore({
				title: label || type,
				body,
				data: blockData(block, type),
				tags: ['devlog', type],
				spellbookIds: [book.id]
			});
			summary.records += 1;

			garden.addFlight(entrySpore.id, spore.id, type);
			summary.flights += 1;

			if (label && !byLabel.has(label.toLowerCase())) {
				byLabel.set(label.toLowerCase(), spore);
			}

			for (const [field, value] of Object.entries(blockData(block, type))) {
				const labels = linkLabels(value);
				if (labels.length > 0) pendingLinks.push({ from: spore, labels, field });
			}
		}
	}

	// Smart links resolve only after every block exists — a link can point
	// forward to a block defined in a later entry.
	for (const link of pendingLinks) {
		for (const label of link.labels) {
			const target = byLabel.get(label.toLowerCase());
			if (!target || target.id === link.from.id) {
				if (!target) summary.unresolvedLinks += 1;
				continue;
			}
			const before = garden.flights.length;
			garden.addFlight(link.from.id, target.id, link.field);
			if (garden.flights.length > before) summary.flights += 1;
		}
	}

	return summary;
}

/**
 * Run the import once, from localStorage. Marked in settings so it can't run
 * twice and quietly double the Garden.
 */
export function importDevlogOnce(garden: GardenStore): DevlogImportSummary | null {
	if (garden.settings.devlogImported === true) return null;
	if (typeof localStorage === 'undefined') return null;

	const entries = readDevlogEntries(localStorage.getItem(DEVLOG_KEY));
	if (!entries) return null;

	const summary = importDevlogEntries(garden, entries);
	garden.markDevlogImported();
	return summary;
}
