<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { studio } from '../../studio.svelte.js';

	/**
	 * The mockup's "Balance Note" — a thought parked next to the thing it is
	 * about. It lives in `def.notes`, so it travels with the project rather than
	 * with the browser.
	 */
	let { id }: NodeProps = $props();

	const note = $derived(studio.def.notes.find((entry) => entry.id === id));
	let editing = $state(false);
	let draft = $state('');

	function begin(): void {
		draft = note?.text ?? '';
		editing = true;
	}

	function commit(): void {
		editing = false;
		if (note && draft !== note.text) studio.updateNote(id, draft);
	}
</script>

{#if note}
	<div class="note nodrag" style:--note-bg={note.color ?? 'var(--bf-note)'}>
		{#if editing}
			<!-- svelte-ignore a11y_autofocus -->
			<textarea
				bind:value={draft}
				autofocus
				aria-label="Note text"
				onblur={commit}
				onkeydown={(event) => {
					if (event.key === 'Escape') {
						editing = false;
					} else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
						commit();
					}
				}}
			></textarea>
		{:else}
			<button class="body" type="button" onclick={begin}>
				{#if note.text.trim()}
					{note.text}
				{:else}
					<span class="empty">Write a note…</span>
				{/if}
			</button>
		{/if}

		<button class="remove" type="button" onclick={() => studio.removeNote(id)} aria-label="Delete note">×</button>
	</div>
{/if}

<style>
	.note {
		position: relative;
		width: 210px;
		min-height: 84px;
		padding: 11px 13px;
		border: 1px solid var(--bf-note-line);
		border-radius: var(--bf-radius);
		/* The very slight tilt is what makes it read as paper on a board rather
		   than as another card in the graph. */
		transform: rotate(-1.1deg);
		background: var(--note-bg);
		box-shadow: var(--bf-shadow-soft);
		font-size: 12px;
		line-height: 1.45;
		color: #6b5320;
	}

	.body {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		font: inherit;
		color: inherit;
		white-space: pre-wrap;
		cursor: text;
	}

	.empty {
		color: #a8904f;
	}

	textarea {
		width: 100%;
		min-height: 62px;
		padding: 0;
		border: 0;
		background: none;
		resize: vertical;
		font: inherit;
		color: inherit;
		outline: none;
	}

	.remove {
		position: absolute;
		top: 2px;
		right: 5px;
		border: 0;
		background: none;
		color: #b09258;
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.note:hover .remove,
	.remove:focus-visible {
		opacity: 1;
	}
</style>
