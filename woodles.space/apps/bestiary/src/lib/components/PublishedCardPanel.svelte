<script lang="ts">
	import type { PublicCreature } from '@woodles/sync';
	import { domainDef, rarityDef, type Domain, type Rarity } from '$lib/content/domains';
	import { bestiary } from '$lib/bestiary.svelte';
	import { downloadCardDataUrl } from '$lib/cardImage';

	// The card + metadata + actions shared by the gallery's detail overlay
	// (GalleryDetail) and the full-page share-link destination (CardView) —
	// ROADMAP.md week 4, "cards that travel". Self-contained: no onclose or
	// other modal-only concerns live here, so either caller can wrap it in
	// whatever chrome fits (an overlay card, or a plain page).

	let { creature }: { creature: PublicCreature } = $props();

	let domain = $derived(domainDef(creature.domain as Domain));
	let rarity = $derived(rarityDef(creature.rarity as Rarity));
	let displayName = $derived(creature.name.trim() || 'Unnamed Creature');

	let savedFlash = $state(false);
	let copiedFlash = $state(false);

	function saveCard(): void {
		// The published cardImage is already a rendered PNG (ROADMAP.md week
		// 2) — no live DOM node here to re-rasterise, so this hands the
		// existing data URL straight to the browser.
		downloadCardDataUrl(creature.cardImage, displayName);
		savedFlash = true;
		setTimeout(() => { savedFlash = false; }, 1400);
	}

	function adopt(): void {
		const c = bestiary.adoptCreature(creature);
		bestiary.openEditor(c.id);
	}

	function copyLink(): void {
		const url = `${location.origin}/bestiary?card=${encodeURIComponent(creature.id)}`;
		navigator.clipboard.writeText(url).then(() => {
			copiedFlash = true;
			setTimeout(() => { copiedFlash = false; }, 1400);
		});
	}
</script>

<div class="card-panel">
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

		<div class="actions-row">
			<button class="action-btn" onclick={saveCard}>{savedFlash ? '✓ saved' : '↓ save card'}</button>
			<button class="action-btn" onclick={adopt}>＋ adopt this card</button>
			<button class="action-btn" onclick={copyLink}>{copiedFlash ? '✓ copied' : '⎘ copy link'}</button>
		</div>
	</div>
</div>

<style>
	.card-panel {
		display: flex;
		gap: var(--b-space-xl);
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

	.actions-row {
		margin-top: var(--b-space-sm);
		padding-top: var(--b-space-md);
		border-top: 1px solid var(--b-rule, var(--b-border));
		display: flex;
		flex-wrap: wrap;
		gap: var(--b-space-sm);
	}
	.action-btn {
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border-strong);
		border-radius: var(--b-radius-pill);
		padding: 0.4rem 0.85rem;
		transition: color var(--b-transition-fast), border-color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.action-btn:hover { color: var(--b-gold); border-color: var(--b-gold); background: var(--b-gold-soft); }

	@media (max-width: 640px) {
		.card-panel { flex-direction: column; align-items: center; text-align: center; }
		.detail-image { width: min(220px, 60vw); }
		.identity-line, .stats-line, .actions-row { justify-content: center; }
	}
</style>
