import type {
	Creature,
	BestiaryBlob,
	BestiarySettings,
	BestiaryView,
	SortKey,
	RarityFilter,
	DomainFilter,
	WorkshopPrefs
} from './types';
import { rarities, type Rarity } from './content/domains';
import type { CoreStat, Substat } from './content/stats';
import { migrateComposition, type Composition } from './composer';
import { normalizeCardStyle, defaultCardStyle, type CardStyle } from './cardstyle';
import { uid, now, clampInt, clampStatus } from './utils';
import {
	blankCreature,
	isUntouched,
	filterCreatures,
	sortCreatures,
	rarityCounts,
	defaultStats
} from './collection';
import { seedCreatures } from './seed';
import { idbAvailable, idbGet, idbSet } from './idb';

// Older creatures in storage predate the stat block (and, later, the studio
// composition). Fill any missing structure so an old record loads cleanly, and
// coerce a stored composition through its migration so a malformed blob can't
// crash the editor.
function normalizeCreature(raw: Creature): Creature {
	return {
		...raw,
		stats: raw.stats ?? defaultStats(),
		status: raw.status ?? {},
		composition: raw.composition ? migrateComposition(raw.composition) : null,
		cardStyle: raw.cardStyle ? normalizeCardStyle(raw.cardStyle) : null,
		isolatedSprite: raw.isolatedSprite ?? null
	};
}

// ── persistence helpers ───────────────────────────────────────────
// Settings are tiny and never overflow, so they stay in localStorage (and stay
// synchronous, so the sort is right on first paint). Creatures carry the heavy
// art and live in IndexedDB — see idb.ts and the store's hydrate/persist below.

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

// The workshop opens roomy, hint-lit, and gently alive — but every one of these
// is a knob the player can turn, and the choice is remembered.
const DEFAULT_WORKSHOP: WorkshopPrefs = {
	railCollapsed: false,
	panelCollapsed: false,
	cardSize: 'roomy',
	showHints: true,
	calm: false,
	reduceMotion: false
};

export class Bestiary {
	// Persisted. Creatures load asynchronously from IndexedDB (see hydrate());
	// `ready` flips true once that first read lands, so the UI can hold the
	// empty-state until we actually know the shelf is empty.
	creatures = $state<Creature[]>([]);
	ready = $state(false);
	settings = $state<BestiarySettings>({
		...DEFAULT_SETTINGS,
		...load(SETTINGS_KEY, {} as Partial<BestiarySettings>)
	});

	// Resolves when the initial IDB load (or seed) is complete. External
	// callers that must not race with hydration (e.g. sync) should await this.
	readonly readyPromise: Promise<void>;
	#resolveReady: () => void = () => {};

	// Persistence bookkeeping. Until the initial load lands we don't write, so a
	// stray early mutation can't clobber stored cards. Writes coalesce: a rapid
	// burst of edits keeps only the latest snapshot, and the drain loop always
	// persists the most recent one (last write wins).
	#hydrated = false;
	#pendingWrite: Creature[] | null = null;
	#writing = false;

	constructor() {
		this.readyPromise = new Promise<void>((resolve) => {
			this.#resolveReady = resolve;
		});
		void this.#hydrate();
	}

	// Load creatures from IndexedDB, migrating any cards that fit in the old
	// localStorage slot on first run. Anything created before this resolves
	// (a brief race) is merged in rather than dropped.
	async #hydrate(): Promise<void> {
		let loaded: Creature[] = [];
		if (idbAvailable()) {
			try {
				let stored = await idbGet<Creature[]>(CREATURES_KEY);
				if (stored === undefined) {
					// One-time migration of whatever survived in localStorage.
					const legacy = load<Creature[]>(CREATURES_KEY, []);
					if (legacy.length) {
						await idbSet(CREATURES_KEY, legacy);
						try {
							localStorage.removeItem(CREATURES_KEY);
						} catch {
							// ignore — freeing the old slot is a nicety, not required
						}
						stored = legacy;
					}
				}
				loaded = stored ?? [];
			} catch (err) {
				console.error('[bestiary] could not read creatures from IndexedDB', err);
				// Best effort: fall back to anything still in localStorage.
				loaded = load<Creature[]>(CREATURES_KEY, []);
			}
		} else {
			loaded = load<Creature[]>(CREATURES_KEY, []);
		}

		// A sync rehydrate may have set authoritative state while we were reading;
		// if so, don't clobber it or merge stale local cards back in.
		if (this.#hydrated) return;

		// Seed with initial creatures if the bestiary is empty
		if (loaded.length === 0) {
			loaded = seedCreatures();
		}

		const normalized = loaded.map(normalizeCreature);
		const seen = new Set(this.creatures.map((c) => c.id));
		this.creatures = [...this.creatures, ...normalized.filter((c) => !seen.has(c.id))];
		this.#hydrated = true;
		this.ready = true;
		this.#resolveReady();
		// Seed IDB with the merged result (and persist any pre-hydrate edits).
		this.#persistCreatures();
	}

	// Schedule a write of the current creatures to IndexedDB. Coalesces bursts
	// and serializes writes so the latest snapshot always wins.
	#persistCreatures(): void {
		if (!this.#hydrated) return;
		// $state proxies aren't structured-cloneable; snapshot to a plain copy.
		this.#pendingWrite = $state.snapshot(this.creatures) as Creature[];
		void this.#drainWrites();
	}

	async #drainWrites(): Promise<void> {
		if (this.#writing || !idbAvailable()) return;
		this.#writing = true;
		try {
			while (this.#pendingWrite) {
				const next = this.#pendingWrite;
				this.#pendingWrite = null;
				try {
					await idbSet(CREATURES_KEY, next);
				} catch (err) {
					console.error('[bestiary] could not persist creatures to IndexedDB', err);
				}
			}
		} finally {
			this.#writing = false;
		}
	}

	// Transient navigation
	currentView = $state<BestiaryView>('collection');
	activeCreatureId = $state<string | null>(null);

	// Transient collection controls
	search = $state('');
	rarityFilter = $state<RarityFilter>('all');
	domainFilter = $state<DomainFilter>('all');

	// Transient UI
	showSyncPanel = $state(false);
	showComfort = $state(false);

	// ── derived views ──────────────────────────────────────────────

	get sort(): SortKey {
		return this.settings.sort ?? 'recent';
	}

	// Workshop layout & comfort, merged over the defaults so a partial (or older)
	// stored blob still reads as a complete set of preferences.
	get workshop(): WorkshopPrefs {
		return { ...DEFAULT_WORKSHOP, ...this.settings.workshop };
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

	// Patch one or more workshop preferences and remember the choice.
	setWorkshop(patch: Partial<WorkshopPrefs>): void {
		this.settings = { ...this.settings, workshop: { ...this.workshop, ...patch } };
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
		this.#persistCreatures();
		this.openEditor(c.id);
		return c;
	}

	updateCreature(id: string, changes: Partial<Omit<Creature, 'id' | 'created'>>): void {
		this.creatures = this.creatures.map((c) =>
			c.id === id ? { ...c, ...changes, updated: now() } : c
		);
		this.#persistCreatures();
	}

	setSprite(id: string, sprite: string, pixelated: boolean): void {
		// A plain upload replaces any studio composition — the two are one slot.
		this.updateCreature(id, { sprite, pixelated, composition: null });
	}

	// Commit studio art: the flattened composite becomes the sprite, the layer
	// stack rides along so the studio can reopen exactly where it left off.
	// Composited art is smooth, so the pixelated card flag is cleared.
	// isolatedSprite is the creature-only crop for Marginalia; null if no
	// creature layers were present in the composition.
	setComposition(
		id: string,
		composition: Composition,
		flattened: string,
		isolatedSprite: string | null
	): void {
		this.updateCreature(id, { sprite: flattened, composition, pixelated: false, isolatedSprite });
	}

	clearSprite(id: string): void {
		this.updateCreature(id, { sprite: null, composition: null });
	}

	// ── card look ──────────────────────────────────────────────────
	// cardStyle is null until the card is dressed; mutations seed it from the
	// default so the first edit starts from the house frame.

	setCardStyle(id: string, style: CardStyle): void {
		this.updateCreature(id, { cardStyle: style });
	}

	updateCardStyle(id: string, changes: Partial<CardStyle>): void {
		const c = this.creatures.find((x) => x.id === id);
		if (!c) return;
		this.updateCreature(id, { cardStyle: { ...(c.cardStyle ?? defaultCardStyle()), ...changes } });
	}

	resetCardStyle(id: string): void {
		this.updateCreature(id, { cardStyle: null });
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

	// ── status conditions ──────────────────────────────────────────
	// Set one keyed status intensity (e.g. cold) on a creature, clamped to
	// 0–10. Zero is "no longer afflicted", so the key is dropped to keep the map
	// clean. No UI wires here yet — the card overlay reads `status.cold`, and
	// this is the tidy door future benches (burning, cursed…) will call.

	setStatus(id: string, key: string, value: number): void {
		const c = this.creatures.find((x) => x.id === id);
		if (!c) return;
		const v = clampStatus(value);
		const status = { ...(c.status ?? {}) };
		if (v === 0) delete status[key];
		else status[key] = v;
		this.updateCreature(id, { status });
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
		this.#persistCreatures();
		return copy;
	}

	deleteCreature(id: string): void {
		this.creatures = this.creatures.filter((c) => c.id !== id);
		this.#persistCreatures();
		if (this.activeCreatureId === id) this.openCollection();
	}

	// Remove a card only if nothing was ever written into it.
	discardIfUntouched(id: string): void {
		const c = this.creatures.find((x) => x.id === id);
		if (c && isUntouched(c)) {
			this.creatures = this.creatures.filter((x) => x.id !== id);
			this.#persistCreatures();
		}
	}

	// ── rehydrate from sync ─────────────────────────────────────────

	rehydrate(blob: BestiaryBlob): void {
		this.creatures = blob.creatures.map(normalizeCreature);
		this.settings = { ...DEFAULT_SETTINGS, ...blob.settings };
		// Synced data is authoritative — mark hydration done so the write lands
		// and the in-flight local load (if any) steps aside.
		this.#hydrated = true;
		this.ready = true;
		this.#resolveReady();
		this.#persistCreatures();
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
