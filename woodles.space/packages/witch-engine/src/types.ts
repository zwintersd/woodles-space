/**
 * The content shapes `MarginaliaDef` and `World` are built from. This is the
 * schema half of Marginalia's content — plain interfaces, no data — the same
 * split `@woodles/incremental-core`'s `types.ts` draws for `Currency`,
 * `Generator`, and the rest: the engine owns the shape, an app owns the
 * words.
 *
 * Marginalia's own `apps/marginalia/src/lib/witch/content/*` files hold the
 * actual World 1 data (the life roster, the conditions, the flavor text) and
 * re-export these types rather than redefining them, so nothing downstream
 * had to change when the types moved here.
 */

export type StockId = 'nutrients' | 'oxygen' | 'moisture';
export type Stocks = Record<StockId, number>;
/** A sparse per-stock effect (metabolism) — only the stocks a life touches. */
export type StockVector = Partial<Record<StockId, number>>;
/** A healthy band [lo, hi] per stock a life depends on. */
export type Needs = Partial<Record<StockId, [number, number]>>;

export type LifeCategory = 'aquatic' | 'terrestrial' | 'atmospheric';
export type LifeDomain = 'plant' | 'animal' | 'ecosystem' | 'geology' | 'weather';

export interface Life {
	id: string;
	name: string;
	scientificName: string;
	category: LifeCategory;
	domain: LifeDomain;
	/** Every id in here must be a written `Condition` for this life to emerge. */
	requires: string[];
	/** How much Insight this life yields once witnessed, at full stage/vitality. */
	insightWeight: number;
	/** How quickly attention deepens here. >1 is quick to know, <1 is slow but usually richer. */
	studyEase: number;
	/** Per-second effect on each stock at full activity and vitality. Omitted = metabolically inert. */
	metabolism?: StockVector;
	/** Healthy bands on the stocks this life depends on. */
	needs?: Needs;
	notice: string;
	observe: string;
	study: string;
	know: string;
}

export interface Condition {
	id: string;
	phrase: string;
	name: string;
	enables: string;
	/** Essence. */
	cost: number;
}

export interface Emergence {
	id: string;
	name: string;
	/** Both conditions must be written for this to surface. */
	from: [string, string];
	note: string;
}

export interface Intervention {
	domain: LifeDomain;
	verb: string;
	reach: 'broad' | 'targeted' | 'narrow';
	permanence: 'temporary' | 'lasting' | 'permanent';
	/** invoke: asked, not commanded — the outcome varies. */
	uncertain?: boolean;
	cost: { insight: number; essence: number };
	lines: string[];
}

/** A named scene: a distinct stock/roster configuration, entered one at a time. */
export type Worldspace = 'water' | 'shallows';
