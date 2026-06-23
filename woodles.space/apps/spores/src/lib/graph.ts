// Force-directed graph simulation for relationship graphs.
// Runs a spring/repulsion model on SimNodes; caller drives ticks via rAF.

export interface SimNode {
	id: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	pinned: boolean;
}

export interface SimEdge {
	from: string;
	to: string;
}

// Physics constants
const REPULSION = 3200;
const SPRING_K = 0.04;
const IDEAL_DIST = 180;
const GRAVITY = 0.006;
const DAMPING = 0.82;
const MIN_DIST = 18;

export function initNodes(ids: string[], radius = 220): SimNode[] {
	return ids.map((id, i) => {
		const angle = (i / ids.length) * Math.PI * 2;
		return {
			id,
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius,
			vx: (Math.random() - 0.5) * 2,
			vy: (Math.random() - 0.5) * 2,
			pinned: false
		};
	});
}

export function tick(nodes: SimNode[], edges: SimEdge[]): void {
	const n = nodes.length;

	// Repulsion between every pair
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const a = nodes[i];
			const b = nodes[j];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DIST);
			const force = REPULSION / (dist * dist);
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
			if (!b.pinned) { b.vx += fx; b.vy += fy; }
		}
	}

	// Spring attraction along edges
	const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]));
	for (const edge of edges) {
		const a = nodeMap.get(edge.from);
		const b = nodeMap.get(edge.to);
		if (!a || !b) continue;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DIST);
		const force = SPRING_K * (dist - IDEAL_DIST);
		const fx = (dx / dist) * force;
		const fy = (dy / dist) * force;
		if (!a.pinned) { a.vx += fx; a.vy += fy; }
		if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
	}

	// Center gravity + damping + integrate
	for (const node of nodes) {
		if (node.pinned) continue;
		node.vx += -node.x * GRAVITY;
		node.vy += -node.y * GRAVITY;
		node.vx *= DAMPING;
		node.vy *= DAMPING;
		node.x += node.vx;
		node.y += node.vy;
	}
}

export function kineticEnergy(nodes: SimNode[]): number {
	return nodes.reduce((sum, n) => sum + n.vx * n.vx + n.vy * n.vy, 0);
}
