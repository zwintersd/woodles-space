<script lang="ts">
	import type { SpriteCreature } from './bestiaryDb';

	interface Props {
		// the minimal shape, not the full local BestiaryCreature — this also
		// renders a bound creature from the published bestiary fallback
		// (ROADMAP.md week 5), which doesn't carry every local-only field.
		creature: SpriteCreature | null;
		unclipped?: boolean;
	}

	let { creature, unclipped = false }: Props = $props();

	const src = $derived(creature ? (creature.isolatedSprite ?? creature.sprite) : null);
	const isIsolated = $derived(!!creature?.isolatedSprite);
</script>

<div class="mini-glow" class:unclipped>
	<div class="mini-outer">
		<div class="mini-bg"></div>
		<div class="mini-viewport" class:scene={!isIsolated && !!src}>

			{#if src && isIsolated && !unclipped}
				<div class="sprite-float">
					<img
						{src}
						alt={creature?.name ?? ''}
						class="sprite"
						class:pixelated={creature?.pixelated}
					/>
				</div>

			{:else if src}
				<div class="portal-breathe">
					<img
						{src}
						alt={creature?.name ?? ''}
						class="portal-img"
						class:pixelated={creature?.pixelated}
					/>
				</div>
				<div class="vignette" aria-hidden="true"></div>

			{/if}

		</div>

		{#if src && isIsolated && unclipped}
			<div class="sprite-float sprite-over">
				<img
					{src}
					alt={creature?.name ?? ''}
					class="sprite"
					class:pixelated={creature?.pixelated}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Static ambient glow — no pulse, too busy in a strip. */
	.mini-glow {
		flex-shrink: 0;
		filter: drop-shadow(0 0 8px rgba(154, 150, 201, 0.22))
			drop-shadow(0 0 3px rgba(240, 143, 184, 0.14));
	}

	.mini-glow.unclipped {
		overflow: visible;
	}

	.mini-outer {
		position: relative;
		width: 90px;
		height: 90px;
		overflow: visible;
	}

	.mini-bg {
		position: absolute;
		inset: 0;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: linear-gradient(150deg, var(--cyan) 0%, var(--periwinkle) 45%, var(--leafeon-pink) 100%);
		opacity: 0.55;
	}

	.mini-viewport {
		position: absolute;
		inset: 2px;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: radial-gradient(ellipse at 50% 65%, #26265a 0%, #1a1a3e 88%);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.mini-viewport.scene {
		background: #0e0e28;
	}

	/* ── creature mode ───────────────────────────────────────────────────────── */

	.sprite-float {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 58px;
		max-height: 58px;
		filter: drop-shadow(0 0 5px rgba(240, 143, 184, 0.45))
			drop-shadow(0 3px 6px rgba(26, 26, 62, 0.7));
		animation: float 3.8s ease-in-out infinite;
	}

	.sprite {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.sprite-over {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 3;
		width: 76px;
		height: 76px;
		max-width: none;
		max-height: none;
		translate: -50% -50%;
		pointer-events: none;
	}

	.sprite.pixelated {
		image-rendering: pixelated;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		45%       { transform: translateY(-5px); }
		55%       { transform: translateY(-5px); }
	}

	/* ── portal mode ─────────────────────────────────────────────────────────── */

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

	@keyframes portal-breathe {
		0%, 100% { transform: scale(1); }
		50%       { transform: scale(1.06); }
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(14, 14, 40, 0.6) 100%);
		pointer-events: none;
	}
</style>
