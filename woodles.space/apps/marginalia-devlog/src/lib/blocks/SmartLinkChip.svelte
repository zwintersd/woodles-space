<script lang="ts">
	import type { SmartLink } from '$lib/types';

	const ICONS: Record<SmartLink['kind'], string> = {
		creature: '✦',
		biome:    '◈',
		ability:  '◆',
		stat:     '▲',
		minigame: '●',
		lore:     '◐'
	};

	let {
		link,
		onremove
	}: {
		link: SmartLink;
		onremove?: () => void;
	} = $props();
</script>

<span class="chip" data-kind={link.kind}>
	<span class="chip-icon">{ICONS[link.kind]}</span>
	<span class="chip-label">{link.label}</span>
	{#if onremove}
		<button class="chip-remove" onclick={onremove} aria-label="remove {link.label}">×</button>
	{/if}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px 2px 6px;
		border-radius: var(--d-radius-pill);
		font-family: var(--d-font-mono);
		font-size: 11px;
		line-height: 1;
		border: 1px solid currentColor;
		opacity: 0.85;
	}

	.chip[data-kind='creature'] { color: var(--d-creature); background: var(--d-creature-soft); }
	.chip[data-kind='biome']    { color: var(--d-biome);    background: var(--d-biome-soft); }
	.chip[data-kind='ability']  { color: var(--d-ability);  background: var(--d-ability-soft); }
	.chip[data-kind='stat']     { color: var(--d-stat);     background: var(--d-stat-soft); }
	.chip[data-kind='minigame'] { color: var(--d-minigame); background: var(--d-minigame-soft); }
	.chip[data-kind='lore']     { color: var(--d-lore);     background: var(--d-lore-soft); }

	.chip-icon { font-size: 10px; }

	.chip-remove {
		margin-left: 2px;
		opacity: 0.6;
		font-size: 13px;
		line-height: 1;
		transition: opacity var(--d-transition-fast);
	}
	.chip-remove:hover { opacity: 1; }
</style>
