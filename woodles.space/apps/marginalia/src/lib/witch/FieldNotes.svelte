<script lang="ts">
	// The live observation log — short, timestamped, auto-generated entries
	// distinct from the big scripted journal beats (see content/journal.ts).
	// A naturalist's actual notebook: not every reading, just the moments
	// worth writing down.
	import { book } from './book.svelte';

	function timeAgo(t: number): string {
		const s = Math.max(0, (Date.now() - t) / 1000);
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}
</script>

{#if book.fieldNotes.length > 0}
	<section class="field-notes">
		<h3>field notes</h3>
		<ul>
			{#each book.fieldNotes as note (note.id)}
				<li>
					<span class="note-text">{note.text}</span>
					<span class="note-time">{timeAgo(note.t)}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.field-notes {
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--panel);
		padding: 0.6rem 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	h3 {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--periwinkle);
		margin: 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 11rem;
		overflow-y: auto;
	}
	li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.7rem;
		border-top: 1px solid var(--rule);
		padding-top: 0.4rem;
	}
	li:first-child {
		border-top: none;
		padding-top: 0;
	}
	.note-text {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		line-height: 1.3;
		color: var(--cream);
	}
	.note-time {
		font-family: var(--font-ui);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
