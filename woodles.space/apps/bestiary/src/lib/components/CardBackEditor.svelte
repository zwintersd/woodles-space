<script lang="ts">
	import { domains, type Domain } from '$lib/content/domains';
	import { bestiary } from '$lib/bestiary.svelte';
	import { cardBackComposition, type Composition } from '$lib/composer';
	import CardBack from './CardBack.svelte';
	import SpriteStudio from './SpriteStudio.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let selectedDomain = $state<Domain>('temporal');
	let studioOpen = $state(false);
	let studioInitial = $state<Composition | null>(null);

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

	function handleClear(domain: Domain) {
		if (confirm(`Clear the custom back for ${domain}? It will revert to the default design.`)) {
			bestiary.clearCardBack(domain);
		}
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
				<span class="cbe-meta">one design per domain · click a card to edit</span>
			</div>
			<button class="close-btn" onclick={onclose} aria-label="close card back editor">×</button>
		</div>

		<div class="cbe-scroll">
			<div class="cbe-grid">
				{#each domains as d (d.id)}
					{@const hasCustom = !!bestiary.getCardBack(d.id)}
					<div class="cbe-item">
						<button
							class="cbe-card-btn"
							onclick={() => openStudio(d.id)}
							title="edit {d.name} card back"
						>
							<CardBack domain={d.id} />
						</button>
						<div class="cbe-card-meta">
							<span class="cbe-domain-name" style="color: var({d.colorVar})">
								{d.glyph} {d.name}
							</span>
							<div class="cbe-card-actions">
								<button class="cbe-edit-btn" onclick={() => openStudio(d.id)}>
									{hasCustom ? '✎ edit' : '✦ design'}
								</button>
								{#if hasCustom}
									<button class="cbe-clear-btn" onclick={() => handleClear(d.id)} title="clear custom art">
										✕
									</button>
								{/if}
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
	.cbe-meta {
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
		grid-template-columns: repeat(auto-fill, minmax(160px, 200px));
		gap: 32px;
		justify-content: center;
		width: 100%;
		max-width: 900px;
	}

	.cbe-item {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.cbe-card-btn {
		display: block;
		width: 100%;
		background: none;
		border-radius: var(--b-radius-card, 10px);
		transition: transform var(--b-transition-fast), box-shadow var(--b-transition-fast);
		box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
	}
	.cbe-card-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
	}

	.cbe-card-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}

	.cbe-domain-name {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.cbe-card-actions {
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
</style>
