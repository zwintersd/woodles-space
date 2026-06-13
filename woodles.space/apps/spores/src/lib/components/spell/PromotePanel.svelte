<script lang="ts">
	import { garden } from '$lib/garden.svelte';
	import { CURATED_CATEGORIES, getChildLevel } from '$lib/spells/registry';
	import type { Spore } from '$lib/types';
	import type { ChildLevel } from '$lib/spells/types';

	let { spore }: { spore: Spore } = $props();

	// Determine which arrays in data are promotable children
	// by looking up the kind in the registry.

	type PromotableLevel = {
		level: ChildLevel;
		items: Array<{ index: number; title: string; meta: string }>;
	};

	let promotableLevels = $derived<PromotableLevel[]>(
		(() => {
			const kind = typeof spore.data.kind === 'string' ? spore.data.kind : null;
			if (!kind) return [];

			const allCategories = [...CURATED_CATEGORIES, ...(garden.settings.customCategories ?? [])];
			const category = allCategories.find((c) => c.rootKind === kind);
			if (!category?.children) return [];

			const result: PromotableLevel[] = [];

			function collectLevel(level: ChildLevel) {
				const arr = spore.data[level.arrayKey];
				if (!Array.isArray(arr) || arr.length === 0) {
					// Still recurse — grandchildren might exist even if parent array empty
					if (level.children) collectLevel(level.children);
					return;
				}
				const items = (arr as Record<string, unknown>[]).map((item, index) => {
					const title =
						typeof item.title === 'string' && item.title !== 'unknown'
							? item.title
							: `${level.label.slice(0, -1)} ${index + 1}`;
					const metaParts: string[] = [];
					for (const key of ['year', 'releaseDate', 'role', 'character', 'episodeNumber']) {
						const v = item[key];
						if (v && v !== 'unknown') metaParts.push(String(v));
					}
					return { index, title, meta: metaParts.join(' · ') };
				});
				result.push({ level, items });
				if (level.children) collectLevel(level.children);
			}

			collectLevel(category.children);
			return result;
		})()
	);

	let promotedIds = $derived(
		new Set(
			garden.flights
				.filter((f) => f.from === spore.id || f.to === spore.id)
				.flatMap((f) => [f.from, f.to])
				.filter((id) => id !== spore.id)
		)
	);

	function handlePromote(arrayKey: string, index: number) {
		const created = garden.promoteChild(spore.id, arrayKey, index);
		if (created) garden.openSpore(created.id);
	}

	function handlePromoteAndPrune(arrayKey: string, index: number) {
		garden.promoteChild(spore.id, arrayKey, index, { prune: true });
	}

	let openLevel = $state<string | null>(null);

	function toggleLevel(kind: string) {
		openLevel = openLevel === kind ? null : kind;
	}
</script>

{#if promotableLevels.length > 0}
	<section class="promote-panel">
		<h3 class="section-label">promote to spore</h3>
		<p class="promote-hint">
			Promote a child into its own Spore. A Line of Flight links them back. Additive by default — the
			data stays in the parent unless you choose "promote &amp; prune."
		</p>

		{#each promotableLevels as { level, items }}
			<div class="level-block">
				<button class="level-header" onclick={() => toggleLevel(level.kind)}>
					<span class="level-name">{level.label}</span>
					<span class="level-count">{items.length}</span>
					<span class="level-arrow">{openLevel === level.kind ? '▲' : '▼'}</span>
				</button>

				{#if openLevel === level.kind}
					<ul class="items-list">
						{#each items as item}
							<li class="item-row">
								<div class="item-info">
									<span class="item-title">{item.title}</span>
									{#if item.meta}
										<span class="item-meta">{item.meta}</span>
									{/if}
								</div>
								<div class="item-actions">
									<button
										class="btn-promote"
										onclick={() => handlePromote(level.arrayKey, item.index)}
									>
										promote →
									</button>
									<button
										class="btn-prune"
										onclick={() => handlePromoteAndPrune(level.arrayKey, item.index)}
										title="Promote and remove from parent's list"
									>
										+ prune
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>
{/if}

<style>
	.promote-panel {
		margin-bottom: var(--g-space-2xl);
		padding-bottom: var(--g-space-xl);
		border-bottom: 1px solid var(--g-rule);
	}

	.section-label {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--g-muted);
		font-weight: 400;
		margin-bottom: var(--g-space-sm);
	}

	.promote-hint {
		font-size: 0.82rem;
		color: var(--g-muted);
		font-style: italic;
		margin-bottom: var(--g-space-md);
	}

	.level-block {
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-md);
		overflow: hidden;
		margin-bottom: var(--g-space-sm);
	}

	.level-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--g-space-sm);
		padding: var(--g-space-sm) var(--g-space-md);
		background: var(--g-surface);
		text-align: left;
		transition: background var(--g-transition-fast);
	}

	.level-header:hover { background: var(--g-surface-2); }

	.level-name {
		font-family: var(--g-font-mono);
		font-size: 0.8rem;
		color: var(--g-flight);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		flex: 1;
	}

	.level-count {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-muted);
	}

	.level-arrow {
		font-size: 0.6rem;
		color: var(--g-muted);
	}

	.items-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: var(--g-space-md);
		padding: var(--g-space-sm) var(--g-space-md);
		border-top: 1px solid var(--g-rule);
	}

	.item-info {
		flex: 1;
		display: flex;
		align-items: baseline;
		gap: var(--g-space-sm);
		overflow: hidden;
	}

	.item-title {
		font-size: 0.88rem;
		color: var(--g-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-meta {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted);
		flex-shrink: 0;
	}

	.item-actions {
		display: flex;
		gap: var(--g-space-xs);
		flex-shrink: 0;
	}

	.btn-promote {
		font-family: var(--g-font-mono);
		font-size: 0.72rem;
		color: var(--g-flight);
		border: 1px solid var(--g-flight-soft);
		border-radius: var(--g-radius-pill);
		padding: 0.2rem 0.5rem;
		transition: background var(--g-transition-fast), color var(--g-transition-fast);
	}

	.btn-promote:hover {
		background: var(--g-flight);
		color: #0d0d1a;
	}

	.btn-prune {
		font-family: var(--g-font-mono);
		font-size: 0.7rem;
		color: var(--g-muted);
		border: 1px solid var(--g-border);
		border-radius: var(--g-radius-pill);
		padding: 0.2rem 0.5rem;
		transition: all var(--g-transition-fast);
	}

	.btn-prune:hover {
		color: var(--g-flight-active);
		border-color: var(--g-flight-active);
	}
</style>
