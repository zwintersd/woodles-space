<script lang="ts">
	// The first tier of burning: embers rising in the art window. A canvas sized
	// to its container, painting glowing motes that drift upward, flicker, and
	// respawn at the bottom. Colour runs deep orange at low burn, shifting toward
	// bright amber/white as intensity climbs. Count, speed, and glow all scale
	// with `burning`. Lives inside a clipped frame so particles vanish at the
	// art edge. Pauses when offscreen; respects prefers-reduced-motion.

	let { burning = 0 }: { burning: number } = $props();

	let canvas: HTMLCanvasElement;

	type Ember = {
		x: number;
		y: number;
		r: number;
		o: number; // base opacity
		vx: number;
		vy: number; // negative = rising
		phase: number;
		flicker: number; // flicker amplitude
		hue: number; // 0 = deep orange, 1 = bright amber/yellow
	};

	let ctx: CanvasRenderingContext2D | null = null;
	let embers: Ember[] = [];
	let cssW = 0;
	let cssH = 0;
	let dpr = 1;
	let onscreen = $state(true);

	const clampBurn = (b: number) => Math.max(0, Math.min(10, b));
	const intensity = (b: number) => Math.max(0, Math.min(1, (clampBurn(b) - 1) / 9));

	function targetCount(b: number): number {
		if (b <= 0) return 0;
		return Math.round(12 + intensity(b) * 55); // ~12 → ~67
	}

	const reduceMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function makeEmber(b: number, seedY = false): Ember {
		const t = intensity(b);
		const speed = 0.4 + t * 1.2;
		return {
			x: Math.random() * cssW,
			y: seedY ? Math.random() * cssH : cssH + Math.random() * cssH * 0.2,
			r: 1 + Math.random() * (1.5 + t * 0.8),
			o: 0.5 + Math.random() * 0.45,
			vx: (Math.random() - 0.5) * 0.4,
			vy: -(speed * (0.5 + Math.random() * 0.9)),
			phase: Math.random() * Math.PI * 2,
			flicker: 0.2 + Math.random() * 0.5,
			hue: Math.random()
		};
	}

	function syncPopulation() {
		const want = targetCount(burning);
		if (want < embers.length) {
			embers.length = want;
		} else {
			while (embers.length < want) embers.push(makeEmber(burning, true));
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
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function step(e: Ember) {
		e.phase += 0.06;
		e.x += e.vx + Math.sin(e.phase * 0.7) * 0.3;
		e.y += e.vy;
		// subtle flicker: nudge opacity each frame
		e.o = Math.max(0.1, Math.min(0.95, e.o + Math.sin(e.phase) * e.flicker * 0.08));
		// respawn at the bottom when off the top
		if (e.y + e.r < 0) {
			e.y = cssH + e.r;
			e.x = Math.random() * cssW;
			e.o = 0.5 + Math.random() * 0.4;
		}
		if (e.x < -e.r) e.x = cssW + e.r;
		else if (e.x > cssW + e.r) e.x = -e.r;
	}

	function emberColor(hue: number, alpha: number): string {
		// deep orange (#ff4800) → amber (#ffaa00) → bright amber-yellow (#ffdd55)
		const r = 255;
		const g = Math.round(40 + hue * 185);
		const b = Math.round(hue * hue * 55);
		return `rgba(${r},${g},${b},${alpha})`;
	}

	function draw() {
		if (!ctx) return;
		ctx.clearRect(0, 0, cssW, cssH);
		for (const e of embers) {
			// outer glow
			const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.5);
			g.addColorStop(0, emberColor(e.hue, e.o));
			g.addColorStop(0.4, emberColor(e.hue, e.o * 0.55));
			g.addColorStop(1, 'rgba(255,80,0,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(e.x, e.y, e.r * 2.5, 0, Math.PI * 2);
			ctx.fill();
			// bright core
			const coreWhite = Math.round(160 + e.hue * 95);
			ctx.fillStyle = `rgba(255,255,${coreWhite},${e.o * 0.9})`;
			ctx.beginPath();
			ctx.arc(e.x, e.y, e.r * 0.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	$effect(() => {
		resize();
		syncPopulation();
		draw();
		const ro = new ResizeObserver(() => {
			resize();
			syncPopulation();
			draw();
		});
		ro.observe(canvas);
		let io: IntersectionObserver | undefined;
		if (typeof IntersectionObserver !== 'undefined') {
			io = new IntersectionObserver(([entry]) => (onscreen = entry.isIntersecting), {
				rootMargin: '60px'
			});
			io.observe(canvas);
		}
		return () => {
			ro.disconnect();
			io?.disconnect();
		};
	});

	$effect(() => {
		void burning;
		syncPopulation();
	});

	$effect(() => {
		if (burning <= 0 || !onscreen || reduceMotion()) return;
		let raf = 0;
		let stopped = false;
		const loop = () => {
			if (stopped) return;
			for (const e of embers) step(e);
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

<canvas bind:this={canvas} class="embers" aria-hidden="true"></canvas>

<style>
	.embers {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		display: block;
	}
</style>
