// rAF-driven game loop and persistence.

import { game } from './game.svelte';

let raf = 0;
let lastT = 0;
let saveAt = 0;

export function start() {
	if (typeof window === 'undefined') return;
	game.hydrate();
	lastT = performance.now();
	saveAt = Date.now() + 5_000;
	const loop = (t: number) => {
		const dt = Math.min(0.25, (t - lastT) / 1000); // clamp to 250ms in case of tab idle
		lastT = t;
		game.tick(dt);
		const now = Date.now();
		if (now > saveAt) {
			game.persist();
			saveAt = now + 5_000;
		}
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);

	window.addEventListener('beforeunload', () => game.persist());
}

export function stop() {
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
}
