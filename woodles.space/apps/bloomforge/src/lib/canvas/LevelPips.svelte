<script lang="ts">
	/**
	 * The mockup's row of little dots under a generator. It's a glanceable
	 * "how far along is this" — deliberately capped, because a hundred dots
	 * communicates less than a number does.
	 */
	interface Props {
		level: number;
		max?: number;
		pips?: number;
	}

	let { level, max = 10, pips = 8 }: Props = $props();

	const cap = $derived(Math.max(1, max));
	const filled = $derived(Math.min(pips, Math.round((Math.min(level, cap) / cap) * pips)));
</script>

<div class="pips" role="img" aria-label="level {level} of {cap}">
	{#each { length: pips } as _, index (index)}
		<span class="pip" class:on={index < filled}></span>
	{/each}
</div>

<style>
	.pips {
		display: flex;
		gap: 4px;
		margin-top: 7px;
	}

	.pip {
		width: 6px;
		height: 6px;
		border-radius: var(--bf-radius-pill);
		background: var(--bf-rule);
	}

	.pip.on {
		background: var(--tint, var(--bf-accent));
	}
</style>
