// The tuning instrument's working state: World 1's numbers, editable, with
// `world1Def` always reachable underneath as the thing being compared
// against. Nothing here touches content (life/conditions/interventions/
// worldspaces/fieldNotes) — this is a *tuning* instrument, not an authoring
// one, so only the twelve numeric groups `MarginaliaDef` defines are here.

import { world1Def, type MarginaliaDef } from '@woodles/witch-engine';
// `tuningFields` imports only *types* back from this module, so this is a
// one-directional runtime dependency, not a cycle.
import { TUNING_GROUPS, setFieldValue } from './tuningFields';

export type TuningGroupKey =
	| 'stage'
	| 'stock'
	| 'vitality'
	| 'favor'
	| 'recall'
	| 'recallYield'
	| 'attention'
	| 'restraint'
	| 'interventionEffects'
	| 'insightSinks'
	| 'progress'
	| 'focus';

/** The twelve groups as a def declares them — readonly, because a def is a spec. */
export type TuningGroupsSource = Pick<MarginaliaDef, TuningGroupKey>;

/**
 * Homomorphic, so arrays stay arrays and `[number, number]` bands stay
 * two-tuples; `-readonly` is the whole point. Sound only because the tuning
 * groups are guaranteed plain data — no functions to mangle, which is also
 * what lets `.def` cross a `postMessage` to the balance worker.
 */
type DeepMutable<T> = T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } : T;

/**
 * The editable working copy. A def's arrays are `readonly` because a def is a
 * specification; this is the thing being *edited*, so it says so — rather than
 * leaving `setFieldValue` to write through a cast into something typed as
 * immutable.
 */
export type TuningGroups = DeepMutable<TuningGroupsSource>;

export const TUNING_GROUP_KEYS: readonly TuningGroupKey[] = [
	'stage',
	'stock',
	'vitality',
	'favor',
	'recall',
	'recallYield',
	'attention',
	'restraint',
	'interventionEffects',
	'insightSinks',
	'progress',
	'focus'
];

/**
 * A deliberate, explicit clone — every leaf touched by a real property read
 * (spread, not `structuredClone`) so that calling this from inside a
 * `$derived`/`$effect` against a reactive `$state` source registers Svelte's
 * fine-grained dependency on every field, not just the twelve group
 * references. Called on plain (non-reactive) sources too, where that's just
 * a normal deep copy.
 */
export function cloneTuningGroups(source: TuningGroupsSource): TuningGroups {
	return {
		stage: {
			seconds: [...source.stage.seconds],
			insightMult: [...source.stage.insightMult],
			activity: [...source.stage.activity],
			lookCloserSeconds: source.stage.lookCloserSeconds
		},
		stock: {
			bands: {
				nutrients: [...source.stock.bands.nutrients],
				oxygen: [...source.stock.bands.oxygen],
				moisture: [...source.stock.bands.moisture]
			},
			driftPerSec: source.stock.driftPerSec,
			leak: { ...source.stock.leak },
			start: source.stock.start,
			neutral: source.stock.neutral,
			bandFalloff: source.stock.bandFalloff
		},
		vitality: { ...source.vitality },
		favor: { ...source.favor, multiplier: { ...source.favor.multiplier } },
		recall: { ...source.recall },
		recallYield: { ...source.recallYield },
		attention: { start: source.attention.start, costs: [...source.attention.costs] },
		restraint: { loadWeight: { ...source.restraint.loadWeight }, loadFull: source.restraint.loadFull, minFactor: source.restraint.minFactor },
		interventionEffects: { ...source.interventionEffects },
		insightSinks: { ...source.insightSinks },
		progress: { ...source.progress },
		focus: { ...source.focus }
	};
}

export const TUNING_STORAGE_KEY = 'grimoire:tuning:v1';

/** Private mode and blocked site-data both throw on mere access, not just on write. */
function ambientStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export class TuningState {
	groups = $state(cloneTuningGroups(world1Def));

	#storage: Storage | null;

	constructor(storage: Storage | null = ambientStorage()) {
		this.#storage = storage;
		const restored = this.#restore();
		if (restored) this.groups = restored;
	}

	/**
	 * Rebuild from a saved payload *through the field schema* rather than
	 * trusting the blob: start from World 1 and apply only the paths the panel
	 * currently declares, and only where the saved value is a finite number.
	 * A payload from an older schema — renamed field, dropped knob, hand-edited
	 * nonsense — degrades to World 1's value for whatever no longer fits,
	 * instead of loading a def that can't be simulated.
	 */
	#restore(): TuningGroups | null {
		if (!this.#storage) return null;
		let raw: string | null;
		try {
			raw = this.#storage.getItem(TUNING_STORAGE_KEY);
		} catch {
			return null;
		}
		if (!raw) return null;

		let saved: unknown;
		try {
			saved = JSON.parse(raw);
		} catch {
			return null;
		}
		if (!saved || typeof saved !== 'object') return null;

		const groups = cloneTuningGroups(world1Def);
		for (const field of TUNING_GROUPS.flatMap((g) => g.fields)) {
			let cur: unknown = (saved as Record<string, unknown>)[field.group];
			for (const key of field.path) {
				if (!cur || typeof cur !== 'object') {
					cur = undefined;
					break;
				}
				cur = (cur as Record<string | number, unknown>)[key];
			}
			if (typeof cur === 'number' && Number.isFinite(cur)) setFieldValue(groups, field, cur);
		}
		return groups;
	}

	/**
	 * Called from an effect on every edit. An unmodified panel clears the key
	 * rather than storing a copy of the shipped numbers, so a visitor who has
	 * changed nothing leaves nothing behind.
	 */
	save(): void {
		if (!this.#storage) return;
		try {
			if (this.isModified) this.#storage.setItem(TUNING_STORAGE_KEY, this.signature);
			else this.#storage.removeItem(TUNING_STORAGE_KEY);
		} catch {
			// Quota, private mode, blocked site data. A lost draft is not worth
			// breaking the instrument over.
		}
	}

	/** World 1's content, with these tuning numbers substituted in. */
	get def(): MarginaliaDef {
		return { ...world1Def, ...cloneTuningGroups(this.groups) };
	}

	/**
	 * A value-identity for the current numbers. Reading it registers a
	 * dependency on every field, so a `$derived` over it re-evaluates on any
	 * edit — which is how a finished balance run knows it has been superseded.
	 */
	get signature(): string {
		return JSON.stringify(this.groups);
	}

	resetGroup<K extends TuningGroupKey>(key: K): void {
		// world1Def is plain, non-reactive data — an ordinary deep copy here,
		// not the read-triggering clone `.def` needs.
		this.groups[key] = structuredClone(world1Def[key]) as TuningGroups[K];
	}

	resetAll(): void {
		this.groups = cloneTuningGroups(world1Def);
	}

	isGroupModified(key: TuningGroupKey): boolean {
		return JSON.stringify(this.groups[key]) !== JSON.stringify(world1Def[key]);
	}

	/** Whether anything at all differs from World 1's shipped numbers. */
	get isModified(): boolean {
		return TUNING_GROUP_KEYS.some((key) => this.isGroupModified(key));
	}
}
