// The world's clock. A rAF loop driving the idle tick + periodic save.

import { book } from './book.svelte';

let raf = 0;
let lastT = 0;
let saveAt = 0;

export function startTick() {
	if (typeof window === 'undefined') return;
	if (raf) return;
	lastT = performance.now();
	saveAt = Date.now() + 5_000;
	const loop = (t: number) => {
		// clamp to 250ms so a backgrounded tab doesn't lurch; longer gaps are
		// settled by the offline-credit pass on the next load.
		const dt = Math.min(0.25, (t - lastT) / 1000);
		lastT = t;
		book.tick(dt);
		const now = Date.now();
		if (now > saveAt) {
			book.persist();
			saveAt = now + 5_000;
		}
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);
}

export function stopTick() {
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
}
