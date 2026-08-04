<script lang="ts">
	import { studio } from '../studio.svelte.js';

	/**
	 * Project-level notes. Separate from the canvas sticky notes on purpose: one
	 * is a thought about a *place* in the graph, this is a thought about the
	 * whole design. Both live in the def and travel with the export.
	 */
	const description = $derived(studio.def.meta.description ?? '');
</script>

<div class="notes">
	<div class="column">
		<label class="bf-label" for="bf-project-notes">Project Notes</label>
		<textarea
			id="bf-project-notes"
			class="bf-input"
			placeholder="What is this game about? What are you still unsure of?"
			value={description}
			oninput={(event) => studio.editQuietly((def) => (def.meta.description = event.currentTarget.value))}
		></textarea>
	</div>

	<div class="column">
		<div class="head">
			<span class="bf-label">Canvas Notes ({studio.def.notes.length})</span>
			<button class="bf-button tiny" type="button" onclick={() => studio.addNote()}>+ Sticky note</button>
		</div>

		{#if studio.def.notes.length}
			<ul>
				{#each studio.def.notes as note (note.id)}
					<li>
						<span class="text">{note.text.trim() || 'Empty note'}</span>
						<button
							class="drop"
							type="button"
							onclick={() => studio.removeNote(note.id)}
							aria-label="Delete note">×</button
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Sticky notes you drop on the canvas show up here.</p>
		{/if}
	</div>
</div>

<style>
	.notes {
		display: grid;
		grid-template-columns: 1fr minmax(220px, 320px);
		gap: 20px;
		height: 100%;
		min-height: 0;
	}

	.column {
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: 6px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	textarea {
		flex: 1;
		min-height: 0;
		resize: none;
		line-height: 1.55;
	}

	.tiny {
		padding: 3px 10px;
		font-size: 11px;
	}

	ul {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 4px;
		align-content: start;
	}

	li {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 7px 9px;
		border: 1px solid var(--bf-note-line);
		border-radius: var(--bf-radius-sm);
		background: var(--bf-note);
		font-size: 11.5px;
		line-height: 1.4;
		color: #6b5320;
	}

	.text {
		flex: 1;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.drop {
		border: 0;
		background: none;
		color: #b09258;
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}

	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--bf-faint);
	}
</style>
