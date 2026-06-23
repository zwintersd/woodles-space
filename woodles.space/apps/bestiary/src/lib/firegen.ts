// The shapes of fire. Given a creature's seeded PRNG and the art window's box,
// this paints two families of SVG path strings:
//
//   · flamePaths  — tongues licking *inward* from the art frame's edges,
//     densest at the bottom where heat pools (tier 2, burning 3–6).
//   · scorchPaths — char marks radiating *outward* from the corners into the
//     surrounding card, as if the frame burned through (tier 3, burning 6–10).
//
// Architecture mirrors frostgen: shared PRNG stream, coordinate space rooted at
// the art window's top-left, scorchPaths allowed to run negative / past the far
// edge. Pure and DOM-free.

type Pt = { x: number; y: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const fmt = (n: number) => Math.round(n * 10) / 10;

// Grow one wandering tendril. Flames wander more than frost (±15° per segment
// vs frost's ±11°) and sub-branches splay wider, giving a tongued chaotic
// character instead of a crystalline one.
function growTendril(
	rng: () => number,
	start: Pt,
	angle: number,
	length: number,
	depth: number,
	out: string[]
): void {
	const segs = 4 + Math.floor(rng() * 3); // 4–6 segments
	let p = start;
	let a = angle;
	let d = `M ${fmt(p.x)} ${fmt(p.y)}`;
	const joints: Pt[] = [p];
	for (let i = 0; i < segs; i++) {
		const segLen = (length / segs) * (0.55 + rng() * 0.9);
		a += rad((rng() - 0.5) * 30); // wander ±15°
		p = { x: p.x + Math.cos(a) * segLen, y: p.y + Math.sin(a) * segLen };
		d += ` L ${fmt(p.x)} ${fmt(p.y)}`;
		joints.push(p);
	}
	out.push(d);

	if (depth <= 0) return;
	const branches = 1 + Math.floor(rng() * 2);
	for (let i = 0; i < branches; i++) {
		const j = 1 + Math.floor(rng() * (joints.length - 1));
		const side = rng() < 0.5 ? -1 : 1;
		const dev = rad(20 + rng() * 40) * side; // ±20–60°, wider splay than frost's ±15–45°
		growTendril(rng, joints[j], angle + dev, length * (0.35 + rng() * 0.25), depth - 1, out);
	}
}

// Tier 2: fire tongues inward from edges. Bottom is densest (heat rises);
// sides get fewer; top gets almost none.
function edgeFlames(rng: () => number, w: number, h: number, reach: number, out: string[]): void {
	// bottom edge: 4–6 main tongues rising upward
	const nBottom = 4 + Math.floor(rng() * 3);
	for (let i = 0; i < nBottom; i++) {
		const t = (i + 0.5) / nBottom + (rng() - 0.5) * (0.6 / nBottom);
		const x = Math.max(0, Math.min(1, t)) * w;
		const len = reach * h * (0.5 + rng() * 0.7);
		const wobble = rad((rng() - 0.5) * 25);
		growTendril(rng, { x, y: h }, rad(-90) + wobble, len, 2, out);
	}

	// left edge: 2–3 tongues angled inward with a slight upward bias
	const nLeft = 2 + Math.floor(rng() * 2);
	for (let i = 0; i < nLeft; i++) {
		const t = 0.3 + ((i + 0.5) / nLeft) * 0.6 + (rng() - 0.5) * (0.4 / nLeft);
		const y = Math.max(0, Math.min(1, t)) * h;
		const len = reach * w * (0.4 + rng() * 0.5);
		const wobble = rad((rng() - 0.5) * 20 - 15);
		growTendril(rng, { x: 0, y }, rad(0) + wobble, len, 1, out);
	}

	// right edge: same
	const nRight = 2 + Math.floor(rng() * 2);
	for (let i = 0; i < nRight; i++) {
		const t = 0.3 + ((i + 0.5) / nRight) * 0.6 + (rng() - 0.5) * (0.4 / nRight);
		const y = Math.max(0, Math.min(1, t)) * h;
		const len = reach * w * (0.4 + rng() * 0.5);
		const wobble = rad((rng() - 0.5) * 20 - 15);
		growTendril(rng, { x: w, y }, rad(180) + wobble, len, 1, out);
	}
}

// Tier 3: scorch marks fanning outward from corners. Wider spread than ice
// cracks (fire spreads chaotically) and more tendrils per corner.
function cornerScorch(rng: () => number, w: number, h: number, reach: number, out: string[]): void {
	const span = Math.hypot(w, h);
	const corners = [
		{ p: { x: 0, y: h }, away: rad(135) }, // bottom-left
		{ p: { x: w, y: h }, away: rad(45) }, // bottom-right
		{ p: { x: 0, y: 0 }, away: rad(225) }, // top-left
		{ p: { x: w, y: 0 }, away: rad(315) } // top-right
	];
	for (const c of corners) {
		const n = 2 + Math.floor(rng() * 3); // 2–4 scorch tendrils per corner
		for (let i = 0; i < n; i++) {
			const fan = rad((rng() - 0.5) * 90); // wide splay — fire spreads chaotically
			const len = reach * span * (0.4 + rng() * 0.55);
			growTendril(rng, c.p, c.away + fan, len, 2, out);
		}
	}
}

// Both tiers from one shared PRNG stream. Use a distinct seed suffix from frost
// (seed + ':fire') so a creature's flame fingerprint is independent of its ice.
export function generateFirePaths(
	rng: () => number,
	artRect: { width: number; height: number }
): { flamePaths: string[]; scorchPaths: string[] } {
	const w = artRect.width;
	const h = artRect.height;
	const flamePaths: string[] = [];
	const scorchPaths: string[] = [];
	if (w > 0 && h > 0) {
		edgeFlames(rng, w, h, 0.35, flamePaths);
		cornerScorch(rng, w, h, 0.62, scorchPaths);
	}
	return { flamePaths, scorchPaths };
}
