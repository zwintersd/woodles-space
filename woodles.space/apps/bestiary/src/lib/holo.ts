// A pointer-driven holographic foil for the cards. On hover it tracks the
// pointer and writes a few CSS custom properties the card's transform and sheen
// overlays read: a glare follows the cursor, the card tilts a touch toward it,
// and both ease back to rest on leave. rAF-throttled and a no-op on touch / when
// disabled, so a print or static card never picks it up; the tilt is dropped
// under prefers-reduced-motion (the sheen stays — it isn't vestibular motion).

export const HOLO_MAX_TILT = 6; // degrees — kept deliberately subtle

export type HoloVars = Record<string, string>;

function clamp01(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

// Pure: the CSS custom properties for a pointer position (0..1 across the card),
// how "live" the effect is (0..1), and whether motion is reduced. The tilt faces
// the card toward the cursor and scales with `active`, so it eases in and out
// with the sheen. Exported for tests.
export function holoVars(px: number, py: number, active: number, reduce = false): HoloVars {
	const cx = clamp01(px);
	const cy = clamp01(py);
	const a = clamp01(active);
	const rx = reduce ? 0 : (0.5 - cy) * 2 * HOLO_MAX_TILT * a;
	const ry = reduce ? 0 : (cx - 0.5) * 2 * HOLO_MAX_TILT * a;
	return {
		'--holo-px': cx.toFixed(4),
		'--holo-py': cy.toFixed(4),
		'--holo-active': a.toFixed(4),
		'--holo-rx': `${rx.toFixed(3)}deg`,
		'--holo-ry': `${ry.toFixed(3)}deg`
	};
}

// Svelte action: `use:holo={enabled}`.
export function holo(node: HTMLElement, enabled: boolean) {
	const mq = (q: string) =>
		typeof window !== 'undefined' && typeof window.matchMedia === 'function'
			? window.matchMedia(q)
			: null;
	// only mouse-like pointers get the effect; touch taps shouldn't tilt cards
	const fine = mq('(hover: hover) and (pointer: fine)')?.matches ?? true;
	const reduce = mq('(prefers-reduced-motion: reduce)')?.matches ?? false;

	let attached = false;
	let raf = 0;
	let px = 0.5, py = 0.5, active = 0; // eased, current
	let tpx = 0.5, tpy = 0.5, tActive = 0; // targets

	const apply = () => {
		const v = holoVars(px, py, active, reduce);
		for (const [k, val] of Object.entries(v)) node.style.setProperty(k, val);
	};

	const frame = () => {
		raf = 0;
		const k = 0.2;
		px += (tpx - px) * k;
		py += (tpy - py) * k;
		active += (tActive - active) * k;
		const settled =
			Math.abs(tpx - px) < 0.001 && Math.abs(tpy - py) < 0.001 && Math.abs(tActive - active) < 0.001;
		if (settled) {
			px = tpx;
			py = tpy;
			active = tActive;
		}
		apply();
		if (!settled) raf = requestAnimationFrame(frame);
	};
	const kick = () => {
		if (!raf) raf = requestAnimationFrame(frame);
	};

	const onMove = (e: PointerEvent) => {
		const r = node.getBoundingClientRect();
		if (!r.width || !r.height) return;
		tpx = (e.clientX - r.left) / r.width;
		tpy = (e.clientY - r.top) / r.height;
		tActive = 1;
		kick();
	};
	const onLeave = () => {
		tActive = 0;
		tpx = 0.5;
		tpy = 0.5;
		kick();
	};

	const attach = () => {
		if (attached || !fine) return;
		attached = true;
		node.addEventListener('pointerenter', onMove, { passive: true });
		node.addEventListener('pointermove', onMove, { passive: true });
		node.addEventListener('pointerleave', onLeave, { passive: true });
	};
	const detach = () => {
		if (!attached) return;
		attached = false;
		node.removeEventListener('pointerenter', onMove);
		node.removeEventListener('pointermove', onMove);
		node.removeEventListener('pointerleave', onLeave);
		onLeave();
	};

	if (enabled) attach();

	return {
		update(next: boolean) {
			if (next) attach();
			else detach();
		},
		destroy() {
			detach();
			if (raf) cancelAnimationFrame(raf);
		}
	};
}
