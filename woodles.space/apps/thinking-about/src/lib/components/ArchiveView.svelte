<script lang="ts">
	import { thinkingAbout } from '$lib/thinkingAbout.svelte';
	import { columnLabel, sectionLabel } from '$lib/constants';
	import { collect } from '$lib/motion';
</script>

<div class="archive-view">
	<header class="archive-header">
		<h2>Completed</h2>
		<button class="back-link" onclick={() => thinkingAbout.openBoard()}>← back to board</button>
	</header>

	<!-- list first, message second: reopening the last completed thing lets
	     that row fold away above the message arriving under it, rather than
	     being cut off by the list unmounting around it. See Section for the
	     same reasoning one screen over. -->
	<ul class="archive-list">
		{#each thinkingAbout.archived as entry, i (entry.id)}
			<!-- the color rides the row, not just its dot, so the hover tint is
			     the entry's own — and the dot inherits it from here -->
			<li class="archive-row" style:--chip-color={entry.color} style:--i={i} out:collect>
				<span class="archive-dot" aria-hidden="true"></span>
				<button class="archive-title" onclick={() => thinkingAbout.openEntry(entry.id)}>
					{entry.title || 'untitled'}
				</button>
				<span class="archive-meta">{columnLabel(entry.columnKey)} · {sectionLabel(entry.sectionKey)}</span>
				<span class="archive-date">closed {entry.dateClosed}</span>
				<button class="reopen-btn" onclick={() => thinkingAbout.reopenEntry(entry.id)}>reopen</button>
			</li>
		{/each}
	</ul>

	{#if thinkingAbout.archived.length === 0}
		<p class="archive-empty">nothing closed yet</p>
	{/if}
</div>

<style>
	.archive-view {
		background:
			linear-gradient(135deg, rgba(63, 81, 181, 0.07), transparent 35%),
			linear-gradient(315deg, rgba(51, 182, 121, 0.08), transparent 40%),
			var(--ta-surface);
		border: 1px solid rgba(255, 255, 255, 0.9);
		border-radius: var(--ta-radius-md);
		box-shadow: var(--ta-shadow-lg);
		padding: 1rem 1.2rem 1.4rem;
		animation: ta-rise 0.5s var(--ta-ease-glide) both;
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
		transform: translateX(-3px);
	}

	.archive-empty {
		font-family: var(--ta-font-sans);
		font-size: 0.85rem;
		color: var(--ta-muted);
		padding: 1.5rem 0;
		text-align: center;
		animation: ta-rise 0.4s var(--ta-ease-glide) 0.1s both;
	}

	.archive-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.archive-list:empty {
		display: none;
	}

	.archive-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.5rem;
		margin: 0 -0.5rem;
		border-radius: var(--ta-radius-sm);
		border-bottom: 1px solid var(--ta-border-soft);
		transition: background var(--ta-transition-fast);
		animation: ta-slide-in 0.4s var(--ta-ease-glide) both;
		animation-delay: min(calc(var(--i, 0) * 34ms), 300ms);
	}

	.archive-row:last-child {
		border-bottom: none;
	}

	.archive-row:hover {
		background: color-mix(in srgb, var(--chip-color, var(--ta-accent)) 9%, white);
	}

	/* reopening flips the row back to its own color on the way out, the same
	   language the board's chips use when they leave in the other direction */
	.archive-row::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--chip-color);
		opacity: calc(var(--ta-collect, 0) * 0.55);
		pointer-events: none;
	}

	.archive-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--chip-color);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--chip-color) 16%, transparent);
		flex-shrink: 0;
		transition: transform var(--ta-transition-spring), box-shadow var(--ta-transition-glide);
	}

	.archive-row:hover .archive-dot {
		transform: scale(1.3);
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--chip-color) 20%, transparent);
	}

	.archive-title {
		font-family: var(--ta-font-sans);
		font-size: 0.85rem;
		color: var(--ta-text);
		text-decoration: line-through;
		text-decoration-color: var(--ta-border);
		text-align: left;
		transition: color var(--ta-transition-fast),
			text-decoration-color var(--ta-transition-medium);
	}

	.archive-title:hover {
		color: var(--ta-accent);
		text-decoration-color: color-mix(in srgb, var(--ta-accent) 45%, transparent);
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
