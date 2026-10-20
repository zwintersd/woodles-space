<script lang="ts">
	import type { Collection } from './collections';

	let {
		collection,
		sourceStatus,
		syncBusy,
		hiddenFields,
		hiddenRecords,
		onCommand,
		onImport
	}: {
		collection: Collection;
		sourceStatus: string;
		syncBusy: boolean;
		hiddenFields: number;
		hiddenRecords: number;
		onCommand: (id: string) => void;
		onImport: (file: File | undefined) => void;
	} = $props();

	const connected = $derived(!!collection.sources?.length);
	const status = $derived(
		sourceStatus ||
			(collection.sourceSyncedAt ? `Updated ${new Date(collection.sourceSyncedAt).toLocaleTimeString()}` : 'Pulling source data…')
	);
</script>

<div class="table-toolbar">
	<div class="table-intro">
		<span>COLLECTION</span>
		<strong>{collection.records.length} records <i>·</i> {collection.fields.length} fields</strong>
		{#if connected}<small class="source-status" role="status">{status}</small>{/if}
	</div>
	<div class="table-tools">
		{#if hiddenRecords}
			<button class="show-hidden" onclick={() => onCommand('view:show-records')} title="Show every hidden record">{hiddenRecords} hidden {hiddenRecords === 1 ? 'record' : 'records'}</button>
		{/if}
		{#if hiddenFields}
			<button class="show-hidden" onclick={() => onCommand('view:show-fields')} title="Show every hidden field">{hiddenFields} hidden {hiddenFields === 1 ? 'field' : 'fields'}</button>
		{/if}
		{#if connected}
			<button onclick={() => onCommand('source:sync')} disabled={syncBusy} title="Refresh records from their source apps">
				{syncBusy ? '↻ Refreshing' : '↻ Refresh sources'}
			</button>
		{/if}
		<button onclick={() => onCommand('reference:add')} title="Add an existing Woodles thing">↗ Add existing</button>
		<label class="import-button" title="Import a Collection JSON backup">
			⇧ Import<input type="file" accept="application/json,.json" onchange={(event) => onImport(event.currentTarget.files?.[0])} />
		</label>
		<button onclick={() => onCommand('collection:export')} title="Export this Collection">⇩ Export</button>
	</div>
</div>
