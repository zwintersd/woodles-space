<script lang="ts">
	import { describeCondition, nameLookup } from '@woodles/incremental-core';
	import EmojiIcon from './EmojiIcon.svelte';
	import { formatDuration, game } from './game.svelte.js';

	/**
	 * Milestones and the event log, side by side — what you're heading for and
	 * what just happened. Purchases and equip toggles are filtered out of the
	 * feed: the player made those, so echoing them back is noise that buries
	 * the events they didn't cause.
	 */
	const names = $derived(game.def ? nameLookup(game.def) : (id: string) => id);
	const PLAYER_CAUSED = new Set(['levelUp', 'purchase', 'equip', 'unequip']);
	const notable = $derived(game.log.filter((event) => !PLAYER_CAUSED.has(event.kind)));
</script>

<div class="chronicle">
	{#if game.def?.milestones.length}
		<section>
			<h2>Milestones</h2>
			<ul class="milestones">
				{#each game.def.milestones as milestone (milestone.id)}
					{@const reached = game.reachedMilestones.has(milestone.id)}
					<li class:reached>
						<span class="mark" aria-hidden="true">{#if reached}<EmojiIcon char="🏆" size={12} />{:else}·{/if}</span>
						<span class="text">
							<span class="name">{milestone.name}</span>
							{#if !reached}
								<span class="when">{describeCondition(milestone.when, names)}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<h2>Chronicle</h2>
		{#if notable.length}
			<ol class="log">
				{#each notable.slice(0, 40) as event, index (`${event.t}-${event.id}-${index}`)}
					<li data-kind={event.kind}>
						<time>{formatDuration(event.t)}</time>
						<span>{event.message}</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty">Unlocks, milestones and rebirths will show up here as they happen.</p>
		{/if}
	</section>
</div>

<style>
	.chronicle {
		display: grid;
		gap: 18px;
		align-content: start;
	}

	h2 {
		margin: 0 0 8px;
		font-family: var(--bp-font-display);
		font-size: 17px;
		font-weight: 600;
		color: var(--bp-ink-soft);
	}

	.milestones {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 3px;
	}

	.milestones li {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 5px 9px;
		border-radius: var(--bp-radius-sm);
		font-size: 12px;
		color: var(--bp-muted);
	}

	.milestones li.reached {
		background: var(--bp-milestone-soft);
		color: var(--bp-milestone);
		font-weight: 600;
	}

	.mark {
		flex: none;
		width: 16px;
		text-align: center;
	}

	.text {
		display: grid;
		gap: 1px;
	}

	.when {
		font-size: 10.5px;
		color: var(--bp-faint);
	}

	.log {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 1px;
		max-height: 320px;
		overflow-y: auto;
	}

	.log li {
		display: flex;
		gap: 9px;
		padding: 4px 8px;
		border-radius: var(--bp-radius-sm);
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--bp-ink-soft);
	}

	.log li:nth-child(odd) {
		background: var(--bp-surface-sunk);
	}

	time {
		flex: none;
		color: var(--bp-faint);
		font-family: var(--bp-font-mono);
		font-size: 10.5px;
	}

	.log li[data-kind='unlock'] span {
		color: var(--bp-unlock);
	}
	.log li[data-kind='milestone'] span {
		color: var(--bp-milestone);
		font-weight: 600;
	}
	.log li[data-kind='prestige'] span {
		color: var(--bp-prestige);
		font-weight: 600;
	}

	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--bp-faint);
		line-height: 1.5;
	}
</style>
