// Version notes for the update modal. Newest first.
//
// CURRENT_VERSION should be bumped whenever a meaningful update lands. The
// modal auto-opens for any save whose `lastSeenVersion` is less than this.
//
// Comparison is alphabetical on the version string; pick lexicographically
// monotonic strings (v1.0 < v1.5 < v2.0 < v2.5 < v3.0 …). For minor patches
// inside a version, append a letter ("v3.0a") rather than relying on numeric
// comparison.

export interface UpdateNote {
	version: string;
	title: string;
	notes: string[];
}

export const updates: UpdateNote[] = [
	{
		version: 'v3.0',
		title: 'more hands in the margin',
		notes: [
			'three new previous readers join the dispute: the methodist, the marginal heretic, and the unlearned hand. each carries a different rhythm.',
			'the methodist beats time like clockwork. the heretic rains five fast disagreements then falls silent. the unlearned hand is slow and arrhythmic, but its accents land truer than they should.',
			'switch between hands in the dispute panel.',
			'two new contested passages: an epistle concerning doubt, and a rescript on the unwritten law.'
		]
	},
	{
		version: 'v2.5',
		title: 'the recitation',
		notes: [
			'a new séance over your own past reading. the recitation upgrade adopts the practice; invoke it to summon a fragment of your past clicks at exactly their original cadence.',
			'recite ≥ 80% in time and the past returns: apparatus and a remembered line in the canonical opening.',
			'remembered lines persist across prestige.'
		]
	},
	{
		version: 'v2.0',
		title: 'the contested passage',
		notes: [
			'a boss-style encounter. a famously disputed passage descends; helpful glyphs must be caught and corrupting ones dodged. survive intact and the passage joins your canonical citations.',
			'five contested passages drawn from patristic, gnostic, decretal, and apocryphal registers.',
			'unlocked by the contested-passage upgrade. five-minute cooldown between encounters.'
		]
	},
	{
		version: 'v1.5',
		title: 'the dispute',
		notes: [
			'two reading tracks. a previous reader marks the upper track in their own rhythm; you click in the lower track in agreement, disagreement, or counterpoint.',
			'each mode produces a different resource — commentaries, apparatus, recensions.'
		]
	},
	{
		version: 'v1.0',
		title: 'the reading pass',
		notes: [
			'the click button graduates. words drift past a vertical seam; click in time to annotate them.',
			'tight timing pays five times. luminous timing on a charged token pays twenty-five times and may produce a free commentary.'
		]
	},
	{
		version: 'v0.5',
		title: 'early-game scaffolding',
		notes: [
			'a chat panel pinned top-right where an unknown hand speaks across milestones.',
			'stray phrases drift through a strip below the click region — catch them for glosses.',
			'every twelve to twenty clicks, the next click is "charged" and weighs five times as much.'
		]
	}
];

export const CURRENT_VERSION = updates[0].version;

export function notesNewerThan(version: string | null): UpdateNote[] {
	if (!version) return updates;
	return updates.filter((u) => u.version > version);
}
