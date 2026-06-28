<script lang="ts">
	import type { BestiaryCreature } from '$lib/witch/bestiaryDb';
	import {
		coreStatPerks,
		type ArcadeStatEffects,
		type ArcadeStatPerk
	} from './arcadeStats';

	interface Props {
		creature?: BestiaryCreature | null;
		effects?: ArcadeStatEffects;
		perks?: ArcadeStatPerk[];
		label?: string;
	}

	let {
		creature = null,
		effects = {},
		perks,
		label = 'active pet stat perks'
	}: Props = $props();

	const displayedPerks = $derived(perks ?? coreStatPerks(creature, effects));
</script>

<div class="pet-perks" aria-label={label}>
	{#each displayedPerks as perk (perk.stat)}
		<span class:lit={perk.tier > 0}>
			<b>{perk.stat}</b>
			{perk.value}: {perk.effect}
		</span>
	{/each}
</div>

<style>
	.pet-perks {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.3rem;
	}
	.pet-perks span {
		border: 1px solid var(--sol-base2);
		border-radius: 3px;
		background: rgba(253, 246, 227, 0.7);
		color: var(--sol-base1);
		font-family: var(--font-ui);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1.25;
		padding: 0.28rem 0.35rem;
	}
	.pet-perks span.lit {
		color: var(--sol-base00);
		border-color: rgba(42, 161, 152, 0.5);
		background: rgba(42, 161, 152, 0.1);
	}
	.pet-perks b {
		color: var(--sol-base01);
		font-weight: 700;
	}

	@media (max-width: 420px) {
		.pet-perks span {
			font-size: 0.52rem;
		}
	}
</style>
