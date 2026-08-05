/**
 * The GameDef schema is the product. The editor edits it, the engine simulates
 * it, and (eventually) the player runs it. Nothing here may depend on the DOM,
 * on a UI framework, or on wall-clock time — this file is the contract all
 * three layers agree on, and it has to serialize to JSON without loss.
 */

export const SCHEMA_VERSION = 1;

/** Canvas coordinates. Kept out of the entities so layout never affects balance. */
export interface XY {
	x: number;
	y: number;
}

/**
 * How a number becomes text. Lives on the currency because the same magnitude
 * reads differently depending on what it counts — 1.23M petals, 1.23e45 atoms.
 */
export type Notation = 'plain' | 'thousands' | 'scientific' | 'letters';

export interface NumberFormat {
	decimalPlaces: number;
	notation: Notation;
}

export interface Currency {
	id: string;
	name: string;
	/** Emoji today; a sprite reference later. The schema leaves room, the MVP ships emoji. */
	symbol?: string;
	color: string;
	format: NumberFormat;
	/**
	 * Every time this currency is spent — a generator level, an upgrade buy —
	 * `rate × amount spent` is quietly added to `intoCurrencyId` as a
	 * byproduct. Applied wherever a wallet is actually debited, so nothing
	 * has to opt in per purchase; a currency with no `spendTax` behaves
	 * exactly as it always has.
	 */
	spendTax?: { intoCurrencyId: string; rate: number };
}

/**
 * Curves are structured rather than free-text expressions. `base × growth^n`
 * covers most real incrementals, and a parser is a rabbit hole the MVP doesn't
 * need. The union is open to extension — a `{ kind: 'expression' }` variant can
 * land later without breaking anything already authored.
 *
 * Every kind is normalized so that **level 1 evaluates to exactly `base`**.
 * That uniformity is what lets the inspector plot any curve against any other
 * and lets `baseRate` mean "output at level 1" no matter which kind is chosen.
 */
export type Curve =
	/** base × growth^(level − 1) — the workhorse, especially for costs. */
	| { kind: 'geometric'; growth: number }
	/** base + slope × (level − 1) */
	| { kind: 'linear'; slope: number }
	/** base × level^exponent — exponent 1 is the plain "N × base" generator. */
	| { kind: 'polynomial'; exponent: number }
	/** base × ∏ multipliers whose breakpoint level has been reached. */
	| { kind: 'steps'; breakpoints: CurveBreakpoint[] };

export interface CurveBreakpoint {
	/** 1-based level at which the multiplier starts applying. */
	level: number;
	multiplier: number;
}

export type CurveKind = Curve['kind'];

export interface Price {
	currencyId: string;
	/** Cost of the *first* level. Later levels come from `curve`. */
	base: number;
	curve: Curve;
}

export interface Generator {
	id: string;
	name: string;
	producesCurrencyId: string;
	/** Units per second at level 1, before any upgrade or prestige modifier. */
	baseRate: number;
	rateCurve: Curve;
	cost: Price;
	maxLevel?: number;
	/** Levels owned at game start — usually 0, though the first generator is often 1. */
	startsOwned?: number;
	/**
	 * An extra rate multiplier driven by a live count instead of this
	 * generator's own level: `rate × (1 + perUnit × count)`. Composes with
	 * `rateCurve` and every upgrade effect. The union is open to extension,
	 * the same way `Curve` is.
	 */
	populationBoost?: PopulationBoost;
	/**
	 * Turns this generator into a converter: `baseRate` / `rateCurve` / every
	 * modifier still set the *ceiling*, but actual output each tick is
	 * throttled to whatever `fromCurrencyId` can currently supply — a
	 * converter with nothing to convert produces nothing, however fast its
	 * curve says it could. Never produces more than the curve allows, only
	 * ever less.
	 */
	converts?: Conversion;
	/**
	 * Free-text labels an author hangs on this generator — no meaning to the
	 * engine except as something `PopulationBoost`'s `taggedLevelSum` metric
	 * (and the matching `Condition` metric) can sum across. See `Upgrade.tags`
	 * and `PrestigeLayer.tags`.
	 */
	tags?: string[];
}

export type PopulationBoost =
	| {
			/** Owned upgrades currently sitting unequipped — see `Upgrade` effects. */
			metric: 'unequippedUpgrades';
			perUnit: number;
	  }
	| {
			/**
			 * The summed *level* of every generator, upgrade and prestige layer
			 * carrying `tag` — a generator's level, an upgrade's level, a
			 * prestige layer's reset count. Deliberately not restricted to one
			 * entity kind: a tag is the designer's own grouping, not the
			 * engine's, so the aggregation has to cross kinds to mean anything.
			 */
			metric: 'taggedLevelSum';
			tag: string;
			perUnit: number;
	  };

export interface Conversion {
	fromCurrencyId: string;
	/** Units of `fromCurrencyId` consumed per unit of this generator's own output. */
	ratio: number;
}

/**
 * What an upgrade does when owned *and equipped*. `value` is applied **once
 * per owned level**, so a repeatable upgrade at level 3 applies its effect
 * three times — but an owned upgrade the player has unequipped contributes
 * nothing at all, as if it weren't owned, until it's equipped again. See
 * `SimState.upgrades[id].equipped` and the `equipUpgrade` / `unequipUpgrade`
 * actions.
 *
 * The two ops are deliberately literal, because a balance tool that fudges
 * arithmetic is worse than useless:
 *   - `add` contributes `value × level` to the stat.
 *   - `mul` multiplies the stat by `value ** level`.
 *
 * So "+50% output per level" is `{ op: 'mul', value: 1.5 }`, and a flat
 * "+10/sec" is `{ op: 'add', value: 10 }`.
 */
export interface Effect {
	target: EffectTarget;
	stat: EffectStat;
	op: 'add' | 'mul';
	value: number;
}

export type EffectTarget =
	| { type: 'generator'; id: string }
	/** Every generator producing this currency. */
	| { type: 'currency'; id: string }
	/** Everything. */
	| { type: 'global' };

export type EffectStat = 'rate' | 'critChance' | 'costScale';

export interface Upgrade {
	id: string;
	name: string;
	description?: string;
	cost: { currencyId: string; amount: number };
	/** Omit for a one-shot upgrade. */
	repeatable?: { maxLevel: number; costCurve: Curve };
	effects: Effect[];
	/** Hidden from the shop until true. Default: always visible. */
	visibleWhen?: Condition;
	/** Visible but not buyable until true, e.g. "requires Golden Touch level 10". */
	purchasableWhen?: Condition;
	/** See `Generator.tags`. */
	tags?: string[];
}

export interface PrestigeLayer {
	id: string;
	name: string;
	/** The currency this layer awards. */
	currencyId: string;
	gainFormula: PrestigeGain;
	/**
	 * Each unit held contributes `perUnit` to a production multiplier of
	 * `1 + perUnit × units` — so 145 units at 0.01 reads ×2.45.
	 */
	multiplier: { perUnit: number };
	/** Entity ids wiped on prestige: currencies, generators, upgrades. */
	resets: string[];
	availableWhen?: Condition;
	/**
	 * See `Generator.tags`. A layer's contribution to `taggedLevelSum` is its
	 * reset *count* — resets never zero it the way a currency or generator
	 * reset does, so a tagged layer only ever adds to the sum, prestige over
	 * prestige.
	 */
	tags?: string[];
}

export interface PrestigeGain {
	/** Measured against *lifetime* earnings, so spending doesn't cost you prestige. */
	sourceCurrencyId: string;
	threshold: number;
	exponent: number;
}

export interface Unlock {
	id: string;
	name: string;
	/** Entity ids hidden until `when` holds. Revealing is sticky — a reset can't re-hide. */
	reveals: string[];
	when: Condition;
}

export interface Milestone {
	id: string;
	name: string;
	when: Condition;
	/**
	 * No mechanical effect in the MVP. It exists so the log has celebration
	 * points and so balance runs have named measuring posts.
	 */
}

/**
 * Structured predicates, for the same reason curves are structured: a
 * condition you can render as a form and reason about statically beats one you
 * have to parse.
 */
export type Condition =
	| { metric: 'currencyAmount' | 'currencyLifetime'; currencyId: string; op: CompareOp; value: number }
	| { metric: 'generatorLevel'; generatorId: string; op: '>=' | '>'; value: number }
	/**
	 * Owned at least `level` times; `level` defaults to 1, so the plain
	 * `{ metric: 'upgradeOwned', upgradeId }` form still means "owned at all".
	 *
	 * The optional level is the one place this schema goes past the build
	 * spec's literal union, and it does so because the spec's own worked
	 * example — `purchasableWhen: "requires Golden Touch level 10"` — is
	 * otherwise inexpressible. Repeatable upgrades need a level test the way
	 * generators do.
	 */
	| { metric: 'upgradeOwned'; upgradeId: string; level?: number }
	| { metric: 'prestigeCount'; layerId: string; op: '>='; value: number }
	/** Owned upgrades currently sitting unequipped, across the whole def. */
	| { metric: 'unequippedUpgrades'; op: CompareOp; value: number }
	/** The summed level of every generator, upgrade and prestige layer tagged `tag`. */
	| { metric: 'taggedLevelSum'; tag: string; op: CompareOp; value: number }
	| { all: Condition[] }
	| { any: Condition[] };

export type CompareOp = '>=' | '>' | '<' | '<=';

/** A freeform canvas annotation — the mockup's "Balance Note". */
export interface StickyNote {
	id: string;
	text: string;
	position: XY;
	/** Optional accent token so a note can be colour-coded by concern. */
	color?: string;
}

export interface GameDef {
	schemaVersion: typeof SCHEMA_VERSION;
	meta: { id: string; title: string; description?: string };
	currencies: Currency[];
	generators: Generator[];
	upgrades: Upgrade[];
	prestigeLayers: PrestigeLayer[];
	unlocks: Unlock[];
	milestones: Milestone[];
	notes: StickyNote[];
	/** Node positions keyed by entity id. Editor-owned; the engine ignores it. */
	layout: Record<string, XY>;
}

/** Every entity kind that can own an id, a node on the canvas, and a layout entry. */
export type EntityKind = 'currency' | 'generator' | 'upgrade' | 'prestige' | 'unlock' | 'milestone';

export type Entity = Currency | Generator | Upgrade | PrestigeLayer | Unlock | Milestone;
