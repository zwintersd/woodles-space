<script lang="ts">
	import { store } from '$lib/store.svelte';
	import { onboarding } from '$lib/onboarding.store.svelte';
	import { STEP_COPY, STARTER_DOMAINS } from '$lib/onboarding.copy';
	import type { Domain } from '$lib/types';
	import StepShell from './StepShell.svelte';

	const copy = STEP_COPY[3];

	// Local selection state; pre-fill with any domains already in the store.
	let selectedIds = $state(new Set(store.domains.map((d) => d.id)));

	function toggle(d: Domain) {
		const next = new Set(selectedIds);
		if (next.has(d.id)) next.delete(d.id);
		else next.add(d.id);
		selectedIds = next;
	}

	function advance() {
		const picked = STARTER_DOMAINS.filter((d) => selectedIds.has(d.id));
		store.setDomains(picked);
		onboarding.advance();
	}

	let canAdvance = $derived(selectedIds.size > 0);
</script>

<StepShell
	eyebrow={copy.eyebrow}
	heading={copy.heading}
	subprompt={copy.subprompt}
	cta={copy.cta}
	stage={4}
	{canAdvance}
	onAdvance={advance}
>
	<div class="chip-grid">
		{#each STARTER_DOMAINS as d (d.id)}
			{@const active = selectedIds.has(d.id)}
			<button
				class="chip"
				class:active
				onclick={() => toggle(d)}
				aria-pressed={active}
				style:--chip-color={d.color}
			>
				<span class="chip-icon">{d.icon}</span>
				<span class="chip-name">{d.name}</span>
			</button>
		{/each}
	</div>

	<p class="chip-count">
		{selectedIds.size > 0
			? `${selectedIds.size} ${selectedIds.size === 1 ? 'territory' : 'territories'} chosen`
			: 'pick at least one'}
	</p>
</StepShell>

<style>
	.chip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 0.55rem;
		padding: 0.5rem 0;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--p-border);
		border-radius: var(--pl-radius-md);
		background: var(--p-surface);
		text-align: left;
		transition: all var(--pl-transition-fast);
		opacity: 0.7;
	}

	.chip:hover {
		opacity: 1;
		border-color: color-mix(in srgb, var(--chip-color) 60%, var(--p-border));
	}

	.chip.active {
		opacity: 1;
		border-color: var(--chip-color);
		background: color-mix(in srgb, var(--chip-color) 18%, var(--p-surface));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--chip-color) 40%, transparent);
	}

	.chip-icon {
		font-family: var(--pl-font-fell);
		font-size: 1.05rem;
		color: var(--chip-color);
		line-height: 1;
		flex-shrink: 0;
	}

	.chip-name {
		font-family: var(--pl-font-body);
		font-size: 0.92rem;
		color: var(--p-text);
		letter-spacing: 0.01em;
	}

	.chip-count {
		font-family: var(--pl-font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		color: var(--p-muted);
		opacity: 0.6;
		text-align: center;
		margin-top: 0.25rem;
		font-style: italic;
	}
</style>
