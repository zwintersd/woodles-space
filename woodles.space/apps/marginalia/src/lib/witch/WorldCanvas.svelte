<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { book } from './book.svelte';
	import {
		WORLD_WATER_TOP,
		featureById,
		resolveSpawnPointForLife,
		stable01,
		waterGridYToWorld,
		worldYToWaterGrid,
		type SpawnLayer
	} from './worldShape';

	const ASPECT = 960 / 480;
	const WATER_TOP = WORLD_WATER_TOP;
	const CREATURE_BOX = 0.2;
	const PEARL_BIT_SPRITES = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 14, 15, 48, 49, 50, 55, 57, 60, 61, 62, 63];
	const PASTEL_BIT_SPRITES = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 52, 53, 56, 59];
	const GLINT_SPRITES = [32, 33, 34, 35, 36, 37, 38, 39];
	const PUFF_SPRITES = [40, 41, 42, 43, 44, 45, 46, 47];

	let wrapEl: HTMLDivElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let isPouring = $state(false);

	const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const rgb = (r: number, g: number, b: number) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
	const TAU = Math.PI * 2;
	const assetUrl = (name: string, bust = 0) =>
		`${base}/diorama/${name}${bust ? `?r=${bust}` : ''}`;

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

		interface SpriteSheet {
			img: HTMLImageElement;
			ok: boolean;
			cols: number;
			rows: number;
		}

		function loadSheet(name: string, cols: number, rows: number): SpriteSheet {
			const sheet = { img: new Image(), ok: false, cols, rows };
			sheet.img.onload = () => {
				sheet.ok = true;
			};
			sheet.img.src = assetUrl(name);
			return sheet;
		}

		const sedimentBits = loadSheet('pearl_sediment_bits.png', 8, 8);
		const sedimentClusters = loadSheet('pearl_sediment_clusters.png', 4, 4);
		const witchMotes = loadSheet('witch_influence_motes.png', 8, 8);
		const waterRipples = loadSheet('witch_water_ripples.png', 8, 2);
		const sedimentCast = loadSheet('sift_sediment_cast.png', 8, 4);
		const featureAwakenings = loadSheet('feature_awakenings.png', 4, 4);

		function pickSprite(options: number[], seed: string): number {
			return options[Math.floor(stable01(seed) * options.length) % options.length];
		}

		function drawSheetSprite(
			sheet: SpriteSheet,
			index: number,
			x: number,
			y: number,
			size: number,
			rotation: number,
			alpha: number,
			yScale = 1,
			blend: GlobalCompositeOperation = 'source-over'
		): boolean {
			if (!sheet.ok || !sheet.img.naturalWidth || !sheet.img.naturalHeight) return false;
			const cellW = sheet.img.naturalWidth / sheet.cols;
			const cellH = sheet.img.naturalHeight / sheet.rows;
			const sx = (index % sheet.cols) * cellW;
			const sy = Math.floor(index / sheet.cols) * cellH;
			ctx!.save();
			ctx!.translate(x, y);
			ctx!.rotate(rotation);
			ctx!.globalAlpha = clamp01(alpha);
			ctx!.globalCompositeOperation = blend;
			ctx!.imageSmoothingEnabled = true;
			ctx!.drawImage(sheet.img, sx, sy, cellW, cellH, -size / 2, -(size * yScale) / 2, size, size * yScale);
			ctx!.restore();
			return true;
		}

		function drawSheetRegion(
			sheet: SpriteSheet,
			sx: number,
			sy: number,
			sw: number,
			sh: number,
			cx: number,
			cy: number,
			dw: number,
			dh: number,
			alpha: number,
			rotation = 0,
			blend: GlobalCompositeOperation = 'source-over'
		) {
			if (!sheet.ok || !sheet.img.naturalWidth || alpha <= 0 || dw <= 0 || dh <= 0) return;
			ctx!.save();
			ctx!.globalAlpha = clamp01(alpha);
			ctx!.globalCompositeOperation = blend;
			ctx!.translate(cx, cy);
			if (rotation) ctx!.rotate(rotation);
			ctx!.imageSmoothingEnabled = true;
			ctx!.drawImage(sheet.img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
			ctx!.restore();
		}

		const spriteCache = new Map<string, { img: HTMLImageElement; ok: boolean }>();
		function getSprite(src: string) {
			let entry = spriteCache.get(src);
			if (!entry) {
				entry = { img: new Image(), ok: false };
				entry.img.onload = () => {
					entry!.ok = true;
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
			sky.addColorStop(0, rgb(lerp(236, 255, fav), lerp(178, 214, o), lerp(198, 226, o)));
			sky.addColorStop(0.58, rgb(lerp(242, 255, fav), lerp(193, 221, o), lerp(211, 235, o)));
			sky.addColorStop(1, rgb(lerp(210, 232, o), lerp(166, 194, fav), lerp(207, 228, fav)));
			ctx!.fillStyle = sky;
			ctx!.fillRect(0, 0, W, horizon + 1);

			const drift = reduce ? 0 : T;
			ctx!.save();
			ctx!.globalAlpha = 0.18 + fav * 0.16;
			ctx!.strokeStyle = 'rgba(255, 252, 252, 0.72)';
			ctx!.lineWidth = 1;
			for (let i = 0; i < 5; i++) {
				const y = horizon * (0.18 + i * 0.13) + Math.sin(drift * 0.25 + i) * H * 0.006;
				ctx!.beginPath();
				ctx!.moveTo(-W * 0.08, y);
				ctx!.bezierCurveTo(W * 0.22, y - H * 0.025, W * 0.48, y + H * 0.018, W * 1.08, y - H * 0.006);
				ctx!.stroke();
			}
			ctx!.restore();

			const horizonGlow = ctx!.createLinearGradient(0, horizon - H * 0.09, 0, horizon + H * 0.04);
			horizonGlow.addColorStop(0, 'rgba(255, 255, 255, 0)');
			horizonGlow.addColorStop(0.7, 'rgba(255, 245, 250, 0.28)');
			horizonGlow.addColorStop(1, 'rgba(210, 164, 198, 0)');
			ctx!.fillStyle = horizonGlow;
			ctx!.fillRect(0, horizon - H * 0.09, W, H * 0.13);
		}

		function drawWeather(T: number) {
			const m = clamp01(book.stocks.moisture / 100);
			const drift = reduce ? 0 : T;
			const veilOpacity = clamp01((m - 0.25) / 0.5);
			if (veilOpacity > 0.01) {
				ctx!.save();
				ctx!.globalAlpha = veilOpacity * 0.34;
				ctx!.strokeStyle = 'rgba(255, 255, 255, 0.68)';
				ctx!.lineWidth = H * 0.018;
				ctx!.lineCap = 'round';
				for (let i = 0; i < 3; i++) {
					const y = H * (0.09 + i * 0.085);
					const offset = ((drift * W * (0.01 + i * 0.003) + i * W * 0.31) % (W * 1.2)) - W * 0.1;
					ctx!.beginPath();
					ctx!.moveTo(offset - W * 0.28, y);
					ctx!.bezierCurveTo(offset, y - H * 0.035, offset + W * 0.28, y + H * 0.025, offset + W * 0.62, y);
					ctx!.stroke();
				}
				ctx!.restore();
			}

			const mo = clamp01((m - 0.4) / 0.4) * 0.42;
			if (mo > 0.01) {
				const mist = ctx!.createLinearGradient(0, H * WATER_TOP - H * 0.1, 0, H * WATER_TOP + H * 0.08);
				mist.addColorStop(0, 'rgba(255, 255, 255, 0)');
				mist.addColorStop(0.45, `rgba(255, 246, 251, ${mo})`);
				mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx!.fillStyle = mist;
				ctx!.fillRect(0, H * WATER_TOP - H * 0.1, W, H * 0.18);
			}
		}

		function drawWaterBase(T: number) {
			const waterY = H * WATER_TOP;
			const waterH = H - waterY;
			const m = clamp01(book.stocks.moisture / 100);
			const waterGrad = ctx!.createLinearGradient(0, waterY, 0, H);
			waterGrad.addColorStop(0, `rgba(255, 229, 239, ${0.28 + m * 0.1})`);
			waterGrad.addColorStop(0.32, 'rgba(204, 193, 229, 0.58)');
			waterGrad.addColorStop(1, 'rgba(132, 146, 205, 0.78)');
			ctx!.fillStyle = waterGrad;
			ctx!.fillRect(0, waterY, W, waterH);

			const wave = reduce ? 0 : Math.sin(T * 0.9) * H * 0.004;
			ctx!.save();
			ctx!.globalAlpha = 0.18;
			ctx!.strokeStyle = 'rgba(255, 255, 255, 0.74)';
			ctx!.lineWidth = 1;
			for (let i = 0; i < 7; i++) {
				const y = waterY + ((i + 1) / 8) * waterH + wave * (i + 1);
				ctx!.beginPath();
				ctx!.moveTo(-W * 0.05, y);
				ctx!.bezierCurveTo(W * 0.22, y + H * 0.012, W * 0.48, y - H * 0.01, W * 1.05, y + H * 0.006);
				ctx!.stroke();
			}
			ctx!.restore();

			ctx!.save();
			ctx!.globalAlpha = 0.36;
			ctx!.strokeStyle = 'rgba(255, 250, 252, 0.82)';
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
					const seed = `${x}:${y}:${book.worldShape.spawnRevision}`;
					const depth = y / Math.max(1, grid.h - 1);

					ctx!.save();
					ctx!.globalAlpha = (0.06 + value * 0.22) * (1 - depth * 0.18);
					const pearl = ctx!.createRadialGradient(cx - cellW * 0.22, cy - cellH * 0.22, 0, cx, cy, cellW * (1.2 + value));
					pearl.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
					pearl.addColorStop(0.46, value > 0.62 ? 'rgba(249, 242, 255, 0.9)' : 'rgba(248, 248, 242, 0.78)');
					pearl.addColorStop(1, 'rgba(205, 218, 244, 0.18)');
					ctx!.fillStyle = pearl;
					ctx!.beginPath();
					ctx!.ellipse(cx, cy, cellW * (0.75 + value), cellH * (0.5 + value * 0.3), 0, 0, Math.PI * 2);
					ctx!.fill();
					ctx!.restore();

					if (value > 0.42 && stable01(`${seed}:puff`) < value * 0.28) {
						const sprite = pickSprite(PUFF_SPRITES, `${seed}:puff-sprite`);
						const size = cellW * (2.1 + stable01(`${seed}:puff-size`) * 1.3);
						drawSheetSprite(
							sedimentBits,
							sprite,
							cx + (stable01(`${seed}:puff-x`) - 0.5) * cellW * 0.8,
							cy + (stable01(`${seed}:puff-y`) - 0.5) * cellH * 0.5,
							size,
							(stable01(`${seed}:puff-r`) - 0.5) * 0.7,
							0.16 + value * 0.22,
							0.72
						);
					}

					if (value > 0.24 && stable01(`${seed}:cluster`) < value * 0.44) {
						const sprite = Math.floor(stable01(`${seed}:cluster-sprite`) * 16);
						const size = cellW * (1.8 + value * 2.4 + stable01(`${seed}:cluster-size`) * 0.8);
						if (!drawSheetSprite(
							sedimentClusters,
							sprite,
							cx + (stable01(`${seed}:cluster-x`) - 0.5) * cellW * 0.85,
							cy + cellH * (0.1 + stable01(`${seed}:cluster-y`) * 0.28),
							size,
							(stable01(`${seed}:cluster-r`) - 0.5) * 0.42,
							0.32 + value * 0.56,
							0.72 + stable01(`${seed}:cluster-scale-y`) * 0.22
						)) {
							ctx!.save();
							ctx!.globalAlpha = 0.12 + value * 0.36;
							ctx!.fillStyle = 'rgba(255, 255, 255, 0.82)';
							ctx!.beginPath();
							ctx!.ellipse(cx, cy, cellW * (0.75 + value), cellH * (0.5 + value * 0.3), 0, 0, Math.PI * 2);
							ctx!.fill();
							ctx!.restore();
						}
					}

					const bitCount = value > 0.62 ? 3 : value > 0.28 ? 2 : 1;
					for (let i = 0; i < bitCount; i++) {
						const bitSeed = `${seed}:bit:${i}`;
						if (stable01(`${bitSeed}:skip`) > 0.35 + value * 0.56) continue;
						const roll = stable01(`${bitSeed}:kind`);
						const sprite =
							roll > 0.88 && value > 0.4
								? pickSprite(GLINT_SPRITES, `${bitSeed}:glint`)
								: roll > 0.62
									? pickSprite(PASTEL_BIT_SPRITES, `${bitSeed}:pastel`)
									: pickSprite(PEARL_BIT_SPRITES, `${bitSeed}:pearl`);
						const size = cellW * (0.72 + stable01(`${bitSeed}:size`) * 1.1) * (0.84 + value * 0.5);
						drawSheetSprite(
							sedimentBits,
							sprite,
							cx + (stable01(`${bitSeed}:x`) - 0.5) * cellW * 1.5,
							cy + (stable01(`${bitSeed}:y`) - 0.5) * cellH * 1.1,
							size,
							(stable01(`${bitSeed}:r`) - 0.5) * Math.PI,
							0.42 + value * 0.44,
							0.72 + stable01(`${bitSeed}:ys`) * 0.46
						);
					}
				}
			}
		}

		function drawShallowsShelf() {
			if (book.worldShape.activeWorldspace !== 'shallows') return;
			const y = H * 0.57;
			const shelf = ctx!.createLinearGradient(0, y - 16, 0, y + 52);
			shelf.addColorStop(0, 'rgba(255, 255, 255, 0)');
			shelf.addColorStop(0.4, 'rgba(248, 241, 255, 0.32)');
			shelf.addColorStop(1, 'rgba(196, 174, 223, 0.24)');
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
			if (ro2 <= 0.01) return;
			const drift = reduce ? 0 : T;
			ctx!.save();
			ctx!.globalAlpha = ro2 * 0.44;
			ctx!.strokeStyle = 'rgba(255, 248, 252, 0.72)';
			ctx!.lineWidth = 1;
			for (let i = 0; i < 80; i++) {
				const x = (i * 73 + drift * W * 0.12) % (W + 60) - 30;
				const y = (i * 31 + drift * H * 0.9) % (H + 80) - 80;
				ctx!.beginPath();
				ctx!.moveTo(x, y);
				ctx!.lineTo(x - H * 0.025, y + H * 0.12);
				ctx!.stroke();
			}
			ctx!.restore();
		}

		function drawWaterGlaze(T: number) {
			const drift = reduce ? 0 : T;
			const waterY = H * WATER_TOP;
			ctx!.save();
			ctx!.globalAlpha = 0.18;
			ctx!.fillStyle = 'rgba(255, 255, 255, 0.54)';
			for (let i = 0; i < 8; i++) {
				const y = waterY + ((i + 1) / 9) * (H - waterY);
				ctx!.fillRect(((drift * 8 + i * 37) % 80) - 80, y, W + 120, 1);
			}
			ctx!.restore();
		}

		function drawOverlays(T: number) {
			const stab = clamp01(book.stability / 100);
			if (stab < 0.999) {
				ctx!.save();
				ctx!.globalAlpha = (1 - stab) * 0.3;
				ctx!.fillStyle = 'rgb(86, 60, 96)';
				ctx!.fillRect(0, 0, W, H);
				ctx!.restore();
			}
			if (book.quiet) {
				const vg = ctx!.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
				vg.addColorStop(0, 'rgba(70,38,75,0)');
				vg.addColorStop(1, 'rgba(70,38,75,0.42)');
				ctx!.fillStyle = vg;
				ctx!.fillRect(0, 0, W, H);
			}
			if (isPouring && pourPoint) {
				const x = pourPoint.x * W;
				const y = H * waterGridYToWorld(pourPoint.y);
				const top = H * WATER_TOP + H * 0.012;
				const bottom = Math.max(top + H * 0.035, y);
				const drift = reduce ? 0 : T;

				ctx!.save();
				ctx!.globalAlpha = 0.34;
				ctx!.strokeStyle = 'rgba(255, 255, 255, 0.78)';
				ctx!.lineWidth = H * 0.01;
				ctx!.lineCap = 'round';
				ctx!.beginPath();
				ctx!.moveTo(x, top);
				ctx!.bezierCurveTo(x - H * 0.02, top + (bottom - top) * 0.24, x + H * 0.018, bottom * 0.74 + top * 0.26, x, bottom);
				ctx!.stroke();
				ctx!.restore();

				ctx!.save();
				for (let i = 0; i < 24; i++) {
					const fall = (i / 24 + drift * 0.46) % 1;
					const wobble = Math.sin(i * 1.91 + drift * 2.4) * H * 0.012;
					const px = x + wobble + Math.cos(i * 0.7) * H * 0.005;
					const py = top + (bottom - top) * fall;
					const r = H * (0.0038 + (i % 4) * 0.0012) * (0.7 + fall * 0.45);
					const pearl = ctx!.createRadialGradient(px - r * 0.35, py - r * 0.35, 0, px, py, r * 2.2);
					pearl.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
					pearl.addColorStop(0.48, 'rgba(250, 244, 255, 0.78)');
					pearl.addColorStop(1, 'rgba(206, 223, 248, 0)');
					ctx!.globalAlpha = 0.38 + fall * 0.36;
					ctx!.fillStyle = pearl;
					ctx!.beginPath();
					ctx!.arc(px, py, r * 2.2, 0, Math.PI * 2);
					ctx!.fill();
				}
				ctx!.restore();

				for (let i = 0; i < 14; i++) {
					const fall = (i / 14 + drift * 0.58) % 1;
					const seed = `pour:${i}`;
					const px = x + Math.sin(i * 2.3 + drift * 3.4) * H * 0.018;
					const py = top + (bottom - top) * fall;
					const sprite =
						stable01(`${seed}:kind`) > 0.72
							? pickSprite(PASTEL_BIT_SPRITES, `${seed}:pastel`)
							: pickSprite(PEARL_BIT_SPRITES, `${seed}:pearl`);
					drawSheetSprite(
						sedimentBits,
						sprite,
						px,
						py,
						H * (0.012 + stable01(`${seed}:size`) * 0.014),
						drift * (0.9 + stable01(`${seed}:spin`) * 1.2) + i,
						0.28 + fall * 0.45,
						0.78 + stable01(`${seed}:ys`) * 0.32
					);
				}

				ctx!.save();
				ctx!.globalAlpha = 0.78;
				ctx!.strokeStyle = 'rgba(255, 255, 255, 0.86)';
				ctx!.lineWidth = 1;
				ctx!.beginPath();
				ctx!.arc(x, y, H * 0.045, 0, Math.PI * 2);
				ctx!.stroke();
				ctx!.globalAlpha = 0.2;
				ctx!.fillStyle = 'rgba(255, 255, 255, 0.72)';
				ctx!.beginPath();
				ctx!.arc(x, y, H * 0.03, 0, Math.PI * 2);
				ctx!.fill();
				ctx!.restore();
			}
		}

		function drawWitchMotes(T: number, intensity: number) {
			if (!witchMotes.ok || intensity <= 0.02) return;
			const rows = [0, 1, 2, 4, 5, 6, 7];
			const count = Math.round(6 + intensity * 16 + book.attentionUsed * 1.5);
			for (let i = 0; i < count; i++) {
				const seed = `witch-mote-${book.worldIndex}-${i}`;
				const drift = (T * (0.018 + stable01(`${seed}-speed`) * 0.025) + stable01(`${seed}-phase`)) % 1;
				const sway = Math.sin(T * (0.5 + stable01(`${seed}-sway`) * 0.8) + stable01(seed) * TAU);
				const x = W * (0.06 + stable01(`${seed}-x`) * 0.88) + sway * W * 0.012;
				const y = H * (0.32 + stable01(`${seed}-y`) * 0.58) - drift * H * 0.16;
				const row = rows[i % rows.length];
				const col = Math.floor(stable01(`${seed}-col`) * 8);
				const size = H * (0.018 + stable01(`${seed}-size`) * 0.026);
				const twinkle = 0.65 + 0.35 * Math.sin(T * (1.2 + stable01(`${seed}-blink`)) + i);
				drawSheetSprite(
					witchMotes,
					row * 8 + col,
					x,
					y,
					size,
					0,
					(0.1 + 0.42 * intensity) * twinkle,
					1,
					'screen'
				);
			}
		}

		function drawWaterRipples(T: number, moisture: number, intensity: number) {
			if (!waterRipples.ok || intensity <= 0.01) return;
			const count = 2 + Math.round(moisture * 3);
			for (let i = 0; i < count; i++) {
				const seed = `ripple-${book.worldIndex}-${i}`;
				const frame = Math.floor(T * (5.5 + i * 0.4) + stable01(`${seed}-phase`) * 8) % 8;
				const row = i % 2;
				const x = W * (0.12 + stable01(`${seed}-x`) * 0.76);
				const y = H * (WATER_TOP + 0.06 + stable01(`${seed}-y`) * 0.2);
				const size = H * (0.12 + stable01(`${seed}-size`) * 0.15);
				const alpha = (0.1 + 0.22 * intensity) * (0.75 + 0.25 * Math.sin(T + i));
				drawSheetSprite(
					waterRipples,
					row * 8 + frame,
					x,
					y,
					row === 0 ? size : size * 1.45,
					0,
					alpha,
					row === 0 ? 1 : 0.42,
					'screen'
				);
			}
		}

		function drawSedimentCast(T: number, intensity: number) {
			if (!sedimentCast.ok || !sedimentCast.img.naturalWidth || intensity <= 0.03) return;
			const sw = sedimentCast.img.naturalWidth / 8;
			const streamH = sedimentCast.img.naturalHeight / 2;
			const puffY = sedimentCast.img.naturalHeight - sw;
			const casts = intensity > 0.55 ? 2 : 1;
			for (let i = 0; i < casts; i++) {
				const seed = `sediment-cast-${book.worldIndex}-${i}`;
				const frame = Math.floor(T * 6 + stable01(`${seed}-phase`) * 8) % 8;
				const x = W * (0.28 + stable01(`${seed}-x`) * 0.44);
				const lean = (stable01(`${seed}-lean`) - 0.5) * 0.18;
				const streamW = H * (0.12 + stable01(`${seed}-w`) * 0.05);
				const streamAlpha = 0.11 + intensity * 0.2;
				drawSheetRegion(
					sedimentCast,
					frame * sw,
					0,
					sw,
					streamH,
					x,
					H * (WATER_TOP - 0.025),
					streamW,
					H * 0.42,
					streamAlpha,
					lean,
					'screen'
				);
				drawSheetRegion(
					sedimentCast,
					frame * sw,
					puffY,
					sw,
					sw,
					x + lean * H * 0.16,
					H * (WATER_TOP + 0.205),
					streamW * 1.3,
					H * 0.09,
					streamAlpha * 1.25,
					0,
					'screen'
				);
			}
		}

		function drawFeatureAuras(T: number, intensity: number) {
			if (!featureAwakenings.ok || intensity <= 0.02) return;
			const interventions = Object.keys(book.interventionsDone).length;
			const count = Math.min(
				4,
				Math.max(
					book.worldShape.placedFeatures.length,
					book.selfBalancing ? 2 : 0,
					Math.ceil(interventions / 2),
					Math.floor(book.knownCount / 4)
				)
			);
			if (count <= 0) return;
			for (let i = 0; i < count; i++) {
				const seed = `feature-aura-${book.worldIndex}-${i}`;
				const rowBase = Math.min(3, Math.floor(intensity * 3 + interventions / 5));
				const row = Math.min(3, rowBase + (Math.sin(T * 0.7 + i) > 0.7 ? 1 : 0));
				const placed = book.worldShape.placedFeatures[i % Math.max(1, book.worldShape.placedFeatures.length)];
				const x = placed ? placed.x * W : W * (0.17 + i * 0.22 + (stable01(`${seed}-x`) - 0.5) * 0.05);
				const y = placed
					? H * waterGridYToWorld(placed.y)
					: H * (WATER_TOP + 0.12 + stable01(`${seed}-y`) * 0.28);
				const size = H * (0.15 + stable01(`${seed}-size`) * 0.05);
				const pulse = 0.78 + 0.22 * Math.sin(T * (0.8 + stable01(`${seed}-pulse`)) + i);
				drawSheetSprite(
					featureAwakenings,
					row * 4 + (i % 4),
					x,
					y,
					size,
					0,
					(0.08 + intensity * 0.16) * pulse,
					1,
					'screen'
				);
			}
		}

		function draw(tMs: number) {
			const T = tMs / 1000;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx!.clearRect(0, 0, W, H);

			const m = clamp01(book.stocks.moisture / 100);
			const fav = clamp01(book.favor / 100);
			const attention = clamp01(book.attentionUsed / Math.max(1, book.attentionCapacity));
			const witchInfluence = clamp01(
				book.life.length * 0.03 +
					book.knownCount * 0.035 +
					book.worldShape.placedFeatures.length * 0.08 +
					attention * 0.24 +
					Math.min(book.insightPerSec / 4, 0.25) +
					fav * 0.14 +
					(isPouring ? 0.28 : 0)
			);

			drawSky(T);
			drawWeather(T);
			drawWaterBase(T);
			drawSedimentGrid();
			drawSedimentCast(T, isPouring ? 1 : witchInfluence * 0.35);
			drawShallowsShelf();
			drawFeatures();
			drawFeatureAuras(T, witchInfluence);
			drawCreatureLayers(['water', 'floor'], T);
			drawWaterGlaze(T);
			drawWaterRipples(T, m, witchInfluence);
			drawCreatureLayers(['shore', 'air'], T);
			drawRain(T);
			drawWitchMotes(T, witchInfluence);
			drawOverlays(T);
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
</div>

<style>
	.diorama {
		position: relative;
		width: 100%;
		border: 1px solid var(--rule);
		border-radius: 4px;
		overflow: hidden;
		background: linear-gradient(180deg, #f8cdd9 0%, #e7b6ce 38%, #b8b2db 100%);
		aspect-ratio: 960 / 480;
	}
	.diorama.pourable canvas {
		cursor: crosshair;
		touch-action: none;
	}
	.diorama.pouring {
		border-color: rgba(255, 255, 255, 0.74);
		box-shadow: 0 0 18px rgba(255, 236, 248, 0.2);
	}
	canvas {
		display: block;
		width: 100%;
	}
</style>
