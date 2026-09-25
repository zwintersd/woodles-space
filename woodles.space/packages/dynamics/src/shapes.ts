// The taxonomy itself, as data.
//
// The thirteen shapes are already named in this package's README and again in
// every consumer's schema comments — which means they can drift, and did: the
// README's prose claimed eleven implemented modules against a table listing
// twelve. A registry plus `shapes.test.ts` makes that a test failure instead
// of a stale sentence.
//
// This is deliberately vocabulary only — no Marginalia instances, no content.
// A consumer says "this group of numbers is an instance of C"; the registry
// says what C *is*. That's the seam that lets a tuning instrument explain a
// world it knows nothing about in advance.

export type ShapeId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

export interface Shape {
	id: ShapeId;
	/** The shape's name, as the README table gives it. */
	name: string;
	/** What it does, in mechanism terms — one sentence, no jargon that isn't earned. */
	does: string;
	/**
	 * The module implementing it, or `null` for a shape that is a discipline
	 * rather than code. See the README's "Why M has no module".
	 */
	module: string | null;
}

export const SHAPES: Readonly<Record<ShapeId, Shape>> = Object.freeze({
	A: {
		id: 'A',
		name: 'Pool',
		does: 'A quantity that accumulates and is spent. Nothing else — no cap, no decay.',
		module: 'pool.ts'
	},
	B: {
		id: 'B',
		name: 'Eased Stat',
		does: 'A value that closes a fraction of the gap to its target each second, and so can never overshoot it.',
		module: 'easedStat.ts'
	},
	C: {
		id: 'C',
		name: 'Banded Stock',
		does: 'A value with a healthy range: free to settle anywhere inside it, pulled back only once it leaves.',
		module: 'bandedStock.ts'
	},
	D: {
		id: 'D',
		name: 'Decay + Coupled Accumulator',
		does: 'Something that fades when neglected and returns with attention, while a second, permanent value grows in proportion to how far it had slipped.',
		module: 'decayRestorePair.ts'
	},
	E: {
		id: 'E',
		name: 'Threshold Ladder',
		does: 'Banked progress crossing a series of rising thresholds, one rung at a time.',
		module: 'thresholdLadder.ts'
	},
	F: {
		id: 'F',
		name: 'Tally → Factor → Gated Accrual',
		does: 'A lifetime tally that never forgets, turned into a factor, which gates how fast a reward banks.',
		module: 'tallyFactorAccrual.ts'
	},
	G: {
		id: 'G',
		name: 'Capacity + Roster',
		does: 'A fixed number of slots, and the list of what currently occupies them.',
		module: 'capacityRoster.ts'
	},
	H: {
		id: 'H',
		name: 'Emergence Gate',
		does: 'Something hidden until every prerequisite it names is present.',
		module: 'emergenceGate.ts'
	},
	I: {
		id: 'I',
		name: 'Trigger → Grant / Override',
		does: 'A one-time crossing that grants something or overrides a coefficient, and never fires again.',
		module: 'trigger.ts'
	},
	J: {
		id: 'J',
		name: 'Manual Conversion',
		does: 'A deliberate exchange, available only when affordable: spend these, receive that.',
		module: 'manualConversion.ts'
	},
	K: {
		id: 'K',
		name: 'Combo Meter',
		does: 'Repeated acts inside a time window building a bounded multiplier, which resets on a gap.',
		module: 'comboMeter.ts'
	},
	L: {
		id: 'L',
		name: 'Edge Latch',
		does: 'Fires once when a condition becomes true, and rearms only after it goes false again.',
		module: 'edgeLatch.ts'
	},
	M: {
		id: 'M',
		name: 'Pure Derived View',
		does: 'Computed fresh from other primitives on every read, storing nothing.',
		module: null
	}
});

export const SHAPE_IDS: readonly ShapeId[] = Object.freeze(Object.keys(SHAPES) as ShapeId[]);

export function shape(id: ShapeId): Shape {
	return SHAPES[id];
}
