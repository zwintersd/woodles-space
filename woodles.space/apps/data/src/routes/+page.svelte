<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { entityHref } from '@woodles/app-manifest';
	import { isHomeSuiteShellMessage, postHomeSuitePaletteRequest, postHomeSuiteState, type HomeSuiteSurfaceState, type WoodlesRef } from '@shared/homesuiteBridge';
	import { candidatesFor, refreshReferenceSources, shelfSource, type ReferenceCandidate } from '../../../write/src/lib/references.svelte';
	import {
		addField, addRecord, createCollection, deleteField, duplicateRecord, exportCollections, importCollections,
		isCollection, loadCollections, removeRecord, renameField, resizeColumn, saveCollections, setCellValue,
		type Collection, type CollectionField, type CollectionLibrary, type FieldType, type FieldValue
	} from '$lib/collections';
	import './data.css';

	let library = $state<CollectionLibrary>({ collections: [] });
	let collection = $state<Collection | null>(null);
	let ready = $state(false);
	let saveIssue = $state('');
	let selectedField = $state('');
	let selectedRecord = $state('');
	let selectedCell = $state<{ recordId: string; fieldId: string } | null>(null);
	let fieldName = $state('');
	let fieldType = $state<FieldType>('text');
	let addFieldOpen = $state(false);
	let pickerFor = $state<{ recordId: string; fieldId: string } | null>(null);
	let pickerQuery = $state('');
	let refs = $state<ReferenceCandidate[]>([]);
	let undoStack: Collection[] = [];
	let redoStack: Collection[] = [];
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let textBurstTimer: ReturnType<typeof setTimeout> | null = null;
	let lastTextKey = '';
	let dragField = '';
	function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

	const collectionId = $derived(page.url.searchParams.get('collection'));
	const homeSuite = $derived(page.url.searchParams.has('homesuite'));
	const orderedFields = $derived.by(() => {
		if (!collection) return [];
		return collection.views.table.columnOrder.map((id) => collection!.fields.find((entry) => entry.id === id)).filter((entry): entry is CollectionField => !!entry);
	});
	const activeField = $derived(collection?.fields.find((entry) => entry.id === selectedField) ?? null);
	const activeRecord = $derived(collection?.records.find((entry) => entry.id === selectedRecord) ?? null);
	const candidates = $derived(candidatesFor('#', pickerQuery).slice(0, 8));

	function updateLibrary(next: Collection, recordHistory = true): void {
		if (!collection) return;
		if (recordHistory && !isCollection(next)) return;
		if (recordHistory) {
			undoStack = [...undoStack.slice(-49), cloneJson(collection)];
			redoStack = [];
		}
		collection = next;
		library = { collections: library.collections.map((item) => item.id === next.id ? next : item) };
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			const result = saveCollections(library);
			saveIssue = result.ok ? '' : result.issue?.message ?? 'Could not save this Collection.';
			publishState();
		}, 120);
		publishState();
	}

	function replaceCollection(next: Collection): void {
		collection = next;
		library = { collections: library.collections.map((item) => item.id === next.id ? next : item) };
		const result = saveCollections(library);
		saveIssue = result.ok ? '' : result.issue?.message ?? 'Could not save this Collection.';
		publishState();
	}

	function setText(recordId: string, fieldId: string, value: string): void {
		const key = `${recordId}:${fieldId}`;
		if (lastTextKey !== key || !textBurstTimer) {
			if (collection) undoStack = [...undoStack.slice(-49), cloneJson(collection)];
			redoStack = [];
		}
		lastTextKey = key;
		if (textBurstTimer) clearTimeout(textBurstTimer);
		textBurstTimer = setTimeout(() => { textBurstTimer = null; lastTextKey = ''; }, 700);
		if (collection) updateLibrary(setCellValue(collection, recordId, fieldId, value), false);
	}

	function mutateCell(recordId: string, field: CollectionField, value: FieldValue): void {
		if (!collection) return;
		selectedCell = { recordId, fieldId: field.id };
		selectedRecord = recordId;
		updateLibrary(setCellValue(collection, recordId, field.id, value));
	}

	function undo(): void {
		if (!collection || !undoStack.length) return;
		redoStack = [...redoStack, cloneJson(collection)];
		const previous = undoStack.at(-1)!;
		undoStack = undoStack.slice(0, -1);
		replaceCollection(previous);
	}
	function redo(): void {
		if (!collection || !redoStack.length) return;
		undoStack = [...undoStack, cloneJson(collection)];
		const next = redoStack.at(-1)!;
		redoStack = redoStack.slice(0, -1);
		replaceCollection(next);
	}

	function primaryLabel(record: Collection['records'][number]): string {
		if (!collection) return '';
		if (record.sourceRef) {
			const candidate = refs.find((entry) => entry.app === record.sourceRef?.app && entry.kind === record.sourceRef?.kind && entry.id === record.sourceRef?.id);
			return candidate?.text ?? 'Unavailable source';
		}
		const primary = collection.fields.find((entry) => entry.primary);
		const value = primary ? record.values[primary.id] : null;
		return typeof value === 'string' && value.trim() ? value : 'Untitled record';
	}

	function sourceCandidate(ref: WoodlesRef): ReferenceCandidate | null {
		return refs.find((entry) => entry.app === ref.app && entry.kind === ref.kind && entry.id === ref.id) ?? null;
	}

	function openSource(ref: WoodlesRef): void {
		try { window.open(entityHref(ref.app, ref.kind, ref.id), '_blank', 'noopener'); } catch { /* A cold reference remains visible. */ }
	}

	function addNewRecord(): void {
		if (!collection) return;
		const next = addRecord(collection);
		updateLibrary(next);
		selectedRecord = next.records.at(-1)?.id ?? '';
		selectedCell = selectedRecord ? { recordId: selectedRecord, fieldId: collection.fields.find((entry) => entry.primary)?.id ?? '' } : null;
	}

	function addExternal(candidate: ReferenceCandidate): void {
		if (!collection) return;
		const next = addRecord(collection, { app: candidate.app, kind: candidate.kind, id: candidate.id });
		updateLibrary(next);
		selectedRecord = next.records.at(-1)?.id ?? '';
		pickerFor = null;
	}

	function createField(): void {
		if (!collection) return;
		updateLibrary(addField(collection, fieldName, fieldType));
		fieldName = '';
		addFieldOpen = false;
	}

	function deleteSelectedField(): void {
		if (!collection || !activeField || activeField.primary) return;
		updateLibrary(deleteField(collection, activeField.id));
		selectedField = '';
	}

	function command(id: string): void {
		if (id === 'record:new') addNewRecord();
		else if (id === 'field:new') { addFieldOpen = true; }
		else if (id === 'record:delete' && collection && selectedRecord) { updateLibrary(removeRecord(collection, selectedRecord)); selectedRecord = ''; }
		else if (id === 'record:duplicate' && collection && selectedRecord) { updateLibrary(duplicateRecord(collection, selectedRecord)); }
		else if (id === 'field:delete') deleteSelectedField();
		else if (id === 'collection:rename' && collection) { const title = window.prompt('Collection name', collection.title); if (title?.trim()) { const next = { ...collection, title: title.trim(), updatedAt: new Date().toISOString() }; updateLibrary(next); } }
		else if (id === 'source:open' && activeRecord?.sourceRef) openSource(activeRecord.sourceRef);
		else if (id === 'collection:export' && collection) { const blob = new Blob([exportCollections({ collections: [collection] })], { type: 'application/json' }); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${collection.title || 'collection'}.json`; anchor.click(); URL.revokeObjectURL(anchor.href); }
		else if (id === 'reference:add') { pickerFor = { recordId: '', fieldId: '' }; pickerQuery = ''; }
	}

	async function importFile(file: File | undefined): Promise<void> {
		if (!file) return;
		const result = importCollections(await file.text());
		if (!result.ok || !result.value?.collections.length) { saveIssue = result.issue?.message ?? 'This file contains no valid Collections.'; return; }
		const source = cloneJson(result.value.collections[0]);
		const fieldIds = new Map(source.fields.map((field) => [field.id, crypto.randomUUID()]));
		source.id = crypto.randomUUID();
		source.fields = source.fields.map((field) => ({ ...field, id: fieldIds.get(field.id)!, config: field.config ? cloneJson(field.config) : undefined }));
		source.records = source.records.map((record) => ({ ...record, id: crypto.randomUUID(), values: Object.fromEntries(Object.entries(record.values).map(([id, value]) => [fieldIds.get(id) ?? id, value])) }));
		source.views.table.columnOrder = source.views.table.columnOrder.map((id) => fieldIds.get(id) ?? id);
		source.views.table.columnWidths = Object.fromEntries(Object.entries(source.views.table.columnWidths).map(([id, width]) => [fieldIds.get(id) ?? id, width]));
		const next = { collections: [...library.collections, source] };
		const saved = saveCollections(next);
		if (!saved.ok) { saveIssue = saved.issue?.message ?? 'Could not import this Collection.'; return; }
		library = next;
		saveIssue = `Imported “${source.title}”. It is now in the HomeSuite index.`;
		publishState();
	}

	function inspectorChange(controlId: string, value: string): void {
		if (!collection || !activeField) return;
		if (controlId === 'field:name') updateLibrary(renameField(collection, activeField.id, value), false);
		else if (controlId.startsWith('option:')) {
			const optionId = controlId.slice('option:'.length);
			const fields = collection.fields.map((entry) => entry.id === activeField.id ? { ...entry, config: { ...entry.config, options: (entry.config?.options ?? []).map((item) => item.id === optionId ? { ...item, label: value } : item) } } : entry);
			updateLibrary({ ...collection, fields }, false);
		}
		publishState();
	}

	function publishState(): void {
		if (!collection || !homeSuite) return;
		const selected = activeField
			? { kind: 'field', label: activeField.name }
			: activeRecord
				? { kind: activeRecord.sourceRef ? 'referenced record' : 'record', label: primaryLabel(activeRecord) }
				: null;
		const rows = activeField
			? [{ label: 'Type', value: activeField.type }, { label: 'Primary', value: activeField.primary ? 'Yes' : 'No' }, { label: 'Field id', value: activeField.id }]
			: activeRecord
				? [{ label: 'Identity', value: activeRecord.sourceRef ? `${activeRecord.sourceRef.app} · ${activeRecord.sourceRef.kind}` : 'Native record' }, { label: 'Created', value: new Date(activeRecord.createdAt).toLocaleDateString() }, ...(activeRecord.sourceRef ? [{ label: 'Source', value: sourceCandidate(activeRecord.sourceRef)?.text ?? 'Unavailable' }] : [])]
				: [{ label: 'Records', value: String(collection.records.length) }, { label: 'Fields', value: String(collection.fields.length) }, { label: 'Created', value: new Date(collection.createdAt).toLocaleDateString() }];
		const commands = [
			{ id: 'record:new', label: 'New record', shortcut: '⌘ ↵' }, { id: 'field:new', label: 'New field' },
			{ id: 'collection:rename', label: 'Rename collection' }, { id: 'collection:export', label: 'Export collection' },
			{ id: 'record:duplicate', label: 'Duplicate record', enabled: !!selectedRecord },
			{ id: 'record:delete', label: 'Delete record', enabled: !!selectedRecord },
			{ id: 'field:delete', label: 'Delete field', enabled: !!activeField && !activeField.primary },
			{ id: 'source:open', label: 'Open source', enabled: !!activeRecord?.sourceRef },
			{ id: 'reference:add', label: 'Add Woodles reference' }
		];
		const state: HomeSuiteSurfaceState = {
			artifact: { id: collection.id, kind: 'collection', title: collection.title }, selection: selected,
			inspector: { title: activeField?.name ?? (activeRecord ? primaryLabel(activeRecord) : collection.title), rows,
				controls: activeField ? [{ id: 'field:name', label: 'Field name', value: activeField.name }, { id: 'field:type', label: 'Type', value: activeField.primary ? 'Primary · Text' : activeField.type }, ...(activeField.config?.options ?? []).map((option, index) => ({ id: `option:${option.id}`, label: `Option ${index + 1}`, value: option.label }))] : undefined,
				actions: activeField && !activeField.primary ? [{ commandId: 'field:delete', label: 'Delete field' }] : activeRecord?.sourceRef ? [{ commandId: 'source:open', label: 'Open source' }, { commandId: 'record:delete', label: 'Remove from collection' }] : [] },
			modes: [], activeMode: 'table', commands, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0
		};
		postHomeSuiteState(state);
	}

	function onShellMessage(event: MessageEvent): void {
		if (event.origin !== window.location.origin || event.source !== window.parent || !isHomeSuiteShellMessage(event.data)) return;
		const message = event.data;
		if (message.action === 'undo') undo();
		else if (message.action === 'redo') redo();
		else if (message.action === 'command') command(message.commandId);
		else if (message.action === 'inspector') inspectorChange(message.controlId, message.value);
		else if (message.action === 'focus') document.querySelector<HTMLElement>('.data-table input')?.focus();
	}

	function cellKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number, recordId: string, fieldId: string): void {
		if (!collection) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); addNewRecord(); return; }
		let nextRow = rowIndex, nextCol = colIndex;
		if (event.key === 'ArrowDown') nextRow = Math.min(collection.records.length - 1, rowIndex + 1);
		else if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
		else if (event.key === 'ArrowRight' && (event.target as HTMLInputElement).selectionStart === (event.target as HTMLInputElement).value?.length) nextCol = Math.min(orderedFields.length - 1, colIndex + 1);
		else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) nextCol = Math.max(0, colIndex - 1);
		else if (event.key === 'Tab') { nextCol = colIndex + (event.shiftKey ? -1 : 1); if (nextCol < 0) { nextCol = orderedFields.length - 1; nextRow = Math.max(0, rowIndex - 1); } if (nextCol >= orderedFields.length) { nextCol = 0; nextRow++; if (nextRow >= collection.records.length) { addNewRecord(); return; } } }
		else if (event.key === 'Enter') { nextRow = Math.min(collection.records.length, rowIndex + 1); if (nextRow === collection.records.length) { addNewRecord(); return; } }
		else return;
		event.preventDefault();
		if (event.key === 'Tab' || event.key === 'Enter' || event.key.startsWith('Arrow')) {
			const record = collection.records[nextRow];
			const field = orderedFields[nextCol];
			if (!record || !field) return;
			selectedRecord = record.id; selectedCell = { recordId: record.id, fieldId: field.id }; selectedField = '';
			requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-cell="${record.id}:${field.id}"] input, [data-cell="${record.id}:${field.id}"] button`)?.focus());
		}
	}

	function beginResize(event: PointerEvent, field: CollectionField): void {
		if (!collection) return;
		event.preventDefault();
		const before = cloneJson(collection);
		const startX = event.clientX;
		const startWidth = collection.views.table.columnWidths[field.id] ?? 160;
		const onMove = (move: PointerEvent) => { if (collection) collection = resizeColumn(before, field.id, startWidth + move.clientX - startX); };
		const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); if (collection) { undoStack = [...undoStack.slice(-49), before]; redoStack = []; const result = saveCollections(library = { collections: library.collections.map((item) => item.id === collection!.id ? collection! : item) }); saveIssue = result.ok ? '' : result.issue?.message ?? 'Could not save this Collection.'; publishState(); } };
		window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
	}

	function fieldValue(record: Collection['records'][number], field: CollectionField): FieldValue { return record.values[field.id] ?? (field.type === 'checkbox' ? false : field.type === 'multi-select' ? [] : null); }
	function isRef(value: FieldValue): value is WoodlesRef { return !!value && typeof value === 'object' && !Array.isArray(value) && 'app' in value; }

	onMount(() => {
		const loaded = loadCollections();
		library = loaded.value;
		if (loaded.issue) saveIssue = loaded.issue.message;
		collection = library.collections.find((entry) => entry.id === collectionId) ?? null;
		ready = true;
		void refreshReferenceSources().then(() => { refs = candidatesFor('#', ''); publishState(); });
		if (collection) { shelfSource.loadLocal(); refs = candidatesFor('#', ''); publishState(); }
		window.addEventListener('message', onShellMessage);
		window.addEventListener('keydown', globalKeydown);
		return () => { window.removeEventListener('message', onShellMessage); window.removeEventListener('keydown', globalKeydown); if (saveTimer) clearTimeout(saveTimer); };
	});

	function globalKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') { pickerFor = null; addFieldOpen = false; }
		if (event.key === 'F2' && collection) { event.preventDefault(); addFieldOpen = true; }
	}
</script>

<svelte:head><title>{collection?.title ?? 'Data'} · HomeSuite</title></svelte:head>

{#if !ready}
	<main class="loading">Opening Data…</main>
{:else if !collection}
	<main class="missing"><span>Collection unavailable</span><h1>This Collection is not on this device.</h1><a href="/homesuite">Back to HomeSuite</a></main>
{:else}
	<main class="data-surface">
		<div class="table-toolbar"><div class="table-intro"><span>COLLECTION</span><strong>{collection.records.length} records <i>·</i> {collection.fields.length} fields</strong></div><div class="table-tools"><button onclick={() => command('reference:add')} title="Add an existing Woodles thing">↗ Add existing</button><label class="import-button" title="Import a Collection JSON backup">⇧ Import<input type="file" accept="application/json,.json" onchange={(event) => importFile(event.currentTarget.files?.[0])} /></label><button onclick={() => command('collection:export')} title="Export this Collection">⇩ Export</button></div></div>
		{#if saveIssue}<div class="save-issue" role="status">{saveIssue}</div>{/if}
		<div class="table-scroll"><table class="data-table" aria-label={`${collection.title} table`}><thead><tr><th class="row-head">#</th>
			{#each orderedFields as field, columnIndex (field.id)}
				<th class:primary={field.primary} style={`width:${collection.views.table.columnWidths[field.id] ?? 160}px;min-width:${collection.views.table.columnWidths[field.id] ?? 160}px`}>
					<button class="field-head" onclick={() => { selectedField = field.id; selectedRecord = ''; selectedCell = null; publishState(); }} draggable="true" ondragstart={() => { dragField = field.id; }} ondragover={(event) => event.preventDefault()} ondrop={(event) => { event.preventDefault(); if (!collection || !dragField || dragField === field.id) return; const ids = orderedFields.map((item) => item.id); const from = ids.indexOf(dragField); const to = ids.indexOf(field.id); ids.splice(from, 1); ids.splice(to, 0, dragField); updateLibrary({ ...collection, views: { table: { ...collection.views.table, columnOrder: ids } } }); dragField = ''; }}>
						<span class="field-type">{field.primary ? '◆' : field.type === 'checkbox' ? '□' : field.type === 'relation' ? '↗' : field.type === 'date' ? '◷' : '·'}</span><span>{field.name}</span>
					</button><span class="resize-grip" onpointerdown={(event) => beginResize(event, field)} aria-hidden="true"></span>
				</th>
			{/each}
			<th class="add-field-head"><button aria-label="Add field" title="Add field" onclick={() => { addFieldOpen = true; }}>＋</button></th>
		</tr></thead><tbody>
			{#each collection.records as record, rowIndex (record.id)}
				<tr class:selected-row={selectedRecord === record.id}>
					<td class="row-number"><button aria-label={`Select ${primaryLabel(record)}`} onclick={() => { selectedRecord = record.id; selectedField = ''; selectedCell = null; publishState(); }}>{rowIndex + 1}</button></td>
					{#each orderedFields as field, colIndex (field.id)}
						{@const value = fieldValue(record, field)}
						<td class:primary-cell={field.primary} class:active-cell={selectedCell?.recordId === record.id && selectedCell.fieldId === field.id} data-cell={`${record.id}:${field.id}`} onclick={() => { selectedRecord = record.id; selectedField = ''; selectedCell = { recordId: record.id, fieldId: field.id }; publishState(); }}>
							{#if record.sourceRef && field.primary}
								<button class="source-value" title={sourceCandidate(record.sourceRef)?.text ?? 'Unavailable source'} onclick={(event) => { event.stopPropagation(); selectedRecord = record.id; selectedField = ''; publishState(); }}>{sourceCandidate(record.sourceRef)?.text ?? 'Unavailable source'}{#if !sourceCandidate(record.sourceRef)} <span class="cold">cold</span>{/if}</button>
							{:else if field.type === 'text' || field.type === 'url'}
								<input aria-label={`${field.name}, ${primaryLabel(record)}`} value={typeof value === 'string' ? value : ''} placeholder={field.primary ? 'Name this record' : '—'} onfocus={() => { selectedRecord = record.id; selectedField = ''; selectedCell = { recordId: record.id, fieldId: field.id }; publishState(); }} oninput={(event) => setText(record.id, field.id, event.currentTarget.value)} onkeydown={(event) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)} />
								{#if field.type === 'url' && typeof value === 'string' && value}<a class="url-open" href={value} target="_blank" rel="noreferrer" aria-label={`Open ${value}`} onclick={(event) => event.stopPropagation()}>↗</a>{/if}
							{:else if field.type === 'number'}
								<input type="number" aria-label={`${field.name}, ${primaryLabel(record)}`} value={typeof value === 'number' ? value : ''} onfocus={() => { selectedRecord = record.id; selectedCell = { recordId: record.id, fieldId: field.id }; publishState(); }} oninput={(event) => { const n = event.currentTarget.valueAsNumber; mutateCell(record.id, field, Number.isFinite(n) ? n : null); }} onkeydown={(event) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)} />
							{:else if field.type === 'checkbox'}
								<button class:checked={value === true} class="checkbox-cell" role="checkbox" aria-checked={value === true} aria-label={`${field.name}, ${primaryLabel(record)}`} onclick={(event) => { event.stopPropagation(); mutateCell(record.id, field, value !== true); }} onkeydown={(event) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)}>{value === true ? '✓' : ''}</button>
							{:else if field.type === 'date'}
								<input type="date" aria-label={`${field.name}, ${primaryLabel(record)}`} value={typeof value === 'string' ? value : ''} onfocus={() => { selectedRecord = record.id; selectedCell = { recordId: record.id, fieldId: field.id }; publishState(); }} onchange={(event) => mutateCell(record.id, field, event.currentTarget.value || null)} onkeydown={(event) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)} />
							{:else if field.type === 'select'}
								<select aria-label={`${field.name}, ${primaryLabel(record)}`} value={typeof value === 'string' ? value : ''} onfocus={() => { selectedRecord = record.id; selectedCell = { recordId: record.id, fieldId: field.id }; publishState(); }} onchange={(event) => mutateCell(record.id, field, event.currentTarget.value || null)} onkeydown={(event) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)}><option value="">—</option>{#each field.config?.options ?? [] as option}<option value={option.id}>{option.label}</option>{/each}</select>
							{:else if field.type === 'multi-select'}
								<select multiple aria-label={`${field.name}, ${primaryLabel(record)}`} value={Array.isArray(value) ? value : []} onchange={(event) => mutateCell(record.id, field, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}>{#each field.config?.options ?? [] as option}<option value={option.id}>{option.label}</option>{/each}</select>
							{:else if field.type === 'relation'}
								<button class="relation-cell" aria-label={`Set ${field.name} relation`} onclick={(event) => { event.stopPropagation(); pickerFor = { recordId: record.id, fieldId: field.id }; pickerQuery = ''; selectedRecord = record.id; selectedField = ''; publishState(); }}>{isRef(value) ? sourceCandidate(value)?.text ?? 'Unavailable reference' : '＋ Add relation'}</button>
							{/if}
						</td>
					{/each}
					<td class="row-actions"><button aria-label={`Actions for ${primaryLabel(record)}`} title="Record actions" onclick={() => { selectedRecord = record.id; selectedField = ''; publishState(); }}>⋯</button></td>
				</tr>
			{/each}
			<tr class="new-record-row"><td></td><td colspan={Math.max(1, orderedFields.length + 1)}><button onclick={addNewRecord}>＋ New record</button></td></tr>
		</tbody></table></div>
		{#if addFieldOpen}<div class="modal-shade" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) addFieldOpen = false; }}><form class="field-dialog" onsubmit={(event) => { event.preventDefault(); createField(); }}><span>TABLE FIELD</span><h2>Add a field</h2><label>Field name<input bind:value={fieldName} placeholder="e.g. Status" /></label><label>Type<select bind:value={fieldType}>{#each ['text','number','checkbox','date','select','multi-select','url','relation'] as type}<option value={type}>{type === 'multi-select' ? 'Multi-select' : type[0].toUpperCase() + type.slice(1)}</option>{/each}</select></label><div class="dialog-actions"><button type="button" onclick={() => { addFieldOpen = false; }}>Cancel</button><button class="primary-action" type="submit">Add field</button></div></form></div>{/if}
		{#if pickerFor}<div class="modal-shade" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) pickerFor = null; }}><div class="reference-dialog" role="dialog" aria-modal="true" aria-label="Choose a Woodles reference"><span>WOODLES REFERENCE</span><h2>{pickerFor.recordId && pickerFor.recordId !== '$new' ? 'Choose a related thing' : 'Add a thing to this Collection'}</h2><input bind:value={pickerQuery} aria-label="Find a thing" placeholder="Search Thinking About entries and Write documents" />{#if !pickerFor.recordId}<button class="picker-all" onclick={() => pickerFor = { recordId: '$new', fieldId: '' }}>Show available things</button>{/if}<div class="reference-list">{#each candidates as candidate (candidate.app + candidate.id)}<button onclick={() => { if (pickerFor?.recordId === '$new' || pickerFor?.recordId === '') addExternal(candidate); else if (pickerFor) { const record = collection?.records.find((entry) => entry.id === pickerFor?.recordId); const field = collection?.fields.find((entry) => entry.id === pickerFor?.fieldId); if (record && field && collection) { mutateCell(record.id, field, { app: candidate.app, kind: candidate.kind, id: candidate.id }); pickerFor = null; } } }}><strong>{candidate.text}</strong><small>{candidate.hint ?? candidate.app}</small></button>{:else}<p>No matches. Refresh the HomeSuite window if a new source was just created.</p>{/each}</div></div></div>{/if}
	</main>
{/if}
