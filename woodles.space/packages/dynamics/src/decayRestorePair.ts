/**
 * Shape D — Decay-with-Restore, coupled to a sibling accumulator. Not one
 * stat but two, and the coupling *is* the mechanic:
 *
 *  - `primary` eases toward 1 while being restored, and decays toward 0
 *    otherwise — but its decay rate is throttled by `companion`, so a
 *    well-built companion makes primary forget more slowly.
 *  - `companion` only grows while primary is being restored, at a rate
 *    proportional to how large primary's own gap currently is. It never
 *    decays on its own.
 *
 * A caller with no coupling in mind — a plain decaying stat with a restore
 * button — can pass `companionGainRate: 0` and ignore `companion` entirely;
 * the shape degrades to ordinary decay-with-restore without deleting code.
 */

export interface DecayRestoreState {
	primary: number;
	companion: number;
}

export interface DecayRestoreOptions {
	/** Rate `primary` eases toward 1 at while restoring. */
	restoreRate: number;
	/** `primary`'s base decay rate, divided by `1 + companion` each step. */
	baseDecayRate: number;
	/** `companion`'s gain per second, scaled by primary's gap, while restoring. */
	companionGainRate: number;
	companionCap: number;
}

/** One step of being attended to: primary eases up, companion may grow. */
export function restore(state: DecayRestoreState, dt: number, opts: DecayRestoreOptions): DecayRestoreState {
	if (state.primary >= 1) return state;
	const gap = 1 - state.primary;
	const primary = Math.min(1, state.primary + gap * (1 - Math.exp(-opts.restoreRate * dt)));
	const companion = Math.min(opts.companionCap, state.companion + opts.companionGainRate * gap * dt);
	return { primary, companion };
}

/** One step of being left alone: primary decays, companion is untouched. */
export function decay(state: DecayRestoreState, dt: number, opts: DecayRestoreOptions): DecayRestoreState {
	if (state.primary <= 0) return state;
	const k = opts.baseDecayRate / (1 + state.companion);
	const primary = Math.max(0, state.primary * Math.exp(-k * dt));
	return { primary, companion: state.companion };
}
