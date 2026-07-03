<script lang="ts">
	import type { PublicCreature } from '@woodles/sync';
	import { domainDef, rarityDef, type Domain, type Rarity } from '$lib/content/domains';

	let { creature, onclose }: { creature: PublicCreature; onclose: () => void } = $props();

	let domain = $derived(domainDef(creature.domain as Domain));
	let rarity = $derived(rarityDef(creature.rarity as Rarity));
	let displayName = $derived(creature.name.trim() || 'Unnamed Creature');

	// A click-to-close backdrop div never holds keyboard focus, so a local
	// onkeydown on it would only fire if something had already focused it —
	// listening on the window instead means Escape closes this regardless of
	// what's focused, exactly like a real dialog.
	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="detail-overlay"
	role="button"
	tabindex="-1"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
	onkeydown={handleKeydown}
>
	<div class="detail-card" role="dialog" aria-modal="true" aria-label="{displayName}, from the gallery">
		<button class="close-btn" onclick={onclose} aria-label="close">×</button>

		<div class="detail-body">
			<img class="detail-image" src={creature.cardImage} alt={displayName} />

			<div class="detail-text">
				<div class="identity-line">
					<span class="rarity-sym" style="color: var({rarity.colorVar})" title={rarity.name}>{rarity.symbol}</span>
					<span class="domain-pip" style="color: var({domain.colorVar})" title={domain.name}>{domain.glyph}</span>
					<span class="kind">{creature.kind || 'Creature'}</span>
				</div>
				<h2 class="creature-name">{displayName}</h2>
				<div class="stats-line">
					<span class="stat-chip rarity" style="--c: var({rarity.colorVar})">{rarity.name}</span>
					<span class="dot">·</span>
					<span class="stat-chip domain" style="--c: var({domain.colorVar})">{domain.name}</span>
					<span class="dot">·</span>
					<span class="stat-chip">Cost {creature.cost}</span>
					<span class="dot">·</span>
					<span class="stat-chip pt">{creature.power}/{creature.toughness}</span>
				</div>

				{#if creature.abilities.trim()}
					<p class="abilities-text">{creature.abilities}</p>
				{/if}
				{#if creature.flavor.trim()}
					<p class="flavor-text">"{creature.flavor}"</p>
				{/if}
				{#if creature.foundIn.trim()}
					<p class="found-text"><span class="found-label">Found in:</span> {creature.foundIn}</p>
				{/if}

				{#if creature.sourceImage}
					<div class="source-block">
						<span class="source-label">◈ before the studio</span>
						<img class="source-image" src={creature.sourceImage} alt="{displayName}, before the studio" />
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.detail-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--b-space-lg);
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
		overflow-y: auto;
	}

	.detail-card {
		position: relative;
		width: 100%;
		max-width: 46rem;
		max-height: calc(100vh - 2 * var(--b-space-lg));
		overflow-y: auto;
		background: var(--b-surface);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-lg);
		box-shadow: var(--b-shadow-hover);
		margin: auto;
	}

	.close-btn {
		position: absolute;
		top: var(--b-space-md);
		right: var(--b-space-md);
		z-index: 2;
		font-size: 1.3rem;
		color: var(--b-muted);
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--b-surface);
		transition: color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.close-btn:hover { color: var(--b-text); background: var(--b-surface-2, var(--b-bg)); }

	.detail-body {
		display: flex;
		gap: var(--b-space-xl);
		padding: var(--b-space-xl);
	}

	.detail-image {
		flex: 0 0 auto;
		width: clamp(180px, 30vw, 260px);
		aspect-ratio: 63 / 88;
		object-fit: contain;
		border-radius: var(--b-radius-md);
		filter: drop-shadow(0 10px 24px rgba(206, 130, 175, 0.28));
	}

	.detail-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--b-space-sm);
	}

	.identity-line {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
	}
	.rarity-sym { font-size: 0.7rem; }
	.domain-pip { font-size: 0.85rem; }
	.kind { color: var(--b-text-dim); letter-spacing: 0.04em; }

	.creature-name {
		font-family: var(--b-font-codex);
		font-size: clamp(1.4rem, 3vw, 1.9rem);
		font-weight: 600;
		color: var(--b-text);
		line-height: 1.15;
	}

	.stats-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		align-items: center;
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		margin-bottom: var(--b-space-xs);
	}
	.dot { color: var(--b-muted); }
	.stat-chip { color: var(--b-text-dim); }
	.stat-chip.rarity, .stat-chip.domain { color: var(--c); }
	.stat-chip.pt { font-weight: 600; color: var(--b-text); }

	.abilities-text {
		font-family: var(--b-font-body);
		font-size: 0.94rem;
		line-height: 1.6;
		color: var(--b-text);
		white-space: pre-wrap;
	}
	.flavor-text {
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.88rem;
		line-height: 1.6;
		color: var(--b-text-dim);
	}
	.found-text {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-muted);
	}
	.found-label { color: var(--b-text-dim); }

	.source-block {
		margin-top: var(--b-space-sm);
		padding-top: var(--b-space-sm);
		border-top: 1px solid var(--b-rule, var(--b-border));
		display: flex;
		flex-direction: column;
		gap: var(--b-space-xs);
	}
	.source-label {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	.source-image {
		width: 100%;
		max-width: 12rem;
		border-radius: var(--b-radius-sm);
		border: 1px solid var(--b-border);
		background: var(--b-vellum);
	}

	@media (max-width: 640px) {
		.detail-body { flex-direction: column; align-items: center; text-align: center; }
		.detail-image { width: min(220px, 60vw); }
		.identity-line, .stats-line { justify-content: center; }
	}
</style>
