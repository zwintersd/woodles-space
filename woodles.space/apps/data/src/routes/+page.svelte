<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { appById, entityHref, primaryDestination } from '@woodles/app-manifest';
	import { subscribePeople } from '@woodles/mycelium';
	import { isHomeSuiteShellMessage, postHomeSuiteFlushed, postHomeSuiteNavigate, postHomeSuitePaletteRequest, postHomeSuiteRenameRequest, postHomeSuiteState, type HomeSuiteSurfaceState, type WoodlesRef } from '@shared/homesuiteBridge';
	import { createHomeSuiteContext, type ContextAction } from '@shared/homesuiteContext';
	import { boardLibrary } from '../../../whiteboard/src/lib/library';
	import FieldDialog from '$lib/FieldDialog.svelte';
	import FindBar from '$lib/FindBar.svelte';
	import ReferenceDialog from '$lib/ReferenceDialog.svelte';
	import TableToolbar from '$lib/TableToolbar.svelte';
	import ScrollFrame from '$lib/ScrollFrame.svelte';
	import { HOMESUITE_TRASH_KEY, isHomeSuiteTrashed } from '@shared/homesuiteTrash';
	import { candidatesFor, refreshReferenceSources, shelfSource, type ReferenceCandidate } from '../../../write/src/lib/references.svelte';
	import { mergePulledRows, pullCollectionSources, readStackRows } from '$lib/sourceSync';
	import { findMatches, isSearchableField, replaceMatches, type FindMatch } from '$lib/findReplace';
	import { clearCells, parseClipboard, pasteGrid, serializeGrid } from '$lib/paste';
	import {
		addField, addRecord, cloneJson, deleteField, duplicateField, duplicateRecord, exportCollections, importCollections,
		isCollection, loadCollections, mirrorStack, removeRecord, renameField, resizeColumn, saveCollection, setCellValue, setFrozen, setHidden, showAllHidden,
		type Collection, type CollectionField, type FieldType, type FieldValue
	} from '$lib/collections';
	import '@shared/homesuiteTheme.css';
	import './data.css';

	let collection = $state<Collection | null>(null);
	let ready = $state(false);
	let saveIssue = $state('');
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;
	let selectedField = $state('');
	let selectedRecord = $state('');
	let selectedCell = $state<{ recordId: string; fieldId: string } | null>(null);
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
	let syncBusy = $state(false);
	let pickerLoading = $state(false);
	let sourceStatus = $state('');
	let trashRevision = $state(0);
	let findOpen = $state(false);
	let findQuery = $state('');
	let findReplacement = $state('');
	let findMatchCase = $state(false);
	let findWholeCell = $state(false);
	let findScopeField = $state('');
	let findIndex = $state(0);
	const context = createHomeSuiteContext();
	const ROW_HEAD_WIDTH = 42;

	function suiteCandidates(): ReferenceCandidate[] {
		return [
			...boardLibrary.list().map((board) => ({ app: 'whiteboard', kind: 'board', id: board.id, text: board.title.trim() || 'Untitled board', hint: 'Whiteboard' })),
			...loadCollections().collections.map((entry) => ({ app: 'data', kind: 'collection', id: entry.id, text: entry.title, hint: 'Data' }))
		];
	}

	/** Owner-backed candidates always come from their current stores. */
	function refreshCandidates(snapshots: ReferenceCandidate[]): void {
		refs = [
			...candidatesFor('#', ''),
			...snapshots.filter((entry) => entry.app !== 'mycelium' && entry.app !== 'thinking-about' && entry.app !== 'write')
		];
	}

	function openDataContext(point: { x: number; y: number }, recordId = selectedRecord, fieldId = selectedField || selectedCell?.fieldId || ''): void {
		if (!homeSuite || !collection) return;
		const ownerId = collection.id;
		const record = collection.records.find((entry) => entry.id === recordId);
		const field = collection.fields.find((entry) => entry.id === fieldId);
		if (record) selectCell(record.id, field?.id ?? '');
		else if (field) selectField(field.id);
		const run = (id: string) => {
			if (collection?.id !== ownerId) return;
			if (record && !collection.records.some((entry) => entry.id === record.id)) return;
			if (field && !collection.fields.some((entry) => entry.id === field.id)) return;
			if (record) selectCell(record.id, field?.id ?? ''); else if (field) selectField(field.id);
			command(id);
		};
		const actions: ContextAction[] = [];
		let ref = record?.sourceRef;
		let detail = record ? (record.sourceRef ? 'Reference in this collection · local notes stay here' : 'Record in this collection · undoable edits') : field ? `${field.primary ? 'Primary · ' : ''}${field.sourceKey ? 'Synced · ' : ''}${field.type} field` : 'Collection';
		if (record) {
			if (field?.type === 'relation' && !field.sourceKey) {
				const value = record.values[field.id];
				if (isRef(value)) ref = value;
				actions.push({ id: 'relation:choose', label: isRef(value) ? 'Change reference…' : 'Choose reference…', group: 'edit', run: () => {
					if (collection?.id === ownerId && collection.records.some((entry) => entry.id === record.id)) openRelationPicker(record.id, field.id);
				} });
				if (isRef(value)) {
					detail = `Reference in ${field.name} · ${primaryLabel(record)}`;
					actions.push({ id: 'relation:remove', label: 'Remove reference', group: 'danger', run: () => run('relation:remove') });
				}
			}
			actions.push(...viewActions(record, field));
			if (!record.sourceRef) actions.push({ id: 'record:duplicate', label: 'Duplicate record', group: 'edit', run: () => run('record:duplicate') });
			actions.push({ id: 'record:delete', label: record.sourceRef ? 'Remove from collection' : 'Delete record', detail: record.sourceRef ? 'Keeps the source item' : 'Undo to restore', group: 'danger', run: () => run('record:delete') });
		} else if (field) {
			actions.push({ id: 'field:new', label: 'Add field…', group: 'edit', run: () => run('field:new') });
			actions.push(...viewActions(undefined, field));
			actions.push({ id: 'field:duplicate', label: 'Duplicate field', detail: field.sourceKey ? 'Copies the values as a local field' : 'Copies every value · undoable', group: 'edit', run: () => run('field:duplicate') });
			actions.push({ id: 'field:delete', label: 'Delete field', enabled: !field.primary, detail: field.primary ? 'The Primary field is required' : 'Removes this column and its values · undoable', group: 'danger', run: () => run('field:delete') });
		} else {
			for (const [id, label] of [['record:new', 'New record'], ['field:new', 'New field…'], ['reference:add', 'Add Woodles reference…'], ['collection:export', 'Export collection']]) actions.push({ id, label, group: 'edit', run: () => run(id) });
			actions.push(...viewActions());
		}
		context.open(point, { label: record ? primaryLabel(record) : field?.name ?? collection.title, detail, ref }, actions);

		/** Freeze and hide verbs for whatever was right-clicked, plus the way back from each. */
		function viewActions(record?: Collection['records'][number], field?: CollectionField): ContextAction[] {
			if (!collection) return [];
			const table = collection.views.table;
			const view: ContextAction[] = [];
			const add = (id: string, label: string, detail?: string, enabled = true) => view.push({ id, label, detail, enabled, group: 'view', run: () => run(id) });
			if (record) {
				const through = collection.records.findIndex((entry) => entry.id === record.id) + 1;
				if ((table.frozenRows ?? 0) !== through) add('view:freeze-rows', 'Freeze up to this row', through === 1 ? 'Keeps it under the header' : `Keeps rows 1–${through} under the header`);
			}
			if (field) {
				const through = table.columnOrder.indexOf(field.id) + 1;
				if ((table.frozenColumns ?? 0) !== through) add('view:freeze-columns', 'Freeze up to this field', through === 1 ? 'Keeps it in view while scrolling' : `Keeps the first ${through} fields in view`);
			}
			if (table.frozenRows) add('view:unfreeze-rows', 'Unfreeze rows');
			if (table.frozenColumns) add('view:unfreeze-columns', 'Unfreeze fields');
			if (record) add('view:hide-record', 'Hide record', 'Show it again from the toolbar or this menu');
			if (field) add('view:hide-field', 'Hide field', field.primary ? 'The Primary field stays visible' : 'Values are kept', !field.primary);
			if (hiddenRecordCount) add('view:show-records', `Show hidden records (${hiddenRecordCount})`);
			if (hiddenFieldCount) add('view:show-fields', `Show hidden fields (${hiddenFieldCount})`);
			return view;
		}
	}

	function dataContextEvent(event: MouseEvent): void {
		if (!homeSuite || !(event.target instanceof Element) || !event.target.closest('.data-table')) return;
		if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
		const row = event.target.closest<HTMLElement>('[data-record]');
		const cell = event.target.closest<HTMLElement>('[data-cell]');
		const head = event.target.closest<HTMLElement>('[data-field]');
		event.preventDefault();
		openDataContext({ x: event.clientX, y: event.clientY }, row?.dataset.record ?? '', head?.dataset.field ?? cell?.dataset.cell?.split(':')[1] ?? '');
	}

	function recordContext(event: MouseEvent, recordId: string): void {
		if (!homeSuite) { selectRecord(recordId); return; }
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		openDataContext({ x: rect.left, y: rect.bottom }, recordId, '');
	}

	const collectionId = $derived(page.url.searchParams.get('collection'));
	const homeSuite = $derived(page.url.searchParams.has('homesuite'));
	const orderedFields = $derived.by(() => {
		if (!collection) return [];
		return collection.views.table.columnOrder.map((id) => collection!.fields.find((entry) => entry.id === id)).filter((entry): entry is CollectionField => !!entry);
	});
	const hiddenFieldIds = $derived(new Set(collection?.views.table.hiddenFields ?? []));
	const hiddenRecordIds = $derived(new Set(collection?.views.table.hiddenRecords ?? []));
	const visibleFields = $derived(orderedFields.filter((field) => field.primary || !hiddenFieldIds.has(field.id)));
	const hiddenFieldCount = $derived(orderedFields.length - visibleFields.length);
	/** Each visible record with its place in the whole Collection, which its row number shows. */
	const visibleRecords = $derived(collection?.records.map((record, index) => ({ record, number: index + 1 })).filter(({ record }) => !hiddenRecordIds.has(record.id)) ?? []);
	const hiddenRecordCount = $derived((collection?.records.length ?? 0) - visibleRecords.length);
	const frozenRecords = $derived(visibleRecords.filter(({ number }) => number <= (collection?.views.table.frozenRows ?? 0)));
	const scrollingRecords = $derived(visibleRecords.slice(frozenRecords.length));
	/** Sticky `left` for each frozen field, after the row numbers and the frozen fields before it. */
	const frozenOffsets = $derived.by(() => {
		const offsets = new Map<string, number>();
		if (!collection) return offsets;
		const frozen = new Set(collection.views.table.columnOrder.slice(0, collection.views.table.frozenColumns ?? 0));
		let left = ROW_HEAD_WIDTH;
		for (const field of visibleFields) {
			if (!frozen.has(field.id)) break;
			offsets.set(field.id, left);
			left += collection.views.table.columnWidths[field.id] ?? 160;
		}
		return offsets;
	});
	const lastFrozenField = $derived([...frozenOffsets.keys()].at(-1) ?? '');
	/** Find and replace works on what is showing, so hidden records and fields are never changed. */
	const findScope = $derived({ recordIds: visibleRecords.map(({ record }) => record.id), fieldIds: findScopeField ? [findScopeField] : visibleFields.map((entry) => entry.id) });
	const findFields = $derived(visibleFields.filter(isSearchableField));
	const findOptions = $derived({ matchCase: findMatchCase, wholeCell: findWholeCell });
	const findList = $derived(collection && findOpen ? findMatches(collection, findQuery, findOptions, findScope) : []);
	const findCurrent = $derived(findList.length ? findList[Math.min(findIndex, findList.length - 1)] : null);
	const findHits = $derived(new Set(findList.map((match) => `${match.recordId}:${match.fieldId}`)));
	const activeField = $derived(collection?.fields.find((entry) => entry.id === selectedField) ?? null);
	const activeRecord = $derived(collection?.records.find((entry) => entry.id === selectedRecord) ?? null);
	const candidates = $derived.by(() => {
		const query = pickerQuery.trim().toLowerCase();
		const synced = refs.filter((entry) => (entry.app === 'bestiary' || entry.app === 'marginalia') && (!query || `${entry.text} ${entry.hint ?? ''}`.toLowerCase().includes(query)));
		const suite = suiteCandidates().filter((entry) => !isHomeSuiteTrashed(entry) && (!query || `${entry.text} ${entry.hint}`.toLowerCase().includes(query)));
		return [...candidatesFor('#', pickerQuery), ...suite, ...synced].slice(0, 8);
	});

	function updateLibrary(next: Collection, recordHistory = true): void {
		if (!collection) return;
		if (recordHistory && !isCollection(next)) return;
		if (recordHistory) {
			undoStack = [...undoStack.slice(-49), cloneJson(collection)];
			redoStack = [];
		}
		collection = next;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTimer = null;
			persist();
			publishState();
		}, 120);
		publishState();
	}

	/** Writes only this Collection; the rest of the library is re-read, never replaced. */
	function persist(): void {
		if (!collection) return;
		const result = saveCollection(collection);
		saveIssue = result.ok ? '' : result.issue?.message ?? 'Could not save this Collection.';
	}

	function replaceCollection(next: Collection): void {
		collection = next;
		persist();
		publishState();
	}

	function flushPendingSave(): void {
		if (!saveTimer) return;
		clearTimeout(saveTimer);
		saveTimer = null;
		persist();
	}

	/** A run of keystrokes into one place is one undo step, not one per key. */
	function recordBurst(key: string): void {
		if (lastTextKey !== key || !textBurstTimer) {
			if (collection) undoStack = [...undoStack.slice(-49), cloneJson(collection)];
			redoStack = [];
		}
		lastTextKey = key;
		if (textBurstTimer) clearTimeout(textBurstTimer);
		textBurstTimer = setTimeout(() => { textBurstTimer = null; lastTextKey = ''; }, 700);
	}

	function setText(recordId: string, fieldId: string, value: string): void {
		recordBurst(`${recordId}:${fieldId}`);
		if (collection) updateLibrary(setCellValue(collection, recordId, fieldId, value), false);
	}

	function setNumber(recordId: string, field: CollectionField, value: number | null): void {
		if (!collection) return;
		selectedCell = { recordId, fieldId: field.id };
		selectedRecord = recordId;
		recordBurst(`${recordId}:${field.id}`);
		updateLibrary(setCellValue(collection, recordId, field.id, value), false);
	}

	function mutateCell(recordId: string, field: CollectionField, value: FieldValue): void {
		if (!collection) return;
		selectedCell = { recordId, fieldId: field.id };
		selectedRecord = recordId;
		updateLibrary(setCellValue(collection, recordId, field.id, value));
	}

	function removeRelation(recordId: string, field: CollectionField): void {
		if (!collection) return;
		updateLibrary(setCellValue(collection, recordId, field.id, null));
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
			const candidate = sourceCandidate(record.sourceRef);
			return candidate?.text ?? 'Unavailable source';
		}
		const primary = collection.fields.find((entry) => entry.primary);
		const value = primary ? record.values[primary.id] : null;
		return typeof value === 'string' && value.trim() ? value : 'Untitled record';
	}

	function sourceCandidate(ref: WoodlesRef): ReferenceCandidate | null {
		if (ref.app === 'whiteboard' || ref.app === 'data') return suiteCandidates().find((entry) => entry.app === ref.app && entry.kind === ref.kind && entry.id === ref.id) ?? null;
		return refs.find((entry) => entry.app === ref.app && entry.kind === ref.kind && entry.id === ref.id) ?? null;
	}

	function referenceLabel(ref: WoodlesRef): string {
		void trashRevision;
		const label = sourceCandidate(ref)?.text ?? 'Unavailable reference';
		return isHomeSuiteTrashed(ref) ? `${label} · in Trash` : label;
	}

	function openSource(ref: WoodlesRef): void {
		// Inside HomeSuite the shell opens it, in place when it is one of its own.
		if (ref.kind !== 'app' && homeSuite && postHomeSuiteNavigate(ref)) return;
		try {
			const href = ref.kind === 'app'
				? primaryDestination(appById[ref.app])
				: entityHref(ref.app, ref.kind, ref.id);
			window.open(href, '_blank', 'noopener');
		} catch { /* A cold reference remains visible. */ }
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

	function createField(name: string, type: FieldType): void {
		if (!collection) return;
		updateLibrary(addField(collection, name, type));
		addFieldOpen = false;
	}

	// ── table interaction, named so the markup below stays readable ──

	function selectField(fieldId: string): void {
		selectedField = fieldId;
		selectedRecord = '';
		selectedCell = null;
		publishState();
	}

	function selectRecord(recordId: string): void {
		selectedRecord = recordId;
		selectedField = '';
		selectedCell = null;
		publishState();
	}

	function selectCell(recordId: string, fieldId: string): void {
		selectedRecord = recordId;
		selectedField = '';
		selectedCell = { recordId, fieldId };
		publishState();
	}

	function dropField(targetId: string): void {
		if (!collection || !dragField || dragField === targetId) return;
		const ids = orderedFields.map((item) => item.id);
		ids.splice(ids.indexOf(dragField), 1);
		ids.splice(ids.indexOf(targetId), 0, dragField);
		updateLibrary({ ...collection, views: { table: { ...collection.views.table, columnOrder: ids } } });
		dragField = '';
	}

	function openFind(): void {
		if (!collection) return;
		// A column selected by its header becomes the scope; clicking elsewhere keeps the last one.
		if (!findOpen && selectedField && findFields.some((entry) => entry.id === selectedField)) findScopeField = selectedField;
		if (findScopeField && !findFields.some((entry) => entry.id === findScopeField)) findScopeField = '';
		findOpen = true;
		requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-find-input]')?.select());
	}

	function closeFind(): void {
		findOpen = false;
	}

	/** Moves to a match: selects its cell and brings it into view, leaving focus in the find bar. */
	function revealMatch(match: FindMatch | null | undefined): void {
		if (!match) return;
		selectCell(match.recordId, match.fieldId);
		requestAnimationFrame(() => document.querySelector(`[data-cell="${match.recordId}:${match.fieldId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
	}

	function findChanged(): void {
		findIndex = 0;
		revealMatch(findList[0]);
	}

	function findStep(direction: 1 | -1): void {
		if (!findList.length) return;
		findIndex = (Math.min(findIndex, findList.length - 1) + direction + findList.length) % findList.length;
		revealMatch(findList[findIndex]);
	}

	/** Replaces the current cell's matches, then moves to the next cell after it. */
	function findReplaceCurrent(): void {
		const current = findCurrent;
		if (!collection || !current) return;
		const result = replaceMatches(collection, findQuery, findReplacement, findOptions, findScope, { recordId: current.recordId, fieldId: current.fieldId });
		if (result.collection === collection) { findStep(1); return; }
		updateLibrary(result.collection);
		const rest = findMatches(result.collection, findQuery, findOptions, findScope);
		const next = rest.findIndex((match) => match.row > current.row || (match.row === current.row && match.col > current.col));
		findIndex = next === -1 ? 0 : next;
		revealMatch(rest[findIndex]);
	}

	function findReplaceAll(): void {
		if (!collection || !findList.length) return;
		const result = replaceMatches(collection, findQuery, findReplacement, findOptions, findScope);
		if (result.collection === collection) { say('Nothing to replace — the replacement is already what is there.'); return; }
		updateLibrary(result.collection);
		findIndex = 0;
		say(`Replaced ${result.occurrences} ${result.occurrences === 1 ? 'match' : 'matches'} in ${result.cells} ${result.cells === 1 ? 'cell' : 'cells'}. Undo restores it.`);
	}

	function openRelationPicker(recordId: string, fieldId: string): void {
		pickerFor = { recordId, fieldId };
		pickerQuery = '';
		selectCell(recordId, fieldId);
	}

	/** A pick either adds a referenced record or sets the Relation it was opened from. */
	function pickCandidate(candidate: ReferenceCandidate): void {
		if (!pickerFor || !collection) return;
		if (pickerFor.recordId === '$new' || pickerFor.recordId === '') { addExternal(candidate); return; }
		const { recordId, fieldId } = pickerFor;
		const field = collection.fields.find((entry) => entry.id === fieldId);
		if (!field || !collection.records.some((entry) => entry.id === recordId)) return;
		mutateCell(recordId, field, { app: candidate.app, kind: candidate.kind, id: candidate.id });
		pickerFor = null;
	}

	function relationSelected(): boolean {
		if (!collection || !selectedCell) return false;
		const field = collection.fields.find((entry) => entry.id === selectedCell?.fieldId);
		return field?.type === 'relation' && isRef(activeRecord?.values[field.id] ?? null);
	}

	function fieldGlyph(field: CollectionField): string {
		if (field.primary) return '◆';
		return field.type === 'checkbox' ? '□' : field.type === 'relation' ? '↗' : field.type === 'date' ? '◷' : '·';
	}

	function cellLabel(field: CollectionField, record: Collection['records'][number]): string {
		return `${field.name}, ${primaryLabel(record)}`;
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
		else if (id === 'relation:remove' && collection && selectedCell) { const field = collection.fields.find((entry) => entry.id === selectedCell?.fieldId); if (field?.type === 'relation') removeRelation(selectedCell.recordId, field); }
		else if (id === 'record:duplicate' && collection && selectedRecord) {
			const at = collection.records.findIndex((entry) => entry.id === selectedRecord);
			const next = duplicateRecord(collection, selectedRecord);
			updateLibrary(next);
			if (at !== -1 && next.records.length > collection.records.length) selectRecord(next.records[at + 1].id);
		}
		else if (id === 'field:duplicate' && collection && activeField) {
			const next = duplicateField(collection, activeField.id);
			updateLibrary(next);
			selectField(next.fields.at(-1)?.id ?? activeField.id);
		}
		else if (id === 'field:delete') deleteSelectedField();
		else if (id === 'collection:rename' && collection) {
			// In HomeSuite the name is edited where it is shown, in the shell's title.
			if (homeSuite && postHomeSuiteRenameRequest()) return;
			const title = window.prompt('Collection name', collection.title);
			if (title?.trim()) renameCollection(title);
		}
		else if (id === 'source:open' && activeRecord?.sourceRef) openSource(activeRecord.sourceRef);
		else if (id === 'find:open') openFind();
		else if (id === 'collection:export' && collection) exportCollection(collection);
		else if (id === 'reference:add') { pickerFor = { recordId: '', fieldId: '' }; pickerQuery = ''; void refreshPickerSources(); }
		else if (id === 'source:sync') void syncSources();
		else if (id.startsWith('view:')) viewCommand(id);
	}

	function viewCommand(id: string): void {
		if (!collection) return;
		const fieldId = selectedField || selectedCell?.fieldId || '';
		const recordIndex = collection.records.findIndex((entry) => entry.id === selectedRecord);
		const fieldIndex = collection.views.table.columnOrder.indexOf(fieldId);
		let next = collection;
		if (id === 'view:freeze-rows' && recordIndex !== -1) next = setFrozen(collection, 'rows', recordIndex + 1);
		else if (id === 'view:freeze-columns' && fieldIndex !== -1) next = setFrozen(collection, 'columns', fieldIndex + 1);
		else if (id === 'view:unfreeze-rows') next = setFrozen(collection, 'rows', 0);
		else if (id === 'view:unfreeze-columns') next = setFrozen(collection, 'columns', 0);
		else if (id === 'view:hide-record' && selectedRecord) next = setHidden(collection, 'rows', selectedRecord, true);
		else if (id === 'view:hide-field' && fieldId) next = setHidden(collection, 'columns', fieldId, true);
		else if (id === 'view:show-records') next = showAllHidden(collection, 'rows');
		else if (id === 'view:show-fields') next = showAllHidden(collection, 'columns');
		if (next === collection) return;
		if (id === 'view:hide-record') { selectedRecord = ''; selectedCell = null; }
		if (id === 'view:hide-field') { selectedField = ''; selectedCell = null; }
		updateLibrary(next);
	}

	function exportCollection(target: Collection): void {
		const blob = new Blob([exportCollections([target])], { type: 'application/json' });
		const anchor = document.createElement('a');
		anchor.href = URL.createObjectURL(blob);
		anchor.download = `${target.title || 'collection'}.json`;
		anchor.click();
		URL.revokeObjectURL(anchor.href);
	}

	function renameCollection(title: string): void {
		if (!collection || !title.trim() || title.trim() === collection.title) return;
		updateLibrary({ ...collection, title: title.trim(), updatedAt: new Date().toISOString() });
	}

	async function syncSources(): Promise<void> {
		if (!collection?.sources?.length || syncBusy) return;
		syncBusy = true;
		try {
			const link = collection.stackLink;
			const stackRowsNow = link ? readStackRows(link) : null;
			if (link && !stackRowsNow) {
				// The board or Stack cannot be read. Keep the rows as they are
				// rather than reading a missing Stack as an empty one.
				sourceStatus = 'Stack not found on this device';
				return;
			}
			const rows = link ? [] : await pullCollectionSources(collection.sources);
			if (!collection) return;
			const next = stackRowsNow ? mirrorStack(collection, stackRowsNow) : mergePulledRows(collection, rows);
			// An unchanged pull saves nothing, so a Collection that is only being
			// looked at keeps its place in HomeSuite's recent order.
			if (next !== collection) {
				const saved = saveCollection(next);
				if (!saved.ok) {
					saveIssue = saved.issue?.message ?? 'Could not refresh source data.';
					sourceStatus = 'Refresh failed';
					return;
				}
				collection = next;
				saveIssue = '';
			}
			const pulledRefs = rows.map((row) => ({ app: row.ref.app, kind: row.ref.kind, id: row.ref.id, text: row.label, hint: row.hint }));
			if (!link) refreshCandidates(pulledRefs);
			sourceStatus = stackRowsNow ? `Following a Stack · ${stackRowsNow.length} ${stackRowsNow.length === 1 ? 'note' : 'notes'}` : rows.length ? `Refreshed ${rows.length} source records` : 'No source records found on this device';
			publishState();
		} catch {
			sourceStatus = 'Refresh failed';
		} finally {
			syncBusy = false;
		}
	}

	async function refreshPickerSources(): Promise<void> {
		pickerLoading = true;
		try {
			const rows = await pullCollectionSources([
				'woodles-apps',
				'bestiary-creatures', 'marginalia-life', 'marginalia-field-notes',
				'marginalia-arcade-games', 'marginalia-arcade-primitives', 'marginalia-arcade-copy'
			]);
			const synced = rows.map((row) => ({ app: row.ref.app, kind: row.ref.kind, id: row.ref.id, text: row.label, hint: row.hint }));
			refreshCandidates(synced);
		} finally {
			pickerLoading = false;
		}
	}

	async function importFile(file: File | undefined): Promise<void> {
		if (!file) return;
		const result = importCollections(await file.text());
		if (!result.collections.length) { saveIssue = result.issue?.message ?? 'This file contains no readable Collections.'; return; }
		const source = cloneJson(result.collections[0]);
		const fieldIds = new Map(source.fields.map((field) => [field.id, `${field.primary ? 'field-primary' : 'field'}-${crypto.randomUUID()}`]));
		source.id = `collection-${crypto.randomUUID()}`;
		source.fields = source.fields.map((field) => ({ ...field, id: fieldIds.get(field.id)!, config: field.config ? cloneJson(field.config) : undefined }));
		const recordIds = new Map(source.records.map((record) => [record.id, `record-${crypto.randomUUID()}`]));
		source.records = source.records.map((record) => ({ ...record, id: recordIds.get(record.id)!, values: Object.fromEntries(Object.entries(record.values).map(([id, value]) => [fieldIds.get(id) ?? id, value])) }));
		source.views.table.columnOrder = source.views.table.columnOrder.map((id) => fieldIds.get(id) ?? id);
		source.views.table.columnWidths = Object.fromEntries(Object.entries(source.views.table.columnWidths).map(([id, width]) => [fieldIds.get(id) ?? id, width]));
		if (source.views.table.hiddenFields) source.views.table.hiddenFields = source.views.table.hiddenFields.map((id) => fieldIds.get(id) ?? id);
		if (source.views.table.hiddenRecords) source.views.table.hiddenRecords = source.views.table.hiddenRecords.map((id) => recordIds.get(id) ?? id);
		const saved = saveCollection(source);
		if (!saved.ok) { saveIssue = saved.issue?.message ?? 'Could not import this Collection.'; return; }
		saveIssue = `Imported “${source.title}”. It is now in the HomeSuite index.`;
		publishState();
	}

	/**
	 * Spreadsheet cells pasted onto the table fill across rows and columns from
	 * the selected cell. One cell pasted into a text box is left to the browser.
	 */
	function onPaste(event: ClipboardEvent): void {
		const data = event.clipboardData;
		if (!collection || !data || event.defaultPrevented) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('[role="dialog"]')) return;
		const editing = target?.closest('input, textarea, select, [contenteditable="true"]') ?? null;
		if (editing && !editing.closest('.data-table')) return;
		const grid = parseClipboard(data.getData('text/html'), data.getData('text/plain'));
		if (!grid) return;
		const single = grid.length === 1 && grid[0].length === 1;
		const cellField = collection.fields.find((entry) => entry.id === selectedCell?.fieldId);
		if (editing && single && (cellField?.type === 'text' || cellField?.type === 'url') && !grid[0][0].href) return;

		const recordIds = visibleRecords.map(({ record }) => record.id);
		const fieldIds = visibleFields.map((entry) => entry.id);
		let row = 0, col = 0;
		if (selectedCell) { row = recordIds.indexOf(selectedCell.recordId); col = fieldIds.indexOf(selectedCell.fieldId); }
		else if (selectedRecord) { row = recordIds.indexOf(selectedRecord); }
		else if (selectedField) { col = fieldIds.indexOf(selectedField); }
		// With nothing selected, a paste only lands in a Collection that is still empty.
		else if (collection.records.length) return;
		if (row === -1 || col === -1) return;

		event.preventDefault();
		const result = pasteGrid(collection, grid, { recordIds, fieldIds, row, col });
		if (result.collection === collection) return;
		updateLibrary(result.collection);
		const size = `${result.rows} ${result.rows === 1 ? 'row' : 'rows'} × ${result.columns} ${result.columns === 1 ? 'column' : 'columns'}`;
		const added = [result.newRecords && `${result.newRecords} new ${result.newRecords === 1 ? 'record' : 'records'}`, result.newFields && `${result.newFields} new ${result.newFields === 1 ? 'field' : 'fields'}`].filter(Boolean).join(', ');
		const kept = result.skipped ? ` ${result.skipped} ${result.skipped === 1 ? 'cell' : 'cells'} did not fit their field and kept what they had.` : '';
		say(`Pasted ${size}${added ? ` · ${added}` : ''}. Undo restores it.${kept}`);
	}

	/**
	 * Ctrl/⌘ C and X on a selected column or row. Cells and text boxes keep the
	 * browser's own copy. Cut clears the values rather than removing anything.
	 */
	function onCopyEvent(event: ClipboardEvent): void { onCopy(event); }

	function onCopy(event: ClipboardEvent, cut = false): void {
		if (!collection || !event.clipboardData || event.defaultPrevented) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('[role="dialog"], input, textarea, select, [contenteditable="true"]')) return;
		if (window.getSelection()?.toString()) return;
		const rows = selectedField ? visibleRecords.map(({ record }) => record) : selectedRecord && !selectedCell ? visibleRecords.map(({ record }) => record).filter((record) => record.id === selectedRecord) : [];
		const fields = selectedField ? visibleFields.filter((entry) => entry.id === selectedField) : selectedRecord && !selectedCell ? visibleFields : [];
		if (!rows.length || !fields.length) return;
		const { text, html } = serializeGrid(rows, fields, (record, field) => {
			const value = record.values[field.id];
			if (field.type === 'relation' && isRef(value ?? null)) return referenceLabel(value as WoodlesRef);
			return record.sourceRef && field.primary ? primaryLabel(record) : undefined;
		});
		event.clipboardData.setData('text/plain', text);
		event.clipboardData.setData('text/html', html);
		event.preventDefault();
		const what = selectedField ? `“${fields[0].name}”` : 'the row';
		if (!cut) { say(`Copied ${what}.`); return; }
		const result = clearCells(collection, rows.map((record) => record.id), fields.map((entry) => entry.id));
		if (!result.cleared) { say(`Copied ${what}. Synced values cannot be cleared, so nothing was cut.`); return; }
		updateLibrary(result.collection);
		say(`Cut ${what}: its values are cleared. Undo restores them.`);
	}

	/** A short note that the save status, which the next autosave clears, cannot carry. */
	function say(message: string): void {
		notice = message;
		if (noticeTimer) clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => { notice = ''; noticeTimer = null; }, 8000);
	}

	function inspectorChange(controlId: string, value: string): void {
		if (!collection || !activeField) return;
		recordBurst(`inspector:${activeField.id}:${controlId}`);
		if (controlId === 'field:name') updateLibrary(renameField(collection, activeField.id, value), false);
		else if (controlId.startsWith('option:')) {
			const optionId = controlId.slice('option:'.length);
			const fields = collection.fields.map((entry) => entry.id === activeField.id ? { ...entry, config: { ...entry.config, options: (entry.config?.options ?? []).map((item) => item.id === optionId ? { ...item, label: value } : item) } } : entry);
			updateLibrary({ ...collection, fields }, false);
		}
		publishState();
	}

	function selectedFieldForView(): CollectionField | null {
		const fieldId = selectedField || selectedCell?.fieldId;
		return collection?.fields.find((entry) => entry.id === fieldId) ?? null;
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
				? [
					{ label: 'Identity', value: activeRecord.sourceRef ? `${activeRecord.sourceRef.app} · ${activeRecord.sourceRef.kind}` : 'Native record' },
					{ label: 'Created', value: new Date(activeRecord.createdAt).toLocaleDateString() },
					...(activeRecord.sourceRef ? [{ label: 'Source', value: sourceCandidate(activeRecord.sourceRef)?.text ?? 'Unavailable' }] : [])
				]
				: [
					{ label: 'Records', value: hiddenRecordCount ? `${collection.records.length} · ${hiddenRecordCount} hidden` : String(collection.records.length) },
					{ label: 'Fields', value: hiddenFieldCount ? `${collection.fields.length} · ${hiddenFieldCount} hidden` : String(collection.fields.length) },
					{ label: 'Created', value: new Date(collection.createdAt).toLocaleDateString() }
				];
		const controls = activeField
			? [
				{ id: 'field:name', label: 'Field name', value: activeField.name },
				{ id: 'field:type', label: 'Type', value: activeField.primary ? 'Primary · Text' : activeField.type, readonly: true },
				...(activeField.config?.options ?? []).map((option, index) => ({ id: `option:${option.id}`, label: `Option ${index + 1}`, value: option.label }))
			]
			: undefined;
		const actions = activeField && !activeField.primary
			? [{ commandId: 'view:hide-field', label: 'Hide field' }, { commandId: 'field:delete', label: 'Delete field' }]
			: activeRecord?.sourceRef
				? [{ commandId: 'source:open', label: 'Open source' }, { commandId: 'record:delete', label: 'Remove from collection' }]
				: activeRecord ? [{ commandId: 'record:delete', label: 'Delete record' }] : [];
		const commands: HomeSuiteSurfaceState['commands'] = [
			{ id: 'record:new', label: 'New record', shortcut: '⌘ ↵' }, { id: 'field:new', label: 'New field' },
			...(collection.sources?.length ? [{ id: 'source:sync', label: 'Refresh connected sources', context: 'artifact' as const, group: 'connect' as const }] : []),
			{ id: 'collection:rename', label: 'Rename collection' }, { id: 'collection:export', label: 'Export collection', context: 'artifact', group: 'connect' },
			{ id: 'find:open', label: 'Find and replace', shortcut: '⌘ H' },
		{ id: 'record:duplicate', label: 'Duplicate record', enabled: !!selectedRecord },
			{ id: 'record:delete', label: activeRecord?.sourceRef ? 'Remove from collection' : 'Delete record', enabled: !!selectedRecord },
			{ id: 'relation:remove', label: 'Remove reference', enabled: relationSelected() },
			{ id: 'field:duplicate', label: 'Duplicate field', enabled: !!activeField },
			{ id: 'field:delete', label: 'Delete field', enabled: !!activeField && !activeField.primary },
			{ id: 'source:open', label: 'Open source', enabled: !!activeRecord?.sourceRef },
			{ id: 'reference:add', label: 'Add Woodles reference' },
			{ id: 'view:freeze-rows', label: 'Freeze up to this row', enabled: !!activeRecord, group: 'view' },
			{ id: 'view:freeze-columns', label: 'Freeze up to this field', enabled: !!(activeField ?? selectedCell), group: 'view' },
			{ id: 'view:unfreeze-rows', label: 'Unfreeze rows', enabled: !!collection.views.table.frozenRows, group: 'view' },
			{ id: 'view:unfreeze-columns', label: 'Unfreeze fields', enabled: !!collection.views.table.frozenColumns, group: 'view' },
			{ id: 'view:hide-record', label: 'Hide record', enabled: !!activeRecord, group: 'view' },
			{ id: 'view:hide-field', label: 'Hide field', enabled: !!selectedFieldForView() && !selectedFieldForView()?.primary, group: 'view' },
			{ id: 'view:show-records', label: `Show hidden records${hiddenRecordCount ? ` (${hiddenRecordCount})` : ''}`, enabled: hiddenRecordCount > 0, group: 'view' },
			{ id: 'view:show-fields', label: `Show hidden fields${hiddenFieldCount ? ` (${hiddenFieldCount})` : ''}`, enabled: hiddenFieldCount > 0, group: 'view' }
		];
		const state: HomeSuiteSurfaceState = {
			artifact: { id: collection.id, kind: 'collection', title: collection.title }, selection: selected,
			inspector: { title: activeField?.name ?? (activeRecord ? primaryLabel(activeRecord) : collection.title), rows, controls, actions },
			modes: [], activeMode: 'table', commands, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0
		};
		postHomeSuiteState(state);
	}

	function onShellMessage(event: MessageEvent): void {
		if (event.origin !== window.location.origin || event.source !== window.parent || !isHomeSuiteShellMessage(event.data)) return;
		const message = event.data;
		if (context.handle(message)) return;
		if (message.action === 'context-open') { openDataContext({ x: 16, y: 16 }); return; }
		if (message.action === 'add-reference' && collection) {
			const ref = message.ref;
			if (!collection.records.some((entry) => entry.sourceRef?.app === ref.app && entry.sourceRef.kind === ref.kind && entry.sourceRef.id === ref.id)) updateLibrary(addRecord(collection, ref));
			return;
		}
		if (message.action === 'flush') { flushPendingSave(); postHomeSuiteFlushed(); }
		else if (message.action === 'rename') renameCollection(message.title);
		else if (message.action === 'undo') undo();
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
		const rows = visibleRecords.map(({ record }) => record);
		if (event.key === 'ArrowDown') nextRow = Math.min(rows.length - 1, rowIndex + 1);
		else if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
		else if (event.key === 'ArrowRight' && (event.target as HTMLInputElement).selectionStart === (event.target as HTMLInputElement).value?.length) nextCol = Math.min(visibleFields.length - 1, colIndex + 1);
		else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) nextCol = Math.max(0, colIndex - 1);
		else if (event.key === 'Tab') { nextCol = colIndex + (event.shiftKey ? -1 : 1); if (nextCol < 0) { nextCol = visibleFields.length - 1; nextRow = Math.max(0, rowIndex - 1); } if (nextCol >= visibleFields.length) { nextCol = 0; nextRow++; if (nextRow >= rows.length) { addNewRecord(); return; } } }
		else if (event.key === 'Enter') { nextRow = Math.min(rows.length, rowIndex + 1); if (nextRow === rows.length) { addNewRecord(); return; } }
		else return;
		event.preventDefault();
		if (event.key === 'Tab' || event.key === 'Enter' || event.key.startsWith('Arrow')) {
			const record = rows[nextRow];
			const field = visibleFields[nextCol];
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
		const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); if (collection) { undoStack = [...undoStack.slice(-49), before]; redoStack = []; persist(); publishState(); } };
		window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
	}

	function fieldValue(record: Collection['records'][number], field: CollectionField): FieldValue { return record.values[field.id] ?? (field.type === 'checkbox' ? false : field.type === 'multi-select' ? [] : null); }
	function isRef(value: FieldValue): value is WoodlesRef { return !!value && typeof value === 'object' && !Array.isArray(value) && 'app' in value; }

	onMount(() => {
		const loaded = loadCollections();
		if (loaded.issue) saveIssue = loaded.issue.message;
		collection = loaded.collections.find((entry) => entry.id === collectionId) ?? null;
		ready = true;
		void refreshReferenceSources().then(() => {
			const synced = collection?.records.filter((record) => record.sourceRef).map((record) => ({ app: record.sourceRef!.app, kind: record.sourceRef!.kind, id: record.sourceRef!.id, text: primaryLabel(record), hint: record.sourceRef!.app })) ?? [];
			refreshCandidates(synced);
			publishState();
		});
		if (collection) { shelfSource.loadLocal(); refs = candidatesFor('#', ''); publishState(); }
		if (collection?.records.some((record) => record.sourceRef?.app === 'bestiary' || record.sourceRef?.app === 'marginalia')) void refreshPickerSources();
		window.addEventListener('message', onShellMessage);
		window.addEventListener('contextmenu', dataContextEvent);
		window.addEventListener('keydown', globalKeydown);
		window.addEventListener('paste', onPaste);
		const onCut = (event: ClipboardEvent) => onCopy(event, true);
		window.addEventListener('copy', onCopyEvent);
		window.addEventListener('cut', onCut);
		const onTrashChange = (event: StorageEvent) => { if (event.key === HOMESUITE_TRASH_KEY || event.key === null) trashRevision += 1; };
		window.addEventListener('storage', onTrashChange);
		const stopPeople = subscribePeople(() => {
			refreshCandidates(refs);
			if (collection?.sources?.includes('mycelium-people')) void syncSources();
		});
		// HomeSuite closes a Collection by removing its frame, which never runs the
		// cleanup below; `pagehide` still fires, so the pending save lands.
		const flushWhenHidden = () => { if (document.visibilityState === 'hidden') flushPendingSave(); };
		window.addEventListener('pagehide', flushPendingSave);
		document.addEventListener('visibilitychange', flushWhenHidden);
		const teardown = () => {
			stopPeople();
			window.removeEventListener('message', onShellMessage);
			window.removeEventListener('contextmenu', dataContextEvent);
			window.removeEventListener('keydown', globalKeydown);
			window.removeEventListener('paste', onPaste);
			window.removeEventListener('copy', onCopyEvent);
			window.removeEventListener('cut', onCut);
			window.removeEventListener('storage', onTrashChange);
			window.removeEventListener('pagehide', flushPendingSave);
			document.removeEventListener('visibilitychange', flushWhenHidden);
			flushPendingSave();
		};
		if (collection?.sources?.length) {
			void syncSources();
			const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void syncSources(); }, 60_000);
			const refreshOnFocus = () => { if (document.visibilityState === 'visible') void syncSources(); };
			window.addEventListener('focus', refreshOnFocus);
			window.addEventListener('visibilitychange', refreshOnFocus);
			return () => { window.removeEventListener('focus', refreshOnFocus); window.removeEventListener('visibilitychange', refreshOnFocus); window.clearInterval(interval); teardown(); };
		}
		return teardown;
	});

	function globalKeydown(event: KeyboardEvent): void {
		if (homeSuite && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
			if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
			event.preventDefault(); openDataContext({ x: 16, y: 16 }); return;
		}
		if (homeSuite && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); postHomeSuitePaletteRequest(); return; }
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'h' && collection && !(event.target instanceof Element && event.target.closest('[role="dialog"]'))) { event.preventDefault(); openFind(); return; }
		if (event.key === 'Escape') { pickerFor = null; addFieldOpen = false; findOpen = false; }
		// In a cell, undo is handled with the cell's own keys; this is for a header, row number, or the page.
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && collection && !(event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))) {
			event.preventDefault(); event.shiftKey ? redo() : undo(); return;
		}
		if (event.key === 'F2' && collection) { event.preventDefault(); addFieldOpen = true; }
		if ((event.key === 'Delete' || event.key === 'Backspace') && collection && selectedRecord) {
			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
			event.preventDefault();
			const selectedRelation = selectedCell && collection.fields.find((field) => field.id === selectedCell?.fieldId);
			if (selectedRelation?.type === 'relation' && isRef(activeRecord?.values[selectedRelation.id] ?? null)) command('relation:remove');
			else command('record:delete');
		}
	}
</script>

{#snippet recordRow(record: Collection['records'][number], rowIndex: number, number: number)}
	<tr class:selected-row={selectedRecord === record.id} class:whole-row={selectedRecord === record.id && !selectedCell} class:frozen-edge={frozenRecords.at(-1)?.record.id === record.id} data-record={record.id}>
		<td class="row-number">
			<button aria-label={`Select ${primaryLabel(record)}`} onclick={() => selectRecord(record.id)}>{number}</button>
		</td>
		{#each visibleFields as field, colIndex (field.id)}
			{@const value = fieldValue(record, field)}
			{@const onkeydown = (event: KeyboardEvent) => cellKeydown(event, rowIndex, colIndex, record.id, field.id)}
			<td
				class:primary-cell={field.primary}
				class:active-cell={selectedCell?.recordId === record.id && selectedCell.fieldId === field.id}
				class:find-hit={findHits.has(`${record.id}:${field.id}`)}
				class:find-current={findCurrent?.recordId === record.id && findCurrent.fieldId === field.id}
				class:selected-col={selectedField === field.id}
				class:frozen-col={frozenOffsets.has(field.id)}
				class:frozen-col-edge={lastFrozenField === field.id}
				style={frozenOffsets.has(field.id) ? `left:${frozenOffsets.get(field.id)}px` : undefined}
				data-cell={`${record.id}:${field.id}`}
				onclick={() => selectCell(record.id, field.id)}
			>
				{#if record.sourceRef && field.primary}
					<button class="source-value" title={referenceLabel(record.sourceRef)} onclick={(event) => { event.stopPropagation(); selectRecord(record.id); }}>
						{referenceLabel(record.sourceRef)}{#if !sourceCandidate(record.sourceRef)} <span class="cold">cold</span>{/if}
					</button>
				{:else if field.type === 'text' || field.type === 'url'}
					<input
						aria-label={cellLabel(field, record)}
						value={typeof value === 'string' ? value : ''}
						placeholder={field.primary ? 'Name this record' : '—'}
						readonly={!!field.sourceKey}
						title={field.sourceKey ? 'Synced from its source app' : undefined}
						onfocus={() => selectCell(record.id, field.id)}
						oninput={(event) => setText(record.id, field.id, event.currentTarget.value)}
						{onkeydown}
					/>
					{#if field.type === 'url' && typeof value === 'string' && value}
						<a class="url-open" href={value} target="_blank" rel="noreferrer" aria-label={`Open ${value}`} onclick={(event) => event.stopPropagation()}>↗</a>
					{/if}
				{:else if field.type === 'number'}
					<input
						type="number"
						aria-label={cellLabel(field, record)}
						value={typeof value === 'number' ? value : ''}
						onfocus={() => selectCell(record.id, field.id)}
						oninput={(event) => { const n = event.currentTarget.valueAsNumber; setNumber(record.id, field, Number.isFinite(n) ? n : null); }}
						{onkeydown}
					/>
				{:else if field.type === 'checkbox'}
					<button
						class="checkbox-cell"
						class:checked={value === true}
						role="checkbox"
						aria-checked={value === true}
						aria-label={cellLabel(field, record)}
						onclick={(event) => { event.stopPropagation(); mutateCell(record.id, field, value !== true); }}
						{onkeydown}
					>{value === true ? '✓' : ''}</button>
				{:else if field.type === 'date'}
					<input
						type="date"
						aria-label={cellLabel(field, record)}
						value={typeof value === 'string' ? value : ''}
						onfocus={() => selectCell(record.id, field.id)}
						onchange={(event) => mutateCell(record.id, field, event.currentTarget.value || null)}
						{onkeydown}
					/>
				{:else if field.type === 'select'}
					<select
						aria-label={cellLabel(field, record)}
						value={typeof value === 'string' ? value : ''}
						onfocus={() => selectCell(record.id, field.id)}
						onchange={(event) => mutateCell(record.id, field, event.currentTarget.value || null)}
						{onkeydown}
					>
						<option value="">—</option>
						{#each field.config?.options ?? [] as option}<option value={option.id}>{option.label}</option>{/each}
					</select>
				{:else if field.type === 'multi-select'}
					<select
						multiple
						aria-label={cellLabel(field, record)}
						value={Array.isArray(value) ? value : []}
						onchange={(event) => mutateCell(record.id, field, Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
					>
						{#each field.config?.options ?? [] as option}<option value={option.id}>{option.label}</option>{/each}
					</select>
				{:else if field.type === 'relation'}
					<div class="relation-wrap">
						<button class="relation-cell" aria-label={`Set ${field.name} relation`} onclick={(event) => { event.stopPropagation(); openRelationPicker(record.id, field.id); }}>
							{isRef(value) ? referenceLabel(value) : '＋ Add relation'}
						</button>
						{#if isRef(value)}
							<button class="remove-reference" aria-label="Remove reference" title="Remove reference" onclick={(event) => { event.stopPropagation(); selectCell(record.id, field.id); removeRelation(record.id, field); }}>×</button>
						{/if}
					</div>
				{/if}
			</td>
		{/each}
		<td class="row-actions">
			<button aria-label={`Actions for ${primaryLabel(record)}`} title="Record actions" aria-haspopup={homeSuite ? 'menu' : undefined} onclick={(event) => recordContext(event, record.id)}>⋯</button>
		</td>
	</tr>
{/snippet}

<svelte:head><title>{collection?.title ?? 'Data'} · HomeSuite</title></svelte:head>

{#if !ready}
	<main class="loading">Opening Data…</main>
{:else if !collection}
	<main class="missing"><span>Collection unavailable</span><h1>This Collection is not on this device.</h1><a href="/homesuite">Back to HomeSuite</a></main>
{:else}
	<main class="data-surface">
		<TableToolbar {collection} {sourceStatus} {syncBusy} hiddenFields={hiddenFieldCount} hiddenRecords={hiddenRecordCount} onCommand={command} onImport={importFile} />
		{#if saveIssue}<div class="save-issue" role="status">{saveIssue}</div>{/if}
		{#if notice}<div class="save-issue notice" role="status">{notice}</div>{/if}
		{#if findOpen}
			<FindBar
				bind:query={findQuery} bind:replacement={findReplacement} bind:matchCase={findMatchCase} bind:wholeCell={findWholeCell} bind:scopeField={findScopeField}
				fields={findFields} cells={findList.length} occurrences={findList.reduce((sum, match) => sum + match.occurrences, 0)}
				position={findCurrent ? findList.indexOf(findCurrent) + 1 : 0}
				onChange={findChanged} onStep={findStep} onReplace={findReplaceCurrent} onReplaceAll={findReplaceAll} onClose={closeFind}
			/>
		{/if}
		<ScrollFrame label={`${collection.title} scrollable table`}>
			<table class="data-table" aria-label={`${collection.title} table`}>
				<thead>
					<tr>
						<th class="row-head">#</th>
						{#each visibleFields as field (field.id)}
							{@const width = collection.views.table.columnWidths[field.id] ?? 160}
							{@const left = frozenOffsets.get(field.id)}
							<th data-field={field.id} class:primary={field.primary} class:selected-col={selectedField === field.id} class:frozen-col={left !== undefined} class:frozen-col-edge={lastFrozenField === field.id} style={`width:${width}px;min-width:${width}px${left !== undefined ? `;left:${left}px` : ''}`}>
								<button
									class="field-head"
									aria-pressed={selectedField === field.id}
									draggable="true"
									onclick={() => selectField(field.id)}
									ondragstart={() => { dragField = field.id; }}
									ondragover={(event) => event.preventDefault()}
									ondrop={(event) => { event.preventDefault(); dropField(field.id); }}
								>
									<span class="field-type">{fieldGlyph(field)}</span>
									<span>{field.name}</span>
									{#if field.sourceKey}<small class="synced-field" title="Refreshed from its source app">sync</small>{/if}
								</button>
								<span class="resize-grip" onpointerdown={(event) => beginResize(event, field)} aria-hidden="true"></span>
							</th>
						{/each}
						<th class="add-field-head"><button aria-label="Add field" title="Add field" onclick={() => { addFieldOpen = true; }}>＋</button></th>
					</tr>
					{#each frozenRecords as { record, number }, index (record.id)}
						{@render recordRow(record, index, number)}
					{/each}
				</thead>
				<tbody>
					{#each scrollingRecords as { record, number }, index (record.id)}
						{@render recordRow(record, frozenRecords.length + index, number)}
					{/each}
					<tr class="new-record-row">
						<td></td>
						<td colspan={Math.max(1, visibleFields.length + 1)}><button onclick={addNewRecord}>＋ New record</button></td>
					</tr>
				</tbody>
			</table>
		</ScrollFrame>
		{#if addFieldOpen}
			<FieldDialog onCreate={createField} onClose={() => { addFieldOpen = false; }} />
		{/if}
		{#if pickerFor}
			<ReferenceDialog
				bind:query={pickerQuery}
				relating={!!pickerFor.recordId && pickerFor.recordId !== '$new'}
				browsing={pickerFor.recordId === '$new'}
				{candidates}
				loading={pickerLoading}
				onBrowse={() => { pickerFor = { recordId: '$new', fieldId: '' }; }}
				onPick={pickCandidate}
				onClose={() => { pickerFor = null; }}
			/>
		{/if}
	</main>
{/if}
