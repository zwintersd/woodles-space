<script lang="ts">
	import { modal } from '@shared/modal';
	import type { FieldType } from './collections';

	let { onCreate, onClose }: { onCreate: (name: string, type: FieldType) => void; onClose: () => void } = $props();

	const TYPES: FieldType[] = ['text', 'number', 'checkbox', 'date', 'select', 'multi-select', 'url', 'relation'];
	let name = $state('');
	let type = $state<FieldType>('text');

	function typeLabel(entry: FieldType): string {
		return entry === 'multi-select' ? 'Multi-select' : entry[0].toUpperCase() + entry.slice(1);
	}
</script>

<div class="modal-shade" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
	<div class="field-dialog" role="dialog" aria-modal="true" aria-label="Add a field" use:modal>
		<form onsubmit={(event) => { event.preventDefault(); onCreate(name, type); }}>
			<span>TABLE FIELD</span>
			<h2>Add a field</h2>
			<label>Field name<input bind:value={name} placeholder="e.g. Status" data-autofocus /></label>
			<label>
				Type
				<select bind:value={type}>
					{#each TYPES as entry}<option value={entry}>{typeLabel(entry)}</option>{/each}
				</select>
			</label>
			<div class="dialog-actions">
				<button type="button" onclick={onClose}>Cancel</button>
				<button class="primary-action" type="submit">Add field</button>
			</div>
		</form>
	</div>
</div>
