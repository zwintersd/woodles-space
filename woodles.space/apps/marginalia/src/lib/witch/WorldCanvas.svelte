<script lang="ts">
	// The world, drawn — a side-on biome diorama that fills and animates from the
	// vital signs (see DESIGN.md §1.6, ASSETS.md). Every layer is optional: the sky
	// is painted in code, and each image draws only once it has loaded, so the scene
	// degrades gracefully while the art is still arriving (and retries until it is).
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { book } from './book.svelte';
	import type { LifeCategory } from './content/life';

	// reference frame is 960×340 (see ASSETS.md); the canvas keeps that aspect.
	const ASPECT = 960 / 340;
	// layout fractions — where the land line, soil band, and water sit. Tunable to
	// match the terrain art once it's in.
	const LAND_Y = 0.52; // horizon, as a fraction of height
	const SOIL_H = 0.2;
	const WATER_TOP = 0.66;

	let wrapEl: HTMLDivElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let anyReady = $state(false);

	// ── asset slots ───────────────────────────────────────────────────────────
	// each slot tries its candidate filenames in order; terrain may be png or svg.
	interface Slot {
		img: HTMLImageElement;
		ok: boolean;
		cands: string[];
		i: number;
	}
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
	let terrain: Slot;
	let soil: Slot;
	let water: Slot;
	let clouds: Slot[] = [];

	// ── small helpers ───────────────────────────────────────────────────────
	const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const rgb = (r: number, g: number, b: number) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
	// a stable 0..1 from a life id, for un-gridded placement and phase offsets
	const hash01 = (s: string) => {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return (h >>> 0) % 1000 / 1000;
	};

	onMount(() => {
		// bound by the time onMount runs; assert so the closures below keep the type
		const canvas = canvasEl!;
		const wrap = wrapEl!;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		sun = makeSlot(['sky-sun.png']);
		mist = makeSlot(['mist.png']);
		rain = makeSlot(['rain.png']);
		terrain = makeSlot(['terrain.png', 'terrain.svg']);
		soil = makeSlot(['soil.png']);
		water = makeSlot(['water.png']);
		clouds = [makeSlot(['cloud-a.png']), makeSlot(['cloud-b.png']), makeSlot(['cloud-c.png'])];

		const reduce =
			typeof matchMedia !== 'undefined' &&
			matchMedia('(prefers-reduced-motion: reduce)').matches;

		// offscreen buffer for tinting the soil to its alpha shape
		const off = document.createElement('canvas');
		const octx = off.getContext('2d');

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

		function tinted(img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number, tint: string) {
			if (!octx || dw <= 0 || dh <= 0) return;
			off.width = Math.ceil(dw);
			off.height = Math.ceil(dh);
			octx.clearRect(0, 0, off.width, off.height);
			octx.drawImage(img, 0, 0, dw, dh);
			octx.globalCompositeOperation = 'source-atop';
			octx.fillStyle = tint;
			octx.fillRect(0, 0, dw, dh);
			octx.globalCompositeOperation = 'source-over';
			ctx!.drawImage(off, dx, dy);
		}

		// retry loading anything still missing — covers a deploy/upload lag.
		let attempt = 0;
		const retry = setInterval(() => {
			attempt++;
			const slots = [sun, mist, rain, terrain, soil, water, ...clouds];
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

		// ── creatures: bound Bestiary sprites standing in their zone ────────────
		// loaded lazily by sprite src and cached; rebinds just add a new entry.
		const spriteCache = new Map<string, { img: HTMLImageElement; ok: boolean }>();
		function getSprite(src: string) {
			let e = spriteCache.get(src);
			if (!e) {
				const entry = { img: new Image(), ok: false };
				entry.img.onload = () => {
					entry.ok = true;
					anyReady = true;
				};
				entry.img.src = src;
				spriteCache.set(src, entry);
				e = entry;
			}
			return e;
		}
		function spriteFor(lifeId: string): { src: string; pixelated: boolean } | null {
			const c = book.boundCreatureFor(lifeId);
			const src = c ? (c.isolatedSprite ?? c.sprite ?? null) : null;
			return src ? { src, pixelated: c!.pixelated } : null;
		}

		// where each category stands, and how it moves
		const ZONE: Record<
			LifeCategory,
			{ y: number; amp: number; speed: number; ground?: boolean }
		> = {
			atmospheric: { y: 0.24, amp: 0.03, speed: 0.5 },
			terrestrial: { y: LAND_Y, amp: 0.012, speed: 0.7, ground: true },
			aquatic: { y: 0.8, amp: 0.025, speed: 0.6 }
		};
		const CREATURE_BOX = 0.2; // max sprite box, as a fraction of height

		function drawZone(cat: LifeCategory, T: number) {
			const zone = ZONE[cat];
			const group = book.life.filter((l) => l.category === cat && spriteFor(l.id));
			for (let j = 0; j < group.length; j++) {
				const l = group[j];
				const info = spriteFor(l.id)!;
				const e = getSprite(info.src);
				if (!e.ok || !e.img.naturalWidth) continue;

				const stage = book.stageOf(l.id);
				const box = H * CREATURE_BOX * (0.6 + 0.4 * (stage / 3));
				const scale = box / Math.max(e.img.naturalWidth, e.img.naturalHeight);
				const dw = e.img.naturalWidth * scale;
				const dh = e.img.naturalHeight * scale;

				const frac = (j + 0.5) / group.length;
				const jitter = (hash01(l.id) - 0.5) * (W / group.length) * 0.4;
				const cx = W * (0.08 + 0.84 * frac) + jitter;
				const zoneY = H * zone.y;
				const bob = reduce ? 0 : Math.sin(T * zone.speed + hash01(l.id) * 6.283) * H * zone.amp;
				const cy = (zone.ground ? zoneY - dh / 2 : zoneY) + bob;

				// unwitnessed life is faint; witnessed life dims as it suffers
				const alpha = clamp01(stage === 0 ? 0.3 : 0.55 + 0.45 * book.vitalityOf(l.id));

				if (zone.ground) {
					ctx!.save();
					ctx!.globalAlpha = alpha * 0.25;
					ctx!.fillStyle = 'rgb(14, 14, 40)';
					ctx!.beginPath();
					ctx!.ellipse(cx, zoneY, dw * 0.32, dh * 0.06, 0, 0, Math.PI * 2);
					ctx!.fill();
					ctx!.restore();
				}

				ctx!.save();
				ctx!.globalAlpha = alpha;
				ctx!.imageSmoothingEnabled = !info.pixelated;
				ctx!.drawImage(e.img, cx - dw / 2, cy - dh / 2, dw, dh);
				ctx!.restore();
			}
		}

		function draw(tMs: number) {
			if (!ctx) return;
			const T = tMs / 1000;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);

			// read the live signs
			const o = clamp01(book.stocks.oxygen / 100);
			const m = clamp01(book.stocks.moisture / 100);
			const n = clamp01(book.stocks.nutrients / 100);
			const stab = clamp01(book.stability / 100);
			const fav = clamp01(book.favor / 100);
			const drift = reduce ? 0 : T;

			const landY = H * LAND_Y;

			// ── sky: painted in code, brighter & bluer with oxygen ──────────────
			const sky = ctx.createLinearGradient(0, 0, 0, landY);
			sky.addColorStop(0, rgb(lerp(26, 34, o), lerp(26, 52, o), lerp(62, 96, o)));
			sky.addColorStop(1, rgb(lerp(45, 92, o), lerp(45, 150, o), lerp(95, 182, o)));
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, W, landY + 1);

			// ── sun + halo (halo tracks favor) ──────────────────────────────────
			if (sun.ok) {
				const ss = H * 0.55;
				const sx = W * 0.76 - ss / 2;
				const sy = H * 0.2 - ss / 2;
				const pulse = reduce ? 1 : 0.85 + 0.15 * Math.sin(T * 0.8);
				ctx.save();
				ctx.globalAlpha = (0.25 + 0.5 * fav) * pulse;
				ctx.drawImage(sun.img, sx, sy, ss, ss);
				ctx.restore();
			}

			// ── clouds: count & opacity rise with moisture, drift across ────────
			const cloudOpacity = clamp01((m - 0.25) / 0.5);
			const cloudCount = m < 0.35 ? 1 : m < 0.65 ? 2 : 3;
			if (cloudOpacity > 0.01) {
				const cw = W * 0.34;
				const ch = cw * 0.5;
				ctx.save();
				ctx.globalAlpha = cloudOpacity;
				for (let i = 0; i < cloudCount; i++) {
					const c = clouds[i];
					if (!c?.ok) continue;
					const span = W + cw;
					const speed = (0.012 + i * 0.004) * W;
					const x = (((drift * speed + i * W * 0.37) % span) + span) % span - cw;
					const y = H * (0.08 + i * 0.1);
					ctx.drawImage(c.img, x, y, cw, ch);
				}
				ctx.restore();
			}

			// ── mist: a low haze near the shore, density with moisture ──────────
			if (mist.ok) {
				const mo = clamp01((m - 0.4) / 0.4) * 0.6;
				if (mo > 0.01) {
					const mw = W * 1.1;
					const mh = H * 0.3;
					const x = -(((drift * W * 0.006) % (mw - W)) + 0);
					ctx.save();
					ctx.globalAlpha = mo;
					ctx.drawImage(mist.img, x, landY - mh * 0.7, mw, mh);
					ctx.restore();
				}
			}

			// ── terrain: full-frame, land baked into the lower portion ──────────
			if (terrain.ok) ctx.drawImage(terrain.img, 0, 0, W, H);

			// ── soil band: tinted richer/darker as nutrients rise ───────────────
			if (soil.ok) {
				const richness = `rgba(58, 34, 46, ${0.12 + 0.5 * n})`;
				tinted(soil.img, 0, landY, W, H * SOIL_H, richness);
			}

			// ── aquatic life, then water washes over it ─────────────────────────
			drawZone('aquatic', T);
			if (water.ok) {
				const bob = reduce ? 0 : Math.sin(T * 0.9) * (H * 0.004);
				ctx.save();
				ctx.globalAlpha = 0.9;
				ctx.drawImage(water.img, 0, H * WATER_TOP + bob, W, H * (1 - WATER_TOP) + 2);
				ctx.restore();
			}

			// ── land & sky life, standing in front of the water ─────────────────
			drawZone('terrestrial', T);
			drawZone('atmospheric', T);

			// ── rain: only when quite wet; tiled and scrolling ──────────────────
			if (rain.ok) {
				const ro2 = clamp01((m - 0.7) / 0.3) * 0.7;
				if (ro2 > 0.01) {
					const rw = W * 0.13;
					const rh = rw * 2;
					const scroll = reduce ? 0 : (drift * H * 0.5) % rh;
					ctx.save();
					ctx.globalAlpha = ro2;
					for (let y = -rh + scroll; y < H; y += rh)
						for (let x = 0; x < W; x += rw) ctx.drawImage(rain.img, x, y, rw, rh);
					ctx.restore();
				}
			}

			// ── instability: a desaturating wash; quiet adds a vignette ─────────
			if (stab < 0.999) {
				ctx.save();
				ctx.globalAlpha = (1 - stab) * 0.3;
				ctx.fillStyle = 'rgb(40, 40, 70)';
				ctx.fillRect(0, 0, W, H);
				ctx.restore();
			}
			if (book.quiet) {
				const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
				vg.addColorStop(0, 'rgba(14,14,40,0)');
				vg.addColorStop(1, 'rgba(14,14,40,0.55)');
				ctx.fillStyle = vg;
				ctx.fillRect(0, 0, W, H);
			}
		}

		let raf = 0;
		let running = true;
		function frame(t: number) {
			if (!running) return;
			draw(t);
			raf = requestAnimationFrame(frame);
		}
		raf = requestAnimationFrame(frame);

		function onVisibility() {
			if (document.hidden) {
				running = false;
				if (raf) cancelAnimationFrame(raf);
			} else if (!running) {
				running = true;
				raf = requestAnimationFrame(frame);
			}
		}
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			running = false;
			if (raf) cancelAnimationFrame(raf);
			clearInterval(retry);
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<div class="diorama" bind:this={wrapEl}>
	<canvas bind:this={canvasEl} aria-label="a living diorama of Brianna's world"></canvas>
	{#if !anyReady}
		<p class="hint">the world's image is still arriving — the signs are live below.</p>
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
