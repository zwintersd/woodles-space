// The shapes of cold. Given a creature's seeded PRNG and the art window's box,
// this paints two families of SVG path strings:
//
//   · borderPaths — frost crystals growing *inward* from the four edges of the
//     art frame (tier 2, cold 3–6).
//   · crackPaths  — fracture lines radiating *outward* from the art's corners
//     into the surrounding card (tier 3, cold 6–10), as if the frame were a
//     pane of ice that split.
//
// Both share one PRNG stream, so a creature's frost and its cracks belong to
// the same fingerprint. Output is plain `d` strings — jagged `M … L … L …`
// polylines, no curves, because jagged reads as crystalline. Coordinates are in
// the art window's own pixel space (0,0 at its top-left); cracks deliberately
// run negative / past the far edge, and the overlay lets them spill.
//
// Pure and DOM-free: hand it any PRNG and a `{ width, height }` box and it is
// fully deterministic, so it can be unit-tested on its own.

type Pt = { x: number; y: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
// one decimal is plenty of precision for a crystal, and keeps the `d` tidy.
const fmt = (n: number) => Math.round(n * 10) / 10;

// Grow one jagged branch from `start`, heading roughly along `angle`, spanning
// `length`. The branch wanders a little each segment; while `depth` remains it
// spawns shorter sub-branches that veer ±15–45° off the parent. Each finished
// polyline is pushed onto `out`.
function growBranch(
	rng: () => number,
	start: Pt,
	angle: number,
	length: number,
	depth: number,
	out: string[]
): void {
	const segs = 3 + Math.floor(rng() * 3); // 3–5 segments
	let p = start;
	let a = angle;
	let d = `M ${fmt(p.x)} ${fmt(p.y)}`;
	const joints: Pt[] = [p];
	for (let i = 0; i < segs; i++) {
		const segLen = (length / segs) * (0.75 + rng() * 0.5);
		a += rad((rng() - 0.5) * 22); // wander ±11° per segment
		p = { x: p.x + Math.cos(a) * segLen, y: p.y + Math.sin(a) * segLen };
		d += ` L ${fmt(p.x)} ${fmt(p.y)}`;
		joints.push(p);
	}
	out.push(d);

	if (depth <= 0) return;
	const branches = 1 + Math.floor(rng() * 2); // 1–2 sub-branches
	for (let i = 0; i < branches; i++) {
		const j = 1 + Math.floor(rng() * (joints.length - 1)); // skip the root joint
		const side = rng() < 0.5 ? -1 : 1;
		const dev = rad(15 + rng() * 30) * side; // ±15–45° off the parent
		growBranch(rng, joints[j], angle + dev, length * (0.4 + rng() * 0.2), depth - 1, out);
	}
}

// Tier 2: frost inward from every edge. Each edge sends 3–5 main branches in
// along its perpendicular, `reach` deciding how far inward they grow.
function edgeFrost(rng: () => number, w: number, h: number, reach: number, out: string[]): void {
	const edges = [
		{ horizontal: true, along: w, perp: h, fixed: 0, inward: rad(90) }, // top → down
		{ horizontal: true, along: w, perp: h, fixed: h, inward: rad(-90) }, // bottom → up
		{ horizontal: false, along: h, perp: w, fixed: 0, inward: rad(0) }, // left → right
		{ horizontal: false, along: h, perp: w, fixed: w, inward: rad(180) } // right → left
	];
	for (const e of edges) {
		const n = 3 + Math.floor(rng() * 3); // 3–5 main branches
		for (let i = 0; i < n; i++) {
			// spaced along the edge, with a little jitter so they don't look combed
			const t = (i + 0.5) / n + (rng() - 0.5) * (0.5 / n);
			const along = Math.max(0, Math.min(1, t)) * e.along;
			const start = e.horizontal ? { x: along, y: e.fixed } : { x: e.fixed, y: along };
			const len = reach * e.perp * (0.7 + rng() * 0.6);
			const wobble = rad((rng() - 0.5) * 20);
			growBranch(rng, start, e.inward + wobble, len, 2, out);
		}
	}
}

// Tier 3: cracks outward from the four corners, fanning away from the centre.
// Longer than the border frost, fewer in number, more dramatic in their spread.
function cornerCracks(rng: () => number, w: number, h: number, reach: number, out: string[]): void {
	const span = Math.hypot(w, h);
	const corners = [
		{ p: { x: 0, y: 0 }, away: rad(225) }, // up-left
		{ p: { x: w, y: 0 }, away: rad(315) }, // up-right
		{ p: { x: 0, y: h }, away: rad(135) }, // down-left
		{ p: { x: w, y: h }, away: rad(45) } // down-right
	];
	for (const c of corners) {
		const n = 2 + Math.floor(rng() * 2); // 2–3 cracks per corner
		for (let i = 0; i < n; i++) {
			const fan = rad((rng() - 0.5) * 80); // ±40°, a dramatic spread
			const len = reach * span * (0.45 + rng() * 0.5);
			growBranch(rng, c.p, c.away + fan, len, 2, out);
		}
	}
}

// Paint both tiers from one shared PRNG stream so a creature's frost and cracks
// read as one consistent fingerprint. `artRect` need only carry width/height.
export function generateFrostPaths(
	rng: () => number,
	artRect: { width: number; height: number }
): { borderPaths: string[]; crackPaths: string[] } {
	const w = artRect.width;
	const h = artRect.height;
	const borderPaths: string[] = [];
	const crackPaths: string[] = [];
	if (w > 0 && h > 0) {
		edgeFrost(rng, w, h, 0.3, borderPaths);
		cornerCracks(rng, w, h, 0.62, crackPaths);
	}
	return { borderPaths, crackPaths };
}
