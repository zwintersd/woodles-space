import { describe, expect, it } from 'vitest';
import {
	addChild,
	addList,
	addListItem,
	addListItemChild,
	addSiblingAfter,
	childrenOf,
	dropZone,
	emptyBoard,
	flatten,
	getItem,
	indentItem,
	indentListItem,
	isEmptyBoard,
	itemCount,
	locate,
	moveItemRelativeTo,
	moveList,
	moveListItemTo,
	moveListItemWithinSiblings,
	moveNodeTo,
	moveWithinSiblings,
	outdentItem,
	outdentListItem,
	removeItem,
	removeList,
	removeListItem,
	removeNode,
	renameList,
	toggleCollapsed,
	toggleListItemCollapsed,
	updateItemText,
	updateListItemText,
	type LiquidBoard,
	type LiquidItem
} from './liquid';

function item(id: string, children: LiquidItem[] = [], text = id): LiquidItem {
	return { id, text, children, collapsed: false };
}

describe('emptyBoard / isEmptyBoard', () => {
	it('starts with no lists', () => {
		expect(isEmptyBoard(emptyBoard())).toBe(true);
	});
	it('is not empty once a list exists', () => {
		const { board } = addList(emptyBoard(), 'todo');
		expect(isEmptyBoard(board)).toBe(false);
	});
});

describe('tree primitives', () => {
	const tree: LiquidItem[] = [item('a', [item('a1'), item('a2', [item('a2a')])]), item('b')];

	it('getItem finds a node anywhere in the tree', () => {
		expect(getItem(tree, 'a2a')?.id).toBe('a2a');
		expect(getItem(tree, 'nope')).toBeNull();
	});

	it('locate reports the parent and index', () => {
		expect(locate(tree, 'a2a')).toEqual({ parentId: 'a2', index: 0 });
		expect(locate(tree, 'b')).toEqual({ parentId: null, index: 1 });
		expect(locate(tree, 'nope')).toBeNull();
	});

	it('childrenOf reads the top level and any nested level', () => {
		expect(childrenOf(tree, null).map((i) => i.id)).toEqual(['a', 'b']);
		expect(childrenOf(tree, 'a').map((i) => i.id)).toEqual(['a1', 'a2']);
		expect(childrenOf(tree, 'missing')).toEqual([]);
	});

	it('removeNode takes a subtree out from wherever it is nested', () => {
		const next = removeNode(tree, 'a2');
		expect(getItem(next, 'a2')).toBeNull();
		expect(getItem(next, 'a2a')).toBeNull(); // the subtree goes with it
		expect(getItem(next, 'a1')).not.toBeNull(); // a sibling survives
	});

	it('removeNode is a no-op when the id is not found', () => {
		expect(removeNode(tree, 'nope')).toEqual(tree);
	});

	it('mapNode replaces one node without touching its children', () => {
		const next = updateItemText(tree, 'a', 'renamed');
		expect(getItem(next, 'a')?.text).toBe('renamed');
		expect(getItem(next, 'a1')).not.toBeNull();
	});

	it('does not mutate the input tree', () => {
		const before = JSON.stringify(tree);
		removeNode(tree, 'a1');
		updateItemText(tree, 'a', 'x');
		toggleCollapsed(tree, 'b');
		expect(JSON.stringify(tree)).toBe(before);
	});
});

describe('addSiblingAfter / addChild', () => {
	it('appends to the end when afterId is null', () => {
		const { items, item: created } = addSiblingAfter([item('a')], null, 'new');
		expect(items.map((i) => i.id)).toEqual(['a', created.id]);
		expect(created.text).toBe('new');
	});

	it('inserts right after the given sibling, at the same level', () => {
		const tree = [item('a'), item('b')];
		const { items, item: created } = addSiblingAfter(tree, 'a', 'new');
		expect(items.map((i) => i.id)).toEqual(['a', created.id, 'b']);
	});

	it('inserts after a nested sibling, staying nested', () => {
		const tree = [item('a', [item('a1')])];
		const { items, item: created } = addSiblingAfter(tree, 'a1', 'new');
		expect(childrenOf(items, 'a').map((i) => i.id)).toEqual(['a1', created.id]);
	});

	it('addChild appends as the last child of the given parent', () => {
		const tree = [item('a', [item('a1')])];
		const { items, item: created } = addChild(tree, 'a', 'new');
		expect(childrenOf(items, 'a').map((i) => i.id)).toEqual(['a1', created.id]);
	});

	it('addChild on a childless parent creates its first child', () => {
		const { items, item: created } = addChild([item('a')], 'a', 'first');
		expect(childrenOf(items, 'a').map((i) => i.id)).toEqual([created.id]);
	});
});

describe('indentItem', () => {
	it('nests under the previous sibling, as its last child', () => {
		const tree = [item('a'), item('b'), item('c')];
		const next = indentItem(tree, 'c');
		expect(next.map((i) => i.id)).toEqual(['a', 'b']);
		expect(childrenOf(next, 'b').map((i) => i.id)).toEqual(['c']);
	});

	it('is a no-op for the first item — nothing to nest under', () => {
		const tree = [item('a'), item('b')];
		expect(indentItem(tree, 'a')).toEqual(tree);
	});

	it('appends after existing children of the new parent', () => {
		const tree = [item('a', [item('a1')]), item('b')];
		const next = indentItem(tree, 'b');
		expect(childrenOf(next, 'a').map((i) => i.id)).toEqual(['a1', 'b']);
	});
});

describe('outdentItem', () => {
	it('becomes the next sibling of its former parent', () => {
		const tree = [item('a', [item('a1'), item('a2')]), item('b')];
		const next = outdentItem(tree, 'a1');
		expect(next.map((i) => i.id)).toEqual(['a', 'a1', 'b']);
		expect(childrenOf(next, 'a').map((i) => i.id)).toEqual(['a2']);
	});

	it('is a no-op for an already-top-level item', () => {
		const tree = [item('a'), item('b')];
		expect(outdentItem(tree, 'a')).toEqual(tree);
	});

	it('outdenting twice reaches the top level from two deep', () => {
		const tree = [item('a', [item('a1', [item('a1a')])])];
		const once = outdentItem(tree, 'a1a');
		expect(locate(once, 'a1a')).toEqual({ parentId: 'a', index: 1 });
		const twice = outdentItem(once, 'a1a');
		expect(locate(twice, 'a1a')).toEqual({ parentId: null, index: 1 });
	});
});

describe('moveWithinSiblings', () => {
	it('moves up and down among siblings', () => {
		const tree = [item('a'), item('b'), item('c')];
		expect(moveWithinSiblings(tree, 'b', -1).map((i) => i.id)).toEqual(['b', 'a', 'c']);
		expect(moveWithinSiblings(tree, 'b', 1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
	});

	it('clamps at either end rather than wrapping', () => {
		const tree = [item('a'), item('b')];
		expect(moveWithinSiblings(tree, 'a', -1)).toEqual(tree);
		expect(moveWithinSiblings(tree, 'b', 1)).toEqual(tree);
	});

	it('reorders within a nested level too', () => {
		const tree = [item('a', [item('a1'), item('a2')])];
		const next = moveWithinSiblings(tree, 'a2', -1);
		expect(childrenOf(next, 'a').map((i) => i.id)).toEqual(['a2', 'a1']);
	});
});

describe('moveNodeTo', () => {
	it('moves a node under a different parent at a given index', () => {
		const tree = [item('a'), item('b', [item('b1')])];
		const next = moveNodeTo(tree, 'a', 'b', 1);
		expect(next.map((i) => i.id)).toEqual(['b']);
		expect(childrenOf(next, 'b').map((i) => i.id)).toEqual(['b1', 'a']);
	});

	it('refuses to nest a node under itself', () => {
		const tree = [item('a')];
		expect(moveNodeTo(tree, 'a', 'a', 0)).toEqual(tree);
	});

	it('refuses to nest a node under its own descendant', () => {
		const tree = [item('a', [item('a1', [item('a1a')])])];
		expect(moveNodeTo(tree, 'a', 'a1a', 0)).toEqual(tree);
	});

	it('moving to null makes a node top-level', () => {
		const tree = [item('a', [item('a1')])];
		const next = moveNodeTo(tree, 'a1', null, 0);
		expect(next.map((i) => i.id)).toEqual(['a1', 'a']);
	});
});

describe('board-level operations', () => {
	function boardWithOneList(): { board: LiquidBoard; listId: string } {
		const { board, list } = addList(emptyBoard(), 'todo');
		return { board, listId: list.id };
	}

	it('addList / renameList / removeList / moveList', () => {
		let board = emptyBoard();
		const a = addList(board, 'a');
		board = a.board;
		const b = addList(board, 'b');
		board = b.board;
		expect(board.lists.map((l) => l.title)).toEqual(['a', 'b']);

		board = renameList(board, a.list.id, 'renamed');
		expect(board.lists[0].title).toBe('renamed');

		board = moveList(board, b.list.id, 0);
		expect(board.lists.map((l) => l.id)).toEqual([b.list.id, a.list.id]);

		board = removeList(board, a.list.id);
		expect(board.lists.map((l) => l.id)).toEqual([b.list.id]);
	});

	it('addListItem / addListItemChild add into the right list', () => {
		const { board, listId } = boardWithOneList();
		const first = addListItem(board, listId, null, 'first');
		const second = addListItem(first.board, listId, first.item!.id, 'second');
		expect(second.board.lists[0].items.map((i) => i.text)).toEqual(['first', 'second']);

		const child = addListItemChild(second.board, listId, first.item!.id, 'child');
		expect(childrenOf(child.board.lists[0].items, first.item!.id).map((i) => i.text)).toEqual(['child']);
	});

	it('updateListItemText / toggleListItemCollapsed / removeListItem', () => {
		const { board, listId } = boardWithOneList();
		const { board: withItem, item: created } = addListItem(board, listId, null, 'x');
		const id = created!.id;

		const renamed = updateListItemText(withItem, listId, id, 'renamed');
		expect(getItem(renamed.lists[0].items, id)?.text).toBe('renamed');

		const collapsed = toggleListItemCollapsed(renamed, listId, id);
		expect(getItem(collapsed.lists[0].items, id)?.collapsed).toBe(true);

		const removed = removeListItem(collapsed, listId, id);
		expect(removed.lists[0].items).toEqual([]);
	});

	it('indentListItem / outdentListItem operate within the named list', () => {
		const { board, listId } = boardWithOneList();
		const first = addListItem(board, listId, null, 'a');
		const second = addListItem(first.board, listId, first.item!.id, 'b');
		const indented = indentListItem(second.board, listId, second.item!.id);
		expect(childrenOf(indented.lists[0].items, first.item!.id).map((i) => i.id)).toEqual([second.item!.id]);

		const outdented = outdentListItem(indented, listId, second.item!.id);
		expect(outdented.lists[0].items.map((i) => i.id)).toEqual([first.item!.id, second.item!.id]);
	});

	it('moveListItemWithinSiblings reorders in place', () => {
		const { board, listId } = boardWithOneList();
		const a = addListItem(board, listId, null, 'a');
		const b = addListItem(a.board, listId, a.item!.id, 'b');
		const next = moveListItemWithinSiblings(b.board, listId, b.item!.id, -1);
		expect(next.lists[0].items.map((i) => i.text)).toEqual(['b', 'a']);
	});

	describe('moveListItemTo', () => {
		it('reorders within the same list', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			const next = moveListItemTo(b.board, listId, b.item!.id, listId, null, 0);
			expect(next.lists[0].items.map((i) => i.text)).toEqual(['b', 'a']);
		});

		it('moves an item, with its subtree, into a different list', () => {
			let board = emptyBoard();
			const doing = addList(board, 'doing');
			board = doing.board;
			const done = addList(board, 'done');
			board = done.board;

			const parent = addListItem(board, doing.list.id, null, 'parent');
			board = parent.board;
			const child = addListItemChild(board, doing.list.id, parent.item!.id, 'child');
			board = child.board;

			const moved = moveListItemTo(board, doing.list.id, parent.item!.id, done.list.id, null, 0);
			expect(moved.lists.find((l) => l.id === doing.list.id)?.items).toEqual([]);
			const landed = moved.lists.find((l) => l.id === done.list.id)?.items ?? [];
			expect(landed.map((i) => i.text)).toEqual(['parent']);
			expect(landed[0].children.map((i) => i.text)).toEqual(['child']);
		});

		it('refuses a move into a nonexistent list', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const next = moveListItemTo(a.board, listId, a.item!.id, 'no-such-list', null, 0);
			expect(next).toEqual(a.board);
		});

		it('refuses to nest an item under its own descendant across lists', () => {
			let board = emptyBoard();
			const src = addList(board, 'src');
			board = src.board;
			const dst = addList(board, 'dst');
			board = dst.board;
			const parent = addListItem(board, src.list.id, null, 'parent');
			board = parent.board;
			const child = addListItemChild(board, src.list.id, parent.item!.id, 'child');
			board = child.board;

			// Try to move "parent" to sit under its own child, now imagined as
			// living in dst — nonsensical, and must be refused rather than
			// silently dropping the subtree.
			const next = moveListItemTo(board, src.list.id, parent.item!.id, src.list.id, child.item!.id, 0);
			expect(next).toEqual(board);
		});
	});

	describe('dropZone', () => {
		const rect = { left: 100, top: 200, width: 300, height: 40 };

		it('is "nest" in the left 20% of the row, any vertical position', () => {
			expect(dropZone(rect, 100 + 10, 200 + 5)).toBe('nest');
			expect(dropZone(rect, 100 + 10, 200 + 35)).toBe('nest');
		});

		it('is "before" in the top half, right of the nest strip', () => {
			expect(dropZone(rect, 100 + 200, 200 + 10)).toBe('before');
		});

		it('is "after" in the bottom half, right of the nest strip', () => {
			expect(dropZone(rect, 100 + 200, 200 + 30)).toBe('after');
		});
	});

	describe('moveItemRelativeTo', () => {
		it('inserting "before" a later sibling in the same list lands exactly there, not one short', () => {
			// The regression this exists to pin: computing the target's index
			// from the pre-removal tree drops one position short whenever the
			// dragged item started out earlier than its target.
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			const c = addListItem(b.board, listId, b.item!.id, 'c');
			const next = moveItemRelativeTo(c.board, listId, a.item!.id, listId, c.item!.id, 'before');
			expect(next.lists[0].items.map((i) => i.text)).toEqual(['b', 'a', 'c']);
		});

		it('inserting "after" a later sibling lands right after it', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			const c = addListItem(b.board, listId, b.item!.id, 'c');
			const next = moveItemRelativeTo(c.board, listId, a.item!.id, listId, c.item!.id, 'after');
			expect(next.lists[0].items.map((i) => i.text)).toEqual(['b', 'c', 'a']);
		});

		it('inserting relative to an earlier sibling is unaffected by the shift', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			const c = addListItem(b.board, listId, b.item!.id, 'c');
			const next = moveItemRelativeTo(c.board, listId, c.item!.id, listId, a.item!.id, 'before');
			expect(next.lists[0].items.map((i) => i.text)).toEqual(['c', 'a', 'b']);
		});

		it('"nest" makes the dragged item the target\'s last child', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			const next = moveItemRelativeTo(b.board, listId, b.item!.id, listId, a.item!.id, 'nest');
			expect(next.lists[0].items.map((i) => i.id)).toEqual([a.item!.id]);
			expect(childrenOf(next.lists[0].items, a.item!.id).map((i) => i.id)).toEqual([b.item!.id]);
		});

		it('moves across lists, landing at the target\'s position', () => {
			let board = emptyBoard();
			const src = addList(board, 'src');
			board = src.board;
			const dst = addList(board, 'dst');
			board = dst.board;
			const dragged = addListItem(board, src.list.id, null, 'dragged');
			board = dragged.board;
			const x = addListItem(board, dst.list.id, null, 'x');
			board = x.board;
			const y = addListItem(board, dst.list.id, x.item!.id, 'y');
			board = y.board;

			const next = moveItemRelativeTo(board, src.list.id, dragged.item!.id, dst.list.id, y.item!.id, 'before');
			expect(next.lists.find((l) => l.id === src.list.id)?.items).toEqual([]);
			expect(next.lists.find((l) => l.id === dst.list.id)?.items.map((i) => i.text)).toEqual([
				'x',
				'dragged',
				'y'
			]);
		});

		it('refuses to drop an item onto itself', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			expect(moveItemRelativeTo(a.board, listId, a.item!.id, listId, a.item!.id, 'before')).toEqual(a.board);
		});

		it('refuses to nest an item under its own descendant', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItemChild(a.board, listId, a.item!.id, 'b');
			expect(moveItemRelativeTo(b.board, listId, a.item!.id, listId, b.item!.id, 'nest')).toEqual(b.board);
		});

		it('refuses to reorder relative to its own descendant, which the removal makes vanish', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItemChild(a.board, listId, a.item!.id, 'b');
			expect(moveItemRelativeTo(b.board, listId, a.item!.id, listId, b.item!.id, 'after')).toEqual(b.board);
		});

		it('refuses a target list that does not exist', () => {
			const { board, listId } = boardWithOneList();
			const a = addListItem(board, listId, null, 'a');
			const b = addListItem(a.board, listId, a.item!.id, 'b');
			expect(
				moveItemRelativeTo(b.board, listId, a.item!.id, 'no-such-list', b.item!.id, 'before')
			).toEqual(b.board);
		});
	});

	describe('flatten', () => {
		const tree: LiquidItem[] = [
			item('a', [item('a1'), item('a2')]),
			item('b')
		];

		it('walks in document order, depth-first', () => {
			expect(flatten(tree)).toEqual([
				{ id: 'a', depth: 0 },
				{ id: 'a1', depth: 1 },
				{ id: 'a2', depth: 1 },
				{ id: 'b', depth: 0 }
			]);
		});

		it('skips a collapsed subtree by default', () => {
			const collapsed = [{ ...tree[0], collapsed: true }, tree[1]];
			expect(flatten(collapsed).map((n) => n.id)).toEqual(['a', 'b']);
		});

		it('walks the whole tree when told not to respect collapse', () => {
			const collapsed = [{ ...tree[0], collapsed: true }, tree[1]];
			expect(flatten(collapsed, false).map((n) => n.id)).toEqual(['a', 'a1', 'a2', 'b']);
		});

		it('is empty for an empty tree', () => {
			expect(flatten([])).toEqual([]);
		});
	});

	it('itemCount counts every node, subtrees included, across every list', () => {
		let board = emptyBoard();
		const a = addList(board, 'a');
		board = a.board;
		const b = addList(board, 'b');
		board = b.board;

		const p = addListItem(board, a.list.id, null, 'p');
		board = p.board;
		const c1 = addListItemChild(board, a.list.id, p.item!.id, 'c1');
		board = c1.board;
		const c2 = addListItemChild(board, a.list.id, p.item!.id, 'c2');
		board = c2.board;
		const q = addListItem(board, b.list.id, null, 'q');
		board = q.board;

		expect(itemCount(board)).toBe(4);
		expect(itemCount(emptyBoard())).toBe(0);
	});
});
