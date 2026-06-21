<script lang="ts">
	import type { Creature } from '$lib/types';
	import type { CoreStat } from '$lib/content/stats';
	import { domainDef, rarityDef } from '$lib/content/domains';
	import { coreStats } from '$lib/content/stats';
	import { statProfile } from '$lib/collection';

	let { creature }: { creature: Creature } = $props();

	let domain = $derived(domainDef(creature.domain));
	let rarity = $derived(rarityDef(creature.rarity));
	let profile = $derived(statProfile(creature.stats));

	function val(id: CoreStat): number {
		return creature.stats[id];
	}
</script>

<div class="stat-detail">
	<!-- ── identity ── -->
	<header class="sd-head">
		<h3 class="sd-name">{creature.name || '(unnamed)'}</h3>
		<div class="sd-identity">
			<span class="sd-domain-glyph" style="color: var({domain.colorVar})">{domain.glyph}</span>
			<span class="sd-kind">{creature.kind || 'Creature'}</span>
			<span class="sd-dot">·</span>
			<span class="sd-rarity" style="color: var({rarity.colorVar})" title={rarity.name}>{rarity.symbol}</span>
			<span class="sd-cost">cost {creature.cost}</span>
			<span class="sd-dot">·</span>
			<span class="sd-pt">{creature.power}/{creature.toughness}</span>
		</div>
	</header>

	<div class="sd-rule"></div>

	<!-- ── stat bars ── -->
	<div class="sd-stats" role="list" aria-label="stats">
		{#each coreStats as stat (stat.id)}
			{@const v = val(stat.id)}
			<div class="sd-stat" role="listitem" style="--c: var({stat.colorVar}); --v: {v}">
				<span class="sd-glyph" aria-hidden="true">{stat.glyph}</span>
				<span class="sd-sname">{stat.name}</span>
				<div class="sd-bar-track" aria-hidden="true">
					<div class="sd-bar-fill"></div>
				</div>
				<span class="sd-val" aria-label="{stat.name} {v}">{v}</span>
			</div>
		{/each}
	</div>

	<div class="sd-rule"></div>

	<!-- ── profile line ── -->
	<p class="sd-profile">{profile}</p>

	<!-- ── text ── -->
	{#if creature.abilities.trim()}
		<p class="sd-abilities">{creature.abilities}</p>
	{/if}

	{#if creature.flavor.trim()}
		<p class="sd-flavor">"{creature.flavor}"</p>
	{/if}
</div>

<style>
	.stat-detail {
		width: 100%;
		height: 100%;
		container-type: inline-size;
		font-size: 5cqw;
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		overflow: hidden;
		padding: 0.4em 0.5em;
	}

	/* ── header ── */
	.sd-head { flex: 0 0 auto; }

	.sd-name {
		font-family: var(--b-font-codex);
		font-size: 1.35em;
		font-weight: 600;
		color: var(--b-text);
		line-height: 1.1;
		margin: 0 0 0.25em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sd-identity {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2em 0.3em;
		font-family: var(--b-font-mono);
		font-size: 0.72em;
		color: var(--b-text-dim);
	}
	.sd-domain-glyph { font-size: 0.9em; }
	.sd-kind { font-style: italic; }
	.sd-dot { color: var(--b-muted); }
	.sd-rarity { font-size: 0.85em; }
	.sd-cost { color: var(--b-text-dim); }
	.sd-pt { font-weight: 600; color: var(--b-text); }

	/* ── divider ── */
	.sd-rule {
		flex: 0 0 auto;
		height: 1px;
		background: var(--b-rule, rgba(150, 130, 185, 0.18));
		margin: 0.1em 0;
	}

	/* ── stat bars ── */
	.sd-stats {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.28em;
	}

	.sd-stat {
		display: grid;
		grid-template-columns: 1em 3.8em 1fr 1.4em;
		align-items: center;
		gap: 0.3em;
	}

	.sd-glyph {
		font-size: 0.7em;
		color: var(--c);
		text-align: center;
		line-height: 1;
	}

	.sd-sname {
		font-family: var(--b-font-mono);
		font-size: 0.68em;
		color: var(--b-text-dim);
		white-space: nowrap;
	}

	.sd-bar-track {
		height: 3px;
		background: var(--b-border, rgba(239, 122, 174, 0.22));
		border-radius: 2px;
		overflow: hidden;
	}
	.sd-bar-fill {
		height: 100%;
		width: calc(var(--v) * 10%);
		background: var(--c);
		border-radius: 2px;
	}

	.sd-val {
		font-family: var(--b-font-mono);
		font-size: 0.72em;
		color: var(--b-text);
		text-align: right;
		font-weight: 500;
	}

	/* ── profile ── */
	.sd-profile {
		flex: 0 0 auto;
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.64em;
		color: var(--b-muted);
		line-height: 1.35;
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* ── text content ── */
	.sd-abilities {
		flex: 0 1 auto;
		font-family: var(--b-font-body);
		font-size: 0.7em;
		color: var(--b-text);
		line-height: 1.45;
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
	}

	.sd-flavor {
		flex: 0 1 auto;
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.65em;
		color: var(--b-text-dim);
		line-height: 1.4;
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
