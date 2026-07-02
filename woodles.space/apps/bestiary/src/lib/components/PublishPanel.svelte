<script lang="ts">
	import { tick } from 'svelte';
	import { bestiary } from '$lib/bestiary.svelte';
	import { sortCreatures } from '$lib/collection';
	import { renderCardDataUrl } from '$lib/cardImage';
	import { BESTIARY_PUBLIC_SLUG, buildPublicCreature, isCardOnly } from '$lib/publish';
	import { now } from '$lib/utils';
	import { publish, SyncError, type BestiaryPublicBlob, type PublicCreature } from '@woodles/sync';
	import CreatureCard from './CreatureCard.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let sorted = $derived(sortCreatures(bestiary.creatures, 'name'));

	// Seeded from whatever's currently marked published, so reopening the panel
	// after a prior publish starts from the live public set, not from scratch.
	let selectedIds = $state<Record<string, boolean>>(
		Object.fromEntries(bestiary.creatures.filter((c) => c.published).map((c) => [c.id, true]))
	);
	let selectedCreatures = $derived(sorted.filter((c) => selectedIds[c.id]));

	// Hidden fixed-width copies of just the selected cards, rasterised at
	// publish time — not reactive state, just a bag of refs `bind:this` fills.
	let exportNodes: Record<string, HTMLDivElement> = {};

	let publishing = $state(false);
	let publishError = $state<string | null>(null);
	let justPublished = $state<{ count: number } | null>(null);

	function toggle(id: string): void {
		selectedIds[id] = !selectedIds[id];
	}
	function selectAll(): void {
		selectedIds = Object.fromEntries(sorted.map((c) => [c.id, true]));
	}
	function selectNone(): void {
		selectedIds = {};
	}

	async function doPublish(): Promise<void> {
		if (publishing) return;
		if (
			selectedCreatures.length === 0 &&
			!confirm('Nothing is selected — this clears the public gallery. Continue?')
		) {
			return;
		}
		publishing = true;
		publishError = null;
		justPublished = null;
		// Snapshot the selection once — `selectedCreatures` is derived from
		// `selectedIds`, which stays live and editable while these awaits run.
		// Reading it again later (instead of `toPublish`) would let a mid-publish
		// checkbox change desync the local `published` flags from what was
		// actually rasterised and sent to the server.
		const toPublish = selectedCreatures;
		try {
			// let the export-stage settle onto the current selection before reading its nodes
			await tick();
			const publishedAt = now();
			const creatures: PublicCreature[] = [];
			// Track only the ids that actually made it into the blob — if a node
			// is missing (never mounted) it's silently skipped above, and it must
			// not be marked published locally when it wasn't published at all.
			const publishedIds = new Set<string>();
			for (const c of toPublish) {
				const node = exportNodes[c.id];
				if (!node) continue;
				const cardImage = await renderCardDataUrl(node, 2);
				creatures.push(buildPublicCreature(c, cardImage, publishedAt));
				publishedIds.add(c.id);
			}
			const blob: BestiaryPublicBlob = { creatures };
			await publish('bestiary', BESTIARY_PUBLIC_SLUG, blob);
			bestiary.applyPublishResult(publishedIds);
			justPublished = { count: creatures.length };
		} catch (err) {
			publishError = err instanceof SyncError ? err.message : 'could not publish — try again';
		} finally {
			publishing = false;
		}
	}
</script>

<div class="pub-overlay" role="dialog" aria-modal="true" aria-label="publish to the gallery">
	<div class="pub-nav">
		<div class="pub-info">
			<span class="pub-title">publish to the gallery</span>
			<span class="pub-sub">choose what the world sees · republishing replaces the whole set</span>
		</div>
		<button class="close-btn" onclick={onclose} aria-label="close publish panel">×</button>
	</div>

	<div class="pub-toolbar">
		<div class="pub-toolbar-left">
			<button class="pub-chip" onclick={selectAll} disabled={publishing}>select all</button>
			<button class="pub-chip" onclick={selectNone} disabled={publishing}>select none</button>
			<span class="pub-count">{selectedCreatures.length} selected</span>
		</div>
		<button class="pub-publish-btn" onclick={doPublish} disabled={publishing}>
			{publishing
				? 'publishing…'
				: `publish ${selectedCreatures.length} creature${selectedCreatures.length === 1 ? '' : 's'}`}
		</button>
	</div>

	{#if publishError}
		<p class="pub-msg error">{publishError}</p>
	{/if}
	{#if justPublished}
		<p class="pub-msg ok">
			published {justPublished.count} creature{justPublished.count === 1 ? '' : 's'} to the gallery.
		</p>
	{/if}

	<div class="pub-scroll">
		{#if sorted.length === 0}
			<p class="pub-empty">the shelf is bare — nothing to publish yet.</p>
		{:else}
			<div class="pub-grid">
				{#each sorted as c (c.id)}
					<div class="pub-cell" class:selected={!!selectedIds[c.id]}>
						<input
							type="checkbox"
							class="pub-select"
							checked={!!selectedIds[c.id]}
							onchange={() => toggle(c.id)}
							disabled={publishing}
							aria-label="include {c.name.trim() || 'this creature'} in the public gallery"
						/>
						<div class="pub-card-wrap">
							<CreatureCard creature={c} preview />
						</div>
						<div class="pub-cell-meta">
							<span class="pub-cell-name">{c.name.trim() || 'Unnamed Creature'}</span>
							{#if isCardOnly(c)}
								<span
									class="pub-flag"
									title="no isolated cutout — marginalia's diorama will fall back to the flat sprite, which may carry a background"
									>◇ card-only</span
								>
							{/if}
						</div>
						{#if selectedIds[c.id]}
							<label class="pub-source-toggle">
								<input
									type="checkbox"
									checked={!!c.publishSource}
									disabled={publishing}
									onchange={(e) => bestiary.setPublishSource(c.id, e.currentTarget.checked)}
								/>
								show the source
							</label>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- hidden, fixed-width cards used only for crisp PNG rendering at publish time -->
<div class="pub-export-stage" aria-hidden="true">
	{#each selectedCreatures as c (c.id)}
		<div bind:this={exportNodes[c.id]}>
			<CreatureCard creature={c} />
		</div>
	{/each}
</div>

<style>
	.pub-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--b-z-overlay, 40);
		display: flex;
		flex-direction: column;
		background: rgba(40, 20, 36, 0.6);
		backdrop-filter: blur(3px);
	}

	.pub-nav {
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
	.pub-info { display: flex; align-items: baseline; gap: var(--b-space-md); flex-wrap: wrap; }
	.pub-title {
		font-family: var(--b-font-codex);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--b-text);
	}
	.pub-sub { font-family: var(--b-font-mono); font-size: 0.76rem; color: var(--b-muted); }

	.close-btn {
		font-size: 1.3rem;
		color: var(--b-muted);
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color var(--b-transition-fast), background var(--b-transition-fast);
	}
	.close-btn:hover { color: var(--b-text); background: var(--b-surface-2, var(--b-bg)); }

	.pub-toolbar {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--b-space-md);
		flex-wrap: wrap;
		padding: var(--b-space-sm) var(--b-space-xl);
		background: var(--b-surface);
		border-bottom: 1px solid var(--b-rule);
	}
	.pub-toolbar-left { display: flex; align-items: center; gap: var(--b-space-sm); }
	.pub-chip {
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.32rem 0.55rem;
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.pub-chip:hover { border-color: var(--b-gold); color: var(--b-gold); }
	.pub-count { font-family: var(--b-font-mono); font-size: 0.75rem; color: var(--b-muted); }

	.pub-publish-btn {
		background: var(--b-gold);
		color: var(--b-on-accent);
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.45rem 0.9rem;
		border-radius: var(--b-radius-pill);
		transition: opacity var(--b-transition-fast), transform var(--b-transition-fast);
	}
	.pub-publish-btn:hover:not(:disabled) { transform: translateY(-1px); }
	.pub-publish-btn:disabled { opacity: 0.5; }

	.pub-msg {
		flex: 0 0 auto;
		margin: 0;
		padding: 0.5rem var(--b-space-xl);
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
	}
	.pub-msg.error { color: var(--b-mythic); background: color-mix(in srgb, var(--b-mythic) 8%, transparent); }
	.pub-msg.ok { color: var(--b-biochemical); background: color-mix(in srgb, var(--b-biochemical) 8%, transparent); }

	.pub-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		background: #e3d9e1;
		padding: 32px;
	}

	.pub-empty {
		text-align: center;
		font-family: var(--b-font-body);
		color: var(--b-text-dim);
		margin-top: var(--b-space-2xl);
	}

	.pub-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 28px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.pub-cell {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-radius: var(--b-radius-card, 10px);
		padding: 8px;
		transition: background var(--b-transition-fast);
	}
	.pub-cell.selected { background: color-mix(in srgb, var(--b-gold) 10%, transparent); }

	.pub-select {
		position: absolute;
		top: 4px;
		left: 4px;
		z-index: 2;
		width: 1.1rem;
		height: 1.1rem;
	}

	.pub-card-wrap { pointer-events: none; }

	.pub-cell-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: center;
		text-align: center;
	}
	.pub-cell-name {
		font-family: var(--b-font-body);
		font-size: 0.82rem;
		color: var(--b-text);
	}
	.pub-flag {
		font-family: var(--b-font-mono);
		font-size: 0.68rem;
		color: var(--b-muted);
	}

	.pub-source-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		color: var(--b-text-dim);
	}

	.pub-export-stage {
		position: fixed;
		left: -10000px;
		top: 0;
		width: 640px;
		pointer-events: none;
		opacity: 1;
	}
</style>
