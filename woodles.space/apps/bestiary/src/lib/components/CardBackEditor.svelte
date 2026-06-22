<script lang="ts">
	import { domains, type Domain } from '$lib/content/domains';
	import { bestiary } from '$lib/bestiary.svelte';
	import { cardBackComposition, type Composition } from '$lib/composer';
	import type { BackBorderStyle } from '$lib/types';
	import CardBack from './CardBack.svelte';
	import SpriteStudio from './SpriteStudio.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let selectedDomain = $state<Domain>('temporal');
	let studioOpen = $state(false);
	let studioInitial = $state<Composition | null>(null);

	const borders: { id: BackBorderStyle; label: string; symbol: string }[] = [
		{ id: 'none',    label: 'none',    symbol: '○' },
		{ id: 'pulse',   label: 'pulse',   symbol: '◉' },
		{ id: 'shimmer', label: 'shimmer', symbol: '◈' },
		{ id: 'halo',    label: 'halo',    symbol: '⊙' },
		{ id: 'drift',   label: 'drift',   symbol: '≋' }
	];

	function openStudio(domain: Domain) {
		selectedDomain = domain;
		const existing = bestiary.getCardBack(domain);
		studioInitial = existing?.composition ?? cardBackComposition();
		studioOpen = true;
	}

	function handleSave(comp: Composition, dataUrl: string) {
		bestiary.setCardBack(selectedDomain, comp, dataUrl);
		studioOpen = false;
	}

	function handleClearArt(domain: Domain) {
		if (confirm(`Clear the custom art for ${domain}? The border effect will remain.`)) {
			bestiary.clearCardBack(domain);
		}
	}

	function setBorder(domain: Domain, border: BackBorderStyle) {
		bestiary.setCardBackBorder(domain, border);
	}

	function currentBorder(domain: Domain): BackBorderStyle {
		return bestiary.getCardBack(domain)?.border ?? 'none';
	}
</script>

{#if studioOpen && studioInitial}
	<SpriteStudio
		initial={studioInitial}
		onsave={handleSave}
		onclose={() => (studioOpen = false)}
	/>
{:else}
	<div class="cbe-overlay" role="dialog" aria-modal="true" aria-label="card back editor">
		<div class="cbe-nav">
			<div class="cbe-info">
				<span class="cbe-title">card backs</span>
				<span class="cbe-meta">one design per domain · art + animated border effects</span>
			</div>
			<button class="close-btn" onclick={onclose} aria-label="close card back editor">×</button>
		</div>

		<div class="cbe-scroll">
			<div class="cbe-grid">
				{#each domains as d (d.id)}
					{@const hasArt = !!bestiary.getCardBack(d.id)?.dataUrl}
					{@const activeBorder = currentBorder(d.id)}
					<div class="cbe-item">
						<button
							class="cbe-card-btn"
							onclick={() => openStudio(d.id)}
							title="edit {d.name} card back art"
						>
							<CardBack domain={d.id} />
						</button>

						<div class="cbe-meta">
							<span class="cbe-domain-name" style="color: var({d.colorVar})">
								{d.glyph} {d.name}
							</span>

							<!-- art controls -->
							<div class="cbe-art-row">
								<button class="cbe-edit-btn" onclick={() => openStudio(d.id)}>
									{hasArt ? '✎ edit art' : '✦ design art'}
								</button>
								{#if hasArt}
									<button class="cbe-clear-btn" onclick={() => handleClearArt(d.id)} title="clear custom art">
										✕
									</button>
								{/if}
							</div>

							<!-- border effect picker -->
							<div class="cbe-border-row" role="group" aria-label="{d.name} border effect">
								{#each borders as b (b.id)}
									<button
										class="cbe-border-chip"
										class:active={activeBorder === b.id}
										onclick={() => setBorder(d.id, b.id)}
										title="{b.label} border"
										style="--dc: var({d.colorVar})"
									>
										<span class="chip-sym">{b.symbol}</span>
										{b.label}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.cbe-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		flex-direction: column;
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
	}

	.cbe-nav {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-md);
		padding: var(--b-space-sm) var(--b-space-xl);
		background: var(--b-surface);
		border-bottom: 1px solid var(--b-border);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}
	.cbe-info { display: flex; align-items: baseline; gap: var(--b-space-md); }
	.cbe-title {
		font-family: var(--b-font-codex);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--b-text);
	}
	/* nav subtitle */
	.cbe-info > span:last-child {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-muted);
	}

	.close-btn {
		font-size: 1.3rem;
		color: var(--b-muted);
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.close-btn:hover { color: var(--b-text); background: var(--b-surface-2, var(--b-bg)); }

	.cbe-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		background: #e3d9e1;
		padding: 40px 32px;
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.cbe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 220px));
		gap: 36px;
		justify-content: center;
		width: 100%;
		max-width: 1100px;
	}

	.cbe-item {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.cbe-card-btn {
		display: block;
		width: 100%;
		background: none;
		border-radius: var(--b-radius-card, 10px);
		transition: transform var(--b-transition-fast), box-shadow var(--b-transition-fast);
		box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
	}
	.cbe-card-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
	}

	/* ── per-card metadata + controls ── */
	.cbe-meta {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cbe-domain-name {
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.cbe-art-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.cbe-edit-btn {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.28rem 0.6rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.cbe-edit-btn:hover { border-color: var(--b-gold); color: var(--b-gold); }

	.cbe-clear-btn {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-muted);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.28rem 0.5rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.cbe-clear-btn:hover { border-color: var(--b-mythic); color: var(--b-mythic); }

	/* ── border effect picker ── */
	.cbe-border-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.cbe-border-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-muted);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.22rem 0.45rem;
		transition: color var(--b-transition-fast), border-color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.cbe-border-chip:hover { color: var(--b-text-dim); border-color: var(--b-border); }
	.cbe-border-chip.active {
		color: var(--b-text);
		border-color: var(--dc);
		background: color-mix(in srgb, var(--dc) 12%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dc) 30%, transparent);
	}
	.chip-sym {
		color: var(--dc);
		font-size: 0.78rem;
		line-height: 1;
	}
</style>
