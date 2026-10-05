<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { book } from './book.svelte';
	import {
		CREATURE_SPECS,
		creatureById,
		featureById,
		resolveSpawnPointForLife,
		stable01,
		type SedimentGrid,
		type SpawnLayer,
		type SpawnPoint
	} from './worldShape';
	import { byDepth } from './projection';
	import {
		CAMERA_TILT,
		HEX_SIZE,
		SEA_LEVEL,
		TILE_THICKNESS,
		hexCorners,
		hexNeighbours,
		offsetToAxial,
		projectHex
	} from './hex';
	import {
		FIELD_COLS,
		FIELD_ROWS,
		TILE_ELEVATION_SCALE,
		TILE_SCREEN_WIDTH,
		SEABED_ALPHA,
		fieldBounds,
		fieldOrigin,
		fieldTiles,
		gridExtent,
		panLimit,
		tileAtPoint,
		tileElevation,
		tileNearest
	} from './hexField';
	import {
		heightAboveSea,
		landscapeFor,
		type Landscape,
		type LandscapeState,
		type PeakSpec,
		type TreeSpec
	} from './landscape';
	import { bandHealth } from './vitals';
	import { world1Def } from './def';
	import type { Life } from './content/life';

	const ASPECT = 960 / 480;
	/**
	 * How far above the tile it's landing on the poured stream starts falling
	 * from, in canvas fractions. Both places that draw the fall (the ambient
	 * sediment cast and the live pour overlay) use this so they agree; there is
	 * no water-surface line left to hang it off instead.
	 */
	const POUR_FALL_HEIGHT = 0.16;
	/**
	 * How wide a creature is, measured in tiles.
	 *
	 * It used to be a fraction of the frame's height, which made sense when the
	 * scene was a water column filling the canvas. Against a hex field the only
	 * scale that means anything is the tile: a creature is a thing standing on the
	 * ground, and how big it is relative to that ground is the whole question. Just
	 * under one tile leaves it clearly an inhabitant rather than a landmark.
	 */
	const CREATURE_TILES = 0.9;
	/** Vitality below this starts to read as wilting; at the floor the life is fully drained. */
	const WILT_ONSET = 0.85;
	/** How far (as a fraction of canvas height) a fully wilted life sags toward its tile. */
	const WILT_SAG = 0.012;
	const PEARL_BIT_SPRITES = [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 14, 15, 48, 49, 50, 55, 57, 60, 61, 62, 63];
	const PASTEL_BIT_SPRITES = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 52, 53, 56, 59];
	const GLINT_SPRITES = [32, 33, 34, 35, 36, 37, 38, 39];
	const PUFF_SPRITES = [40, 41, 42, 43, 44, 45, 46, 47];
	const DEEPWATER_SWIM = { columns: 4, rows: 3, frames: 12, fps: 12 } as const;

	// something in the scene with a distance, held back until its whole pass has
	// been collected so it can be drawn in depth order.
	type Drawable = { z: number; render: () => void };

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

	// ── the camera ───────────────────────────────────────────────────────────────
	//
	// The frame holds FIELD_COLS columns; a world that has grown is wider, and the
	// camera is a translation along it — axonometry has no perspective to recompute,
	// so panning moves the origin and nothing else. Measured in tile columns from
	// the centred view, positive looking east, and not saved: she always comes back
	// to the home island, which is where the pan starts.
	const worldExtent = $derived(gridExtent(book.worldShape.sedimentGrid));
	const reach = $derived(panLimit(worldExtent));
	let panTarget = $state(0);
	/** The eased position the frame is actually drawn at, chasing panTarget. */
	let panNow = 0;
	/** How far a tap on an arrow carries the view, in columns — a third of the frame. */
	const PAN_STEP = 5;
	const PAN_EASE = 9;

	const clampPan = (cols: number) => Math.max(-reach, Math.min(reach, cols));

	function cameraOrigin(extent = worldExtent): { x: number; y: number } {
		const origin = fieldOrigin(extent);
		return { x: origin.x - panNow * TILE_SCREEN_WIDTH, y: origin.y };
	}

	function panBy(cols: number) {
		panTarget = clampPan(panTarget + cols);
	}

	function panKey(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') panBy(-PAN_STEP);
		else if (event.key === 'ArrowRight') panBy(PAN_STEP);
		else return;
		event.preventDefault();
	}

	let panPointerId: number | null = null;
	let panDragX = 0;

	function startPan(event: PointerEvent) {
		panPointerId = event.pointerId;
		panDragX = event.clientX;
		canvasEl?.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function movePan(event: PointerEvent) {
		if (event.pointerId !== panPointerId || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		if (rect.width <= 0) return;
		// dragging the world one way moves the camera the other, and the view follows
		// the hand rather than easing after it
		const cols = -((event.clientX - panDragX) / rect.width) / TILE_SCREEN_WIDTH;
		panDragX = event.clientX;
		panTarget = clampPan(panTarget + cols);
		panNow = panTarget;
	}

	function stopPan(event?: PointerEvent) {
		if (event && event.pointerId !== panPointerId) return;
		if (panPointerId !== null && canvasEl?.hasPointerCapture(panPointerId)) {
			canvasEl.releasePointerCapture(panPointerId);
		}
		panPointerId = null;
	}

	// Shift, the middle button, or any drag when there is nothing to pour with. A
	// plain drag is the pour — that is the one gesture the world already has.
	function startPointer(event: PointerEvent) {
		const pannable = reach > 0;
		if (pannable && (event.button === 1 || event.shiftKey || !book.canPourSediment())) {
			startPan(event);
			return;
		}
		startPour(event);
	}

	function stopPointer(event?: PointerEvent) {
		stopPan(event);
		stopPour(event);
	}

	// screen point -> a place in the density field. tileAtPoint resolves the hex
	// tile under the pointer and hands back its (u, v) in the grid's own [0, 1]
	// coordinates, returning null off the field — which is what stops a pour
	// writing past the edge of the world.
	function pointerToWaterPoint(event: PointerEvent): { x: number; y: number } | null {
		const canvas = canvasEl;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const tile = tileAtPoint(
			(event.clientX - rect.left) / rect.width,
			(event.clientY - rect.top) / rect.height,
			cameraOrigin(),
			worldExtent
		);
		return tile === null ? null : { x: tile.u, y: tile.v };
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
		let ctx = canvas.getContext('2d');
		if (!ctx) return;

		// the sediment floor doesn't animate — every cell's sprite choice and
		// placement is seeded off (x, y, spawnRevision), not time — but it was
		// still being fully repainted (up to 48x12 cells, several sprite draws
		// each) on every single animation frame. bake it to this offscreen
		// canvas once per actual change and blit the result instead.
		const sedimentCanvas = document.createElement('canvas');
		const sedimentCtx = sedimentCanvas.getContext('2d');
		// while a pour is live the floor repaints at most this often; see
		// ensureSedimentBaked.
		const SEDIMENT_BAKE_MIN_MS = 90;
		let sedimentBakedAt = -Infinity;
		let sedimentBakedGrid: SedimentGrid | null = null;
		let sedimentBakedW = 0;
		let sedimentBakedH = 0;
		// where the baked canvas sits, in canvas fractions with the camera centred
		let sedimentBakedLeft = 0;
		let sedimentBakedSpan = 1;

		const motionQuery =
			typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
		let reduce = motionQuery?.matches ?? false;
		const onMotionChange = (event: MediaQueryListEvent) => {
			reduce = event.matches;
		};
		motionQuery?.addEventListener('change', onMotionChange);

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
		// A deliberately small proof that the Sprite Studio atlas contract plays in the
		// real world canvas. Keep this local until Bestiary grows a reviewed animation
		// bundle import flow; ordinary creature sprites remain single-image assets.
		const deepwaterSwimmer = loadSheet(
			'creatures/deepwater_fish_swim_sheet.png',
			DEEPWATER_SWIM.columns,
			DEEPWATER_SWIM.rows
		);

		// the shared, public decorative-creature pool (CREATURE_SPECS) — a
		// small fixed list, so eagerly loading all of them (like the sheets
		// above) is fine regardless of what's actually been placed yet.
		const creatureSheets = new Map<string, SpriteSheet>(
			CREATURE_SPECS.map((spec) => [spec.id, loadSheet(spec.sprite, spec.cols, spec.rows)])
		);

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
			blend: GlobalCompositeOperation = 'source-over',
			// distance haze, when the sprite is something standing in the world rather
			// than an overlay drawn on top of it.
			fog?: { amount: number; tint: readonly [number, number, number] }
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
			if (fog && fog.amount > 0.01) {
				drawFogged(
					sheet.img,
					-size / 2,
					-(size * yScale) / 2,
					size,
					size * yScale,
					fog.amount,
					fog.tint,
					{ sx, sy, sw: cellW, sh: cellH }
				);
			} else {
				ctx!.drawImage(sheet.img, sx, sy, cellW, cellH, -size / 2, -(size * yScale) / 2, size, size * yScale);
			}
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

		// The witch-influence sheets (motes, auras) are drawn in 'screen' blend
		// mode, which barely moves a pixel that's already near-white — and the
		// sky/water here mostly are. A plain alpha-blended tinted halo behind the
		// sprite always shows, regardless of how pale the background is, so the
		// glow reads even where 'screen' alone would wash out invisibly.
		function drawGlow(x: number, y: number, radius: number, tint: readonly [number, number, number], alpha: number) {
			if (alpha <= 0.002 || radius <= 0) return;
			const [r, g, b] = tint;
			const glow = ctx!.createRadialGradient(x, y, 0, x, y, radius);
			glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
			glow.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
			glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
			ctx!.save();
			ctx!.fillStyle = glow;
			ctx!.beginPath();
			ctx!.arc(x, y, radius, 0, TAU);
			ctx!.fill();
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

		function spriteFor(lifeId: string): { src: string; pixelated: boolean; sizeScale: number } | null {
			const c = book.boundCreatureFor(lifeId);
			const src = c ? (c.isolatedSprite ?? c.sprite ?? null) : null;
			return src ? { src, pixelated: c!.pixelated, sizeScale: c!.sizeScale } : null;
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
				// settles at the field's own horizon rather than a waterline this camera
				// doesn't draw — the same far edge the cloud streaks above are already
				// gathered around, so the two read as one bank of mist over the water.
				const mist = ctx!.createLinearGradient(
					0,
					H * FIELD_HORIZON_Y - H * 0.1,
					0,
					H * FIELD_HORIZON_Y + H * 0.08
				);
				mist.addColorStop(0, 'rgba(255, 255, 255, 0)');
				mist.addColorStop(0.45, `rgba(255, 246, 251, ${mo})`);
				mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx!.fillStyle = mist;
				ctx!.fillRect(0, H * FIELD_HORIZON_Y - H * 0.1, W, H * 0.18);
			}
		}

		// The sea the island sits in. Under the hex camera there is no waterline to
		// draw — the water is the whole ground plane, paler with distance toward the
		// top of the frame — so the old sky-over-water split, its glaze and its shelf
		// wash have gone with the perspective floor they belonged to.
		function drawSea(T: number) {
			const sea = ctx!.createLinearGradient(0, 0, 0, H);
			const m = clamp01(book.stocks.moisture / 100);
			sea.addColorStop(0, 'rgb(207, 233, 242)');
			sea.addColorStop(0.3, `rgb(126, ${200 + m * 12}, 218)`);
			sea.addColorStop(0.62, 'rgb(47, 131, 166)');
			sea.addColorStop(1, 'rgb(27, 91, 125)');
			ctx!.fillStyle = sea;
			ctx!.fillRect(0, 0, W, H);

			// a few slow bands of open water, so the sea is not a flat wash
			if (reduce) return;
			ctx!.save();
			ctx!.globalAlpha = 0.05;
			ctx!.strokeStyle = 'rgb(255, 255, 255)';
			ctx!.lineWidth = 1;
			for (let i = 0; i < 6; i++) {
				const y = H * (0.2 + i * 0.13) + Math.sin(T * 0.4 + i) * H * 0.004;
				ctx!.beginPath();
				ctx!.moveTo(0, y);
				ctx!.bezierCurveTo(W * 0.3, y + H * 0.008, W * 0.6, y - H * 0.008, W, y);
				ctx!.stroke();
			}
			ctx!.restore();
		}

		// ── the hex field ────────────────────────────────────────────────────────
		//
		// The island she is building, drawn back to front so a tile's raised side is
		// covered by whatever stands in front of it. Nothing is drawn where the
		// seabed has not gathered: open water stays open, which is the difference
		// between an island and a tiled floor.
		const CORNERS = hexCorners();

		// The closest thing this camera has to a horizon: where the field's far edge
		// sits on screen before any elevation lifts it. fieldOrigin().y depends only on
		// FIELD_ROWS (the world grows sideways), so this is a constant, not something to recompute
		// per frame. Weather and ambient effects that used to anchor to the vanished
		// waterline (WATER_TOP, retired with the perspective camera) anchor here.
		const FIELD_HORIZON_Y = fieldOrigin().y;

		/** How much a side face is darkened relative to its own top. */
		const SIDE_SHADE = 0.72;
		/** How far the back of the field hazes, on land and under water. */
		const FIELD_HAZE_LAND = 0.34;
		const FIELD_HAZE_WATER = 0.46;
		const SKY_HAZE = [186, 219, 231] as const;
		const DEEP_HAZE = [60, 128, 160] as const;

		function traceTop(cx: number, cy: number) {
			ctx!.beginPath();
			CORNERS.forEach((c, i) => {
				const px = (cx + c.x) * W;
				const py = (cy + c.y) * H;
				if (i === 0) ctx!.moveTo(px, py);
				else ctx!.lineTo(px, py);
			});
			ctx!.closePath();
		}

		function traceSide(cx: number, cy: number, side: number) {
			// the four lower corners, extruded straight down by the tile's thickness
			const lower = [CORNERS[1], CORNERS[2], CORNERS[3], CORNERS[4]];
			ctx!.beginPath();
			lower.forEach((c, i) => {
				const px = (cx + c.x) * W;
				const py = (cy + c.y) * H;
				if (i === 0) ctx!.moveTo(px, py);
				else ctx!.lineTo(px, py);
			});
			for (let i = lower.length - 1; i >= 0; i--) {
				ctx!.lineTo((cx + lower[i].x) * W, (cy + lower[i].y + side) * H);
			}
			ctx!.closePath();
		}

		// Where a spawn point's (x, y) — still plain [0,1] fractions — lands on the
		// field, and how high the tile under it stands. This is what puts creatures
		// and features on the island rather than on a plane behind it.
		// A spawn point's (x, y) were authored against a canvas the scene filled edge
		// to edge. The field occupies the middle of the frame with open water around
		// it, so read literally they put creatures out on the rim where the seabed
		// has already faded to nothing — one of world 1's own points sits at
		// (0.8, 0.84), which lands half off the frame. Compressing toward the middle
		// keeps their arrangement relative to each other while putting all of them on
		// ground that exists.
		const SPAWN_INSET = 0.62;

		function spawnToField(u: number, v: number): { u: number; v: number } {
			return { u: 0.5 + (u - 0.5) * SPAWN_INSET, v: 0.5 + (v - 0.5) * SPAWN_INSET };
		}

		function standOn(
			u: number,
			v: number
		): { x: number; y: number; elevation: number; col: number; row: number; land: boolean } {
			const { col, row } = tileNearest(u, v, worldExtent);
			const { q, r } = offsetToAxial(col, row);
			const elevation = tileElevation(book.worldShape.sedimentGrid, col, row);
			const standing = elevation >= SEA_LEVEL ? elevation : Math.min(elevation, SEA_LEVEL * 0.92);
			const p = projectHex(q, r, standing, cameraOrigin());
			return { x: p.x, y: p.y, elevation, col, row, land: elevation >= SEA_LEVEL };
		}

		// How far above its tile a creature rides, in elevation units. A swimmer is
		// in the water over the seabed rather than sitting on it, and something in
		// the air is higher still; anything that walks stands on the top face.
		const LAYER_HOVER: Record<SpawnLayer, number> = {
			air: 0.62,
			water: 0.3,
			shore: 0,
			floor: 0
		};

		// The mark that actually does the work of putting something in the world: a
		// shadow on the tile below it, flattened to the same tilt as the tile's own
		// top face. Without it a sprite is a picture laid over the scene; with it the
		// eye reads a thing standing on ground.
		function drawTileShadow(cx: number, cy: number, radius: number, alpha: number) {
			ctx!.save();
			ctx!.globalAlpha = alpha;
			// the water swallows a shadow far more than sand does, so this leans blue
			// rather than black — a hard dark ellipse on open water reads as a hole
			ctx!.fillStyle = 'rgb(16, 46, 66)';
			ctx!.beginPath();
			ctx!.ellipse(cx * W, cy * H, radius * W, radius * W * CAMERA_TILT * 0.6, 0, 0, TAU);
			ctx!.fill();
			ctx!.restore();
		}

		// ── how a tile is coloured ───────────────────────────────────────────────
		//
		// Three things act on every tile, and they are separable on purpose so each
		// can be reasoned about alone.
		//
		// **Biome** is a ramp read off elevation: sand at the waterline, grass above
		// it, a darker green higher still. Nothing places a biome — the same thing
		// that decides land decides what kind of land.
		//
		// **Light** is one direction. The top face takes it full, the side faces are
		// in shade, and a side is a darker shade of *its own tile's* colour rather
		// than a fixed brown, so a tall tile reads as one material with a lit top.
		//
		// **Distance** hazes a tile toward the water it sits in. There is no
		// perspective here to make far things small, so haze is the only thing that
		// says a row at the back is further away than a row at the front.
		const BIOME_STOPS: readonly (readonly [number, readonly [number, number, number]])[] = [
			[0, [236, 220, 174]],
			[0.34, [206, 206, 140]],
			[0.66, [150, 190, 110]],
			[1, [104, 156, 96]]
		];

		function biomeColour(above: number): [number, number, number] {
			const t = clamp01(above);
			for (let i = 1; i < BIOME_STOPS.length; i++) {
				const [toStop, to] = BIOME_STOPS[i];
				const [fromStop, from] = BIOME_STOPS[i - 1];
				if (t <= toStop || i === BIOME_STOPS.length - 1) {
					const k = toStop === fromStop ? 0 : clamp01((t - fromStop) / (toStop - fromStop));
					return [lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k)];
				}
			}
			return [...BIOME_STOPS[0][1]] as [number, number, number];
		}

		/** Mixes a colour toward the sea it is seen through. */
		function hazed(
			c: readonly [number, number, number],
			amount: number,
			toward: readonly [number, number, number]
		) {
			return rgb(
				lerp(c[0], toward[0], amount),
				lerp(c[1], toward[1], amount),
				lerp(c[2], toward[2], amount)
			);
		}

		function drawHexField() {
			// baked with the camera centred: panning moves the finished picture, so
			// it never costs a rebake
			const origin = fieldOrigin(worldExtent);
			const tiles = fieldTiles(book.worldShape.sedimentGrid);
			// which tiles are land, so a shore can know it is a shore
			const land = new Set<string>();
			for (const t of tiles) if (t.land) land.add(`${t.col}:${t.row}`);

			for (const tile of tiles) {
				// A submerged tile is held just under the surface however deep its silt
				// is, so open water reads as water rather than as a stack of steps.
				const standing = tile.land ? tile.elevation : Math.min(tile.elevation, SEA_LEVEL * 0.92);
				const p = projectHex(tile.q, tile.r, standing, origin);
				const shallow = clamp01(tile.elevation / SEA_LEVEL);
				const submerged = (SEABED_ALPHA + (0.62 - SEABED_ALPHA) * shallow) * tile.edge;
				const grain = (stable01(`tone:${tile.homeCol}:${tile.row}`) - 0.5) * 2;

				// Rows at the back are further away. With no perspective to shrink them,
				// haze is the only thing that says so.
				const distance = 1 - tile.row / Math.max(1, FIELD_ROWS - 1);
				const haze = distance * (tile.land ? FIELD_HAZE_LAND : FIELD_HAZE_WATER);
				const hazeTo = tile.land ? SKY_HAZE : DEEP_HAZE;

				const top: [number, number, number] = tile.land
					? biomeColour((tile.elevation - SEA_LEVEL) / (TILE_ELEVATION_SCALE - SEA_LEVEL))
					: [46 + 70 * shallow, 120 + 80 * shallow, 146 + 60 * shallow];
				top[0] += grain * 7;
				top[1] += grain * 7;
				top[2] += grain * 6;

				if (p.side > 0.0005) {
					ctx!.save();
					traceSide(p.x, p.y, p.side);
					if (tile.land) {
						// the same material, in shade — not a separate brown
						ctx!.fillStyle = hazed(
							[top[0] * SIDE_SHADE, top[1] * SIDE_SHADE, top[2] * SIDE_SHADE * 0.96],
							haze,
							hazeTo
						);
					} else {
						ctx!.globalAlpha = submerged * 0.8;
						ctx!.fillStyle = 'rgb(29, 95, 124)';
					}
					ctx!.fill();
					ctx!.restore();
				}

				ctx!.save();
				traceTop(p.x, p.y);
				ctx!.globalAlpha = tile.land ? tile.edge : submerged;
				ctx!.fillStyle = hazed(top, haze, hazeTo);
				ctx!.fill();
				// Only land keeps a drawn edge. Underwater the strokes of a whole row
				// line up and read as stripes ruled across the sea; the tone difference
				// between neighbours is enough to tell tiles apart down there.
				if (tile.land) {
					// A shore is a land tile with water against it, and it catches a pale
					// line where the two meet — the one place the reference art puts a
					// hard edge, and the thing that stops an island looking stamped on.
					const shore = hexNeighbours(tile.col, tile.row).some(
						(n) => !land.has(`${n.col}:${n.row}`)
					);
					ctx!.strokeStyle = shore
						? `rgba(238, 249, 252, ${0.5 * tile.edge * (1 - haze)})`
						: `rgba(255, 255, 255, ${0.14 * tile.edge * (1 - haze)})`;
					ctx!.lineWidth = shore ? 1.6 : 1;
					ctx!.stroke();
				}
				ctx!.restore();
			}
		}

		// rebakes drawHexField() into the offscreen sediment canvas by
		// temporarily pointing the shared `ctx` at it — every draw helper below
		// already reads `ctx` dynamically, so nothing else needs to change.
		function ensureSedimentBaked(nowMs: number, force: boolean) {
			if (!sedimentCtx) return;
			const grid = book.worldShape.sedimentGrid;
			if (grid === sedimentBakedGrid && W === sedimentBakedW && H === sedimentBakedH) return;
			// A live pour hands us a new grid every single frame (pourSedimentAt
			// rebuilds it), and since C the bake is a real piece of work — the whole
			// silt surface, filled and stroked band by band. Baking it at frame rate
			// spends the cost squarely on the one interaction that has to stay
			// responsive. The grid itself still updates every frame, so nothing about
			// the pour's arithmetic changes; only the painted floor trails it, by less
			// than a tenth of a second, under a falling stream drawn live on top. The
			// frame the pour ends is forced, so what she let go of is what she sees.
			if (!force && nowMs - sedimentBakedAt < SEDIMENT_BAKE_MIN_MS) return;
			// The frame, widened to take in the whole world. The home world fits inside
			// the frame, so for it this is exactly the canvas it has always baked.
			const bounds = fieldBounds(worldExtent);
			sedimentBakedLeft = Math.min(0, bounds.left);
			sedimentBakedSpan = Math.max(1, bounds.right) - sedimentBakedLeft;
			sedimentCanvas.width = Math.max(1, Math.round(W * sedimentBakedSpan * dpr));
			sedimentCanvas.height = Math.max(1, Math.round(H * dpr));
			const liveCtx = ctx;
			ctx = sedimentCtx;
			ctx.setTransform(dpr, 0, 0, dpr, -sedimentBakedLeft * W * dpr, 0);
			ctx.clearRect(sedimentBakedLeft * W, 0, sedimentBakedSpan * W, H);
			drawHexField();
			ctx = liveCtx;
			sedimentBakedGrid = grid;
			sedimentBakedW = W;
			sedimentBakedH = H;
			sedimentBakedAt = nowMs;
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

		// Placed features stand on a tile like anything else, so they are collected
		// and depth-sorted with the land and the creatures rather than painted first:
		// a mountain or a tree behind one must not cover it, and one in front must.
		// A feature outranks the land on its own tile, and a creature outranks both.
		const FEATURE_Z_LIFT = 0.0004;

		function collectFeatures(into: Drawable[]) {
			for (const placed of book.worldShape.placedFeatures) {
				const spec = featureById(placed.featureId);
				if (!spec) continue;
				// placed.y is already the grid's depth axis, so a feature projects
				// onto the plane the same way a sediment cell does — including the
				// foreshortening, which is what stops a feature at the back of the
				// floor from reading as pasted on top of it, and the height of the
				// silt it was settled into, since placeFeatureOnBestSediment seeks
				// exactly the deep cells that now stand proud of the floor.
				const projected = standOn(placed.x, placed.y);
				const x = projected.x * W;
				const size = H * 0.13 * placed.scale;
				// features are placed on the deepest sediment rows by design
				// (placeFeatureOnBestSediment favors them), which can sit close
				// enough to y=1 that the feature — plus its grounding shadow at
				// y + size * 0.35 — would spill past the bottom of the canvas.
				const y = Math.min(projected.y * H, H - size * 0.5 - H * 0.01);
				into.push({
					z: projected.row / Math.max(1, FIELD_ROWS - 1) + FEATURE_Z_LIFT,
					render() {
						ctx!.save();
						ctx!.globalAlpha = 0.2;
						ctx!.fillStyle = 'rgb(14, 14, 40)';
						ctx!.beginPath();
						ctx!.ellipse(x, y + size * 0.28, size * 0.35, size * 0.07, 0, 0, Math.PI * 2);
						ctx!.fill();
						ctx!.restore();
						const img = spec!.sprite ? getFeatureSprite(spec!.sprite) : null;
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
				});
			}
		}

		function layerBob(layer: SpawnLayer, T: number, seed: number): number {
			if (reduce) return 0;
			const amp = layer === 'air' ? 0.035 : layer === 'shore' ? 0.008 : 0.022;
			const speed = layer === 'air' ? 0.5 : 0.65;
			return Math.sin(T * speed + seed * Math.PI * 2) * H * amp;
		}

		// resolveSpawnPointForLife regenerates the entire spawn-point pool —
		// including a scan of the sediment grid — on every call, but the point it
		// resolves to for a given life only changes when the worldspace or
		// spawnRevision does. it was being called twice per life on every single
		// animation frame; cache it instead, invalidating on those two keys.
		let spawnPointCacheKey = '';
		const spawnPointCache = new Map<string, SpawnPoint>();
		function spawnPointFor(life: Life): SpawnPoint {
			const shape = book.worldShape;
			const key = `${shape.activeWorldspace}:${shape.spawnRevision}`;
			if (key !== spawnPointCacheKey) {
				spawnPointCache.clear();
				spawnPointCacheKey = key;
			}
			let point = spawnPointCache.get(life.id);
			if (!point) {
				point = resolveSpawnPointForLife(life, shape);
				spawnPointCache.set(life.id, point);
			}
			return point;
		}

		// Tinting a sprite by distance needs the fog to land on the sprite's own
		// pixels, not on the water behind it — so the sprite goes to a scratch canvas
		// first, takes a `source-atop` wash there, and arrives here already hazed.
		// One canvas, reused, grown as needed.
		const fogCanvas = document.createElement('canvas');
		const fogCtx = fogCanvas.getContext('2d');

		function drawFogged(
			img: CanvasImageSource,
			dx: number,
			dy: number,
			dw: number,
			dh: number,
			fog: number,
			tint: readonly [number, number, number],
			source?: { sx: number; sy: number; sw: number; sh: number }
		) {
			// the scratch is sized to where the sprite *lands*, not to the source art:
			// a bound Bestiary creature can be a 1024px png drawn at 90, and rasterizing
			// the full source every frame would cost far more than the haze is worth.
			// device pixels, so a hi-dpi screen loses no sharpness on the round trip.
			const rw = Math.ceil(dw * dpr);
			const rh = Math.ceil(dh * dpr);
			if (!fogCtx || fog <= 0.01 || rw <= 0 || rh <= 0) {
				if (source) ctx!.drawImage(img, source.sx, source.sy, source.sw, source.sh, dx, dy, dw, dh);
				else ctx!.drawImage(img, dx, dy, dw, dh);
				return;
			}
			if (fogCanvas.width < rw || fogCanvas.height < rh) {
				fogCanvas.width = Math.max(fogCanvas.width, rw);
				fogCanvas.height = Math.max(fogCanvas.height, rh);
			}
			fogCtx.setTransform(1, 0, 0, 1, 0, 0);
			fogCtx.globalCompositeOperation = 'source-over';
			fogCtx.clearRect(0, 0, rw, rh);
			fogCtx.imageSmoothingEnabled = ctx!.imageSmoothingEnabled;
			if (source) fogCtx.drawImage(img, source.sx, source.sy, source.sw, source.sh, 0, 0, rw, rh);
			else fogCtx.drawImage(img, 0, 0, rw, rh);
			fogCtx.globalCompositeOperation = 'source-atop';
			fogCtx.fillStyle = `rgba(${tint[0] | 0}, ${tint[1] | 0}, ${tint[2] | 0}, ${fog})`;
			fogCtx.fillRect(0, 0, rw, rh);
			fogCtx.globalCompositeOperation = 'source-over';
			ctx!.drawImage(fogCanvas, 0, 0, rw, rh, dx, dy, dw, dh);
		}

		// One creature, already placed in depth. Collected rather than drawn on sight
		// so the whole layer can be sorted back-to-front first (see drawSceneLayers).
		function collectLife(layers: SpawnLayer[], T: number, into: Drawable[]) {
			for (const life of book.life) {
				const info = spriteFor(life.id);
				if (!info) continue;
				const point = spawnPointFor(life);
				if (!layers.includes(point.layer)) continue;
				const entry = getSprite(info.src);
				if (!entry.ok || !entry.img.naturalWidth) continue;

				const seed = point.x + point.y + life.id.length * 0.013;
				const stage = book.stageOf(life.id);
				// A spawn point's (x, y) are still plain fractions; read as a place in
				// the field they name the tile this life belongs to. Everything else
				// follows from that tile: what it stands on, how high, and — since the
				// camera has no perspective — a size that no longer depends on where
				// in the frame it happens to be.
				const inset = spawnToField(point.x, point.y);
				const spot = standOn(inset.u, inset.v);
				const box =
					HEX_SIZE *
					2 *
					W *
					CREATURE_TILES *
					point.scale *
					info.sizeScale *
					(0.58 + 0.42 * (stage / 3));
				const scale = box / Math.max(entry.img.naturalWidth, entry.img.naturalHeight);
				const dw = entry.img.naturalWidth * scale;
				const dh = entry.img.naturalHeight * scale;
				// A handful of spawn points serve many lives — world 1 alone has four
				// aquatic sharing three points — so co-located lives are fanned apart
				// by a stable per-(point, life) offset rather than stacking.
				const fan = (stable01(`${point.id}:${life.id}:fan`) - 0.5) * HEX_SIZE * 1.3;
				const cx = clamp01(spot.x + fan);
				// The hover is what separates a swimmer from a walker: the shadow stays
				// on the tile while the creature rides above it.
				const hover = LAYER_HOVER[point.layer] ?? 0;
				const footY = spot.y;
				// Wilting makes stress legible: a life under it drains of colour, sags
				// toward the tile it stands on, and stops bobbing. Vitality floors rather
				// than hitting zero (dormant, recoverable), so this is the whole range
				// short of death. Unobserved life (stage 0) has no vitality worth showing.
				const vitality = book.vitalityOf(life.id);
				const wilt = stage === 0 ? 0 : clamp01((WILT_ONSET - vitality) / WILT_ONSET);
				const bodyY =
					footY -
					hover * TILE_THICKNESS * (1 - 0.5 * wilt) +
					(reduce ? 0 : (layerBob(point.layer, T, seed) / H) * (1 - wilt)) +
					wilt * WILT_SAG;
				const alpha = clamp01(stage === 0 ? 0.3 : 0.55 + 0.45 * vitality);

				into.push({
					// depth is the row it stands in, so creatures sort among themselves
					// the same way the tiles they stand on do
					z: spot.row / Math.max(1, FIELD_ROWS - 1),
					render() {
						drawTileShadow(
							cx,
							footY,
							dw / W / 2.4,
							alpha * 0.26 * (1 - hover * 0.5) * (spot.land ? 1 : 0.34)
						);
						ctx!.save();
						ctx!.globalAlpha = alpha;
						ctx!.imageSmoothingEnabled = !info.pixelated;
						// ctx.filter is ignored where unsupported; alpha still carries the fade
						if (wilt > 0) ctx!.filter = `saturate(${1 - 0.85 * wilt}) brightness(${1 - 0.25 * wilt})`;
						const wdh = dh * (1 - 0.1 * wilt);
						ctx!.drawImage(entry.img, cx * W - dw / 2, bodyY * H - wdh * 0.82, dw, wdh);
						ctx!.restore();
					}
				});
			}
		}

		// the shared decorative creatures Brianna calls into the scene
		// (CREATURE_SPECS / worldShape.placedCreatures) — no vitals/stage
		// concept, just an animated sprite sheet at a fixed placed spot.
		function collectPlacedCreatures(layers: SpawnLayer[], T: number, into: Drawable[]) {
			for (const placed of book.worldShape.placedCreatures) {
				const spec = creatureById(placed.creatureId);
				if (!spec || !layers.includes(spec.layer)) continue;
				const sheet = creatureSheets.get(spec.id);
				if (!sheet || !sheet.ok || !sheet.img.naturalWidth) continue;

				const cellW = sheet.img.naturalWidth / sheet.cols;
				const cellH = sheet.img.naturalHeight / sheet.rows;
				const yScale = cellW > 0 ? cellH / cellW : 1;
				// same footing as the living life: the tile its (x, y) names
				const inset = spawnToField(placed.x, placed.y);
				const spot = standOn(inset.u, inset.v);
				const size = HEX_SIZE * 2 * W * CREATURE_TILES * spec.boxScale * placed.scale;
				const dh = size * yScale;
				const seed = placed.x + placed.y + placed.id.length * 0.013;
				const jitter = (stable01(`${placed.id}:fan`) - 0.5) * HEX_SIZE * 1.3;
				const cx = clamp01(spot.x + jitter);
				const hover = LAYER_HOVER[spec.layer] ?? 0;
				const footY = spot.y;
				const bodyY =
					footY - hover * TILE_THICKNESS + (reduce ? 0 : layerBob(spec.layer, T, seed) / H);

				into.push({
					z: spot.row / Math.max(1, FIELD_ROWS - 1),
					render() {
						drawTileShadow(
							cx,
							footY,
							size / W / 2.4,
							0.24 * (1 - hover * 0.5) * (spot.land ? 1 : 0.34)
						);
						const frame = Math.floor(T * spec.fps) % spec.frameCount;
						drawSheetSprite(sheet, frame, cx * W, bodyY * H - dh * 0.32, size, placed.rotation, 1, yScale);
					}
				});
			}
		}

		// ── the land's answer to the world ───────────────────────────────────────
		//
		// Forests and mountains are read from state (see landscape.ts), not placed.
		// They cannot live in the sediment bake: that is rebuilt only when the silt
		// changes, and the plants' health, the world's complexity and its deaths all
		// move without it. They are also drawn as depth-sorted objects alongside the
		// creatures rather than painted under them, so a tree in front of a creature
		// stands in front of it.
		const TILE_W = HEX_SIZE * Math.sqrt(3);
		const LANDSCAPE_REBUILD_MS = 120;
		let landscape: Landscape | null = null;
		let landscapeGrid: SedimentGrid | null = null;
		let landscapeKey = '';
		let landscapeAt = -Infinity;

		function landscapeState(): LandscapeState {
			const { bands, bandFalloff } = world1Def.stock;
			const stocks = book.stocks;
			return {
				moistureHealth: bandHealth(stocks.moisture, bands.moisture[0], bands.moisture[1], bandFalloff) / 100,
				nutrientHealth: bandHealth(stocks.nutrients, bands.nutrients[0], bands.nutrients[1], bandFalloff) / 100,
				stability: book.stability,
				complexity: book.complexity,
				deaths: book.deadCount
			};
		}

		function currentLandscape(nowMs: number): Landscape {
			const grid = book.worldShape.sedimentGrid;
			const state = landscapeState();
			// Quantised, so the land does not rebuild for a change nobody could see.
			const key = [
				Math.round(state.moistureHealth * 40),
				Math.round(state.nutrientHealth * 40),
				Math.round(state.stability / 4),
				Math.round(state.complexity),
				state.deaths
			].join(':');
			const stale = !landscape || grid !== landscapeGrid || key !== landscapeKey;
			// A live pour hands over a new grid every frame, like the sediment bake it
			// sits beside; trail it by a beat rather than rebuild at frame rate.
			if (stale && (!landscape || !isPouring || nowMs - landscapeAt >= LANDSCAPE_REBUILD_MS)) {
				landscape = landscapeFor(fieldTiles(grid), state);
				landscapeGrid = grid;
				landscapeKey = key;
				landscapeAt = nowMs;
			}
			return landscape!;
		}

		/** Green when the plants' needs are met, going to straw as they are not. */
		function leafColour(vigor: number, conifer: boolean, shade: number): [number, number, number] {
			const healthy = conifer ? [52, 112, 82] : [78, 146, 88];
			const parched = conifer ? [112, 122, 74] : [176, 154, 86];
			return [
				lerp(parched[0], healthy[0], vigor) * shade,
				lerp(parched[1], healthy[1], vigor) * shade,
				lerp(parched[2], healthy[2], vigor) * shade
			];
		}

		function drawTree(
			tree: TreeSpec,
			tileX: number,
			tileY: number,
			vigor: number,
			haze: number,
			T: number
		) {
			const unit = HEX_SIZE * W;
			// a stressed forest is stunted as well as pale
			const h = unit * 1.7 * tree.size * (0.55 + 0.45 * vigor);
			const sway = reduce ? 0 : Math.sin(T * 0.9 + tree.phase) * h * 0.035;
			const bx = (tileX + tree.dx * TILE_W) * W;
			const by = (tileY + tree.dy * TILE_W * CAMERA_TILT) * H;

			ctx!.save();
			ctx!.globalAlpha *= 0.2 * (1 - haze);
			ctx!.fillStyle = 'rgb(16, 46, 66)';
			ctx!.beginPath();
			ctx!.ellipse(bx + h * 0.12, by, h * 0.3, h * 0.3 * CAMERA_TILT, 0, 0, TAU);
			ctx!.fill();
			ctx!.restore();

			if (tree.conifer) {
				ctx!.fillStyle = hazed([84, 62, 48], haze, SKY_HAZE);
				ctx!.fillRect(bx - h * 0.04, by - h * 0.16, h * 0.08, h * 0.16);
				for (let tier = 0; tier < 3; tier++) {
					const top = by - h * (1 - tier * 0.24);
					const spread = h * (0.2 + tier * 0.1);
					const lit = leafColour(vigor, true, 1 + (2 - tier) * 0.06);
					ctx!.fillStyle = hazed(lit, haze, SKY_HAZE);
					ctx!.beginPath();
					ctx!.moveTo(bx + sway * (1 - tier * 0.3), top);
					ctx!.lineTo(bx - spread, top + h * 0.36);
					ctx!.lineTo(bx + spread, top + h * 0.36);
					ctx!.closePath();
					ctx!.fill();
				}
			} else {
				ctx!.fillStyle = hazed([96, 72, 52], haze, SKY_HAZE);
				ctx!.fillRect(bx - h * 0.04, by - h * 0.42, h * 0.08, h * 0.42);
				const cx = bx + sway;
				const cy = by - h * 0.66;
				ctx!.fillStyle = hazed(leafColour(vigor, false, 0.86), haze, SKY_HAZE);
				ctx!.beginPath();
				ctx!.ellipse(cx + h * 0.06, cy + h * 0.05, h * 0.34, h * 0.3, 0, 0, TAU);
				ctx!.fill();
				ctx!.fillStyle = hazed(leafColour(vigor, false, 1.04), haze, SKY_HAZE);
				ctx!.beginPath();
				ctx!.ellipse(cx - h * 0.04, cy - h * 0.03, h * 0.3, h * 0.27, 0, 0, TAU);
				ctx!.fill();
			}
		}

		const ROCK_LIT = [154, 148, 142] as const;
		const ROCK_SHADE = [108, 104, 106] as const;
		const SNOW_LIT = [246, 249, 252] as const;
		const SNOW_SHADE = [208, 218, 230] as const;

		function drawPeak(peak: PeakSpec, tileX: number, tileY: number, haze: number) {
			const unit = HEX_SIZE * W;
			const cx = tileX * W;
			const cy = tileY * H;
			const halfBase = unit * 1.15;
			const rise = unit * (1.0 + 2.3 * peak.height);
			const flat = halfBase * CAMERA_TILT * 0.4;
			const apex = { x: cx + peak.lean * halfBase * 0.3, y: cy - rise };
			const left = { x: cx - halfBase, y: cy + flat * 0.4 };
			const right = { x: cx + halfBase, y: cy + flat * 0.4 };
			const foot = { x: cx + peak.lean * halfBase * 0.1, y: cy + flat * 1.6 };
			const along = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
				x: lerp(a.x, b.x, t),
				y: lerp(a.y, b.y, t)
			});
			const face = (pts: { x: number; y: number }[], colour: readonly [number, number, number]) => {
				ctx!.fillStyle = hazed(colour, haze, SKY_HAZE);
				ctx!.beginPath();
				pts.forEach((p, i) => (i === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)));
				ctx!.closePath();
				ctx!.fill();
			};

			ctx!.save();
			ctx!.globalAlpha *= 0.22 * (1 - haze);
			ctx!.fillStyle = 'rgb(16, 46, 66)';
			ctx!.beginPath();
			ctx!.ellipse(cx + halfBase * 0.35, cy + flat * 1.2, halfBase * 1.1, halfBase * 0.34, 0, 0, TAU);
			ctx!.fill();
			ctx!.restore();

			face([apex, left, foot], ROCK_LIT);
			face([apex, foot, right], ROCK_SHADE);
			if (peak.snow > 0) {
				const f = 0.2 + 0.5 * peak.snow;
				// a ragged lower edge, so the cap is weather and not a triangle laid on a triangle
				const lowL = along(apex, left, f);
				const lowM = along(apex, foot, f * 1.15);
				const lowR = along(apex, right, f);
				face([apex, lowL, along(lowL, lowM, 0.5), lowM], SNOW_LIT);
				face([apex, lowM, along(lowM, lowR, 0.5), lowR], SNOW_SHADE);
			}
		}

		/** What stands on a faded rim tile fades with it, so the island dissolves instead of keeping a hard edge of trees. */
		function withEdge(edge: number, draw: () => void) {
			ctx!.save();
			ctx!.globalAlpha *= edge;
			draw();
			ctx!.restore();
		}

		function collectLandscape(T: number, into: Drawable[]) {
			const { vigor, tiles } = currentLandscape(T * 1000);
			const origin = cameraOrigin();
			const grid = book.worldShape.sedimentGrid;
			for (const tile of tiles) {
				const elevation = tileElevation(grid, tile.col, tile.row);
				const { q, r } = offsetToAxial(tile.col, tile.row);
				const p = projectHex(q, r, elevation, origin);
				// a grown world runs well past the frame; keep to what can be seen
				if (p.x < -0.1 || p.x > 1.1) continue;
				const distance = 1 - tile.row / Math.max(1, FIELD_ROWS - 1);
				const haze = distance * FIELD_HAZE_LAND;
				// the same row-based depth the creatures use, so they sort together
				const z = tile.row / Math.max(1, FIELD_ROWS - 1);
				// only tall enough to matter if it is actually high ground
				if (tile.peak && heightAboveSea(elevation) > 0) {
					const peak = tile.peak;
					into.push({ z, render: () => withEdge(tile.edge, () => drawPeak(peak, p.x, p.y, haze)) });
				}
				if (tile.trees.length) {
					const trees = [...tile.trees].sort((a, b) => a.dy - b.dy);
					into.push({
						z,
						render: () =>
							withEdge(tile.edge, () => {
								for (const tree of trees) drawTree(tree, p.x, p.y, vigor, haze, T);
							})
					});
				}
			}
		}

		// Back-to-front within a pass. The four hand-ordered buckets stay two passes,
		// split at the water's surface — the glaze and ripples are a film on it, not
		// an object in the volume, so they keep their fixed place between. Inside each
		// pass the order was `book.life`'s roster order, which had nothing to do with
		// distance: a creature at the back could draw over one at the front.
		function drawSceneLayers(layers: SpawnLayer[], T: number) {
			const items: Drawable[] = [];
			// the land goes in first, so on a tie a creature stands in front of it
			if (layers.includes('floor')) {
				collectLandscape(T, items);
				collectFeatures(items);
			}
			collectLife(layers, T, items);
			collectPlacedCreatures(layers, T, items);
			items.sort(byDepth);
			for (const item of items) item.render();
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
				// pourPoint is a place in the density field; stand it on the tile she is
				// actually pouring onto, so the stream ends where the silt is landing.
				const landing = standOn(pourPoint.x, pourPoint.y);
				const x = landing.x * W;
				const y = landing.y * H;
				// falls from above the tile it's landing on, not a waterline this camera
				// no longer draws.
				const top = y - H * POUR_FALL_HEIGHT;
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

		// tint per sheet row, so each mote's halo matches its sparkle's own
		// color instead of one generic glow.
		const MOTE_TINTS: Record<number, readonly [number, number, number]> = {
			0: [214, 120, 150],
			1: [120, 205, 205],
			2: [235, 230, 245],
			4: [165, 155, 225],
			5: [230, 195, 90],
			6: [200, 210, 235],
			7: [200, 210, 235]
		};

		function drawWitchMotes(T: number, intensity: number) {
			if (!witchMotes.ok || intensity <= 0.02) return;
			const rows = [0, 1, 2, 4, 5, 6, 7];
			// tuned against a water column that filled the frame; the world it drifts
			// over is a third of that now, and at the old count it read as static
			const count = Math.round(5 + intensity * 12 + book.attentionUsed * 0.8);
			for (let i = 0; i < count; i++) {
				const seed = `witch-mote-${book.worldIndex}-${i}`;
				const drift = (T * (0.018 + stable01(`${seed}-speed`) * 0.025) + stable01(`${seed}-phase`)) % 1;
				const sway = Math.sin(T * (0.5 + stable01(`${seed}-sway`) * 0.8) + stable01(seed) * TAU);
				const x = W * (0.06 + stable01(`${seed}-x`) * 0.88) + sway * W * 0.012;
				const y = H * (0.24 + stable01(`${seed}-y`) * 0.5) - drift * H * 0.14;
				const row = rows[i % rows.length];
				const col = Math.floor(stable01(`${seed}-col`) * 8);
				const size = H * (0.018 + stable01(`${seed}-size`) * 0.026);
				const twinkle = 0.65 + 0.35 * Math.sin(T * (1.2 + stable01(`${seed}-blink`)) + i);
				drawGlow(x, y, size * 0.95, MOTE_TINTS[row] ?? [200, 210, 235], (0.22 + 0.5 * intensity) * twinkle);
				drawSheetSprite(
					witchMotes,
					row * 8 + col,
					x,
					y,
					size,
					0,
					(0.16 + 0.58 * intensity) * twinkle,
					1,
					'screen'
				);
			}
		}

		function drawAnimatorSwimmer(T: number, intensity: number) {
			if (!deepwaterSwimmer.ok || !deepwaterSwimmer.img.naturalWidth) return;

			const seed = stable01(`animator-swimmer:${book.worldIndex}`);
			const passage = reduce ? 0.48 : (seed + T * 0.024) % 1;
			const frame = reduce ? 0 : Math.floor(T * DEEPWATER_SWIM.fps) % DEEPWATER_SWIM.frames;
			const bob = reduce ? 0 : Math.sin(T * 0.9 + seed * TAU) * H * 0.012;
			const x = W * (1.12 - passage * 1.26);
			// no water-surface line to hang this off any more; keep it in the open
			// sea beyond the field's far edge so it drifts past the island rather
			// than swims over it.
			const y = H * (0.03 + seed * (FIELD_HORIZON_Y - 0.1)) + bob;
			const size = H * (0.18 + seed * 0.035);
			const alpha = 0.32 + intensity * 0.2;

			ctx!.save();
			ctx!.globalAlpha = alpha * 0.16;
			ctx!.fillStyle = 'rgb(33, 39, 77)';
			ctx!.beginPath();
			ctx!.ellipse(x + size * 0.03, y + size * 0.19, size * 0.29, size * 0.045, 0, 0, TAU);
			ctx!.fill();
			ctx!.restore();

			drawSheetSprite(deepwaterSwimmer, frame, x, y, size, 0, alpha, 1);
		}

		function drawWaterRipples(T: number, moisture: number, intensity: number) {
			if (!waterRipples.ok || intensity <= 0.01) return;
			const count = 2 + Math.round(moisture * 3);
			for (let i = 0; i < count; i++) {
				const seed = `ripple-${book.worldIndex}-${i}`;
				const frame = Math.floor(T * (5.5 + i * 0.4) + stable01(`${seed}-phase`) * 8) % 8;
				const row = i % 2;
				const x = W * (0.12 + stable01(`${seed}-x`) * 0.76);
				// no waterline to hang this off any more; ripples read best on the open
				// water nearest the viewer, in front of the field rather than through it.
				const y = H * (0.83 + stable01(`${seed}-y`) * 0.14);
				const size = H * (0.12 + stable01(`${seed}-size`) * 0.15);
				const alpha = (0.14 + 0.34 * intensity) * (0.75 + 0.25 * Math.sin(T + i));
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

		// The falling silt. Its x used to be seeded off `book.worldIndex` and never
		// consulted `pourPoint`, so during a pour the stream ran at full intensity
		// somewhere the pointer wasn't — cause and effect with the travel between them
		// missing. Given a landing spot it now starts at the surface above that spot,
		// falls to it, and puffs where it arrives, foreshortened by the landing depth
		// so a pour at the back of the floor is a smaller, shorter fall than one at the
		// front. Without one it keeps the ambient wandering it always had.
		// Silt arriving on a tile.
		//
		// It used to fall from a water surface drawn as a line near the top of the
		// frame, down a column seen edge-on. There is no such surface under this
		// camera and no column to fall down: the world is seen from above, so what
		// reads is the arrival — a short plume dropping onto the tile she is pouring
		// into, and a puff spreading across its top face in the same flattened
		// ellipse the tile itself is drawn in.
		function drawSedimentCast(
			T: number,
			intensity: number,
			landing: { x: number; y: number } | null
		) {
			if (!sedimentCast.ok || !sedimentCast.img.naturalWidth || intensity <= 0.03) return;
			const sw = sedimentCast.img.naturalWidth / 8;
			const streamH = sedimentCast.img.naturalHeight / 2;
			const puffY = sedimentCast.img.naturalHeight - sw;
			const frame = Math.floor(T * 6) % 8;

			// where it lands, and how far above the tile the fall starts
			const spot = landing
				? standOn(landing.x, landing.y)
				: standOn(0.5, 0.5);
			const drop = H * POUR_FALL_HEIGHT;
			const width = H * 0.1;
			const alpha = 0.14 + intensity * 0.32;
			const x = spot.x * W;
			const groundY = spot.y * H;

			drawSheetRegion(
				sedimentCast, frame * sw, 0, sw, streamH,
				x, groundY - drop, width, drop, alpha, 0, 'screen'
			);
			drawSheetRegion(
				sedimentCast, frame * sw, puffY, sw, sw,
				x, groundY, width * 1.5, width * 1.5 * CAMERA_TILT, alpha * 1.2, 0, 'screen'
			);
		}

		const AURA_TINTS: Record<number, readonly [number, number, number]> = {
			0: [235, 230, 245],
			1: [150, 140, 150],
			2: [230, 200, 110],
			3: [214, 130, 150]
		};

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
				// an aura anchored to a feature has to stand on the same tile the
				// feature itself does — standOn, the way collectFeatures places the
				// feature sprite — or it drifts off the thing it belongs to. This used
				// to ride the old floor projection, which this camera replaced; there's
				// also no per-distance scale to apply any more, so size is fixed.
				const anchor = placed ? standOn(placed.x, placed.y) : null;
				const size = H * (0.15 + stable01(`${seed}-size`) * 0.05);
				const x = anchor ? anchor.x * W : W * (0.17 + i * 0.22 + (stable01(`${seed}-x`) - 0.5) * 0.05);
				const y = anchor
					? Math.min(anchor.y * H, H - size * 0.5 - H * 0.01)
					: H * (FIELD_HORIZON_Y + stable01(`${seed}-y`) * 0.5);
				const pulse = 0.78 + 0.22 * Math.sin(T * (0.8 + stable01(`${seed}-pulse`)) + i);
				drawGlow(x, y, size * 0.6, AURA_TINTS[row] ?? [200, 190, 220], (0.18 + intensity * 0.32) * pulse);
				drawSheetSprite(
					featureAwakenings,
					row * 4 + (i % 4),
					x,
					y,
					size,
					0,
					(0.13 + intensity * 0.26) * pulse,
					1,
					'screen'
				);
			}
		}

		// A perceptual ramp: raw signals below get compressed toward the top of
		// their [0,1] range, so a little tending reads as a visible glow right
		// away instead of needing everything maxed before anything shows.
		const shine = (x: number) => Math.pow(clamp01(x), 0.55);

		function draw(tMs: number) {
			const T = tMs / 1000;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx!.clearRect(0, 0, W, H);

			const m = clamp01(book.stocks.moisture / 100);
			const fav = clamp01(book.favor / 100);
			const attention = clamp01(book.attentionUsed / Math.max(1, book.attentionCapacity));

			// how present she is *right now* — attention spent, insight flowing,
			// trust earned. fast-moving; this is what the motes/ripples/sediment
			// answer to.
			const tending = clamp01(
				attention * 0.42 + Math.min(book.insightPerSec / 4, 1) * 0.36 + fav * 0.22
			);
			// how deeply the world has come to be known and shaped — slow and
			// structural, unlike `tending`. this is what the feature auras answer to.
			const witnessed = clamp01(
				book.knownCount * 0.05 +
					book.worldShape.placedFeatures.length * 0.12 +
					(book.selfBalancing ? 0.22 : 0)
			);

			drawSea(T);
			drawWeather(T);
			ensureSedimentBaked(tMs, !isPouring);
			ctx!.drawImage(
				sedimentCanvas,
				(sedimentBakedLeft - panNow * TILE_SCREEN_WIDTH) * W,
				0,
				sedimentBakedSpan * W,
				H
			);
			drawSedimentCast(T, isPouring ? 1 : shine(tending) * 0.45, isPouring ? pourPoint : null);
			// Everything that stands on a tile is one depth-sorted list — land, features,
			// swimmers and walkers — so nothing in front is covered by something behind.
			// Only what flies is left for after the ripples, which are a film on the water.
			drawSceneLayers(['water', 'floor', 'shore'], T);
			drawFeatureAuras(T, shine(witnessed));
			drawAnimatorSwimmer(T, shine(tending));
			drawWaterRipples(T, m, shine(tending * 0.6 + m * 0.4));
			drawSceneLayers(['air'], T);
			drawRain(T);
			drawWitchMotes(T, shine(tending));
			drawOverlays(T);
		}

		let raf = 0;
		let running = true;
		let lastFrameAt = 0;
		function stepPan(t: number) {
			const dt = Math.min(0.1, Math.max(0, (t - lastFrameAt) / 1000));
			lastFrameAt = t;
			// the world can shrink under the camera (a cheat, a reset), so hold the target in range
			const held = clampPan(panTarget);
			if (held !== panTarget) panTarget = held;
			if (reduce || Math.abs(panTarget - panNow) < 0.002) panNow = panTarget;
			else panNow += (panTarget - panNow) * (1 - Math.exp(-dt * PAN_EASE));
		}

		function frame(t: number) {
			if (!running) return;
			stepPan(t);
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

		// A trackpad's sideways scroll, or shift and the wheel, pans a world that has
		// grown. Registered by hand because Svelte's own wheel listener is passive, and
		// this has to be able to keep the page from scrolling under the gesture. Plain
		// vertical scrolling is left alone, so the page still scrolls past the canvas.
		function onWheel(event: WheelEvent) {
			if (reach <= 0) return;
			const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
			if (sideways === 0) return;
			event.preventDefault();
			const rect = canvas.getBoundingClientRect();
			if (rect.width <= 0) return;
			const cols = sideways / rect.width / TILE_SCREEN_WIDTH;
			panTarget = clampPan(panTarget + cols);
			panNow = panTarget;
		}
		canvas.addEventListener('wheel', onWheel, { passive: false });

		return () => {
			canvas.removeEventListener('wheel', onWheel);
			stopPour();
			running = false;
			if (raf) cancelAnimationFrame(raf);
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			motionQuery?.removeEventListener('change', onMotionChange);
		};
	});
</script>

<div class="diorama" bind:this={wrapEl} class:pourable={book.canPourSediment()} class:pouring={isPouring}>
	<canvas
		bind:this={canvasEl}
		aria-label={book.canPourSediment()
			? 'a living water world — tap and drag on the water to sift sediment into shallows'
			: 'a living water world where sediment can gather into shallows'}
		onpointerdown={startPointer}
		onpointermove={(event) => {
			movePan(event);
			movePour(event);
		}}
		onpointerup={stopPointer}
		onpointercancel={stopPointer}
		onlostpointercapture={stopPointer}
	></canvas>
	{#if reach > 0}
		<button
			type="button"
			class="pan pan-left"
			aria-label="look west along the world"
			disabled={panTarget <= -reach}
			onclick={() => panBy(-PAN_STEP)}
			onkeydown={panKey}
		>
			‹
		</button>
		<button
			type="button"
			class="pan pan-right"
			aria-label="look east along the world"
			disabled={panTarget >= reach}
			onclick={() => panBy(PAN_STEP)}
			onkeydown={panKey}
		>
			›
		</button>
		<div class="pan-track" aria-hidden="true">
			<div
				class="pan-thumb"
				style:left="{(1 - FIELD_COLS / worldExtent) * (0.5 + panTarget / (2 * reach)) * 100}%"
				style:width="{(FIELD_COLS / worldExtent) * 100}%"
			></div>
		</div>
	{/if}
</div>

<style>
	.diorama {
		position: relative;
		width: 100%;
		border: 1px solid var(--rule);
		border-radius: 4px;
		overflow: hidden;
		background: linear-gradient(180deg, #f3ecda 0%, #e7cdc6 45%, #b9c9a8 100%);
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
	.pan {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 2rem;
		height: 3rem;
		border: 1px solid var(--rule);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.5);
		color: inherit;
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.7;
	}
	.pan:hover:not(:disabled),
	.pan:focus-visible {
		opacity: 1;
		background: rgba(255, 255, 255, 0.8);
	}
	.pan:disabled {
		opacity: 0.18;
		cursor: default;
	}
	.pan-left {
		left: 0.5rem;
	}
	.pan-right {
		right: 0.5rem;
	}
	/* where the frame sits along the whole world */
	.pan-track {
		position: absolute;
		left: 50%;
		bottom: 0.45rem;
		width: 5rem;
		height: 3px;
		transform: translateX(-50%);
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.35);
		pointer-events: none;
	}
	.pan-thumb {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.85);
	}
</style>
