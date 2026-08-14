import { describe, expect, it } from 'vitest';
import {
	attachLabel,
	deleteLabel,
	detachLabel,
	ensureLabel,
	findLabel,
	labelCount,
	labelItems,
	labelsOn,
	mergeLabels,
	nextTint,
	renameLabel,
	retintLabel,
	suggestLabels,
	toggleLabel
} from './labels';
import { createCard, createEmptyBoard, createFrame, TINTS, type WhiteboardDocument } from './model';

function board(): WhiteboardDocument {
	return {
		...createEmptyBoard(),
		items: [
			{ ...createCard(0, 0), id: 'physics-card', title: 'Brush pickup physics' },
			{ ...createCard(300, 0), id: 'second-card', title: 'Foundation blending' },
			{ ...createFrame(0, 0, 900, 600), id: 'brushes-frame', title: 'Brushes' }
		]
	};
}

describe('naming a label', () => {
	it('makes a label once and finds it again whatever case it is typed in', () => {
		const first = ensureLabel(board(), 'Physics')!;
		expect(first.label.name).toBe('Physics');
		const second = ensureLabel(first.document, 'physics')!;
		expect(second.label.id).toBe(first.label.id);
		expect(second.document.labels).toHaveLength(1);
	});

	it('reads a typed hash as part of the gesture, not part of the name', () => {
		const made = ensureLabel(board(), '#physics')!;
		expect(made.label.name).toBe('physics');
		expect(findLabel(made.document, 'physics')?.id).toBe(made.label.id);
	});

	it('will not make a label out of nothing', () => {
		expect(ensureLabel(board(), '   ')).toBeNull();
		expect(ensureLabel(board(), '#')).toBeNull();
	});

	it('hands out the least-used colour so a board of labels stays legible', () => {
		let document = board();
		const seen = new Set<string>();
		for (let index = 0; index < TINTS.length; index += 1) {
			const tint = nextTint(document);
			expect(seen.has(tint)).toBe(false);
			seen.add(tint);
			document = ensureLabel(document, `label ${index}`, tint)!.document;
		}
	});
});

describe('wearing a label', () => {
	it('labels several objects at once, making the label if it is new', () => {
		const document = labelItems(board(), ['physics-card', 'brushes-frame'], 'physics');
		expect(document.labels).toHaveLength(1);
		expect(labelsOn(document, document.items[0]).map((label) => label.name)).toEqual(['physics']);
		expect(labelCount(document, document.labels[0].id)).toBe(2);
	});

	it('leaves an object with no property sheet at all once its last label goes', () => {
		let document = labelItems(board(), ['physics-card'], 'physics');
		expect(document.items[0].properties).toBeDefined();
		document = detachLabel(document, 'physics-card', document.labels[0].id);
		expect(document.items[0].properties).toBeUndefined();
	});

	it('does not wear the same label twice', () => {
		let document = labelItems(board(), ['physics-card'], 'physics');
		const labelId = document.labels[0].id;
		document = attachLabel(document, 'physics-card', labelId);
		expect(document.items[0].properties?.labelIds).toEqual([labelId]);
	});

	it('toggles a label on and back off', () => {
		let document = ensureLabel(board(), 'physics')!.document;
		const labelId = document.labels[0].id;
		document = toggleLabel(document, 'physics-card', labelId);
		expect(labelCount(document, labelId)).toBe(1);
		document = toggleLabel(document, 'physics-card', labelId);
		expect(labelCount(document, labelId)).toBe(0);
	});

	it('refuses to attach a label the board does not have', () => {
		const document = board();
		expect(attachLabel(document, 'physics-card', 'label-nowhere').items[0].properties).toBeUndefined();
	});

	it('lists an object labels in the board order, not the order they were added', () => {
		let document = labelItems(board(), [], 'first');
		document = labelItems(document, [], 'second');
		const [first, second] = document.labels;
		document = attachLabel(document, 'physics-card', second.id);
		document = attachLabel(document, 'physics-card', first.id);
		expect(labelsOn(document, document.items[0]).map((label) => label.name)).toEqual(['first', 'second']);
	});
});

describe('tending the labels', () => {
	it('renames a label once, everywhere it is worn', () => {
		let document = labelItems(board(), ['physics-card', 'brushes-frame'], 'physcis');
		document = renameLabel(document, document.labels[0].id, 'physics');
		expect(document.labels[0].name).toBe('physics');
		expect(labelCount(document, document.labels[0].id)).toBe(2);
	});

	it('folds two labels into one when a rename would make them read the same', () => {
		let document = labelItems(board(), ['physics-card'], 'physics');
		document = labelItems(document, ['second-card'], 'fysics');
		const [physics, fysics] = document.labels;
		document = renameLabel(document, fysics.id, 'Physics');

		expect(document.labels).toHaveLength(1);
		expect(labelCount(document, physics.id)).toBe(2);
	});

	it('carries everything across when two labels are merged by hand', () => {
		let document = labelItems(board(), ['physics-card'], 'keep');
		document = labelItems(document, ['second-card', 'brushes-frame'], 'fold');
		const [keep, fold] = document.labels;
		document = mergeLabels(document, fold.id, keep.id);
		expect(document.labels.map((label) => label.name)).toEqual(['keep']);
		expect(labelCount(document, keep.id)).toBe(3);
	});

	it('takes a deleted label off everything wearing it', () => {
		let document = labelItems(board(), ['physics-card', 'brushes-frame'], 'physics');
		document = deleteLabel(document, document.labels[0].id);
		expect(document.labels).toEqual([]);
		expect(document.items.every((item) => item.properties === undefined)).toBe(true);
	});

	it('recolours a label without disturbing who wears it', () => {
		let document = labelItems(board(), ['physics-card'], 'physics');
		const labelId = document.labels[0].id;
		document = retintLabel(document, labelId, 'sage');
		expect(document.labels[0].tint).toBe('sage');
		expect(labelCount(document, labelId)).toBe(1);
	});

	it('leaves a rename to nothing alone', () => {
		const document = labelItems(board(), ['physics-card'], 'physics');
		expect(renameLabel(document, document.labels[0].id, '  ')).toBe(document);
	});
});

describe('suggesting a label', () => {
	it('offers the most-worn labels first when nothing has been typed', () => {
		let document = labelItems(board(), ['physics-card', 'brushes-frame'], 'common');
		document = labelItems(document, ['second-card'], 'rare');
		expect(suggestLabels(document, null, '').map((label) => label.name)).toEqual(['common', 'rare']);
	});

	it('puts labels that start with what was typed above ones that merely contain it', () => {
		let document = labelItems(board(), [], 'brush pickup');
		document = labelItems(document, [], 'dry brush');
		expect(suggestLabels(document, null, 'brush').map((label) => label.name)).toEqual(['brush pickup', 'dry brush']);
	});

	it('leaves out labels the object already wears', () => {
		const document = labelItems(board(), ['physics-card'], 'physics');
		const card = document.items.find((item) => item.id === 'physics-card')!;
		expect(suggestLabels(document, card, '')).toEqual([]);
		expect(suggestLabels(document, null, '')).toHaveLength(1);
	});
});
