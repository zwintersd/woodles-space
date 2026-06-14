import type {
	Creature,
	BestiaryBlob,
	BestiarySettings,
	BestiaryView,
	SortKey,
	RarityFilter,
	DomainFilter
} from './types';
import { rarities, type Rarity } from './content/domains';
import type { CoreStat, Substat } from './content/stats';
import { uid, now, clampInt } from './utils';
import {
	blankCreature,
	isUntouched,
	filterCreatures,
	sortCreatures,
	rarityCounts,
	defaultStats
} from './collection';

// Older creatures in storage predate the stat block. Fill any missing
// structure with defaults so a pre-stats record loads cleanly.
function normalizeCreature(raw: Creature): Creature {
	return {
		...raw,
		stats: raw.stats ?? defaultStats()
	};
}

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

const CREATURES_KEY = 'bestiary.creatures.v1';
const SETTINGS_KEY = 'bestiary.settings.v1';

const DEFAULT_SETTINGS: BestiarySettings = { sort: 'recent' };

export class Bestiary {
	// Persisted
	creatures = $state<Creature[]>(load<Creature[]>(CREATURES_KEY, []).map(normalizeCreature));
	settings = $state<BestiarySettings>({
		...DEFAULT_SETTINGS,
		...load(SETTINGS_KEY, {} as Partial<BestiarySettings>)
	});

	// Transient navigation
	currentView = $state<BestiaryView>('collection');
	activeCreatureId = $state<string | null>(null);

	// Transient collection controls
	search = $state('');
	rarityFilter = $state<RarityFilter>('all');
	domainFilter = $state<DomainFilter>('all');

	// Transient UI
	showSyncPanel = $state(false);

	// ── derived views ──────────────────────────────────────────────

	get sort(): SortKey {
		return this.settings.sort ?? 'recent';
	}

	get activeCreature(): Creature | null {
		if (!this.activeCreatureId) return null;
		return this.creatures.find((c) => c.id === this.activeCreatureId) ?? null;
	}

	get total(): number {
		return this.creatures.length;
	}

	// Counts per rarity, for the collection's little census line.
	get rarityCounts(): Record<Rarity, number> {
		return rarityCounts(this.creatures);
	}

	get visibleCreatures(): Creature[] {
		const filtered = filterCreatures(this.creatures, {
			search: this.search,
			rarityFilter: this.rarityFilter,
			domainFilter: this.domainFilter
		});
		return sortCreatures(filtered, this.sort);
	}

	get hasActiveFilters(): boolean {
		return this.search.trim() !== '' || this.rarityFilter !== 'all' || this.domainFilter !== 'all';
	}

	// ── navigation ─────────────────────────────────────────────────

	openCollection(): void {
		// Sweep an abandoned blank before leaving the editor.
		if (this.activeCreatureId) this.discardIfUntouched(this.activeCreatureId);
		this.currentView = 'collection';
		this.activeCreatureId = null;
	}

	openEditor(id: string): void {
		this.activeCreatureId = id;
		this.currentView = 'editor';
	}

	setSort(sort: SortKey): void {
		this.settings = { ...this.settings, sort };
		save(SETTINGS_KEY, this.settings);
	}

	clearFilters(): void {
		this.search = '';
		this.rarityFilter = 'all';
		this.domainFilter = 'all';
	}

	// ── creature CRUD ──────────────────────────────────────────────

	// Summon a fresh card and drop straight into the editor.
	newCreature(): Creature {
		const c = blankCreature();
		this.creatures = [c, ...this.creatures];
		save(CREATURES_KEY, this.creatures);
		this.openEditor(c.id);
		return c;
	}

	updateCreature(id: string, changes: Partial<Omit<Creature, 'id' | 'created'>>): void {
		this.creatures = this.creatures.map((c) =>
			c.id === id ? { ...c, ...changes, updated: now() } : c
		);
		save(CREATURES_KEY, this.creatures);
	}

	setSprite(id: string, sprite: string, pixelated: boolean): void {
		this.updateCreature(id, { sprite, pixelated });
	}

	clearSprite(id: string): void {
		this.updateCreature(id, { sprite: null });
	}

	// ── stat mutations ─────────────────────────────────────────────
	// Setting a core changes the default its substats fall back to; it never
	// rewrites existing overrides. Substats are cleared explicitly by passing
	// null — the "reset to core" signal.

	setCoreStat(id: string, stat: CoreStat, value: number): void {
		const c = this.creatures.find((x) => x.id === id);
		if (!c) return;
		const v = clampInt(value, 0, 10);
		this.updateCreature(id, { stats: { ...c.stats, [stat]: v } });
	}

	setSubstat(id: string, sub: Substat, value: number | null): void {
		const c = this.creatures.find((x) => x.id === id);
		if (!c) return;
		const next = { ...c.stats.substats };
		if (value === null) delete next[sub];
		else next[sub] = clampInt(value, 0, 10);
		this.updateCreature(id, { stats: { ...c.stats, substats: next } });
	}

	// Copy a card as a new draft — handy for variants of one creature.
	duplicateCreature(id: string): Creature | null {
		const src = this.creatures.find((c) => c.id === id);
		if (!src) return null;
		const copy: Creature = {
			...src,
			id: uid(),
			name: src.name ? `${src.name} (variant)` : '',
			created: now(),
			updated: now()
		};
		this.creatures = [copy, ...this.creatures];
		save(CREATURES_KEY, this.creatures);
		return copy;
	}

	deleteCreature(id: string): void {
		this.creatures = this.creatures.filter((c) => c.id !== id);
		save(CREATURES_KEY, this.creatures);
		if (this.activeCreatureId === id) this.openCollection();
	}

	// Remove a card only if nothing was ever written into it.
	discardIfUntouched(id: string): void {
		const c = this.creatures.find((x) => x.id === id);
		if (c && isUntouched(c)) {
			this.creatures = this.creatures.filter((x) => x.id !== id);
			save(CREATURES_KEY, this.creatures);
		}
	}

	// ── rehydrate from sync ─────────────────────────────────────────

	rehydrate(blob: BestiaryBlob): void {
		this.creatures = blob.creatures.map(normalizeCreature);
		this.settings = { ...DEFAULT_SETTINGS, ...blob.settings };
		save(CREATURES_KEY, this.creatures);
		save(SETTINGS_KEY, this.settings);
	}

	// ── export ──────────────────────────────────────────────────────

	exportJSON(): string {
		const blob: BestiaryBlob = { creatures: this.creatures, settings: this.settings };
		return JSON.stringify(blob, null, 2);
	}

	downloadExport(): void {
		const json = this.exportJSON();
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		a.download = `bestiary-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
}

export const bestiary = new Bestiary();

// Re-export so components can pull the singleton and the rarity list together.
export { rarities };
