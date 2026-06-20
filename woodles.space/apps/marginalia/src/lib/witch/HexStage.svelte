<script lang="ts">
	import { book } from './book.svelte';

	const creatures = $derived(book.bestiaryCreatures.filter((c) => c.isolatedSprite ?? c.sprite));

	let selectedId = $state<string | null>(null);

	const creature = $derived(
		creatures.find((c) => c.id === selectedId) ?? creatures[0] ?? null
	);

	const src = $derived(creature ? (creature.isolatedSprite ?? creature.sprite) : null);
</script>

<div class="hex-stage-wrap">
	{#if creatures.length === 0}
		<div class="hex-glow">
			<div class="hex-outer">
				<div class="hex-bg"></div>
				<div class="hex-viewport">
					<span class="empty-hint">open the Bestiary<br />and paint a creature</span>
				</div>
			</div>
		</div>
	{:else}
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

		<div class="hex-glow">
			<div class="hex-outer">
				<div class="hex-bg"></div>
				<div class="hex-viewport">
					{#if src}
						<div class="sprite-float">
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
		</div>

		{#if creature?.name}
			<p class="creature-name">{creature.name}</p>
		{/if}
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

	/* the glow wrapper is NOT clipped, so drop-shadow follows the hex alpha */
	.hex-glow {
		filter: drop-shadow(0 0 18px rgba(154, 150, 201, 0.28))
			drop-shadow(0 0 6px rgba(240, 143, 184, 0.18));
	}

	.hex-outer {
		position: relative;
		width: 200px;
		height: 200px;
	}

	/* outer hex — gradient border peek-through */
	.hex-bg {
		position: absolute;
		inset: 0;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: linear-gradient(145deg, var(--periwinkle) 0%, var(--leafeon-pink) 100%);
		opacity: 0.55;
	}

	/* inner hex — stage floor, inset 3px from border */
	.hex-viewport {
		position: absolute;
		inset: 3px;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		background: radial-gradient(ellipse at 50% 65%, #26265a 0%, #1a1a3e 85%);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	/* floating sprite — animation lives here to avoid fighting the clip */
	.sprite-float {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 128px;
		max-height: 128px;
		filter: drop-shadow(0 0 7px rgba(240, 143, 184, 0.5))
			drop-shadow(0 5px 10px rgba(26, 26, 62, 0.75));
		animation: float 3.6s ease-in-out infinite;
	}

	.sprite {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.sprite.pixelated {
		image-rendering: pixelated;
	}

	.empty-hint {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 0.74rem;
		color: var(--muted);
		text-align: center;
		line-height: 1.5;
		padding: 0 1rem;
	}

	.creature-name {
		font-family: var(--font-hand);
		font-size: 1.05rem;
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

	@keyframes float {
		0%,
		100% {
			transform: translateY(0px);
		}
		45% {
			transform: translateY(-8px);
		}
		55% {
			transform: translateY(-8px);
		}
	}
</style>
