<script lang="ts">
	import { COLUMNS } from '$lib/constants';
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import Column from './Column.svelte';

	let isEmpty = $derived(thinkingAbout.entries.length === 0);
</script>

<div class="board-shell">
	{#if isEmpty}
		<div class="empty-guide">
			<p>Start with one thing that keeps orbiting.</p>
			<span>Books, games, shows, articles — anything you want a soft place to keep noticing.</span>
		</div>
	{/if}

	<div class="board">
		{#each COLUMNS as column (column.key)}
			<Column {column} />
		{/each}
	</div>
</div>

<style>
	.board-shell {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-guide {
		position: relative;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		background:
			linear-gradient(90deg, rgba(63, 81, 181, 0.12), transparent 32%),
			linear-gradient(270deg, rgba(51, 182, 121, 0.1), rgba(244, 81, 30, 0.08)),
			var(--ta-surface);
		border: 1px solid rgba(255, 255, 255, 0.86);
		border-radius: var(--ta-radius-md);
		box-shadow: var(--ta-shadow-sm);
		padding: 0.75rem 0.95rem;
		overflow: hidden;
	}

	.empty-guide::before {
		content: '';
		width: 0.58rem;
		align-self: stretch;
		border-radius: var(--ta-radius-pill);
		background: linear-gradient(180deg, #3f51b5, #33b679, #f4511e);
		flex-shrink: 0;
	}

	.empty-guide p {
		font-family: var(--ta-font-sans);
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--ta-text);
	}

	.empty-guide span {
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
	}

	.board {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		background: var(--ta-surface);
		border: 1px solid rgba(255, 255, 255, 0.9);
		border-radius: var(--ta-radius-md);
		box-shadow: var(--ta-shadow-lg);
		overflow: hidden;
	}

	@media (max-width: 860px) {
		.empty-guide {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.2rem;
		}

		.empty-guide::before {
			width: 100%;
			height: 0.32rem;
		}

		.board {
			grid-template-columns: 1fr;
		}
	}
</style>
