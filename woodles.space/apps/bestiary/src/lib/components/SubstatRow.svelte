<script lang="ts">
	import { bestiary } from '$lib/bestiary.svelte';
	import type { Stats } from '$lib/types';
	import type { SubstatDef } from '$lib/content/stats';
	import { effectiveSubstat, isSubstatOverridden } from '$lib/collection';
	import StatBar from './StatBar.svelte';

	let {
		creatureId,
		sub,
		stats,
		colorVar
	}: { creatureId: string; sub: SubstatDef; stats: Stats; colorVar: string } = $props();

	let value = $derived(effectiveSubstat(stats, sub.id));
	let overridden = $derived(isSubstatOverridden(stats, sub.id));

	function step(delta: number) {
		bestiary.setSubstat(creatureId, sub.id, value + delta);
	}
	function reset() {
		bestiary.setSubstat(creatureId, sub.id, null);
	}
</script>

<div class="sub" class:overridden style="--c: var({colorVar})">
	<span class="dot" aria-hidden="true"></span>
	<span class="name" title={sub.note}>{sub.name}</span>
	<div class="stepper" class:authored={overridden}>
		<button type="button" onclick={() => step(-1)} aria-label="less {sub.name}">−</button>
		<input
			class="num"
			type="number"
			min="0"
			max="10"
			value={value}
			oninput={(e) => bestiary.setSubstat(creatureId, sub.id, e.currentTarget.valueAsNumber)}
		/>
		<button type="button" onclick={() => step(1)} aria-label="more {sub.name}">+</button>
	</div>
	<StatBar {value} {colorVar} />
	{#if overridden}
		<button type="button" class="reset" onclick={reset} title="reset to its core value">↺ reset</button>
	{/if}
</div>

<style>
	.sub {
		display: flex;
		align-items: center;
		gap: var(--b-space-sm);
		padding: 0.2rem 0;
	}
	.dot {
		flex-shrink: 0;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: transparent;
	}
	.overridden .dot {
		background: var(--c);
		box-shadow: 0 0 0.3em color-mix(in srgb, var(--c) 60%, transparent);
	}
	.name {
		flex: 0 0 6.5rem;
		font-family: var(--b-font-mono);
		font-size: 0.72rem;
		color: var(--b-text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* steppers — a lighter echo of the core stepper */
	.stepper {
		display: flex;
		align-items: stretch;
		width: fit-content;
		border: 1px solid var(--b-border);
		border-radius: var(--b-radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}
	.stepper.authored { border-color: color-mix(in srgb, var(--c) 60%, var(--b-border)); }
	.stepper button {
		width: 1.5rem;
		display: grid;
		place-items: center;
		font-size: 0.95rem;
		color: var(--b-text-dim);
		background: var(--b-surface-2);
		transition: background var(--b-transition-fast), color var(--b-transition-fast);
	}
	.stepper button:hover { background: var(--b-gold-soft); color: var(--b-gold); }
	.stepper .num {
		width: 2.1rem;
		text-align: center;
		border: none;
		border-left: 1px solid var(--b-border);
		border-right: 1px solid var(--b-border);
		border-radius: 0;
		background: var(--b-surface-2);
		color: var(--b-text);
		font-family: var(--b-font-pixel);
		font-size: 0.9rem;
		padding: 0.25rem 0;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.stepper .num::-webkit-outer-spin-button,
	.stepper .num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

	.reset {
		font-family: var(--b-font-mono);
		font-size: 0.66rem;
		color: var(--b-muted);
		transition: color var(--b-transition-fast);
		white-space: nowrap;
	}
	.reset:hover { color: var(--b-gold); }
</style>
