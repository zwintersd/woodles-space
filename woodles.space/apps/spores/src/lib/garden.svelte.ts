import type { Spore, Spellbook, Flight, GardenBlob, GardenSettings, GardenView } from './types';
import { uid, now } from './utils';

// ── persistence helpers ───────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw !== null ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function save<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore quota / disabled storage
	}
}

// ── sample structured spore (import seam demo) ────────────────────
// This is the stub for the garden-import-v1 parser handoff.
// The parser will hand off a GardenBlob-compatible structured Spore
// where the imported hierarchy lives in `data`. See §7 of the build doc.

export const SAMPLE_STRUCTURED_SPORE: Spore = {
	id: 'sample-structured',
	title: 'Discography: Grouper',
	body: 'A structured import — promote branches to Spores where you have something to say.',
	data: {
		_importSource: 'garden-import-v1-stub',
		branches: [
			{
				key: 'dragging-a-dead-deer',
				label: 'Dragging a Dead Deer Up a Hill',
				year: 2008,
				notes: 'The fog record. Reverb as shelter.'
			},
			{
				key: 'a-i-a',
				label: 'A I A',
				year: 2011,
				notes: 'Two discs: Alien Observer and Dream Loss.'
			},
			{
				key: 'ruins',
				label: 'Ruins',
				year: 2014,
				notes: 'Piano and voice, stripped to bone.'
			}
		]
	},
	spellbookIds: [],
	created: '2024-01-01T00:00:00.000Z',
	updated: '2024-01-01T00:00:00.000Z'
};

const DEFAULT_SETTINGS: GardenSettings = {};

export class GardenStore {
	// Persisted
	spores = $state<Spore[]>(load('spores.spores.v1', []));
	spellbooks = $state<Spellbook[]>(load('spores.spellbooks.v1', []));
	flights = $state<Flight[]>(load('spores.flights.v1', []));
	settings = $state<GardenSettings>({
		...DEFAULT_SETTINGS,
		...load('spores.settings.v1', {} as Partial<GardenSettings>)
	});

	// Transient navigation
	currentView = $state<GardenView>('garden');
	activeSpellbookId = $state<string | null>(null);
	activeSporeId = $state<string | null>(null);

	// Transient UI
	editingSporeId = $state<string | null>(null);
	showSyncPanel = $state(false);
	showNewSpellbook = $state(false);
	newSpellbookTitle = $state('');
	newSpellbookArchetype = $state<'plain' | 'diary' | 'media'>('plain');
	showAddFlight = $state(false);
	flightSearchQuery = $state('');

	// ── derived views ──────────────────────────────────────────────

	get activeSpellbook(): Spellbook | null {
		if (!this.activeSpellbookId) return null;
		return this.spellbooks.find((s) => s.id === this.activeSpellbookId) ?? null;
	}

	get activeSpore(): Spore | null {
		if (!this.activeSporeId) return null;
		return this.spores.find((s) => s.id === this.activeSporeId) ?? null;
	}

	sporesInSpellbook(spellbookId: string): Spore[] {
		return this.spores.filter((s) => s.spellbookIds.includes(spellbookId));
	}

	flightsTouchingSpore(sporeId: string): Flight[] {
		return this.flights.filter((f) => f.from === sporeId || f.to === sporeId);
	}

	linkedSpores(sporeId: string): Array<{ flight: Flight; spore: Spore }> {
		return this.flightsTouchingSpore(sporeId).flatMap((f) => {
			const otherId = f.from === sporeId ? f.to : f.from;
			const spore = this.spores.find((s) => s.id === otherId);
			return spore ? [{ flight: f, spore }] : [];
		});
	}

	get flightSearchResults(): Spore[] {
		if (!this.flightSearchQuery.trim()) return [];
		const q = this.flightSearchQuery.toLowerCase();
		return this.spores
			.filter((s) => s.id !== this.activeSporeId && s.title.toLowerCase().includes(q))
			.slice(0, 8);
	}

	// ── navigation ─────────────────────────────────────────────────

	openGarden(): void {
		this.currentView = 'garden';
		this.activeSpellbookId = null;
		this.activeSporeId = null;
		this.editingSporeId = null;
	}

	openSpellbook(id: string): void {
		this.activeSpellbookId = id;
		this.activeSporeId = null;
		this.currentView = 'spellbook';
		this.editingSporeId = null;
	}

	openSpore(id: string): void {
		this.activeSporeId = id;
		this.currentView = 'spore';
		this.editingSporeId = null;
		this.showAddFlight = false;
		this.flightSearchQuery = '';
	}

	// ── spellbook CRUD ──────────────────────────────────────────────

	addSpellbook(title: string, archetype: 'plain' | 'diary' | 'media' | string): Spellbook {
		const sb: Spellbook = {
			id: uid(),
			title: title.trim(),
			archetype,
			created: now(),
			updated: now()
		};
		this.spellbooks = [...this.spellbooks, sb];
		save('spores.spellbooks.v1', this.spellbooks);
		return sb;
	}

	updateSpellbook(id: string, changes: Partial<Pick<Spellbook, 'title' | 'archetype'>>): void {
		this.spellbooks = this.spellbooks.map((s) =>
			s.id === id ? { ...s, ...changes, updated: now() } : s
		);
		save('spores.spellbooks.v1', this.spellbooks);
	}

	deleteSpellbook(id: string): void {
		// Remove membership from all spores
		this.spores = this.spores.map((s) =>
			s.spellbookIds.includes(id)
				? { ...s, spellbookIds: s.spellbookIds.filter((sid) => sid !== id), updated: now() }
				: s
		);
		save('spores.spores.v1', this.spores);
		this.spellbooks = this.spellbooks.filter((s) => s.id !== id);
		save('spores.spellbooks.v1', this.spellbooks);
		if (this.activeSpellbookId === id) this.openGarden();
	}

	// ── spore CRUD ──────────────────────────────────────────────────

	addSpore(
		partial: Partial<Omit<Spore, 'id' | 'created' | 'updated'>> & { title: string }
	): Spore {
		const s: Spore = {
			id: uid(),
			title: partial.title.trim(),
			body: partial.body ?? '',
			data: partial.data ?? {},
			spellbookIds: partial.spellbookIds ?? [],
			created: now(),
			updated: now()
		};
		this.spores = [...this.spores, s];
		save('spores.spores.v1', this.spores);
		return s;
	}

	updateSpore(id: string, changes: Partial<Omit<Spore, 'id' | 'created'>>): void {
		this.spores = this.spores.map((s) =>
			s.id === id ? { ...s, ...changes, updated: now() } : s
		);
		save('spores.spores.v1', this.spores);
	}

	deleteSpore(id: string): void {
		this.spores = this.spores.filter((s) => s.id !== id);
		save('spores.spores.v1', this.spores);
		this.flights = this.flights.filter((f) => f.from !== id && f.to !== id);
		save('spores.flights.v1', this.flights);
		if (this.activeSporeId === id) {
			if (this.activeSpellbookId) this.currentView = 'spellbook';
			else this.openGarden();
		}
	}

	// ── membership ──────────────────────────────────────────────────

	addToSpellbook(sporeId: string, spellbookId: string): void {
		this.spores = this.spores.map((s) =>
			s.id === sporeId && !s.spellbookIds.includes(spellbookId)
				? { ...s, spellbookIds: [...s.spellbookIds, spellbookId], updated: now() }
				: s
		);
		save('spores.spores.v1', this.spores);
	}

	removeFromSpellbook(sporeId: string, spellbookId: string): void {
		this.spores = this.spores.map((s) =>
			s.id === sporeId
				? { ...s, spellbookIds: s.spellbookIds.filter((id) => id !== spellbookId), updated: now() }
				: s
		);
		save('spores.spores.v1', this.spores);
	}

	// ── flights ─────────────────────────────────────────────────────

	addFlight(fromId: string, toId: string, label?: string): Flight {
		const existing = this.flights.find(
			(f) =>
				(f.from === fromId && f.to === toId) || (f.from === toId && f.to === fromId)
		);
		if (existing) return existing;

		const f: Flight = { id: uid(), from: fromId, to: toId, created: now() };
		if (label) f.label = label;
		this.flights = [...this.flights, f];
		save('spores.flights.v1', this.flights);
		return f;
	}

	deleteFlight(id: string): void {
		this.flights = this.flights.filter((f) => f.id !== id);
		save('spores.flights.v1', this.flights);
	}

	// ── promote branch to Spore (import seam) ───────────────────────
	// Promotes a branch from a structured Spore's data.branches array
	// into its own Spore, linked back via a Line of Flight.
	// The parser (garden-import-v1) will hand off structured Spores in this shape.

	promoteBranch(
		parentSporeId: string,
		branchKey: string
	): Spore | null {
		const parent = this.spores.find((s) => s.id === parentSporeId);
		if (!parent) return null;

		const branches = parent.data.branches as Array<Record<string, unknown>> | undefined;
		if (!branches) return null;
		const branch = branches.find((b) => b.key === branchKey);
		if (!branch) return null;

		const label = typeof branch.label === 'string' ? branch.label : String(branchKey);
		const notes = typeof branch.notes === 'string' ? branch.notes : '';
		const { key: _key, label: _label, notes: _notes, ...rest } = branch;

		const promoted = this.addSpore({
			title: label,
			body: notes,
			data: rest,
			spellbookIds: [...parent.spellbookIds]
		});

		this.addFlight(parentSporeId, promoted.id, `branch: ${label}`);

		// Remove promoted branch from parent's data
		const remaining = branches.filter((b) => b.key !== branchKey);
		this.updateSpore(parentSporeId, {
			data: { ...parent.data, branches: remaining }
		});

		return promoted;
	}

	// ── rehydrate from sync ─────────────────────────────────────────

	rehydrate(blob: GardenBlob): void {
		this.spores = blob.spores;
		this.spellbooks = blob.spellbooks;
		this.flights = blob.flights;
		this.settings = { ...DEFAULT_SETTINGS, ...blob.settings };
		save('spores.spores.v1', this.spores);
		save('spores.spellbooks.v1', this.spellbooks);
		save('spores.flights.v1', this.flights);
		save('spores.settings.v1', this.settings);
	}

	// ── export ──────────────────────────────────────────────────────

	exportJSON(): string {
		const blob: GardenBlob = {
			spores: this.spores,
			spellbooks: this.spellbooks,
			flights: this.flights,
			settings: this.settings
		};
		return JSON.stringify(blob, null, 2);
	}

	downloadExport(): void {
		const json = this.exportJSON();
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		a.download = `spores-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
}

export const garden = new GardenStore();
