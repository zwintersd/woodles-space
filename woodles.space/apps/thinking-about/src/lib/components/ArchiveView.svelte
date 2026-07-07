<script lang="ts">
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { columnLabel, sectionLabel } from '$lib/constants';
</script>

<div class="archive-view">
	<header class="archive-header">
		<h2>Completed</h2>
		<button class="back-link" onclick={() => thinkingAbout.openBoard()}>← back to board</button>
	</header>

	{#if thinkingAbout.archived.length === 0}
		<p class="archive-empty">nothing closed yet</p>
	{:else}
		<ul class="archive-list">
			{#each thinkingAbout.archived as entry (entry.id)}
				<li class="archive-row">
					<span class="archive-dot" style:--chip-color={entry.color} aria-hidden="true"></span>
					<button class="archive-title" onclick={() => thinkingAbout.openEntry(entry.id)}>
						{entry.title || 'untitled'}
					</button>
					<span class="archive-meta">{columnLabel(entry.columnKey)} · {sectionLabel(entry.sectionKey)}</span>
					<span class="archive-date">closed {entry.dateClosed}</span>
					<button class="reopen-btn" onclick={() => thinkingAbout.reopenEntry(entry.id)}>reopen</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.archive-view {
		background: var(--ta-surface);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-md);
		box-shadow: var(--ta-shadow-lg);
		padding: 1rem 1.2rem 1.4rem;
	}

	.archive-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.8rem;
		margin-bottom: 0.4rem;
		border-bottom: 1px solid var(--ta-border);
	}

	.archive-header h2 {
		font-family: var(--ta-font-sans);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--ta-text);
	}

	.back-link {
		font-family: var(--ta-font-sans);
		font-size: 0.78rem;
		color: var(--ta-muted);
		transition: color var(--ta-transition-fast), transform var(--ta-transition-spring);
	}

	.back-link:hover {
		color: var(--ta-accent);
		transform: translateX(-2px);
	}

	.archive-empty {
		font-family: var(--ta-font-sans);
		font-size: 0.85rem;
		color: var(--ta-muted);
		padding: 1.5rem 0;
		text-align: center;
	}

	.archive-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.archive-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.5rem;
		margin: 0 -0.5rem;
		border-radius: var(--ta-radius-sm);
		border-bottom: 1px solid var(--ta-border-soft);
		transition: background var(--ta-transition-fast);
	}

	.archive-row:last-child {
		border-bottom: none;
	}

	.archive-row:hover {
		background: var(--ta-bg-subtle);
	}

	.archive-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--chip-color);
		flex-shrink: 0;
		transition: transform var(--ta-transition-spring);
	}

	.archive-row:hover .archive-dot {
		transform: scale(1.3);
	}

	.archive-title {
		font-family: var(--ta-font-sans);
		font-size: 0.85rem;
		color: var(--ta-text);
		text-decoration: line-through;
		text-decoration-color: var(--ta-border);
		text-align: left;
	}

	.archive-title:hover {
		color: var(--ta-accent);
	}

	.archive-meta {
		margin-left: auto;
		font-family: var(--ta-font-mono);
		font-size: 0.68rem;
		color: var(--ta-muted);
		white-space: nowrap;
	}

	.archive-date {
		font-family: var(--ta-font-mono);
		font-size: 0.68rem;
		color: var(--ta-muted);
		white-space: nowrap;
	}

	.reopen-btn {
		flex-shrink: 0;
		font-family: var(--ta-font-sans);
		font-size: 0.72rem;
		color: var(--ta-muted);
		border: 1px solid var(--ta-border);
		border-radius: var(--ta-radius-sm);
		padding: 0.2rem 0.5rem;
		transition: border-color var(--ta-transition-fast), color var(--ta-transition-fast),
			transform var(--ta-transition-spring), box-shadow var(--ta-transition-fast);
	}

	.reopen-btn:hover {
		border-color: var(--ta-accent);
		color: var(--ta-accent);
		box-shadow: var(--ta-shadow-sm);
		transform: var(--ta-lift-hover);
	}

	.reopen-btn:active {
		transform: var(--ta-lift-press);
	}

	@media (max-width: 640px) {
		.archive-meta {
			display: none;
		}
	}
</style>
