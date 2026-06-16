<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import type { Stats } from '$lib/types';
	import type { CoreStatDef } from '$lib/content/stats';
	import StatBar from './StatBar.svelte';
	import SubstatRow from './SubstatRow.svelte';

	let {
		creatureId,
		core,
		stats
	}: { creatureId: string; core: CoreStatDef; stats: Stats } = $props();

	let value = $derived(stats[core.id]);
	let hasSubstats = $derived(core.substats.length > 0);

	let open = $state(false);
	let rowEl = $state<HTMLElement | null>(null);

	function step(delta: number) {
		bestiary.setCoreStat(creatureId, core.id, value + delta);
	}

	$effect(() => {
		if (!rowEl) return;
		function onwheel(e: WheelEvent) {
			e.preventDefault();
			step(e.deltaY < 0 ? 1 : -1);
		}
		rowEl.addEventListener('wheel', onwheel, { passive: false });
		return () => rowEl!.removeEventListener('wheel', onwheel);
	});
</script>

<div class="row" bind:this={rowEl} style="--c: var({core.colorVar})">
	<div class="lead">
		<span class="glyph" aria-hidden="true">{core.glyph}</span>
		<span class="name">{core.name}</span>
	</div>

	<div class="stepper">
		<button type="button" onclick={() => step(-1)} aria-label="less {core.name}">−</button>
		<input
			class="num"
			type="number"
			min="0"
			max="10"
			value={value}
			oninput={(e) => bestiary.setCoreStat(creatureId, core.id, e.currentTarget.valueAsNumber)}
		/>
		<button type="button" onclick={() => step(1)} aria-label="more {core.name}">+</button>
	</div>

	<StatBar
		{value}
		colorVar={core.colorVar}
		onpick={(n) => bestiary.setCoreStat(creatureId, core.id, n)}
	/>

	{#if hasSubstats}
		<button
			type="button"
			class="disclose"
			class:open
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<span class="tri" aria-hidden="true">{open ? '▾' : '▸'}</span> substats
		</button>
	{/if}
</div>

<p class="tagline">{core.tagline}</p>

{#if hasSubstats && open}
	<div class="substats">
		{#each core.substats as s (s.id)}
			<SubstatRow {creatureId} sub={s} {stats} colorVar={core.colorVar} />
		{/each}
	</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--b-space-md);
		flex-wrap: wrap;
	}
	.lead {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 0 0 6.5rem;
		min-width: 0;
	}
	.glyph {
		color: var(--c);
		font-size: 1rem;
		line-height: 1;
		width: 1.1rem;
		text-align: center;
	}
	.name {
		font-family: var(--b-font-codex);
		font-size: 1rem;
		color: var(--b-text);
	}

	/* stepper — matches the core stepper used for cost / P-T */
	.stepper {
		display: flex;
		align-items: stretch;
		width: fit-content;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}
	.stepper button {
		width: 1.8rem;
		display: grid;
		place-items: center;
		font-size: 1.05rem;
		color: var(--b-text-dim);
		background: var(--b-surface-2);
		transition: background var(--b-transition-fast), color var(--b-transition-fast);
	}
	.stepper button:hover { background: var(--b-gold-soft); color: var(--b-gold); }
	.stepper .num {
		width: 2.6rem;
		text-align: center;
		border: none;
		border-left: 1px solid var(--b-border);
		border-right: 1px solid var(--b-border);
		border-radius: 0;
		background: var(--b-surface-2);
		color: var(--b-text);
		font-family: var(--b-font-pixel);
		font-size: 1rem;
		padding: 0.3rem 0;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.stepper .num::-webkit-outer-spin-button,
	.stepper .num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

	.disclose {
		font-family: var(--b-font-mono);
		font-size: 0.7rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
		white-space: nowrap;
	}
	.disclose:hover, .disclose.open { color: var(--b-gold); }
	.tri { display: inline-block; width: 0.8em; }

	.tagline {
		margin: 0.05rem 0 0 calc(6.5rem + var(--b-space-md));
		font-family: var(--b-font-body);
		font-style: italic;
		font-size: 0.76rem;
		color: var(--b-muted);
	}

	.substats {
		margin: var(--b-space-xs) 0 var(--b-space-sm) calc(1.6rem + var(--b-space-md));
		padding-left: var(--b-space-md);
		border-left: 1px solid var(--b-border);
		display: flex;
		flex-direction: column;
	}
</style>
