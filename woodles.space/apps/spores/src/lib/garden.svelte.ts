import type {
	Spore,
	Spellbook,
	Flight,
	GardenBlob,
	GardenSettings,
	GardenView,
	OnboardingStep
} from './types';
import type { Category } from './spells/types';
import { uid, now } from './utils';
import {
	tagCounts,
	addTag,
	removeTag,
	hasTag,
	normalizeTag,
	sameTag,
	cleanTags,
	type TagCount
} from './tags';

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

// Ensure every spore has a `tags` array (back-fill for data saved before tags).
function migrateSpores(spores: Spore[]): Spore[] {
	return spores.map((s) => (Array.isArray(s.tags) ? s : { ...s, tags: [] }));
}

function save<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore quota / disabled storage
	}
}

const DEFAULT_SETTINGS: GardenSettings = {};

export class GardenStore {
	// Persisted
	spores = $state<Spore[]>(migrateSpores(load('spores.spores.v1', [])));
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
	activeTag = $state<string | null>(null);
	// Where the spore view returns to (set when entering it from a list view).
	sporeReturnView = $state<Exclude<GardenView, 'spore'>>('garden');

	// Transient UI
	editingSporeId = $state<string | null>(null);
	showSyncPanel = $state(false);
	showNewSpellbook = $state(false);
	newSpellbookTitle = $state('');
	newSpellbookArchetype = $state<'plain' | 'diary' | 'media'>('plain');
	showAddFlight = $state(false);
	flightSearchQuery = $state('');

	// Spell wizard
	spellPrevView = $state<Exclude<GardenView, 'spell'>>('garden');

	// First-run onboarding (transient — the flag itself lives in settings.onboarded)
	showOnboarding = $state(false);
	onboardingStep = $state<OnboardingStep>('welcome');
	onboardingGrownSporeId = $state<string | null>(null);
	// Bumped to force the embedded wizard to remount at a chosen step (dev jumps).
	onboardingMountToken = $state(0);
	devMode = $state(false);

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
		this.activeTag = null;
		this.editingSporeId = null;
	}

	openSpellbook(id: string): void {
		this.activeSpellbookId = id;
		this.activeSporeId = null;
		this.activeTag = null;
		this.currentView = 'spellbook';
		this.editingSporeId = null;
	}

	openTag(tag: string): void {
		this.activeTag = tag;
		this.activeSpellbookId = null;
		this.activeSporeId = null;
		this.currentView = 'tag';
		this.editingSporeId = null;
	}

	openSpore(id: string): void {
		// Remember the list view to return to (but not when jumping spore→spore).
		if (this.currentView !== 'spore') {
			this.sporeReturnView = this.currentView as Exclude<GardenView, 'spore'>;
		}
		this.activeSporeId = id;
		this.currentView = 'spore';
		this.editingSporeId = null;
		this.showAddFlight = false;
		this.flightSearchQuery = '';
	}

	// Return from the spore view to wherever it was opened from.
	closeSpore(): void {
		this.activeSporeId = null;
		this.editingSporeId = null;
		if (this.sporeReturnView === 'spellbook' && this.activeSpellbookId) {
			this.currentView = 'spellbook';
		} else if (this.sporeReturnView === 'tag' && this.activeTag) {
			this.currentView = 'tag';
		} else {
			this.openGarden();
		}
	}

	openSpellWizard(): void {
		this.spellPrevView = this.currentView as Exclude<GardenView, 'spell'>;
		this.currentView = 'spell';
	}

	closeSpellWizard(): void {
		this.currentView = this.spellPrevView;
	}

	// ── first-run onboarding ────────────────────────────────────────
	// Trigger the guided first cast when the Garden is empty and the
	// user has never been onboarded. Never auto-fires once the flag is set.

	maybeStartOnboarding(): void {
		if (this.spores.length === 0 && this.settings.onboarded !== true) {
			this.onboardingStep = 'welcome';
			this.onboardingGrownSporeId = null;
			this.showOnboarding = true;
		}
	}

	setOnboardingStep(step: OnboardingStep): void {
		this.onboardingStep = step;
	}

	markOnboarded(): void {
		this.settings = { ...this.settings, onboarded: true };
		save('spores.settings.v1', this.settings);
	}

	completeOnboarding(): void {
		this.markOnboarded();
		this.showOnboarding = false;
		const grownId = this.onboardingGrownSporeId;
		if (grownId && this.spores.some((s) => s.id === grownId)) this.openSpore(grownId);
		else this.openGarden();
	}

	// Dev backdoor (see §7) — re-arm first-run and/or jump to any step.
	// Gated by garden.devMode, which is off unless explicitly enabled.

	resetOnboarding(clearSpores = false): void {
		this.settings = { ...this.settings, onboarded: false };
		save('spores.settings.v1', this.settings);
		if (clearSpores) {
			this.spores = [];
			save('spores.spores.v1', this.spores);
			this.flights = [];
			save('spores.flights.v1', this.flights);
		}
		this.onboardingGrownSporeId = null;
		this.onboardingStep = 'welcome';
		this.showOnboarding = true;
	}

	jumpToOnboardingStep(step: OnboardingStep): void {
		this.showOnboarding = true;
		this.onboardingStep = step;
		// Force the embedded wizard to remount so it lands on the matching step.
		this.onboardingMountToken++;
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
			tags: cleanTags(partial.tags ?? []),
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
		if (this.activeSporeId === id) this.closeSpore();
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

	// ── tags ────────────────────────────────────────────────────────

	// All tags across the Garden, with counts (case-insensitive grouping).
	get allTags(): TagCount[] {
		return tagCounts(this.spores);
	}

	get activeTagSpores(): Spore[] {
		return this.activeTag ? this.sporesWithTag(this.activeTag) : [];
	}

	sporesWithTag(tag: string): Spore[] {
		return this.spores.filter((s) => hasTag(s.tags, tag));
	}

	addSporeTag(sporeId: string, raw: string): void {
		this.spores = this.spores.map((s) =>
			s.id === sporeId ? { ...s, tags: addTag(s.tags, raw), updated: now() } : s
		);
		save('spores.spores.v1', this.spores);
	}

	removeSporeTag(sporeId: string, tag: string): void {
		this.spores = this.spores.map((s) =>
			s.id === sporeId ? { ...s, tags: removeTag(s.tags, tag), updated: now() } : s
		);
		save('spores.spores.v1', this.spores);
	}

	// Rename a tag across every spore that carries it.
	renameTag(from: string, to: string): void {
		const next = normalizeTag(to);
		if (!next || sameTag(from, next)) return;
		this.spores = this.spores.map((s) =>
			hasTag(s.tags, from)
				? { ...s, tags: addTag(removeTag(s.tags, from), next), updated: now() }
				: s
		);
		save('spores.spores.v1', this.spores);
		if (this.activeTag && sameTag(this.activeTag, from)) this.activeTag = next;
	}

	// Remove a tag from every spore that carries it.
	deleteTag(tag: string): void {
		this.spores = this.spores.map((s) =>
			hasTag(s.tags, tag) ? { ...s, tags: removeTag(s.tags, tag), updated: now() } : s
		);
		save('spores.spores.v1', this.spores);
		if (this.activeTag && sameTag(this.activeTag, tag)) this.openGarden();
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

	// ── import a parsed structured Spore ────────────────────────────

	importStructuredSpore(spore: Spore, spellbookIds: string[] = []): Spore {
		return this.addSpore({
			title: spore.title,
			body: spore.body,
			data: spore.data,
			spellbookIds
		});
	}

	// ── promote a child from import data to its own Spore ────────────
	// childArrayKey: the key in parent.data holding the child array (e.g. 'albums')
	// childIndex:    index within that array
	// prune:         if true, removes the child from the parent's array (default: additive)

	promoteChild(
		parentSporeId: string,
		childArrayKey: string,
		childIndex: number,
		opts?: { prune?: boolean }
	): Spore | null {
		const parent = this.spores.find((s) => s.id === parentSporeId);
		if (!parent) return null;

		const arr = parent.data[childArrayKey];
		if (!Array.isArray(arr) || childIndex >= arr.length) return null;

		const child = arr[childIndex] as Record<string, unknown>;
		const title =
			typeof child.title === 'string' && child.title.trim()
				? child.title.trim()
				: `${childArrayKey} ${childIndex + 1}`;

		const body =
			typeof child.bio === 'string' && child.bio !== 'unknown'
				? child.bio
				: typeof child.description === 'string' && child.description !== 'unknown'
					? child.description
					: '';

		const promoted = this.addSpore({
			title,
			body,
			data: child,
			spellbookIds: [...parent.spellbookIds],
			tags: [...parent.tags] // a promoted branch inherits the parent's tags
		});

		this.addFlight(parentSporeId, promoted.id, `${childArrayKey}: ${title}`);

		if (opts?.prune) {
			const newArr = (arr as unknown[]).filter((_, i) => i !== childIndex);
			this.updateSpore(parentSporeId, {
				data: { ...parent.data, [childArrayKey]: newArr }
			});
		}

		return promoted;
	}

	// ── custom category persistence ──────────────────────────────────

	addCustomCategory(cat: Category): void {
		const existing = this.settings.customCategories ?? [];
		this.settings = {
			...this.settings,
			customCategories: [...existing.filter((c) => c.id !== cat.id), cat]
		};
		save('spores.settings.v1', this.settings);
	}

	deleteCustomCategory(id: string): void {
		this.settings = {
			...this.settings,
			customCategories: (this.settings.customCategories ?? []).filter((c) => c.id !== id)
		};
		save('spores.settings.v1', this.settings);
	}

	// ── rehydrate from sync ─────────────────────────────────────────

	rehydrate(blob: GardenBlob): void {
		this.spores = migrateSpores(blob.spores);
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
