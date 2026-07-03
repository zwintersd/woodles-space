<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { book } from './book.svelte';
	import {
		WORLD_WATER_TOP,
		featureById,
		resolveSpawnPointForLife,
		waterGridYToWorld,
		worldYToWaterGrid,
		type SpawnLayer
	} from './worldShape';

	const ASPECT = 960 / 340;
	const WATER_TOP = WORLD_WATER_TOP;
	const CREATURE_BOX = 0.2;

	let wrapEl: HTMLDivElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let anyReady = $state(false);
	let isPouring = $state(false);

	interface Slot {
		img: HTMLImageElement;
		ok: boolean;
		cands: string[];
		i: number;
	}

	const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const rgb = (r: number, g: number, b: number) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
	const assetUrl = (name: string, bust = 0) =>
		`${base}/diorama/${name}${bust ? `?r=${bust}` : ''}`;

	function makeSlot(cands: string[]): Slot {
		const slot: Slot = { img: new Image(), ok: false, cands, i: 0 };
		slot.img.onload = () => {
			slot.ok = true;
			anyReady = true;
		};
		slot.img.onerror = () => {
			slot.i++;
			if (slot.i < slot.cands.length) slot.img.src = assetUrl(slot.cands[slot.i]);
		};
		slot.img.src = assetUrl(cands[0]);
		return slot;
	}

	let sun: Slot;
	let mist: Slot;
	let rain: Slot;
	let water: Slot;
	let clouds: Slot[] = [];

	let activePointerId: number | null = null;
	let pourPoint: { x: number; y: number } | null = null;
	let lastPourAt = 0;

	function pointerToWaterPoint(event: PointerEvent): { x: number; y: number } | null {
		const canvas = canvasEl;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const x = clamp01((event.clientX - rect.left) / rect.width);
		const worldY = (event.clientY - rect.top) / rect.height;
		const y = worldYToWaterGrid(worldY);
		return y === null ? null : { x, y };
	}

	function startPour(event: PointerEvent) {
		if (!book.canPourSediment()) return;
		const point = pointerToWaterPoint(event);
		if (!point) return;
		activePointerId = event.pointerId;
		pourPoint = point;
		lastPourAt = performance.now();
		isPouring = true;
		canvasEl?.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function movePour(event: PointerEvent) {
		if (event.pointerId !== activePointerId) return;
		const point = pointerToWaterPoint(event);
		if (point) pourPoint = point;
	}

	function stopPour(event?: PointerEvent) {
		if (event && event.pointerId !== activePointerId) return;
		if (activePointerId !== null && canvasEl?.hasPointerCapture(activePointerId)) {
			canvasEl.releasePointerCapture(activePointerId);
		}
		if (isPouring) book.finishPourSediment();
		activePointerId = null;
		pourPoint = null;
		isPouring = false;
	}

	onMount(() => {
		const canvas = canvasEl!;
		const wrap = wrapEl!;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		anyReady = true;

		sun = makeSlot(['sky-sun.png']);
		mist = makeSlot(['mist.png']);
		rain = makeSlot(['rain.png']);
		water = makeSlot(['water.png']);
		clouds = [makeSlot(['cloud-a.png']), makeSlot(['cloud-b.png']), makeSlot(['cloud-c.png'])];

		const reduce =
			typeof matchMedia !== 'undefined' &&
			matchMedia('(prefers-reduced-motion: reduce)').matches;

		let dpr = 1;
		let W = 0;
		let H = 0;

		function resize() {
			dpr = Math.min(2, window.devicePixelRatio || 1);
			W = wrap.clientWidth;
			H = Math.round(W / ASPECT);
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			canvas.style.height = `${H}px`;
		}

		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(wrap);

		let attempt = 0;
		const retry = setInterval(() => {
			attempt++;
			const slots = [sun, mist, rain, water, ...clouds];
			if (slots.every((s) => s.ok) || attempt > 12) {
				clearInterval(retry);
				return;
			}
			for (const s of slots) {
				if (!s.ok) {
					s.i = 0;
					s.img.src = assetUrl(s.cands[0], attempt);
				}
			}
		}, 5000);

		const spriteCache = new Map<string, { img: HTMLImageElement; ok: boolean }>();
		function getSprite(src: string) {
			let entry = spriteCache.get(src);
			if (!entry) {
				entry = { img: new Image(), ok: false };
				entry.img.onload = () => {
					entry!.ok = true;
					anyReady = true;
				};
				entry.img.src = src;
				spriteCache.set(src, entry);
			}
			return entry;
		}

		const featureCache = new Map<string, { img: HTMLImageElement; ok: boolean; failed: boolean }>();
		function getFeatureSprite(src: string) {
			let entry = featureCache.get(src);
			if (!entry) {
				entry = { img: new Image(), ok: false, failed: false };
				entry.img.onload = () => {
					entry!.ok = true;
				};
				entry.img.onerror = () => {
					entry!.failed = true;
				};
				entry.img.src = assetUrl(src);
				featureCache.set(src, entry);
			}
			return entry.ok && !entry.failed ? entry.img : null;
		}

		function spriteFor(lifeId: string): { src: string; pixelated: boolean } | null {
			const c = book.boundCreatureFor(lifeId);
			const src = c ? (c.isolatedSprite ?? c.sprite ?? null) : null;
			return src ? { src, pixelated: c!.pixelated } : null;
		}

		function drawSky(T: number) {
			const o = clamp01(book.stocks.oxygen / 100);
			const fav = clamp01(book.favor / 100);
			const horizon = H * WATER_TOP;
			const sky = ctx!.createLinearGradient(0, 0, 0, horizon);
			sky.addColorStop(0, rgb(lerp(22, 35, o), lerp(26, 54, o), lerp(70, 104, o)));
			sky.addColorStop(1, rgb(lerp(48, 84, o), lerp(70, 130, o), lerp(118, 168, o)));
			ctx!.fillStyle = sky;
			ctx!.fillRect(0, 0, W, horizon + 1);

			if (sun.ok) {
				const ss = H * 0.5;
				const sx = W * 0.78 - ss / 2;
				const sy = H * 0.19 - ss / 2;
				const pulse = reduce ? 1 : 0.86 + 0.14 * Math.sin(T * 0.8);
				ctx!.save();
				ctx!.globalAlpha = (0.22 + 0.48 * fav) * pulse;
				ctx!.drawImage(sun.img, sx, sy, ss, ss);
				ctx!.restore();
			}
		}

		function drawWeather(T: number) {
			const m = clamp01(book.stocks.moisture / 100);
			const drift = reduce ? 0 : T;
			const cloudOpacity = clamp01((m - 0.25) / 0.5);
			const cloudCount = m < 0.35 ? 1 : m < 0.65 ? 2 : 3;
			if (cloudOpacity > 0.01) {
				const cw = W * 0.3;
				const ch = cw * 0.5;
				ctx!.save();
				ctx!.globalAlpha = cloudOpacity;
				for (let i = 0; i < cloudCount; i++) {
					const c = clouds[i];
					if (!c?.ok) continue;
					const span = W + cw;
					const speed = (0.012 + i * 0.004) * W;
					const x = (((drift * speed + i * W * 0.37) % span) + span) % span - cw;
					const y = H * (0.06 + i * 0.08);
					ctx!.drawImage(c.img, x, y, cw, ch);
				}
				ctx!.restore();
			}

			if (mist.ok) {
				const mo = clamp01((m - 0.4) / 0.4) * 0.55;
				if (mo > 0.01) {
					const mw = W * 1.1;
					const mh = H * 0.3;
					const x = -(((drift * W * 0.006) % (mw - W)) + 0);
					ctx!.save();
					ctx!.globalAlpha = mo;
					ctx!.drawImage(mist.img, x, H * WATER_TOP - mh * 0.5, mw, mh);
					ctx!.restore();
				}
			}
		}

		function drawWaterBase(T: number) {
			const waterY = H * WATER_TOP;
			const waterH = H - waterY;
			const m = clamp01(book.stocks.moisture / 100);
			const waterGrad = ctx!.createLinearGradient(0, waterY, 0, H);
			waterGrad.addColorStop(0, `rgba(108, 229, 232, ${0.24 + m * 0.12})`);
			waterGrad.addColorStop(0.38, 'rgba(97, 146, 197, 0.62)');
			waterGrad.addColorStop(1, 'rgba(95, 93, 165, 0.82)');
			ctx!.fillStyle = waterGrad;
			ctx!.fillRect(0, waterY, W, waterH);

			const wave = reduce ? 0 : Math.sin(T * 0.9) * H * 0.004;
			ctx!.save();
			ctx!.globalAlpha = 0.6;
			if (water.ok) ctx!.drawImage(water.img, 0, waterY + wave, W, waterH + 2);
			ctx!.restore();

			ctx!.save();
			ctx!.globalAlpha = 0.24;
			ctx!.strokeStyle = 'rgba(245, 242, 232, 0.7)';
			ctx!.lineWidth = 1;
			ctx!.beginPath();
			ctx!.moveTo(0, waterY + 0.5);
			ctx!.bezierCurveTo(W * 0.28, waterY - 1, W * 0.46, waterY + 2, W, waterY + 0.5);
			ctx!.stroke();
			ctx!.restore();
		}

		function drawSedimentGrid() {
			const grid = book.worldShape.sedimentGrid;
			const waterY = H * WATER_TOP;
			const waterH = H - waterY;
			const cellW = W / grid.w;
			const cellH = waterH / grid.h;
			for (let y = 0; y < grid.h; y++) {
				for (let x = 0; x < grid.w; x++) {
					const value = grid.cells[y * grid.w + x] ?? 0;
					if (value <= 0.01) continue;
					const cx = (x + 0.5) * cellW;
					const cy = waterY + (y + 0.5) * cellH;
					ctx!.save();
					ctx!.globalAlpha = 0.08 + value * 0.58;
					ctx!.fillStyle = value > 0.62 ? 'rgb(216, 190, 142)' : 'rgb(171, 137, 116)';
					ctx!.beginPath();
					ctx!.ellipse(cx, cy, cellW * (0.75 + value), cellH * (0.5 + value * 0.3), 0, 0, Math.PI * 2);
					ctx!.fill();
					ctx!.restore();
				}
			}
		}

		function drawShallowsShelf() {
			if (book.worldShape.activeWorldspace !== 'shallows') return;
			const y = H * 0.57;
			const shelf = ctx!.createLinearGradient(0, y - 16, 0, y + 52);
			shelf.addColorStop(0, 'rgba(216, 190, 142, 0)');
			shelf.addColorStop(0.4, 'rgba(216, 190, 142, 0.32)');
			shelf.addColorStop(1, 'rgba(71, 47, 61, 0.24)');
			ctx!.fillStyle = shelf;
			ctx!.beginPath();
			ctx!.moveTo(0, y + 16);
			ctx!.bezierCurveTo(W * 0.18, y - 6, W * 0.36, y + 10, W * 0.58, y);
			ctx!.bezierCurveTo(W * 0.76, y - 8, W * 0.88, y + 8, W, y - 4);
			ctx!.lineTo(W, H);
			ctx!.lineTo(0, H);
			ctx!.closePath();
			ctx!.fill();
		}

		function drawFeatureFallback(featureId: string, x: number, y: number, size: number, rotation: number) {
			ctx!.save();
			ctx!.translate(x, y);
			ctx!.rotate(rotation);
			ctx!.globalAlpha = 0.85;
			if (featureId === 'black_silt') {
				ctx!.fillStyle = 'rgba(33, 28, 48, 0.9)';
				ctx!.beginPath();
				ctx!.ellipse(0, 0, size * 0.62, size * 0.24, 0, 0, Math.PI * 2);
				ctx!.fill();
			} else if (featureId === 'mineral_glint') {
				ctx!.fillStyle = 'rgba(108, 229, 232, 0.85)';
				for (let i = 0; i < 5; i++) {
					const a = (i / 5) * Math.PI * 2;
					ctx!.beginPath();
					ctx!.ellipse(Math.cos(a) * size * 0.18, Math.sin(a) * size * 0.08, size * 0.07, size * 0.025, a, 0, Math.PI * 2);
					ctx!.fill();
				}
			} else if (featureId === 'reef_nub') {
				ctx!.fillStyle = 'rgba(240, 143, 184, 0.62)';
				ctx!.beginPath();
				ctx!.roundRect(-size * 0.28, -size * 0.38, size * 0.56, size * 0.76, size * 0.12);
				ctx!.fill();
			} else {
				ctx!.fillStyle = 'rgba(245, 242, 232, 0.82)';
				for (let i = 0; i < 4; i++) {
					ctx!.beginPath();
					ctx!.ellipse(-size * 0.22 + i * size * 0.15, 0, size * 0.12, size * 0.05, i * 0.4, 0, Math.PI * 2);
					ctx!.fill();
				}
			}
			ctx!.restore();
		}

		function drawFeatures() {
			for (const placed of book.worldShape.placedFeatures) {
				const spec = featureById(placed.featureId);
				if (!spec) continue;
				const x = placed.x * W;
				const y = H * waterGridYToWorld(placed.y);
				const size = H * 0.13 * placed.scale;
				ctx!.save();
				ctx!.globalAlpha = 0.2;
				ctx!.fillStyle = 'rgb(14, 14, 40)';
				ctx!.beginPath();
				ctx!.ellipse(x, y + size * 0.28, size * 0.35, size * 0.07, 0, 0, Math.PI * 2);
				ctx!.fill();
				ctx!.restore();
				const img = spec.sprite ? getFeatureSprite(spec.sprite) : null;
				if (img) {
					ctx!.save();
					ctx!.translate(x, y);
					ctx!.rotate(placed.rotation);
					ctx!.drawImage(img, -size / 2, -size / 2, size, size);
					ctx!.restore();
				} else {
					drawFeatureFallback(placed.featureId, x, y, size, placed.rotation);
				}
			}
		}

		function layerBob(layer: SpawnLayer, T: number, seed: number): number {
			if (reduce) return 0;
			const amp = layer === 'air' ? 0.035 : layer === 'shore' ? 0.008 : 0.022;
			const speed = layer === 'air' ? 0.5 : 0.65;
			return Math.sin(T * speed + seed * Math.PI * 2) * H * amp;
		}

		function drawCreatureLayers(layers: SpawnLayer[], T: number) {
			for (const life of book.life) {
				const info = spriteFor(life.id);
				if (!info) continue;
				const point = resolveSpawnPointForLife(life, book.worldShape);
				if (!layers.includes(point.layer)) continue;
				const entry = getSprite(info.src);
				if (!entry.ok || !entry.img.naturalWidth) continue;

				const seed = point.x + point.y + life.id.length * 0.013;
				const stage = book.stageOf(life.id);
				const box = H * CREATURE_BOX * point.scale * (0.58 + 0.42 * (stage / 3));
				const scale = box / Math.max(entry.img.naturalWidth, entry.img.naturalHeight);
				const dw = entry.img.naturalWidth * scale;
				const dh = entry.img.naturalHeight * scale;
				const jitter = (point.id.length % 7) * W * 0.002;
				const cx = point.x * W + jitter;
				const cy = point.y * H + layerBob(point.layer, T, seed);
				const alpha = clamp01(stage === 0 ? 0.3 : 0.55 + 0.45 * book.vitalityOf(life.id));

				if (point.layer === 'floor' || point.layer === 'shore') {
					ctx!.save();
					ctx!.globalAlpha = alpha * 0.22;
					ctx!.fillStyle = 'rgb(14, 14, 40)';
					ctx!.beginPath();
					ctx!.ellipse(cx, cy + dh * 0.35, dw * 0.32, dh * 0.06, 0, 0, Math.PI * 2);
					ctx!.fill();
					ctx!.restore();
				}

				ctx!.save();
				ctx!.globalAlpha = alpha;
				ctx!.imageSmoothingEnabled = !info.pixelated;
				ctx!.drawImage(entry.img, cx - dw / 2, cy - dh / 2, dw, dh);
				ctx!.restore();
			}
		}

		function drawRain(T: number) {
			const m = clamp01(book.stocks.moisture / 100);
			const ro2 = clamp01((m - 0.7) / 0.3) * 0.7;
			if (!rain.ok || ro2 <= 0.01) return;
			const rw = W * 0.13;
			const rh = rw * 2;
			const scroll = reduce ? 0 : (T * H * 0.5) % rh;
			ctx!.save();
			ctx!.globalAlpha = ro2;
			for (let y = -rh + scroll; y < H; y += rh) {
				for (let x = 0; x < W; x += rw) ctx!.drawImage(rain.img, x, y, rw, rh);
			}
			ctx!.restore();
		}

		function drawWaterGlaze(T: number) {
			const drift = reduce ? 0 : T;
			const waterY = H * WATER_TOP;
			ctx!.save();
			ctx!.globalAlpha = 0.22;
			ctx!.fillStyle = 'rgba(108, 229, 232, 0.4)';
			for (let i = 0; i < 8; i++) {
				const y = waterY + ((i + 1) / 9) * (H - waterY);
				ctx!.fillRect(((drift * 8 + i * 37) % 80) - 80, y, W + 120, 1);
			}
			ctx!.restore();
		}

		function drawOverlays() {
			const stab = clamp01(book.stability / 100);
			if (stab < 0.999) {
				ctx!.save();
				ctx!.globalAlpha = (1 - stab) * 0.3;
				ctx!.fillStyle = 'rgb(40, 40, 70)';
				ctx!.fillRect(0, 0, W, H);
				ctx!.restore();
			}
			if (book.quiet) {
				const vg = ctx!.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
				vg.addColorStop(0, 'rgba(14,14,40,0)');
				vg.addColorStop(1, 'rgba(14,14,40,0.55)');
				ctx!.fillStyle = vg;
				ctx!.fillRect(0, 0, W, H);
			}
			if (isPouring && pourPoint) {
				const x = pourPoint.x * W;
				const y = H * waterGridYToWorld(pourPoint.y);
				ctx!.save();
				ctx!.globalAlpha = 0.7;
				ctx!.strokeStyle = 'rgba(245, 242, 232, 0.7)';
				ctx!.lineWidth = 1;
				ctx!.beginPath();
				ctx!.arc(x, y, H * 0.045, 0, Math.PI * 2);
				ctx!.stroke();
				ctx!.restore();
			}
		}

		function draw(tMs: number) {
			const T = tMs / 1000;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx!.clearRect(0, 0, W, H);

			drawSky(T);
			drawWeather(T);
			drawWaterBase(T);
			drawSedimentGrid();
			drawShallowsShelf();
			drawFeatures();
			drawCreatureLayers(['water', 'floor'], T);
			drawWaterGlaze(T);
			drawCreatureLayers(['shore', 'air'], T);
			drawRain(T);
			drawOverlays();
		}

		let raf = 0;
		let running = true;
		function frame(t: number) {
			if (!running) return;
			if (isPouring && pourPoint) {
				const dt = Math.min(0.08, Math.max(0, (t - lastPourAt) / 1000));
				if (dt > 0) {
					book.pourSedimentAt(pourPoint.x, pourPoint.y, dt);
					lastPourAt = t;
				}
				if (!book.canPourSediment()) stopPour();
			}
			draw(t);
			raf = requestAnimationFrame(frame);
		}
		raf = requestAnimationFrame(frame);

		function onVisibility() {
			if (document.hidden) {
				stopPour();
				running = false;
				if (raf) cancelAnimationFrame(raf);
			} else if (!running) {
				running = true;
				lastPourAt = performance.now();
				raf = requestAnimationFrame(frame);
			}
		}

		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			stopPour();
			running = false;
			if (raf) cancelAnimationFrame(raf);
			clearInterval(retry);
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<div class="diorama" bind:this={wrapEl} class:pourable={book.canPourSediment()} class:pouring={isPouring}>
	<canvas
		bind:this={canvasEl}
		aria-label="a living water world where sediment can gather into shallows"
		onpointerdown={startPour}
		onpointermove={movePour}
		onpointerup={stopPour}
		onpointercancel={stopPour}
		onlostpointercapture={stopPour}
	></canvas>
	{#if !anyReady}
		<p class="hint">the world's image is still arriving; the signs are live below.</p>
	{/if}
</div>

<style>
	.diorama {
		position: relative;
		width: 100%;
		border: 1px solid var(--rule);
		border-radius: 4px;
		overflow: hidden;
		background: radial-gradient(ellipse at 50% 30%, #26265a 0%, var(--bg) 90%);
		aspect-ratio: 960 / 340;
	}
	.diorama.pourable canvas {
		cursor: crosshair;
		touch-action: none;
	}
	.diorama.pouring {
		border-color: rgba(108, 229, 232, 0.58);
		box-shadow: 0 0 18px rgba(108, 229, 232, 0.12);
	}
	canvas {
		display: block;
		width: 100%;
	}
	.hint {
		position: absolute;
		inset: auto 0 0 0;
		margin: 0;
		padding: 0.5rem 0.7rem;
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--muted);
		text-align: center;
		background: linear-gradient(transparent, rgba(14, 14, 40, 0.7));
	}
</style>
