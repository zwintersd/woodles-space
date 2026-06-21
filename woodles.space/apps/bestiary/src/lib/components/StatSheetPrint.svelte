<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import CreatureCard from './CreatureCard.svelte';
	import CreatureStatDetail from './CreatureStatDetail.svelte';
	import CardBack from './CardBack.svelte';
	import type { Creature } from '$lib/types';

	const PAGE_SIZE = 3;

	let { onclose }: { onclose: () => void } = $props();

	let creatures = $derived(bestiary.visibleCreatures);
	let pages = $derived(makepages(creatures));

	let pagesEl = $state<HTMLElement | null>(null);

	function makepages(list: Creature[]): Creature[][] {
		const result: Creature[][] = [];
		for (let i = 0; i < list.length; i += PAGE_SIZE) result.push(list.slice(i, i + PAGE_SIZE));
		if (result.length === 0) result.push([]);
		return result;
	}

	function doPrint() {
		if (!pagesEl) return;

		const portal = document.createElement('div');
		portal.setAttribute('data-stat-sheet-portal', '');

		const clone = pagesEl.cloneNode(true) as HTMLElement;
		clone.style.cssText =
			'display:flex;flex-direction:column;align-items:center;gap:0;overflow:visible;background:none;padding:0;';
		portal.appendChild(clone);
		document.body.appendChild(portal);

		const sheet = document.createElement('style');
		sheet.setAttribute('data-stat-sheet-sheet', '');
		sheet.textContent = `
			@media print {
				@page { size: A4 portrait; margin: 10mm; }
				body > *:not([data-stat-sheet-portal]) { display: none !important; }

				[data-stat-sheet-portal] .sheet-page {
					width: 100%;
					max-width: none;
					height: 277mm;
					box-shadow: none;
					margin: 0;
					padding: 0;
					display: grid;
					grid-template-rows: repeat(3, 1fr);
					gap: 3mm;
					page-break-after: always;
					break-after: page;
				}
				[data-stat-sheet-portal] .sheet-page:last-child {
					page-break-after: avoid;
					break-after: avoid;
				}
				[data-stat-sheet-portal] .sheet-row {
					display: grid;
					grid-template-columns: 1fr 1fr 1fr;
					gap: 4mm;
					overflow: hidden;
				}
				[data-stat-sheet-portal] .sheet-col { overflow: hidden; }
				[data-stat-sheet-portal] .sheet-row-empty {
					border: 1px dashed #ddd;
					border-radius: 4px;
				}
			}
		`;
		document.head.appendChild(sheet);

		window.print();

		window.addEventListener(
			'afterprint',
			() => {
				portal.remove();
				sheet.remove();
			},
			{ once: true }
		);
	}
</script>

<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="stat sheet print preview">

	<!-- Header -->
	<div class="sheet-nav">
		<div class="sheet-info">
			<span class="sheet-title">stat sheet</span>
			<span class="sheet-meta">
				{creatures.length} card{creatures.length !== 1 ? 's' : ''}
				&middot;
				{pages.length} page{pages.length !== 1 ? 's' : ''}
				&middot;
				3 per page
			</span>
		</div>
		<div class="sheet-actions">
			<button class="print-btn" onclick={doPrint}>
				<span class="print-icon">⎙</span> print / save as pdf
			</button>
			<button class="close-btn" onclick={onclose} aria-label="close stat sheet preview">×</button>
		</div>
	</div>

	<!-- Scrollable preview -->
	<div class="sheet-scroll" bind:this={pagesEl}>
		{#each pages as page, i (i)}
			<div class="sheet-page">
				{#each page as creature (creature.id)}
					<div class="sheet-row">
						<div class="sheet-col"><CreatureCard {creature} /></div>
						<div class="sheet-col"><CreatureStatDetail {creature} /></div>
						<div class="sheet-col"><CardBack domain={creature.domain} /></div>
					</div>
				{/each}
				{#each { length: PAGE_SIZE - page.length } as _, j (j)}
					<div class="sheet-row sheet-row-empty" aria-hidden="true"></div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	/* ── overlay shell ── */
	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		flex-direction: column;
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
	}

	/* ── nav bar ── */
	.sheet-nav {
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
	.sheet-info { display: flex; align-items: baseline; gap: var(--b-space-md); }
	.sheet-title {
		font-family: var(--b-font-codex);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--b-text);
	}
	.sheet-meta {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-muted);
	}
	.sheet-actions { display: flex; align-items: center; gap: var(--b-space-sm); }

	.print-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--b-gold);
		color: var(--b-on-accent);
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.45rem 1rem;
		border-radius: var(--b-radius-pill);
		transition: transform var(--b-transition-fast), box-shadow var(--b-transition-fast);
	}
	.print-btn:hover { transform: translateY(-1px); box-shadow: 0 0.4rem 1rem var(--b-gold-soft); }
	.print-icon { font-size: 1rem; }

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

	/* ── scroll area ── */
	.sheet-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		background: #e3d9e1;
		padding: 36px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 40px;
	}

	/* ── one page ── */
	.sheet-page {
		width: min(820px, 100%);
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px;
		background: white;
		border-radius: 3px;
		box-shadow: 0 2px 20px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06);
	}

	/* ── one creature row ── */
	.sheet-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 12px;
		/* Row height driven by the card's aspect-ratio: 63/88 filling its 1fr column */
	}
	.sheet-col { overflow: hidden; }

	.sheet-row-empty {
		aspect-ratio: 63 / 88;
		border: 1px dashed rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.02);
	}
</style>
