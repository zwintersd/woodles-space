<script lang="ts">
	// The first tier of cold: snow drifting in the art window. A canvas, sized to
	// its container in device pixels for crisp flakes, painting soft white motes
	// that fall, wobble, and wrap back to the top. Count, speed and flake size all
	// scale with `cold` — a faint flurry at 1, a dense squall at 10.
	//
	// It lives inside a clipped frame over the art, so flakes vanish cleanly at
	// the edge. The loop pauses when the card scrolls out of view (collections can
	// hold many of these) and respects prefers-reduced-motion by holding a single
	// still frame.

	let { cold = 0 }: { cold: number } = $props();

	let canvas: HTMLCanvasElement;

	type Flake = {
		x: number;
		y: number;
		r: number; // radius, css px
		o: number; // opacity
		vx: number; // drift, slight leftward bias
		vy: number; // fall speed
		phase: number; // wobble offset
		sway: number; // wobble amplitude
	};

	let ctx: CanvasRenderingContext2D | null = null;
	let flakes: Flake[] = [];
	let cssW = 0;
	let cssH = 0;
	let dpr = 1;
	// onscreen until an IntersectionObserver says otherwise; starting true means
	// even a permanently-offscreen card (the hidden export clone) paints a frame.
	let onscreen = $state(true);

	const clampCold = (c: number) => Math.max(0, Math.min(10, c));
	// progress along the cold axis, 0 at cold 1, 1 at cold 10 — the knob the
	// flurry's character rides on.
	const intensity = (c: number) => Math.max(0, Math.min(1, (clampCold(c) - 1) / 9));

	function targetCount(c: number): number {
		if (c <= 0) return 0;
		return Math.round(15 + intensity(c) * 65); // ~15 → ~80
	}

	const reduceMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	// A fresh flake. Low cold → large, slow, soft; high cold → small, quick, sharp.
	function makeFlake(c: number, seedY = false): Flake {
		const t = intensity(c);
		const rMin = 2 - t; // 2 → 1
		const rMax = 4 - 2 * t; // 4 → 2
		const speed = 0.3 + t * 1.0; // base fall, scales up with cold
		return {
			x: Math.random() * cssW,
			y: seedY ? Math.random() * cssH : -Math.random() * cssH * 0.3,
			r: rMin + Math.random() * (rMax - rMin),
			o: 0.4 + Math.random() * 0.5,
			vx: (-0.15 - Math.random() * 0.25) * speed, // wind, leftward bias
			vy: speed * (0.6 + Math.random() * 0.8),
			phase: Math.random() * Math.PI * 2,
			sway: 0.2 + Math.random() * 0.6
		};
	}

	// Grow or trim the population to match the cold level, keeping existing flakes
	// where we can so a nudge of the slider doesn't restart the whole flurry.
	function syncPopulation() {
		const want = targetCount(cold);
		if (want < flakes.length) {
			flakes.length = want;
		} else {
			while (flakes.length < want) flakes.push(makeFlake(cold, true));
		}
	}

	function resize() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		cssW = rect.width;
		cssH = rect.height;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.max(1, Math.round(cssW * dpr));
		canvas.height = Math.max(1, Math.round(cssH * dpr));
		ctx = canvas.getContext('2d');
		// work in css pixels; the transform handles the device scale
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function step(f: Flake) {
		f.phase += 0.02;
		f.x += f.vx + Math.sin(f.phase) * f.sway;
		f.y += f.vy;
		// wrap top↔bottom, re-randomising x so flakes never fall in columns
		if (f.y - f.r > cssH) {
			f.y = -f.r;
			f.x = Math.random() * cssW;
		}
		if (f.x < -f.r) f.x = cssW + f.r;
		else if (f.x > cssW + f.r) f.x = -f.r;
	}

	function draw() {
		if (!ctx) return;
		ctx.clearRect(0, 0, cssW, cssH);
		for (const f of flakes) {
			const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
			g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * f.o})`);
			g.addColorStop(1, 'rgba(255, 255, 255, 0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// ── lifecycle ──────────────────────────────────────────────────────
	// Keep the canvas sized to its frame, and pause work while offscreen.
	$effect(() => {
		resize();
		syncPopulation();
		draw(); // one frame up front so a paused/offscreen card is never blank

		const ro = new ResizeObserver(() => {
			resize();
			syncPopulation();
			draw();
		});
		ro.observe(canvas);

		let io: IntersectionObserver | undefined;
		if (typeof IntersectionObserver !== 'undefined') {
			io = new IntersectionObserver(
				([entry]) => (onscreen = entry.isIntersecting),
				{ rootMargin: '60px' }
			);
			io.observe(canvas);
		}

		return () => {
			ro.disconnect();
			io?.disconnect();
		};
	});

	// Match the flurry to the live cold level (slider nudges, threshold crossings).
	$effect(() => {
		void cold;
		syncPopulation();
	});

	// The animation loop. Reading cold/onscreen here means the effect tears down
	// and restarts when the card freezes over, thaws, or scrolls out of sight —
	// no stray frames, no leaked rAF handles.
	$effect(() => {
		if (cold <= 0 || !onscreen || reduceMotion()) return;
		let raf = 0;
		let stopped = false;
		const loop = () => {
			if (stopped) return;
			for (const f of flakes) step(f);
			draw();
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			stopped = true;
			cancelAnimationFrame(raf);
		};
	});
</script>

<canvas bind:this={canvas} class="snow" aria-hidden="true"></canvas>

<style>
	.snow {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		display: block;
	}
</style>
