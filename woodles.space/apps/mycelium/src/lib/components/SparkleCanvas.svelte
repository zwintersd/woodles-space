<script lang="ts">
	import { onMount } from 'svelte';
	import { seededRng } from '../prng';

	let { intensity = 0.5, personId, animated = false }: {
		intensity: number;
		personId: string;
		animated?: boolean;
	} = $props();

	type Fleck = {
		x: number;
		y: number;
		size: number;
		period: number;
		offset: number;
		hue: number;
	};

	let canvas = $state<HTMLCanvasElement>();
	let reducedMotion = $state(true);
	let printing = $state(false);

	onMount(() => {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
		const print = window.matchMedia('print');
		const updateMedia = () => {
			reducedMotion = reduce.matches;
			printing = print.matches;
		};
		updateMedia();
		reduce.addEventListener('change', updateMedia);
		print.addEventListener('change', updateMedia);
		return () => {
			reduce.removeEventListener('change', updateMedia);
			print.removeEventListener('change', updateMedia);
		};
	});

	$effect(() => {
		const node = canvas;
		if (!node) return;
		const live = animated && !reducedMotion && !printing;
		const strength = intensity;
		const rng = seededRng(personId);
		const count = Math.floor(40 + strength * 120);
		// hue: gold-white at low intensity, full spectrum at high intensity
		const flecks: Fleck[] = Array.from({ length: count }, () => ({
			x: rng(),
			y: rng(),
			size: 1 + rng() * 2,
			period: 800 + rng() * 1700,
			offset: rng(),
			hue: strength < 0.4 ? 40 + rng() * 15 : rng() * 360
		}));
		const startTime = performance.now();
		let rafId = 0;

		function resize() {
			const d = window.devicePixelRatio || 1;
			node!.width = node!.offsetWidth * d;
			node!.height = node!.offsetHeight * d;
			paint(live ? performance.now() - startTime : 0);
		}

		const ro = new ResizeObserver(resize);
		ro.observe(node);
		resize();

		function paint(elapsed: number) {
			const ctx = node!.getContext('2d');
			if (!ctx) return;
			const { width: w, height: h } = node!;
			ctx.clearRect(0, 0, w, h);
			const dpr = window.devicePixelRatio || 1;

			for (const fleck of flecks) {
				// phase-offset so flecks don't all peak together
				const t = (elapsed / fleck.period + fleck.offset) % 1;
				const raw = Math.sin(t * Math.PI);
				// sharp bell curve: near-invisible most of the cycle, brief bright peak
				const brightness = Math.pow(raw, 6);
				if (brightness < 0.02) continue;
				// clamp size to at least 1 physical pixel so thin strokes render crisply
				drawFleck(ctx, fleck.x * w, fleck.y * h, Math.max(dpr, fleck.size * dpr), brightness, fleck.hue, strength);
			}
		}

		function draw(now: number) {
			paint(now - startTime);
			rafId = requestAnimationFrame(draw);
		}

		// A still card keeps its seeded sparkle pattern, with no animation loop.
		if (live) rafId = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
		};
	});

	function drawFleck(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		size: number,
		brightness: number,
		hue: number,
		strength: number
	) {
		const alpha = brightness * (0.6 + strength * 0.4);
		const len = size * (1 + brightness * 3);

		// bloom glow underneath the cross arms
		const grd = ctx.createRadialGradient(x, y, 0, x, y, len * 2);
		grd.addColorStop(0, `hsla(${hue}, ${strength * 60}%, 98%, ${alpha * 0.4})`);
		grd.addColorStop(1, `hsla(${hue}, ${strength * 60}%, 98%, 0)`);
		ctx.fillStyle = grd;
		ctx.beginPath();
		ctx.arc(x, y, len * 2, 0, Math.PI * 2);
		ctx.fill();

		// 4-point star: two crossed lines
		ctx.strokeStyle = `hsla(${hue}, ${strength * 40}%, 98%, ${alpha})`;
		ctx.lineWidth = size * 0.4;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x - len, y);
		ctx.lineTo(x + len, y);
		ctx.moveTo(x, y - len);
		ctx.lineTo(x, y + len);
		ctx.stroke();
	}
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		border-radius: inherit;
	}
</style>
