import { conferStackStatuses, extractCardFromStack, stackCards, STACK_GAP } from './geometry';
import { isDone, setProperty } from './properties';
import {
	DONE,
	makeId,
	now,
	type CardItem,
	type StackBehavior,
	type StackItem,
	type WhiteboardDocument,
	type WhiteboardItem
} from './model';

export const BEHAVIOR_NOTES: Record<StackBehavior, string> = {
	plain: 'Cards in the order you put them.',
	status: 'Cards inside wear this stack’s name. Drag one in and its status changes with it.',
	checklist: 'Cards can be ticked off. The header keeps the count.',
	queue: 'The top card is what you are on; the one under it is next.',
	gallery: 'Cards lie out as tiles rather than a column.'
};

export function behaviorOf(stack: StackItem): StackBehavior {
	return stack.behavior ?? 'plain';
}

export function isStack(item: WhiteboardItem | undefined | null): item is StackItem {
	return Boolean(item && item.type === 'stack');
}

/**
 * Gives a stack a behaviour, or takes it back to plain. Changing to Status
 * confers this stack's title on everything already inside it, so a stack that
 * becomes a column of a board does not need its cards re-dropped to catch up.
 */
export function setStackBehavior(document: WhiteboardDocument, stackId: string, behavior: StackBehavior): WhiteboardDocument {
	const items = document.items.map((item) => {
		if (item.id !== stackId || item.type !== 'stack') return item;
		if (behavior === 'plain') {
			const { behavior: _plain, ...rest } = item;
			return { ...rest, updatedAt: now() } as WhiteboardItem;
		}
		return { ...item, behavior, updatedAt: now() } as WhiteboardItem;
	}) as WhiteboardItem[];
	return { ...document, items: conferStackStatuses(items) };
}

/**
 * Renaming a Status stack renames the status of every card in it. The stack's
 * title *is* the vocabulary, so the two cannot drift apart.
 */
export function renameStack(document: WhiteboardDocument, stackId: string, title: string): WhiteboardDocument {
	const items = document.items.map((item) =>
		item.id === stackId && item.type === 'stack' ? ({ ...item, title, updatedAt: now() } as WhiteboardItem) : item
	) as WhiteboardItem[];
	return { ...document, items: conferStackStatuses(items) };
}

export function toggleChecked(document: WhiteboardDocument, cardId: string): WhiteboardDocument {
	const items = document.items.map((item) => {
		if (item.id !== cardId || item.type !== 'card') return item;
		return setProperty(item, 'status', isDone(item) ? null : DONE);
	}) as WhiteboardItem[];
	return { ...document, items };
}

export type ChecklistProgress = { done: number; total: number };

export function checklistProgress(items: WhiteboardItem[], stack: StackItem): ChecklistProgress {
	const cards = stackCards(items, stack);
	return { done: cards.filter(isDone).length, total: cards.length };
}

/** What a queue is on, and what it is on next. Either may be absent. */
export function queueHeads(items: WhiteboardItem[], stack: StackItem): { now: CardItem | null; next: CardItem | null } {
	const cards = stackCards(items, stack);
	return { now: cards[0] ?? null, next: cards[1] ?? null };
}

/**
 * Takes the top card out of a queue and sets it down beside the stack, at the
 * height of the stack's head. Picking up the current thing is a move across the
 * board, not a state change in a list — the card is somewhere afterwards.
 */
export function takeFromQueue(document: WhiteboardDocument, stackId: string): WhiteboardDocument {
	const stack = document.items.find((item): item is StackItem => item.id === stackId && item.type === 'stack');
	if (!stack) return document;
	const top = stackCards(document.items, stack)[0];
	if (!top) return document;
	return extractCardFromStack(document, top.id, { x: stack.x + stack.width + STACK_GAP * 2, y: stack.y });
}

/**
 * A second Status stack, the same size, set down to the right of this one.
 * Four of these beside each other is the whole of Kanban — no board object is
 * created, and nothing about the space changes.
 */
export function stackBeside(document: WhiteboardDocument, stackId: string, title: string): WhiteboardDocument {
	const stack = document.items.find((item): item is StackItem => item.id === stackId && item.type === 'stack');
	if (!stack) return document;
	const stamp = now();
	const sibling: StackItem = {
		...stack,
		id: makeId('stack'),
		title,
		cardIds: [],
		x: stack.x + stack.width + STACK_GAP * 2,
		y: stack.y,
		createdAt: stamp,
		updatedAt: stamp
	};
	return { ...document, items: [...document.items, sibling] };
}

/** Status stacks in reading order across the board — the columns, as they sit. */
export function statusColumns(items: WhiteboardItem[]): StackItem[] {
	return items
		.filter((item): item is StackItem => item.type === 'stack' && item.behavior === 'status')
		.sort((a, b) => a.x - b.x || a.y - b.y);
}

/**
 * Moves a card to the next or previous Status stack along. The board already
 * says which column comes after which by where the stacks sit, so this is the
 * keyboard saying the same thing as the drag.
 */
export function shiftCardColumn(document: WhiteboardDocument, cardId: string, direction: -1 | 1): WhiteboardDocument {
	const card = document.items.find((item): item is CardItem => item.id === cardId && item.type === 'card');
	if (!card?.stackId) return document;
	const columns = statusColumns(document.items);
	const at = columns.findIndex((column) => column.id === card.stackId);
	const target = columns[at + direction];
	if (at === -1 || !target) return document;

	const items = document.items.map((item) => {
		if (item.type === 'stack') {
			const without = item.cardIds.filter((id) => id !== cardId);
			return item.id === target.id ? { ...item, cardIds: [...without, cardId] } : { ...item, cardIds: without };
		}
		if (item.id === cardId && item.type === 'card') return { ...item, stackId: target.id };
		return item;
	}) as WhiteboardItem[];
	return { ...document, items: conferStackStatuses(items) };
}
