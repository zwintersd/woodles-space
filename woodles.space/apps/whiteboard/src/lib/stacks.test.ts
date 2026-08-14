import { describe, expect, it } from 'vitest';
import {
	behaviorOf,
	checklistProgress,
	queueHeads,
	renameStack,
	setStackBehavior,
	shiftCardColumn,
	stackBeside,
	statusColumns,
	takeFromQueue,
	toggleChecked
} from './stacks';
import {
	extractCardFromStack,
	galleryColumns,
	insertCardIntoStack,
	removeItems,
	repairDocument,
	stackCardBounds,
	stackContentHeight,
	stackCards
} from './geometry';
import { isDone, setItemProperty, statusOf } from './properties';
import { createCard, createEmptyBoard, createStack, type StackItem, type WhiteboardDocument } from './model';

function stack(id: string, title: string, x = 0, y = 0): StackItem {
	return { ...createStack(x, y), id, title };
}

function board(): WhiteboardDocument {
	return {
		...createEmptyBoard(),
		items: [
			{ ...createCard(0, 0), id: 'one', title: 'Brush pickup' },
			{ ...createCard(0, 200), id: 'two', title: 'Foundation' },
			{ ...createCard(0, 400), id: 'three', title: 'Setting spray' },
			stack('ideas', 'IDEA', 0, 0),
			stack('building', 'BUILDING', 400, 0)
		]
	};
}

function withCards(document: WhiteboardDocument, stackId: string, cardIds: string[]): WhiteboardDocument {
	return cardIds.reduce((next, cardId) => insertCardIntoStack(next, cardId, stackId), document);
}

describe('a stack earns its behaviour', () => {
	it('is plain until told otherwise, and carries no behaviour field', () => {
		const plain = createStack(0, 0);
		expect(plain.behavior).toBeUndefined();
		expect(behaviorOf(plain)).toBe('plain');
	});

	it('drops the field again when set back to plain', () => {
		let document = setStackBehavior(board(), 'ideas', 'queue');
		expect(document.items.find((item) => item.id === 'ideas')).toMatchObject({ behavior: 'queue' });
		document = setStackBehavior(document, 'ideas', 'plain');
		expect(document.items.find((item) => item.id === 'ideas')).not.toHaveProperty('behavior');
	});
});

describe('status stacks', () => {
	it('confers its title on a card dragged into it', () => {
		let document = setStackBehavior(board(), 'ideas', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('IDEA');
	});

	it('changes the status when the card moves to the next stack along', () => {
		let document = setStackBehavior(setStackBehavior(board(), 'ideas', 'status'), 'building', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		document = insertCardIntoStack(document, 'one', 'building');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('BUILDING');
		expect(stackCards(document.items, document.items.find((item): item is StackItem => item.id === 'ideas')!)).toEqual([]);
	});

	it('catches up cards already inside when a stack becomes a status stack', () => {
		let document = withCards(board(), 'ideas', ['one', 'two']);
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBeNull();
		document = setStackBehavior(document, 'ideas', 'status');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('IDEA');
		expect(statusOf(document.items.find((item) => item.id === 'two')!)).toBe('IDEA');
	});

	it('renames the status of everything inside when the stack is renamed', () => {
		let document = setStackBehavior(board(), 'ideas', 'status');
		document = withCards(document, 'ideas', ['one', 'two']);
		document = renameStack(document, 'ideas', 'MAYBE');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('MAYBE');
		expect(statusOf(document.items.find((item) => item.id === 'two')!)).toBe('MAYBE');
	});

	it('lets a card keep what it was told when it leaves', () => {
		let document = setStackBehavior(board(), 'ideas', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		document = extractCardFromStack(document, 'one', { x: 900, y: 900 });
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('IDEA');
	});

	it('says nothing when the stack has no name to confer', () => {
		let document = setStackBehavior(renameStack(board(), 'ideas', '   '), 'ideas', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBeNull();
	});

	it('leaves a plain stack out of it entirely', () => {
		const document = insertCardIntoStack(board(), 'one', 'ideas');
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBeNull();
	});

	it('sets the record straight whenever the board is repaired', () => {
		let document = setStackBehavior(board(), 'ideas', 'status');
		document = withCards(document, 'ideas', ['one']);
		// Something wrote a status that disagrees with where the card sits.
		document = setItemProperty(document, 'one', 'status', 'nonsense');
		expect(statusOf(repairDocument(document).items.find((item) => item.id === 'one')!)).toBe('IDEA');
	});
});

describe('kanban, as four stacks side by side', () => {
	it('reads status stacks left to right, as they sit on the board', () => {
		let document = setStackBehavior(setStackBehavior(board(), 'building', 'status'), 'ideas', 'status');
		expect(statusColumns(document.items).map((column) => column.title)).toEqual(['IDEA', 'BUILDING']);
	});

	it('puts a sibling stack down beside this one, not on top of it', () => {
		const document = stackBeside(setStackBehavior(board(), 'ideas', 'status'), 'ideas', 'WORKS');
		const made = document.items.find((item): item is StackItem => item.type === 'stack' && item.title === 'WORKS')!;
		const origin = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		expect(made.x).toBeGreaterThan(origin.x + origin.width - 1);
		expect(made.y).toBe(origin.y);
		expect(made.behavior).toBe('status');
		expect(made.cardIds).toEqual([]);
	});

	it('moves a card to the next column along, and its status with it', () => {
		let document = setStackBehavior(setStackBehavior(board(), 'ideas', 'status'), 'building', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		document = shiftCardColumn(document, 'one', 1);
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('BUILDING');
		document = shiftCardColumn(document, 'one', -1);
		expect(statusOf(document.items.find((item) => item.id === 'one')!)).toBe('IDEA');
	});

	it('stays put at either end of the row', () => {
		let document = setStackBehavior(setStackBehavior(board(), 'ideas', 'status'), 'building', 'status');
		document = insertCardIntoStack(document, 'one', 'ideas');
		expect(shiftCardColumn(document, 'one', -1)).toBe(document);
		expect(shiftCardColumn(document, 'nowhere', 1)).toBe(document);
	});

	it('has nowhere to shift a card that is not in a stack at all', () => {
		const document = setStackBehavior(board(), 'ideas', 'status');
		expect(shiftCardColumn(document, 'one', 1)).toBe(document);
	});
});

describe('checklist stacks', () => {
	it('ticks a card off and back on', () => {
		let document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two']), 'ideas', 'checklist');
		document = toggleChecked(document, 'one');
		expect(isDone(document.items.find((item) => item.id === 'one')!)).toBe(true);
		document = toggleChecked(document, 'one');
		expect(isDone(document.items.find((item) => item.id === 'one')!)).toBe(false);
		// Unticking leaves nothing behind, the same as never having ticked.
		expect(document.items.find((item) => item.id === 'one')!.properties).toBeUndefined();
	});

	it('keeps the count', () => {
		let document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two', 'three']), 'ideas', 'checklist');
		document = toggleChecked(document, 'two');
		const list = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		expect(checklistProgress(document.items, list)).toEqual({ done: 1, total: 3 });
	});

	it('agrees with a card that simply says it is done', () => {
		let document = setStackBehavior(withCards(board(), 'ideas', ['one']), 'ideas', 'checklist');
		document = setItemProperty(document, 'one', 'status', 'Done');
		const list = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		expect(checklistProgress(document.items, list)).toEqual({ done: 1, total: 1 });
	});
});

describe('queue stacks', () => {
	it('names what is current and what is next', () => {
		const document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two', 'three']), 'ideas', 'queue');
		const queue = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		const heads = queueHeads(document.items, queue);
		expect(heads.now?.id).toBe('one');
		expect(heads.next?.id).toBe('two');
	});

	it('has no heads when the queue is empty', () => {
		const document = setStackBehavior(board(), 'ideas', 'queue');
		const queue = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		expect(queueHeads(document.items, queue)).toEqual({ now: null, next: null });
	});

	it('sets the taken card down beside the stack, so it is still somewhere', () => {
		let document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two']), 'ideas', 'queue');
		document = takeFromQueue(document, 'ideas');
		const taken = document.items.find((item) => item.id === 'one')!;
		const queue = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		expect(taken.type === 'card' && taken.stackId).toBeUndefined();
		expect(taken.x).toBeGreaterThan(queue.x + queue.width - 1);
		expect(queue.cardIds).toEqual(['two']);
		expect(queueHeads(document.items, queue).now?.id).toBe('two');
	});

	it('has nothing to take from an empty queue', () => {
		const document = setStackBehavior(board(), 'ideas', 'queue');
		expect(takeFromQueue(document, 'ideas')).toBe(document);
	});
});

describe('gallery stacks', () => {
	it('lays cards across and then down instead of in a column', () => {
		const document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two', 'three']), 'ideas', 'gallery');
		const gallery = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		const [first, second, third] = ['one', 'two', 'three'].map((id) =>
			stackCardBounds(document.items, gallery, document.items.find((item) => item.id === id) as never)
		);
		expect(galleryColumns(gallery)).toBe(2);
		expect(second.y).toBe(first.y);
		expect(second.x).toBeGreaterThan(first.x);
		expect(third.y).toBeGreaterThan(first.y);
		expect(third.x).toBe(first.x);
	});

	it('keeps its tiles inside the stack it belongs to', () => {
		const document = setStackBehavior(withCards(board(), 'ideas', ['one', 'two']), 'ideas', 'gallery');
		const gallery = document.items.find((item): item is StackItem => item.id === 'ideas')!;
		for (const id of ['one', 'two']) {
			const box = stackCardBounds(document.items, gallery, document.items.find((item) => item.id === id) as never);
			expect(box.x).toBeGreaterThanOrEqual(gallery.x);
			expect(box.x + box.width).toBeLessThanOrEqual(gallery.x + gallery.width + 0.001);
		}
	});

	it('grows by rows rather than by cards', () => {
		const three = setStackBehavior(withCards(board(), 'ideas', ['one', 'two', 'three']), 'ideas', 'gallery');
		const two = setStackBehavior(withCards(board(), 'ideas', ['one', 'two']), 'ideas', 'gallery');
		const galleryOf = (document: WhiteboardDocument) =>
			document.items.find((item): item is StackItem => item.id === 'ideas')!;
		// Two tiles share a row; the third opens a second one.
		expect(stackContentHeight(two.items, galleryOf(two))).toBeLessThanOrEqual(stackContentHeight(three.items, galleryOf(three)));
	});
});

describe('behaviour survives the board changing under it', () => {
	it('keeps a stack behaviour through a save and a repair', () => {
		const document = repairDocument(setStackBehavior(board(), 'ideas', 'queue'));
		expect(document.items.find((item) => item.id === 'ideas')).toMatchObject({ behavior: 'queue' });
	});

	it('loses nothing but the stack when a status stack is deleted', () => {
		let document = setStackBehavior(board(), 'ideas', 'status');
		document = withCards(document, 'ideas', ['one']);
		document = removeItems(document, new Set(['ideas']));
		const card = document.items.find((item) => item.id === 'one')!;
		expect(card).toBeDefined();
		expect(statusOf(card)).toBe('IDEA');
	});
});
