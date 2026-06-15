<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import { domains, rarities } from '$lib/content/domains';
	import type { SortKey } from '$lib/types';
	import CreatureCard from './CreatureCard.svelte';

	const sorts: { id: SortKey; label: string }[] = [
		{ id: 'recent', label: 'newest' },
		{ id: 'name', label: 'name' },
		{ id: 'cost', label: 'cost' },
		{ id: 'rarity', label: 'rarity' }
	];

	let visible = $derived(bestiary.visibleCreatures);
	let counts = $derived(bestiary.rarityCounts);
</script>

<div class="collection">
	<header class="shelf-head">
		<div class="title-row">
			<h1 class="title">the bestiary</h1>
			<button class="summon" onclick={() => bestiary.newCreature()}>
				<span class="plus">＋</span> new creature
			</button>
		</div>
		<p class="census">
			{#if !bestiary.ready}
				&nbsp;
			{:else if bestiary.total === 0}
				no creatures yet — the margins are quiet
			{:else}
				{bestiary.total} discovered
				<span class="dot">·</span>
				<span class="cc" style="--c: var(--b-common)">{counts.common} common</span>
				<span class="cc" style="--c: var(--b-uncommon)">{counts.uncommon} uncommon</span>
				<span class="cc" style="--c: var(--b-rare)">{counts.rare} rare</span>
				<span class="cc" style="--c: var(--b-mythic)">{counts.mythic} mythic</span>
			{/if}
		</p>
	</header>

	{#if bestiary.total > 0}
		<div class="controls">
			<input
				class="search"
				type="search"
				placeholder="search the shelf…"
				value={bestiary.search}
				oninput={(e) => (bestiary.search = e.currentTarget.value)}
			/>

			<div class="control-group" role="group" aria-label="sort">
				{#each sorts as s (s.id)}
					<button
						class="chip"
						class:active={bestiary.sort === s.id}
						onclick={() => bestiary.setSort(s.id)}
					>{s.label}</button>
				{/each}
			</div>

			<div class="control-group" role="group" aria-label="filter by rarity">
				<button
					class="chip"
					class:active={bestiary.rarityFilter === 'all'}
					onclick={() => (bestiary.rarityFilter = 'all')}
				>all</button>
				{#each rarities as r (r.id)}
					<button
						class="chip rarity"
						class:active={bestiary.rarityFilter === r.id}
						style="--c: var({r.colorVar})"
						onclick={() => (bestiary.rarityFilter = r.id)}
						title={r.name}
					><span class="sym">{r.symbol}</span>{r.name}</button>
				{/each}
			</div>

			<div class="control-group" role="group" aria-label="filter by domain">
				<button
					class="chip"
					class:active={bestiary.domainFilter === 'all'}
					onclick={() => (bestiary.domainFilter = 'all')}
				>any domain</button>
				{#each domains as d (d.id)}
					<button
						class="chip domain"
						class:active={bestiary.domainFilter === d.id}
						style="--c: var({d.colorVar})"
						onclick={() => (bestiary.domainFilter = d.id)}
						title={d.aspect}
					><span class="sym">{d.glyph}</span>{d.name}</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if !bestiary.ready}
		<!-- Creatures load asynchronously from IndexedDB; hold the empty-state
		     until that first read lands so the shelf doesn't flash "bare". -->
	{:else if bestiary.total === 0}
		<div class="empty">
			<span class="empty-glyph">✶</span>
			<p class="empty-lead">The shelf is bare.</p>
			<p class="empty-sub">
				In Marginalia, the witch writes a condition and the world works out the rest —
				and sometimes, out of that working, a creature emerges. Catch one here. Give it a
				sprite, a cost, a rarity, a pair of numbers in the corner, and pin it to the page.
			</p>
			<button class="summon big" onclick={() => bestiary.newCreature()}>
				<span class="plus">＋</span> summon your first creature
			</button>
		</div>
	{:else if visible.length === 0}
		<div class="empty small">
			<p class="empty-lead">Nothing on the shelf matches.</p>
			<button class="ghost" onclick={() => bestiary.clearFilters()}>clear filters</button>
		</div>
	{:else}
		<div class="grid">
			{#each visible as creature (creature.id)}
				<button class="card-cell" onclick={() => bestiary.openEditor(creature.id)}>
					<CreatureCard {creature} interactive />
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.collection {
		padding: var(--b-space-xl) clamp(var(--b-space-lg), 4vw, var(--b-space-2xl)) var(--b-space-2xl);
		max-width: 1600px;
		margin: 0 auto;
	}

	.shelf-head { margin-bottom: var(--b-space-lg); }
	.title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--b-space-md);
		flex-wrap: wrap;
	}
	.title {
		font-family: var(--b-font-codex);
		font-weight: 600;
		font-size: clamp(1.8rem, 4vw, 2.7rem);
		color: var(--b-text);
		letter-spacing: 0.01em;
	}

	.summon {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--b-gold);
		color: var(--b-on-accent);
		font-family: var(--b-font-mono);
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.45rem 0.9rem;
		border-radius: var(--b-radius-pill);
		transition: transform var(--b-transition-fast), box-shadow var(--b-transition-fast);
	}
	.summon:hover { transform: translateY(-1px); box-shadow: 0 0.4rem 1rem var(--b-gold-soft); }
	.summon .plus { font-size: 1rem; line-height: 1; }
	.summon.big { font-size: 0.92rem; padding: 0.6rem 1.2rem; margin-top: var(--b-space-md); }

	.census {
		margin-top: var(--b-space-sm);
		font-family: var(--b-font-mono);
		font-size: 0.78rem;
		color: var(--b-text-dim);
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.census .dot { color: var(--b-muted); }
	.cc::before {
		content: '';
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--c);
		margin-right: 0.3rem;
		vertical-align: middle;
	}

	/* ── controls ── */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--b-space-sm);
		align-items: center;
		margin-bottom: var(--b-space-lg);
		padding-bottom: var(--b-space-md);
		border-bottom: 1px solid var(--b-rule);
	}
	.search {
		flex: 1 1 12rem;
		min-width: 10rem;
		background: var(--b-surface-2);
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.45rem 0.7rem;
		color: var(--b-text);
		font-family: var(--b-font-body);
		font-size: 0.9rem;
	}
	.search:focus { border-color: var(--b-gold); }

	.control-group { display: flex; flex-wrap: wrap; gap: 2px; }
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-muted);
		border: 1px solid transparent;
		border-radius: var(--b-radius-sm);
		padding: 0.32rem 0.55rem;
		transition: color var(--b-transition-fast), border-color var(--b-transition-fast),
			background var(--b-transition-fast);
	}
	.chip:hover { color: var(--b-text-dim); }
	.chip.active { color: var(--b-text); border-color: var(--b-border-strong); background: var(--b-surface); }
	.chip .sym { color: var(--c, var(--b-gold)); }
	.chip.rarity.active, .chip.domain.active {
		border-color: var(--c);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent);
	}

	/* ── grid ── */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: clamp(var(--b-space-md), 2vw, var(--b-space-xl));
	}
	.card-cell { display: block; width: 100%; background: none; text-align: left; }

	/* ── empty states ── */
	.empty {
		text-align: center;
		max-width: 34rem;
		margin: var(--b-space-2xl) auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--b-space-sm);
	}
	.empty.small { margin: var(--b-space-xl) auto; }
	.empty-glyph { font-size: 2.4rem; color: var(--b-gold); opacity: 0.6; }
	.empty-lead {
		font-family: var(--b-font-codex);
		font-size: 1.4rem;
		color: var(--b-text);
	}
	.empty-sub {
		font-family: var(--b-font-body);
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--b-text-dim);
	}
	.ghost {
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		padding: 0.4rem 0.9rem;
		font-family: var(--b-font-mono);
		font-size: 0.8rem;
		color: var(--b-text-dim);
		transition: border-color var(--b-transition-fast), color var(--b-transition-fast);
	}
	.ghost:hover { border-color: var(--b-gold); color: var(--b-gold); }
</style>
