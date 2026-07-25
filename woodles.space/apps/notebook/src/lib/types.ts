/**
 * Notebook is the front door (CONVERGENCE.md §3): where a thought goes when
 * you don't yet know where it belongs. It holds one kind of thing.
 *
 * It used to hold three — notes, tasks, and ideas — behind three mode tabs, so
 * arriving with a thought meant answering "which of these is it?" before you
 * could type, which is exactly the decision the front door exists to remove.
 * Tasks moved to Carillon, where time lives; notes and ideas were always the
 * same gesture at different lengths, and are now both captures.
 */

/** Where a capture is in your head, not how finished it is. Optional triage. */
export type Lane = 'spark' | 'shape' | 'later';

export const LANES: Lane[] = ['spark', 'shape', 'later'];

export const LANE_LABEL: Record<Lane, string> = {
	spark: 'sparks',
	shape: 'shaping',
	later: 'later'
};

export type Capture = {
	id: string;
	/** May be empty — a thought does not owe you a title. */
	title: string;
	body: string;
	tags: string[];
	lane: Lane;
	createdAt: string;
	updatedAt: string;
};
