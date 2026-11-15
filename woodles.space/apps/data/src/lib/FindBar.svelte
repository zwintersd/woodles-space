<script lang="ts">
	import type { CollectionField } from './collections';
	import type { FieldTally } from './findReplace';

	let {
		query = $bindable(),
		replacement = $bindable(),
		matchCase = $bindable(),
		wholeCell = $bindable(),
		scopeField = $bindable(),
		fields,
		cells,
		occurrences,
		position,
		confirming,
		tally,
		onChange,
		onStep,
		onReplace,
		onReplaceAll,
		onConfirm,
		onCancel,
		onClose
	}: {
		query: string;
		replacement: string;
		matchCase: boolean;
		wholeCell: boolean;
		scopeField: string;
		fields: CollectionField[];
		cells: number;
		occurrences: number;
		/** 1-based place of the current match among `cells`, or 0 when there is none. */
		position: number;
		/** Replace all with nothing deletes text, so it asks first, with what it would remove. */
		confirming: boolean;
		tally: FieldTally[];
		onChange: () => void;
		onStep: (direction: 1 | -1) => void;
		onReplace: () => void;
		onReplaceAll: () => void;
		onConfirm: () => void;
		onCancel: () => void;
		onClose: () => void;
	} = $props();

	const summary = $derived(
		!query ? 'Type to find' : !cells ? 'No matches' : `${position} of ${cells} ${cells === 1 ? 'cell' : 'cells'}${occurrences > cells ? ` · ${occurrences} matches` : ''}`
	);

	const plural = (count: number, word: 'cell' | 'match') => `${count} ${count === 1 ? word : word === 'match' ? 'matches' : `${word}s`}`;

	function keydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') { event.preventDefault(); onClose(); }
		else if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.classList.contains('find-input')) { event.preventDefault(); if (event.target === replaceInput) onReplace(); else onStep(event.shiftKey ? -1 : 1); }
	}
	let replaceInput = $state<HTMLInputElement | null>(null);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="find-bar" role="search" aria-label="Find and replace" onkeydown={keydown}>
	<div class="find-row">
		<input class="find-input" aria-label="Find" placeholder="Find" bind:value={query} oninput={onChange} data-find-input />
		<span class="find-count" role="status">{summary}</span>
		<button onclick={() => onStep(-1)} disabled={!cells} aria-label="Previous match" title="Previous (Shift+Enter)">↑</button>
		<button onclick={() => onStep(1)} disabled={!cells} aria-label="Next match" title="Next (Enter)">↓</button>
		<button class="find-close" onclick={onClose} aria-label="Close find and replace" title="Close (Esc)">×</button>
	</div>
	<div class="find-row">
		<input class="find-input" aria-label="Replace with" placeholder="Replace with" bind:value={replacement} bind:this={replaceInput} />
		<button onclick={onReplace} disabled={!cells} title="Replace this cell's matches (Enter)">Replace</button>
		<button onclick={onReplaceAll} disabled={!cells} title="Replace every match · undoable">Replace all</button>
	</div>
	<div class="find-row find-options">
		<label><input type="checkbox" bind:checked={matchCase} onchange={onChange} /> Match case</label>
		<label><input type="checkbox" bind:checked={wholeCell} onchange={onChange} /> Whole cell</label>
		<label class="find-scope">
			In
			<select bind:value={scopeField} onchange={onChange} aria-label="Search in">
				<option value="">All visible text fields</option>
				{#each fields as field (field.id)}<option value={field.id}>{field.name}</option>{/each}
			</select>
		</label>
	</div>
	{#if confirming}
		<div class="find-confirm" role="alertdialog" aria-label="Confirm delete">
			<p>Delete “{query}” — {plural(occurrences, 'match')} in {plural(cells, 'cell')}. Undo restores it.</p>
			<ul>
				{#each tally as entry (entry.fieldId)}<li><strong>{entry.name}</strong> {plural(entry.cells, 'cell')} · {plural(entry.occurrences, 'match')}</li>{/each}
			</ul>
			<div class="find-row">
				<button class="find-danger" onclick={onConfirm} data-find-confirm>Delete {plural(occurrences, 'match')}</button>
				<button onclick={onCancel}>Cancel</button>
			</div>
		</div>
	{/if}
</div>
