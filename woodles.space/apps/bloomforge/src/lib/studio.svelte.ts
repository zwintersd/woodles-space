import {
	DEFAULT_FORMAT,
	defaultCurve,
	emptyGameDef,
	entityIndex,
	parseGameDef,
	serializeGameDef,
	slugify,
	validateGameDef,
	type Currency,
	type EntityKind,
	type GameDef,
	type Generator,
	type Milestone,
	type PrestigeLayer,
	type StickyNote,
	type Unlock,
	type Upgrade,
	type ValidationIssue,
	type XY
} from '@woodles/incremental-core';
import { loadProject, markOpened, newProjectId, saveProject, starterProject } from './projects.js';

/**
 * One store holds the whole editor: the def, what's selected, and the undo
 * stack. Everything else in the app derives from it.
 *
 * Undo/redo is whole-def snapshots in a ring buffer rather than a command log.
 * At this data size — a few dozen entities of plain JSON — cloning is cheap,
 * and "correct" beats "clever" for an operation people reach for when they've
 * just broken something.
 */

const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY = 600;

export type SaveState = 'saved' | 'saving' | 'error';

export class Studio {
	def = $state<GameDef>(emptyGameDef());
	projectId = $state<string>('');
	selectedId = $state<string | null>(null);
	saveState = $state<SaveState>('saved');

	/** Live validation. Every node badge and the inspector's warnings read this. */
	issues = $derived<ValidationIssue[]>(validateGameDef(this.def));
	errorCount = $derived(this.issues.filter((issue) => issue.severity === 'error').length);

	#past = $state<GameDef[]>([]);
	#future = $state<GameDef[]>([]);
	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	get canUndo(): boolean {
		return this.#past.length > 0;
	}

	get canRedo(): boolean {
		return this.#future.length > 0;
	}

	get selected(): { id: string; kind: EntityKind } | null {
		if (!this.selectedId) return null;
		const ref = entityIndex(this.def).get(this.selectedId);
		return ref ? { id: ref.id, kind: ref.kind } : null;
	}

	issuesFor(id: string): ValidationIssue[] {
		return this.issues.filter((issue) => issue.entityId === id);
	}

	// ── lifecycle ────────────────────────────────────────────────────────

	open(id: string, def: GameDef): void {
		this.projectId = id;
		this.def = def;
		this.selectedId = null;
		this.#past = [];
		this.#future = [];
		this.saveState = 'saved';
		markOpened(id);
	}

	/** Resumes the last project, or seeds a first-run one from the cozy garden. */
	openOrCreate(id: string | null): void {
		if (id) {
			const existing = loadProject(id);
			if (existing) {
				this.open(id, existing);
				return;
			}
		}
		const fresh = newProjectId();
		this.open(fresh, starterProject());
		this.#persist();
	}

	createProject(title = 'Untitled Game'): void {
		const def = emptyGameDef(title);
		def.meta.id = slugify(title);
		this.open(newProjectId(), def);
		this.#persist();
	}

	// ── editing ──────────────────────────────────────────────────────────

	/**
	 * The one way the def changes. Snapshots first, mutates, then schedules a
	 * save — so no caller has to remember to do any of the three.
	 */
	edit(mutate: (def: GameDef) => void): void {
		this.#pushHistory();
		mutate(this.def);
		this.#scheduleSave();
	}

	/**
	 * For changes that stream — dragging a node emits a position per frame, and
	 * a hundred undo entries for one drag is not an undo stack. Callers pair it
	 * with `beginGesture()` at the start of the interaction.
	 */
	editQuietly(mutate: (def: GameDef) => void): void {
		mutate(this.def);
		this.#scheduleSave();
	}

	/** Marks one undoable point before a streaming interaction begins. */
	beginGesture(): void {
		this.#pushHistory();
	}

	undo(): void {
		const previous = this.#past.pop();
		if (!previous) return;
		this.#future.push($state.snapshot(this.def) as GameDef);
		this.def = previous;
		this.#scheduleSave();
	}

	redo(): void {
		const next = this.#future.pop();
		if (!next) return;
		this.#past.push($state.snapshot(this.def) as GameDef);
		this.def = next;
		this.#scheduleSave();
	}

	select(id: string | null): void {
		this.selectedId = id;
	}

	moveNode(id: string, position: XY): void {
		this.editQuietly((def) => {
			def.layout[id] = { x: Math.round(position.x), y: Math.round(position.y) };
		});
	}

	// ── entities ─────────────────────────────────────────────────────────

	/** Creates an entity of the given kind, drops it on the canvas, and selects it. */
	create(kind: EntityKind, at: XY = { x: 120, y: 120 }): string | null {
		const taken = [...entityIndex(this.def).keys()];
		const name = nextName(kind, this.def);
		const id = slugify(name, taken);

		this.edit((def) => {
			switch (kind) {
				case 'currency':
					def.currencies.push(newCurrency(id, name));
					break;
				case 'generator': {
					const generator = newGenerator(id, name, def);
					if (!generator) return;
					def.generators.push(generator);
					break;
				}
				case 'upgrade': {
					const upgrade = newUpgrade(id, name, def);
					if (!upgrade) return;
					def.upgrades.push(upgrade);
					break;
				}
				case 'prestige': {
					const layer = newPrestige(id, name, def);
					if (!layer) return;
					def.prestigeLayers.push(layer);
					break;
				}
				case 'unlock':
					def.unlocks.push(newUnlock(id, name, def));
					break;
				case 'milestone':
					def.milestones.push(newMilestone(id, name, def));
					break;
			}
			def.layout[id] = { x: Math.round(at.x), y: Math.round(at.y) };
		});

		if (!entityIndex(this.def).has(id)) return null;
		this.selectedId = id;
		return id;
	}

	/**
	 * Removes an entity *and* every reference to it, so deleting can't leave the
	 * def in a state the engine refuses to run. A dangling reference the author
	 * didn't create is a bug, not a warning to show them.
	 */
	remove(id: string): void {
		this.edit((def) => {
			def.currencies = def.currencies.filter((entity) => entity.id !== id);
			def.generators = def.generators.filter((entity) => entity.id !== id);
			def.upgrades = def.upgrades.filter((entity) => entity.id !== id);
			def.prestigeLayers = def.prestigeLayers.filter((entity) => entity.id !== id);
			def.unlocks = def.unlocks.filter((entity) => entity.id !== id);
			def.milestones = def.milestones.filter((entity) => entity.id !== id);

			for (const upgrade of def.upgrades) {
				upgrade.effects = upgrade.effects.filter(
					(effect) => effect.target.type === 'global' || effect.target.id !== id
				);
			}
			for (const layer of def.prestigeLayers) layer.resets = layer.resets.filter((entry) => entry !== id);
			for (const unlock of def.unlocks) unlock.reveals = unlock.reveals.filter((entry) => entry !== id);

			delete def.layout[id];
		});
		if (this.selectedId === id) this.selectedId = null;
	}

	duplicate(id: string): string | null {
		const ref = entityIndex(this.def).get(id);
		if (!ref) return null;

		const taken = [...entityIndex(this.def).keys()];
		const copyName = `${ref.name} copy`;
		const copyId = slugify(copyName, taken);
		const from = this.def.layout[id] ?? { x: 120, y: 120 };

		this.edit((def) => {
			const clone = structuredClone($state.snapshot(ref.entity)) as { id: string; name: string };
			clone.id = copyId;
			clone.name = copyName;
			switch (ref.kind) {
				case 'currency':
					def.currencies.push(clone as Currency);
					break;
				case 'generator':
					def.generators.push(clone as Generator);
					break;
				case 'upgrade':
					def.upgrades.push(clone as Upgrade);
					break;
				case 'prestige':
					def.prestigeLayers.push(clone as PrestigeLayer);
					break;
				case 'unlock':
					def.unlocks.push(clone as Unlock);
					break;
				case 'milestone':
					def.milestones.push(clone as Milestone);
					break;
			}
			def.layout[copyId] = { x: from.x + 40, y: from.y + 40 };
		});

		this.selectedId = copyId;
		return copyId;
	}

	// ── notes ────────────────────────────────────────────────────────────

	addNote(at: XY = { x: 160, y: 160 }): void {
		this.edit((def) => {
			const id = slugify('note', def.notes.map((note) => note.id));
			const note: StickyNote = { id, text: '', position: { x: Math.round(at.x), y: Math.round(at.y) } };
			def.notes.push(note);
		});
	}

	updateNote(id: string, text: string): void {
		this.editQuietly((def) => {
			const note = def.notes.find((entry) => entry.id === id);
			if (note) note.text = text;
		});
	}

	moveNote(id: string, position: XY): void {
		this.editQuietly((def) => {
			const note = def.notes.find((entry) => entry.id === id);
			if (note) note.position = { x: Math.round(position.x), y: Math.round(position.y) };
		});
	}

	removeNote(id: string): void {
		this.edit((def) => {
			def.notes = def.notes.filter((note) => note.id !== id);
		});
	}

	// ── import / export ──────────────────────────────────────────────────

	toJSON(): string {
		return serializeGameDef($state.snapshot(this.def) as GameDef);
	}

	/** Throws `GameDefParseError` with readable issues if the file can't be used. */
	importJSON(text: string): void {
		const { def } = parseGameDef(text);
		this.#pushHistory();
		this.def = def;
		this.selectedId = null;
		this.#scheduleSave();
	}

	/** Flushes a pending autosave — call before the tab goes away. */
	flush(): void {
		if (this.#saveTimer === null) return;
		clearTimeout(this.#saveTimer);
		this.#saveTimer = null;
		this.#persist();
	}

	// ── internals ────────────────────────────────────────────────────────

	#pushHistory(): void {
		this.#past.push($state.snapshot(this.def) as GameDef);
		// Oldest out first: an undo stack that grows without bound is a memory
		// leak wearing a feature's clothes.
		if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
		this.#future = [];
	}

	#scheduleSave(): void {
		this.saveState = 'saving';
		if (this.#saveTimer !== null) clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => {
			this.#saveTimer = null;
			this.#persist();
		}, AUTOSAVE_DELAY);
	}

	#persist(): void {
		if (!this.projectId) return;
		const snapshot = $state.snapshot(this.def) as GameDef;
		this.saveState = saveProject(this.projectId, snapshot) ? 'saved' : 'error';
	}
}

/**
 * The editor is a single-document app, so the store is a module singleton —
 * the same shape spores and planner use. The class stays exported so tests can
 * build an isolated one.
 */
export const studio = new Studio();

// ── factories for new entities ─────────────────────────────────────────
// Each one lands *valid*: a new generator points at a real currency, a new
// upgrade has a real effect. Creating a node should never hand the author a
// validation error they didn't cause.

function nextName(kind: EntityKind, def: GameDef): string {
	const bases: Record<EntityKind, string> = {
		currency: 'New Currency',
		generator: 'New Generator',
		upgrade: 'New Upgrade',
		prestige: 'New Prestige',
		unlock: 'New Unlock',
		milestone: 'New Milestone'
	};
	const base = bases[kind];
	const existing = new Set(entityIndex(def).values().map((ref) => ref.name));
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base} ${suffix}`)) suffix += 1;
	return `${base} ${suffix}`;
}

function newCurrency(id: string, name: string): Currency {
	return { id, name, symbol: '🌸', color: '#A78BFA', format: { ...DEFAULT_FORMAT } };
}

function newGenerator(id: string, name: string, def: GameDef): Generator | null {
	const currency = def.currencies[0];
	if (!currency) return null;
	return {
		id,
		name,
		producesCurrencyId: currency.id,
		baseRate: 1,
		rateCurve: defaultCurve('polynomial'),
		cost: { currencyId: currency.id, base: 10, curve: defaultCurve('geometric') }
	};
}

function newUpgrade(id: string, name: string, def: GameDef): Upgrade | null {
	const currency = def.currencies[0];
	if (!currency) return null;
	const generator = def.generators[0];
	return {
		id,
		name,
		cost: { currencyId: currency.id, amount: 100 },
		effects: [
			{
				target: generator ? { type: 'generator', id: generator.id } : { type: 'global' },
				stat: 'rate',
				op: 'mul',
				value: 2
			}
		]
	};
}

function newPrestige(id: string, name: string, def: GameDef): PrestigeLayer | null {
	const source = def.currencies[0];
	if (!source) return null;
	// Award a *different* currency where one exists: a layer that resets the
	// currency it pays out in pays out nothing, which the validator would
	// rightly warn about the moment it appeared.
	const award = def.currencies[1] ?? source;
	return {
		id,
		name,
		currencyId: award.id,
		gainFormula: { sourceCurrencyId: source.id, threshold: 1_000_000, exponent: 0.5 },
		multiplier: { perUnit: 0.01 },
		resets: award.id === source.id ? [] : [source.id]
	};
}

function newUnlock(id: string, name: string, def: GameDef): Unlock {
	const currency = def.currencies[0];
	return {
		id,
		name,
		reveals: [],
		when: currency
			? { metric: 'currencyLifetime', currencyId: currency.id, op: '>=', value: 1000 }
			: { all: [] }
	};
}

function newMilestone(id: string, name: string, def: GameDef): Milestone {
	const currency = def.currencies[0];
	return {
		id,
		name,
		when: currency
			? { metric: 'currencyLifetime', currencyId: currency.id, op: '>=', value: 1000 }
			: { all: [] }
	};
}
