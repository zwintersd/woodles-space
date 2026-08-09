/**
 * Liquid — a mode for writing lists, nesting them, and moving things around
 * fluidly. Trello's board-of-lists shape crossed with a Notion-style outline
 * inside each list: a draft of kind `list` holds a `LiquidBoard` instead of
 * prose, and `Liquid.svelte` is the only thing that reads or writes it.
 *
 * Pure tree logic lives here, with no DOM and no runes, so every operation —
 * indent, outdent, reorder, move an item to a different list — is testable
 * directly. Everything is built from two primitives: `removeNode` (take an
 * item and its subtree out of a list, wherever it is nested) and `insertNode`
 * (put it back somewhere else). Indent, outdent, and moving between lists are
 * all just "remove, then insert at a different address" — there is no
 * separate code path for each.
 */

export type LiquidItem = {
	id: string;
	text: string;
	children: LiquidItem[];
	collapsed: boolean;
};

export type LiquidList = {
	id: string;
	title: string;
	items: LiquidItem[];
};

export type LiquidBoard = {
	lists: LiquidList[];
};

export function emptyBoard(): LiquidBoard {
	return { lists: [] };
}

export function isEmptyBoard(board: LiquidBoard): boolean {
	return board.lists.length === 0;
}

function newId(prefix: string): string {
	return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function newItem(text = ''): LiquidItem {
	return { id: newId('li'), text, children: [], collapsed: false };
}

// ── generic tree primitives, operating on one list's items ────────────────

/** The node itself, found anywhere in the tree, or null. */
export function getItem(items: LiquidItem[], id: string): LiquidItem | null {
	for (const item of items) {
		if (item.id === id) return item;
		const found = getItem(item.children, id);
		if (found) return found;
	}
	return null;
}

/** Where a node currently lives: whose children array, and at what index. */
export function locate(
	items: LiquidItem[],
	id: string,
	parentId: string | null = null
): { parentId: string | null; index: number } | null {
	const index = items.findIndex((item) => item.id === id);
	if (index !== -1) return { parentId, index };
	for (const item of items) {
		const found = locate(item.children, id, item.id);
		if (found) return found;
	}
	return null;
}

/** The children array belonging to `parentId` (or the top level when null). */
export function childrenOf(items: LiquidItem[], parentId: string | null): LiquidItem[] {
	if (parentId === null) return items;
	return getItem(items, parentId)?.children ?? [];
}

/**
 * Every id in document order — the order a reader (or Backspace, moving
 * focus to "the previous item") would walk the list. Collapsed subtrees are
 * skipped by default, matching what's actually on screen; pass
 * `respectCollapsed: false` to walk the whole tree regardless.
 */
export function flatten(items: LiquidItem[], respectCollapsed = true): { id: string; depth: number }[] {
	const out: { id: string; depth: number }[] = [];
	function walk(level: LiquidItem[], depth: number) {
		for (const item of level) {
			out.push({ id: item.id, depth });
			if (!respectCollapsed || !item.collapsed) walk(item.children, depth + 1);
		}
	}
	walk(items, 0);
	return out;
}

/** Apply `fn` to the children array of `parentId` (or the top level), leaving everything else untouched. */
function updateChildrenOf(
	items: LiquidItem[],
	parentId: string | null,
	fn: (siblings: LiquidItem[]) => LiquidItem[]
): LiquidItem[] {
	if (parentId === null) return fn(items);
	return items.map((item) =>
		item.id === parentId
			? { ...item, children: fn(item.children) }
			: { ...item, children: updateChildrenOf(item.children, parentId, fn) }
	);
}

function insertAt<T>(arr: T[], value: T, index: number): T[] {
	const clamped = Math.max(0, Math.min(index, arr.length));
	return [...arr.slice(0, clamped), value, ...arr.slice(clamped)];
}

/** Take a node and its subtree out of the tree. A no-op tree when the id isn't found. */
export function removeNode(items: LiquidItem[], id: string): LiquidItem[] {
	return items.filter((item) => item.id !== id).map((item) => ({ ...item, children: removeNode(item.children, id) }));
}

/** Put a node back as a child of `parentId` (or top-level when null) at `index`. */
export function insertNode(
	items: LiquidItem[],
	node: LiquidItem,
	parentId: string | null,
	index: number
): LiquidItem[] {
	return updateChildrenOf(items, parentId, (siblings) => insertAt(siblings, node, index));
}

/** Replace one node's own fields (never its children) by id. */
export function mapNode(items: LiquidItem[], id: string, fn: (item: LiquidItem) => LiquidItem): LiquidItem[] {
	return items.map((item) => {
		const next = item.id === id ? fn(item) : item;
		return { ...next, children: mapNode(next.children, id, fn) };
	});
}

/** True when `maybeAncestorId` is `id` itself or one of its ancestors. */
function wouldCycle(items: LiquidItem[], id: string, maybeAncestorId: string): boolean {
	if (id === maybeAncestorId) return true;
	const node = getItem(items, id);
	if (!node) return false;
	return getItem(node.children, maybeAncestorId) !== null;
}

// ── item operations, within one list ───────────────────────────────────────

export function addSiblingAfter(items: LiquidItem[], afterId: string | null, text = ''): { items: LiquidItem[]; item: LiquidItem } {
	const item = newItem(text);
	if (afterId === null) return { items: [...items, item], item };
	const loc = locate(items, afterId);
	if (!loc) return { items: [...items, item], item };
	return { items: insertNode(items, item, loc.parentId, loc.index + 1), item };
}

export function addChild(items: LiquidItem[], parentId: string, text = ''): { items: LiquidItem[]; item: LiquidItem } {
	const item = newItem(text);
	const siblings = childrenOf(items, parentId);
	return { items: insertNode(items, item, parentId, siblings.length), item };
}

export function updateItemText(items: LiquidItem[], id: string, text: string): LiquidItem[] {
	return mapNode(items, id, (item) => ({ ...item, text }));
}

export function toggleCollapsed(items: LiquidItem[], id: string): LiquidItem[] {
	return mapNode(items, id, (item) => ({ ...item, collapsed: !item.collapsed }));
}

export function removeItem(items: LiquidItem[], id: string): LiquidItem[] {
	return removeNode(items, id);
}

/** Nest under the previous sibling, as its last child. First-in-parent items have no previous sibling to nest under. */
export function indentItem(items: LiquidItem[], id: string): LiquidItem[] {
	const loc = locate(items, id);
	if (!loc || loc.index === 0) return items;
	const siblings = childrenOf(items, loc.parentId);
	const newParentId = siblings[loc.index - 1].id;
	const node = getItem(items, id);
	if (!node) return items;
	const withoutNode = removeNode(items, id);
	const newSiblings = childrenOf(withoutNode, newParentId);
	return insertNode(withoutNode, node, newParentId, newSiblings.length);
}

/** Move up one level, becoming the next sibling of its former parent. Already-top-level items have nowhere to outdent to. */
export function outdentItem(items: LiquidItem[], id: string): LiquidItem[] {
	const loc = locate(items, id);
	if (!loc || loc.parentId === null) return items;
	const parentLoc = locate(items, loc.parentId);
	if (!parentLoc) return items;
	const node = getItem(items, id);
	if (!node) return items;
	const withoutNode = removeNode(items, id);
	return insertNode(withoutNode, node, parentLoc.parentId, parentLoc.index + 1);
}

/** Reorder among siblings. Clamped at either end rather than wrapping. */
export function moveWithinSiblings(items: LiquidItem[], id: string, direction: -1 | 1): LiquidItem[] {
	const loc = locate(items, id);
	if (!loc) return items;
	const siblings = childrenOf(items, loc.parentId);
	const targetIndex = loc.index + direction;
	if (targetIndex < 0 || targetIndex >= siblings.length) return items;
	const node = getItem(items, id);
	if (!node) return items;
	const withoutNode = removeNode(items, id);
	return insertNode(withoutNode, node, loc.parentId, targetIndex);
}

/**
 * Move a node (and its subtree) to an arbitrary position, possibly under a
 * different parent — what a drag-and-drop reorder needs. Refuses a move that
 * would nest a node under itself or one of its own descendants, returning the
 * tree unchanged rather than corrupting it.
 */
export function moveNodeTo(
	items: LiquidItem[],
	id: string,
	parentId: string | null,
	index: number
): LiquidItem[] {
	if (parentId !== null && wouldCycle(items, id, parentId)) return items;
	const node = getItem(items, id);
	if (!node) return items;
	const withoutNode = removeNode(items, id);
	return insertNode(withoutNode, node, parentId, index);
}

// ── board operations, across lists ─────────────────────────────────────────

function updateList(board: LiquidBoard, listId: string, fn: (items: LiquidItem[]) => LiquidItem[]): LiquidBoard {
	return { lists: board.lists.map((list) => (list.id === listId ? { ...list, items: fn(list.items) } : list)) };
}

export function addList(board: LiquidBoard, title = ''): { board: LiquidBoard; list: LiquidList } {
	const list: LiquidList = { id: newId('ll'), title, items: [] };
	return { board: { lists: [...board.lists, list] }, list };
}

export function renameList(board: LiquidBoard, listId: string, title: string): LiquidBoard {
	return { lists: board.lists.map((list) => (list.id === listId ? { ...list, title } : list)) };
}

export function removeList(board: LiquidBoard, listId: string): LiquidBoard {
	return { lists: board.lists.filter((list) => list.id !== listId) };
}

export function moveList(board: LiquidBoard, listId: string, toIndex: number): LiquidBoard {
	const fromIndex = board.lists.findIndex((list) => list.id === listId);
	if (fromIndex === -1) return board;
	const list = board.lists[fromIndex];
	const without = board.lists.filter((l) => l.id !== listId);
	return { lists: insertAt(without, list, Math.max(0, Math.min(toIndex, without.length))) };
}

export function addListItem(board: LiquidBoard, listId: string, afterId: string | null, text = ''): { board: LiquidBoard; item: LiquidItem | null } {
	let created: LiquidItem | null = null;
	const board2 = updateList(board, listId, (items) => {
		const { items: next, item } = addSiblingAfter(items, afterId, text);
		created = item;
		return next;
	});
	return { board: board2, item: created };
}

export function addListItemChild(board: LiquidBoard, listId: string, parentId: string, text = ''): { board: LiquidBoard; item: LiquidItem | null } {
	let created: LiquidItem | null = null;
	const board2 = updateList(board, listId, (items) => {
		const { items: next, item } = addChild(items, parentId, text);
		created = item;
		return next;
	});
	return { board: board2, item: created };
}

export function updateListItemText(board: LiquidBoard, listId: string, itemId: string, text: string): LiquidBoard {
	return updateList(board, listId, (items) => updateItemText(items, itemId, text));
}

export function toggleListItemCollapsed(board: LiquidBoard, listId: string, itemId: string): LiquidBoard {
	return updateList(board, listId, (items) => toggleCollapsed(items, itemId));
}

export function removeListItem(board: LiquidBoard, listId: string, itemId: string): LiquidBoard {
	return updateList(board, listId, (items) => removeItem(items, itemId));
}

export function indentListItem(board: LiquidBoard, listId: string, itemId: string): LiquidBoard {
	return updateList(board, listId, (items) => indentItem(items, itemId));
}

export function outdentListItem(board: LiquidBoard, listId: string, itemId: string): LiquidBoard {
	return updateList(board, listId, (items) => outdentItem(items, itemId));
}

export function moveListItemWithinSiblings(board: LiquidBoard, listId: string, itemId: string, direction: -1 | 1): LiquidBoard {
	return updateList(board, listId, (items) => moveWithinSiblings(items, itemId, direction));
}

/**
 * Move an item — possibly to a different list — to sit under `toParentId`
 * (or top-level) at `toIndex`. The one operation drag-and-drop needs,
 * covering same-list reorders and cross-list moves alike: dropping onto a
 * row in the same list it came from is just `fromListId === toListId`.
 */
export function moveListItemTo(
	board: LiquidBoard,
	fromListId: string,
	itemId: string,
	toListId: string,
	toParentId: string | null,
	toIndex: number
): LiquidBoard {
	const fromList = board.lists.find((list) => list.id === fromListId);
	const toListExists = board.lists.some((list) => list.id === toListId);
	if (!fromList || !toListExists) return board;
	const node = getItem(fromList.items, itemId);
	if (!node) return board;
	if (fromListId === toListId) {
		return updateList(board, fromListId, (items) => moveNodeTo(items, itemId, toParentId, toIndex));
	}
	if (toParentId !== null && wouldCycle(fromList.items, itemId, toParentId)) return board;
	const withoutNode = updateList(board, fromListId, (items) => removeNode(items, itemId));
	return updateList(withoutNode, toListId, (items) => insertNode(items, node, toParentId, toIndex));
}

export type DropZone = 'before' | 'after' | 'nest';

/**
 * Which zone of a row a drag is hovering, from the row's own bounding box and
 * the pointer position — the geometry a drop indicator needs. The left 20%
 * of a row is the "nest" strip; the rest splits top/bottom at the row's
 * vertical midpoint. Pure and given a plain rect shape rather than a real
 * `DOMRect` so it's testable without a browser.
 */
export function dropZone(
	rect: { left: number; top: number; width: number; height: number },
	x: number,
	y: number
): DropZone {
	if (x - rect.left < rect.width * 0.2) return 'nest';
	return y - rect.top < rect.height / 2 ? 'before' : 'after';
}

/**
 * Move an item — possibly from a different list — to sit immediately before
 * or after `targetId`, at the target's own nesting level, or to nest as the
 * target's last child. What dropping onto a specific row needs, and the
 * counterpart to `moveListItemTo`'s absolute-index move (for dropping into a
 * list's empty space, not onto any particular row).
 *
 * The target's position is located *after* the dragged node is removed, not
 * before: removing a node shifts every later sibling's index down by one, so
 * computing "before/after" against the pre-removal tree drops one position
 * short whenever the dragged node started out earlier than its target in the
 * same list. Doing the remove first and locating the target in what's left
 * is also what makes "the target was inside the node being dragged" refuse
 * itself for free — that target simply isn't there to find any more.
 */
export function moveItemRelativeTo(
	board: LiquidBoard,
	fromListId: string,
	itemId: string,
	toListId: string,
	targetId: string,
	zone: DropZone
): LiquidBoard {
	if (itemId === targetId) return board;
	const fromList = board.lists.find((list) => list.id === fromListId);
	if (!fromList) return board;
	const node = getItem(fromList.items, itemId);
	if (!node) return board;
	if (!board.lists.some((list) => list.id === toListId)) return board;

	const boardWithoutNode = updateList(board, fromListId, (items) => removeNode(items, itemId));
	const destItems = boardWithoutNode.lists.find((list) => list.id === toListId)!.items;

	if (zone === 'nest') {
		const target = getItem(destItems, targetId);
		if (!target) return board;
		return updateList(boardWithoutNode, toListId, (items) =>
			insertNode(items, node, targetId, target.children.length)
		);
	}

	const loc = locate(destItems, targetId);
	if (!loc) return board;
	const index = zone === 'before' ? loc.index : loc.index + 1;
	return updateList(boardWithoutNode, toListId, (items) => insertNode(items, node, loc.parentId, index));
}

/** Total item count across every list, subtree included — Liquid's stand-in for a word count. */
export function itemCount(board: LiquidBoard): number {
	function count(items: LiquidItem[]): number {
		return items.reduce((sum, item) => sum + 1 + count(item.children), 0);
	}
	return board.lists.reduce((sum, list) => sum + count(list.items), 0);
}
