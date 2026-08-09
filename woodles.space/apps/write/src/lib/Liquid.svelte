<script lang="ts">
	// Liquid — a mode for writing lists, nesting them, and moving things
	// around fluidly. Trello's board-of-lists shape, a Notion-style outline
	// inside each one. This component owns all the interactive state (drag
	// tracking, hover zones); the tree itself is `board`, a bindable prop, and
	// every mutation goes through liquid.ts's pure functions — nothing here
	// reaches into the tree directly.
	import {
		addList,
		addListItem,
		dropZone,
		flatten,
		getItem,
		indentListItem,
		moveItemRelativeTo,
		moveList,
		moveListItemTo,
		moveListItemWithinSiblings,
		outdentListItem,
		removeList,
		removeListItem,
		renameList,
		toggleListItemCollapsed,
		updateListItemText,
		type DropZone,
		type LiquidBoard
	} from './liquid';
	import LiquidNode from './LiquidNode.svelte';

	let { board = $bindable() }: { board: LiquidBoard } = $props();

	/** Renaming a list opens its title already selected, ready to type over —
	 *  an action rather than the `autofocus` attribute, which a11y flags. */
	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// ── drag state — one board-wide source of truth, so an item can be
	// dragged from one list's column into another's without either side
	// needing to know about the other. ──
	let dragItem = $state<{ listId: string; itemId: string } | null>(null);
	let hoverItem = $state<{ listId: string; itemId: string; zone: DropZone } | null>(null);
	let dragList = $state<string | null>(null);
	let hoverListSide = $state<{ listId: string; side: 'before' | 'after' } | null>(null);
	let hoverListEnd = $state<string | null>(null);

	let newItemText = $state<Record<string, string>>({});
	let newListTitle = $state('');
	let focusItemId = $state<string | null>(null);
	let confirmDeleteListId = $state<string | null>(null);
	let editingListId = $state<string | null>(null);

	function clearDrag() {
		dragItem = null;
		hoverItem = null;
		dragList = null;
		hoverListSide = null;
		hoverListEnd = null;
	}

	// ── lists ──

	function createList() {
		const title = newListTitle.trim();
		if (!title) return;
		const { board: next } = addList(board, title);
		board = next;
		newListTitle = '';
	}

	function startRenameList(listId: string) {
		editingListId = listId;
	}

	function commitRenameList(listId: string, title: string) {
		board = renameList(board, listId, title.trim() || 'untitled list');
		editingListId = null;
	}

	function deleteList(listId: string) {
		if (confirmDeleteListId !== listId) {
			confirmDeleteListId = listId;
			return;
		}
		board = removeList(board, listId);
		confirmDeleteListId = null;
	}

	function onListHeaderDragStart(e: DragEvent, listId: string) {
		dragList = listId;
		e.dataTransfer?.setData('text/plain', listId);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onListHeaderDragOver(e: DragEvent, listId: string) {
		if (!dragList || dragList === listId) return;
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const side = e.clientX - rect.left < rect.width / 2 ? 'before' : 'after';
		hoverListSide = { listId, side };
	}

	function onListHeaderDrop(e: DragEvent, listId: string) {
		e.preventDefault();
		if (!dragList || dragList === listId || !hoverListSide) {
			clearDrag();
			return;
		}
		const targetIndex = board.lists.findIndex((l) => l.id === listId);
		const finalIndex = hoverListSide.side === 'before' ? targetIndex : targetIndex + 1;
		board = moveList(board, dragList, finalIndex);
		clearDrag();
	}

	// ── items ──

	function addNewItem(listId: string) {
		const text = (newItemText[listId] ?? '').trim();
		if (!text) return;
		const { board: next, item } = addListItem(board, listId, null, text);
		board = next;
		newItemText = { ...newItemText, [listId]: '' };
		if (item) focusNewItem(item.id);
	}

	function focusNewItem(id: string) {
		focusItemId = id;
	}

	function onItemInput(listId: string, itemId: string, text: string) {
		board = updateListItemText(board, listId, itemId, text);
	}

	function onItemToggleCollapse(listId: string, itemId: string) {
		board = toggleListItemCollapsed(board, listId, itemId);
	}

	function onItemDelete(listId: string, itemId: string) {
		const list = board.lists.find((l) => l.id === listId);
		const order = list ? flatten(list.items) : [];
		const at = order.findIndex((n) => n.id === itemId);
		const previous = at > 0 ? order[at - 1].id : null;
		board = removeListItem(board, listId, itemId);
		if (previous) focusItemId = previous;
	}

	function onItemKeydown(listId: string, e: KeyboardEvent, itemId: string) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const { board: next, item } = addListItem(board, listId, itemId, '');
			board = next;
			if (item) focusItemId = item.id;
			return;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			board = e.shiftKey ? outdentListItem(board, listId, itemId) : indentListItem(board, listId, itemId);
			return;
		}
		if (e.altKey && e.key === 'ArrowUp') {
			e.preventDefault();
			board = moveListItemWithinSiblings(board, listId, itemId, -1);
			return;
		}
		if (e.altKey && e.key === 'ArrowDown') {
			e.preventDefault();
			board = moveListItemWithinSiblings(board, listId, itemId, 1);
			return;
		}
		if (e.key === 'Backspace') {
			const input = e.currentTarget as HTMLInputElement;
			if (input.selectionStart === 0 && input.selectionEnd === 0 && input.value === '') {
				e.preventDefault();
				onItemDelete(listId, itemId);
			}
		}
	}

	function onItemDragStart(e: DragEvent, listId: string, itemId: string) {
		dragItem = { listId, itemId };
		e.dataTransfer?.setData('text/plain', itemId);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onItemDragOver(e: DragEvent, listId: string, itemId: string) {
		if (!dragItem) return;
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		hoverItem = { listId, itemId, zone: dropZone(rect, e.clientX, e.clientY) };
	}

	function onItemDrop(e: DragEvent, listId: string, itemId: string) {
		e.preventDefault();
		if (dragItem) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const zone = dropZone(rect, e.clientX, e.clientY);
			board = moveItemRelativeTo(board, dragItem.listId, dragItem.itemId, listId, itemId, zone);
		}
		clearDrag();
	}

	function onListBodyDragOver(e: DragEvent, listId: string) {
		if (!dragItem) return;
		e.preventDefault();
		hoverListEnd = listId;
		hoverItem = null;
	}

	function onListBodyDrop(e: DragEvent, listId: string) {
		e.preventDefault();
		if (dragItem) {
			const list = board.lists.find((l) => l.id === listId);
			board = moveListItemTo(board, dragItem.listId, dragItem.itemId, listId, null, list?.items.length ?? 0);
		}
		clearDrag();
	}
</script>

<div class="liquid-board">
	{#each board.lists as list (list.id)}
		<div
			class="liquid-list"
			class:drop-list-before={hoverListSide?.listId === list.id && hoverListSide.side === 'before'}
			class:drop-list-after={hoverListSide?.listId === list.id && hoverListSide.side === 'after'}
		>
			<div
				class="liquid-list-header"
				draggable="true"
				role="group"
				aria-label="{list.title || 'untitled list'} — drag to reorder"
				ondragstart={(e) => onListHeaderDragStart(e, list.id)}
				ondragover={(e) => onListHeaderDragOver(e, list.id)}
				ondrop={(e) => onListHeaderDrop(e, list.id)}
				ondragend={clearDrag}
			>
				<span class="liquid-list-handle" aria-hidden="true">⠿</span>
				{#if editingListId === list.id}
					<input
						class="liquid-list-title-input"
						type="text"
						value={list.title}
						use:focusAndSelect
						onblur={(e) => commitRenameList(list.id, e.currentTarget.value)}
						onkeydown={(e) => {
							if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
							if (e.key === 'Escape') editingListId = null;
						}}
					/>
				{:else}
					<button class="liquid-list-title" onclick={() => startRenameList(list.id)}>
						{list.title || 'untitled list'}
					</button>
				{/if}
				<span class="liquid-list-count">{list.items.length}</span>
				{#if confirmDeleteListId === list.id}
					<button class="liquid-list-delete confirm" onclick={() => deleteList(list.id)}>delete?</button>
					<button class="liquid-list-cancel" onclick={() => (confirmDeleteListId = null)}>cancel</button>
				{:else}
					<button class="liquid-list-delete" onclick={() => deleteList(list.id)} aria-label="delete list">×</button>
				{/if}
			</div>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="liquid-list-body"
				class:drop-end={hoverListEnd === list.id}
				ondragover={(e) => onListBodyDragOver(e, list.id)}
				ondrop={(e) => onListBodyDrop(e, list.id)}
			>
				{#each list.items as item (item.id)}
					<LiquidNode
						{item}
						listId={list.id}
						depth={0}
						{dragItem}
						{hoverItem}
						{focusItemId}
						onKeydown={(e, itemId) => onItemKeydown(list.id, e, itemId)}
						onInput={(itemId, text) => onItemInput(list.id, itemId, text)}
						onToggleCollapse={(itemId) => onItemToggleCollapse(list.id, itemId)}
						onDelete={(itemId) => onItemDelete(list.id, itemId)}
						onDragStart={(e, itemId) => onItemDragStart(e, list.id, itemId)}
						onDragOver={(e, itemId) => onItemDragOver(e, list.id, itemId)}
						onDrop={(e, itemId) => onItemDrop(e, list.id, itemId)}
						onDragEnd={clearDrag}
						onFocused={() => (focusItemId = null)}
					/>
				{/each}
				<div class="liquid-add-item">
					<input
						type="text"
						placeholder="+ add an item"
						value={newItemText[list.id] ?? ''}
						oninput={(e) => (newItemText = { ...newItemText, [list.id]: e.currentTarget.value })}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addNewItem(list.id);
							}
						}}
					/>
				</div>
			</div>
		</div>
	{/each}

	<div class="liquid-new-list">
		<input
			type="text"
			placeholder="+ new list"
			bind:value={newListTitle}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					createList();
				}
			}}
		/>
	</div>
</div>

<style>
	.liquid-board {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		overflow-x: auto;
		padding: 0.4rem 0.2rem 2rem;
		min-height: 60vh;
	}
	.liquid-list {
		flex: none;
		width: 15.5rem;
		background: var(--surface);
		border: 1px solid var(--rule);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		max-height: 76vh;
		border-left: 2px solid transparent;
		border-right: 2px solid transparent;
	}
	.liquid-list.drop-list-before {
		border-left-color: var(--accent-strong);
	}
	.liquid-list.drop-list-after {
		border-right-color: var(--accent-strong);
	}
	.liquid-list-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.55rem 0.5rem;
		border-bottom: 1px solid var(--rule);
		cursor: grab;
	}
	.liquid-list-handle {
		flex: none;
		font-size: 0.7rem;
		color: var(--muted);
		opacity: 0.5;
	}
	.liquid-list-title,
	.liquid-list-title-input {
		flex: 1 1 auto;
		min-width: 0;
		text-align: left;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--accent-strong);
		background: none;
		border: none;
		padding: 0.15rem 0.2rem;
		border-radius: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.liquid-list-title-input:focus {
		outline: none;
		background: var(--bg);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.liquid-list-count {
		flex: none;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.6rem;
		color: var(--muted);
		opacity: 0.6;
	}
	.liquid-list-delete,
	.liquid-list-cancel {
		flex: none;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.65rem;
		color: var(--muted);
		background: none;
		border: none;
		border-radius: 3px;
		padding: 0.1rem 0.3rem;
		cursor: pointer;
		opacity: 0.6;
	}
	.liquid-list-delete:hover {
		opacity: 1;
		color: var(--danger, #b3454f);
	}
	.liquid-list-delete.confirm {
		opacity: 1;
		color: var(--danger, #b3454f);
	}
	.liquid-list-body {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		border: 2px solid transparent;
		border-radius: 0 0 9px 9px;
	}
	.liquid-list-body.drop-end {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.liquid-add-item {
		margin-top: 0.2rem;
	}
	.liquid-add-item input {
		width: 100%;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.75rem;
		color: var(--muted);
		background: none;
		border: 1px dashed transparent;
		padding: 0.3rem 0.4rem;
		border-radius: 6px;
	}
	.liquid-add-item input:hover {
		border-color: var(--rule);
	}
	.liquid-add-item input:focus {
		outline: none;
		color: var(--text);
		border-color: var(--accent);
		border-style: solid;
	}
	.liquid-new-list {
		flex: none;
		width: 15.5rem;
	}
	.liquid-new-list input {
		width: 100%;
		font-family: var(--editor-mono, var(--font-mono));
		font-size: 0.75rem;
		color: var(--muted);
		background: none;
		border: 1px dashed var(--rule);
		padding: 0.55rem 0.6rem;
		border-radius: 10px;
	}
	.liquid-new-list input:focus {
		outline: none;
		color: var(--text);
		border-color: var(--accent);
		border-style: solid;
	}
</style>
