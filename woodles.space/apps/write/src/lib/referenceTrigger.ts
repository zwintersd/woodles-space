// Deciding whether `#` or `@` in the prose means "open the picker".
//
// Kept pure and away from the DOM so the fiddly part — what counts as a
// trigger — is testable without a browser. The insertion half lives below in
// `insertReferenceAtCaret`, which is the only piece that touches a range.

import { referenceHtml } from '@woodles/text';
import type { ReferenceCandidate, Sigil } from './references.svelte';

export type ReferenceTrigger = {
	sigil: Sigil;
	query: string;
	/** How many characters before the caret the trigger occupies, sigil included. */
	length: number;
};

/**
 * The longest query a trigger will carry. Past this, somebody is writing a
 * sentence that happens to contain a `#`, not naming a thing.
 */
const MAX_QUERY = 40;

/**
 * Read a trigger out of the text immediately before the caret.
 *
 * A sigil only counts at a word boundary — start of line, or after whitespace.
 * That single rule is what keeps an email address from opening a day picker
 * and `C#` from opening a shelf, without any special-casing.
 *
 * Spaces are allowed inside the query so a title like "The Left Hand" is
 * reachable; the picker closes itself when nothing matches, which is what
 * makes that safe. "#1 priority" queries "1 priority", matches nothing, and
 * shows no picker.
 */
export function readTrigger(textBeforeCaret: string): ReferenceTrigger | null {
	for (let i = textBeforeCaret.length - 1; i >= 0; i -= 1) {
		const char = textBeforeCaret[i];
		if (char === '\n') return null;

		if (char === '#' || char === '@') {
			const before = i === 0 ? '' : textBeforeCaret[i - 1];
			// A boundary, or it isn't a trigger at all.
			if (before !== '' && !/\s/.test(before)) return null;
			const query = textBeforeCaret.slice(i + 1);
			if (query.length > MAX_QUERY) return null;
			return { sigil: char as Sigil, query, length: query.length + 1 };
		}

		// Give up once the run gets long enough that no sigil could still be
		// the start of a query.
		if (textBeforeCaret.length - i > MAX_QUERY + 1) return null;
	}
	return null;
}

/**
 * Replace the trigger text before the caret with a stored reference.
 *
 * Returns false when there is no usable selection, so a caller can leave the
 * document alone rather than guessing where the words should go.
 */
export function insertReferenceAtCaret(
	candidate: ReferenceCandidate,
	trigger: ReferenceTrigger,
	href: string | null
): boolean {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return false;

	const range = selection.getRangeAt(0);
	const node = range.startContainer;
	if (node.nodeType !== Node.TEXT_NODE) return false;

	const offset = range.startOffset;
	if (offset < trigger.length) return false;

	// Cut the `#query` the person typed, then put the reference in its place.
	const cut = document.createRange();
	cut.setStart(node, offset - trigger.length);
	cut.setEnd(node, offset);
	cut.deleteContents();

	const holder = document.createElement('div');
	holder.innerHTML = referenceHtml({
		app: candidate.app,
		kind: candidate.kind,
		id: candidate.id,
		text: candidate.text,
		...(href ? { href } : {})
	});
	const element = holder.firstElementChild;
	if (!element) return false;

	// A trailing space, so the caret lands in ordinary prose rather than inside
	// the reference where the next keystroke would extend its text.
	const spacer = document.createTextNode(' ');
	cut.insertNode(spacer);
	cut.insertNode(element);

	const after = document.createRange();
	after.setStartAfter(spacer);
	after.collapse(true);
	selection.removeAllRanges();
	selection.addRange(after);
	return true;
}

/** The text of the current text node up to the caret, or null. */
export function textBeforeCaret(): string | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
	const range = selection.getRangeAt(0);
	if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
	return (range.startContainer.textContent ?? '').slice(0, range.startOffset);
}

/** Where to float the picker — the caret's own rectangle. */
export function caretRect(): { x: number; y: number } | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	const rect = selection.getRangeAt(0).getBoundingClientRect();
	if (rect.x === 0 && rect.y === 0) return null;
	return { x: rect.x, y: rect.bottom + 6 };
}
