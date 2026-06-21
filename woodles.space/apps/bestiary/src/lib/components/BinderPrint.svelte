<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import CreatureCard from './CreatureCard.svelte';
	import type { Creature } from '$lib/types';

	const PAGE_SIZE = 9;

	let { onclose }: { onclose: () => void } = $props();

	let creatures = $derived(bestiary.visibleCreatures);
	let pages = $derived(makepages(creatures));

	// Bound to the scrollable pages container so we can clone it for printing.
	let pagesEl = $state<HTMLElement | null>(null);

	function makepages(list: Creature[]): Creature[][] {
		const result: Creature[][] = [];
		for (let i = 0; i < list.length; i += PAGE_SIZE) result.push(list.slice(i, i + PAGE_SIZE));
		if (result.length === 0) result.push([]);
		return result;
	}

	// Clone the rendered pages into a top-level body portal so the print CSS
	// can trivially hide everything else. Cleaned up via the afterprint event.
	function doPrint() {
		if (!pagesEl) return;

		// Deep-clone the already-rendered card HTML. Canvas-based overlays
		// (foil/sparkle) won't transfer, but the base card renders fine in CSS.
		const portal = document.createElement('div');
		portal.setAttribute('data-binder-portal', '');

		const clone = pagesEl.cloneNode(true) as HTMLElement;
		// Override the screen-only scroll styles inline so the pages flow.
		clone.style.cssText =
			'display:flex;flex-direction:column;align-items:center;gap:0;overflow:visible;background:none;padding:0;';
		portal.appendChild(clone);
		document.body.appendChild(portal);

		// Inject print rules: hide everything except our portal.
		const sheet = document.createElement('style');
		sheet.setAttribute('data-binder-sheet', '');
		sheet.textContent = `
			@media print {
				@page { size: A4 portrait; margin: 10mm; }
				body > *:not([data-binder-portal]) { display: none !important; }
				[data-binder-portal] .binder-page {
					width: 100%;
					max-width: none;
					box-shadow: none;
					margin: 0;
					padding: 12px;
					page-break-after: always;
					break-after: page;
				}
				[data-binder-portal] .binder-page:last-child {
					page-break-after: avoid;
					break-after: avoid;
				}
				[data-binder-portal] .binder-cell-empty {
					border: 1px dashed #ddd;
					background: none;
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

<div
	class="binder-overlay"
	role="dialog"
	aria-modal="true"
	aria-label="binder print preview"
>
	<!-- Header bar -->
	<div class="binder-nav">
		<div class="binder-info">
			<span class="binder-title">card binder</span>
			<span class="binder-meta">
				{creatures.length} card{creatures.length !== 1 ? 's' : ''}
				&middot;
				{pages.length} page{pages.length !== 1 ? 's' : ''}
				&middot;
				3×3 per page
			</span>
		</div>
		<div class="binder-actions">
			<button class="print-btn" onclick={doPrint}>
				<span class="print-icon">⎙</span> print / save as pdf
			</button>
			<button class="close-btn" onclick={onclose} aria-label="close binder preview">×</button>
		</div>
	</div>

	<!-- Scrollable page preview -->
	<div class="binder-scroll" bind:this={pagesEl}>
		{#each pages as page, i (i)}
			<div class="binder-page">
				{#each page as creature (creature.id)}
					<div class="binder-cell">
						<CreatureCard {creature} />
					</div>
				{/each}
				<!-- Empty slots pad the last page to keep a full 3×3 grid -->
				{#each { length: PAGE_SIZE - page.length } as _, j (j)}
					<div class="binder-cell binder-cell-empty" aria-hidden="true"></div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	/* ── overlay shell ── */
	.binder-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		flex-direction: column;
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
	}

	/* ── sticky nav bar ── */
	.binder-nav {
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

	.binder-info {
		display: flex;
		align-items: baseline;
		gap: var(--b-space-md);
	}
	.binder-title {
		font-family: var(--b-font-codex);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--b-text);
	}
	.binder-meta {
		font-family: var(--b-font-mono);
		font-size: 0.76rem;
		color: var(--b-muted);
	}

	.binder-actions {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
	}

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

	/* ── scrollable preview area ── */
	.binder-scroll {
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

	/* ── one binder page ── */
	.binder-page {
		width: min(740px, 100%);
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		padding: 28px;
		background: white;
		border-radius: 3px;
		box-shadow: 0 2px 20px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06);
	}

	/* ── card slot ── */
	.binder-cell {
		border-radius: 8px;
		overflow: hidden;
	}

	.binder-cell-empty {
		aspect-ratio: 63 / 88;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px dashed rgba(0, 0, 0, 0.1);
	}
</style>
