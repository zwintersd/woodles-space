<script lang="ts">
	import { book } from './book.svelte';

	const creatures = $derived(book.bestiaryCreatures.filter((c) => c.isolatedSprite ?? c.sprite));

	let selectedId = $state<string | null>(null);

	const creature = $derived(
		creatures.find((c) => c.id === selectedId) ?? creatures[0] ?? null
	);

	// Prefer the creature-only crop; fall back to the full flattened scene.
	const isolatedSrc = $derived(creature?.isolatedSprite ?? null);
	const sceneSrc = $derived(creature?.sprite ?? null);
	const src = $derived(isolatedSrc ?? sceneSrc);

	// True = creature on dark stage; false = scene fills the hex like a portal.
	const isIsolated = $derived(!!isolatedSrc);
</script>

<div class="hex-stage-wrap">
	{#if creatures.length > 1}
		<select
			class="creature-select"
			value={creature?.id ?? ''}
			onchange={(e) => (selectedId = (e.target as HTMLSelectElement).value)}
		>
			{#each creatures as c (c.id)}
				<option value={c.id}>{c.name || '(unnamed)'}</option>
			{/each}
		</select>
	{/if}

	<div class="hex-glow" class:portal-glow={!isIsolated && !!src}>
		<div class="hex-outer">
			<div class="hex-bg"></div>
			<div class="hex-viewport" class:scene={!isIsolated && !!src}>

				{#if !src}
					<!-- empty state -->
					<span class="empty-hint">open the Bestiary<br />and paint a creature</span>

				{:else if isIsolated}
					<!-- creature on a dark stage: float vertically, glow follows alpha -->
					<div class="sprite-float">
						<img
							{src}
							alt={creature?.name ?? ''}
							class="sprite"
							class:pixelated={creature?.pixelated}
						/>
					</div>

				{:else}
					<!-- full scene: fill the hex like a portal window, breathe in/out -->
					<div class="portal-breathe">
						<img
							src={sceneSrc}
							alt={creature?.name ?? ''}
							class="portal-img"
							class:pixelated={creature?.pixelated}
						/>
					</div>
					<!-- radial vignette to frame the portal edges -->
					<div class="vignette" aria-hidden="true"></div>
				{/if}

			</div>
		</div>
	</div>

	{#if creature?.name}
		<p class="creature-name">{creature.name}</p>
	{/if}
</div>

<style>
	.hex-stage-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 0;
	}

	/* ── outer glow (unclipped so drop-shadow follows hex alpha) ────────────── */

	.hex-glow {
		filter: drop-shadow(0 0 20px rgba(154, 150, 201, 0.32))
			drop-shadow(0 0 7px rgba(240, 143, 184, 0.2));
		animation: glow-pulse 4s ease-in-out infinite;
	}

	/* portal scenes get a cooler, more intense glow */
	.hex-glow.portal-glow {
		filter: drop-shadow(0 0 22px rgba(108, 229, 232, 0.28))
			drop-shadow(0 0 8px rgba(154, 150, 201, 0.35));
	}

	@keyframes glow-pulse {
		0%, 100% { filter: drop-shadow(0 0 20px rgba(154, 150, 201, 0.32)) drop-shadow(0 0 7px rgba(240, 143, 184, 0.2)); }
		50%       { filter: drop-shadow(0 0 28px rgba(154, 150, 201, 0.52)) drop-shadow(0 0 12px rgba(240, 143, 184, 0.36)); }
	}

	/* ── hex structure ───────────────────────────────────────────────────────── */

	.hex-outer {
		position: relative;
		width: 220px;
		height: 220px;
	}

	/* border ring: gradient hex slightly larger than the viewport */
	.hex-bg {
		position: absolute;
		inset: 0;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: linear-gradient(150deg, var(--cyan) 0%, var(--periwinkle) 45%, var(--leafeon-pink) 100%);
		opacity: 0.6;
		animation: border-shimmer 4s ease-in-out infinite;
	}

	@keyframes border-shimmer {
		0%, 100% { opacity: 0.6; }
		50%       { opacity: 0.9; }
	}

	/* viewport: inner hex clipped to show stage/scene */
	.hex-viewport {
		position: absolute;
		inset: 3px;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: radial-gradient(ellipse at 50% 65%, #26265a 0%, #1a1a3e 88%);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	/* portal: no stage background, the image IS the background */
	.hex-viewport.scene {
		background: #0e0e28;
	}

	/* ── creature mode: float on dark stage ──────────────────────────────────── */

	.sprite-float {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 138px;
		max-height: 138px;
		filter: drop-shadow(0 0 9px rgba(240, 143, 184, 0.55))
			drop-shadow(0 6px 12px rgba(26, 26, 62, 0.8));
		animation: float 3.8s ease-in-out infinite;
	}

	.sprite {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.sprite.pixelated {
		image-rendering: pixelated;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		45%       { transform: translateY(-9px); }
		55%       { transform: translateY(-9px); }
	}

	/* ── portal mode: scene fills the hex, breathes gently ──────────────────── */

	.portal-breathe {
		position: absolute;
		inset: 0;
		animation: portal-breathe 5s ease-in-out infinite;
		transform-origin: center;
	}

	.portal-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		display: block;
	}

	.portal-img.pixelated {
		image-rendering: pixelated;
	}

	/* subtle scale pulse — the portal window breathes */
	@keyframes portal-breathe {
		0%, 100% { transform: scale(1); }
		50%       { transform: scale(1.05); }
	}

	/* radial vignette darkens portal edges, adds depth */
	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 50% 50%,
			transparent 30%,
			rgba(14, 14, 40, 0.55) 100%
		);
		pointer-events: none;
	}

	/* ── empty state ─────────────────────────────────────────────────────────── */

	.empty-hint {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.72rem;
		color: var(--muted);
		text-align: center;
		line-height: 1.55;
		padding: 0 1.2rem;
	}

	/* ── meta ────────────────────────────────────────────────────────────────── */

	.creature-name {
		font-family: var(--font-hand);
		font-size: 1.08rem;
		color: var(--cream);
		margin: 0;
		letter-spacing: 0.03em;
	}

	.creature-select {
		font-family: var(--font-ui);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--periwinkle);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 3px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}

	.creature-select:focus {
		outline: 1px solid var(--periwinkle);
	}
</style>
