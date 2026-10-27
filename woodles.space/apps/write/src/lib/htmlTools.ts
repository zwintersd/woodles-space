// Write's text/HTML layer. The mechanics now live in `@woodles/text`, which was
// extracted once three apps had converged on the same contract — see
// REFACTORING.md. This file is the seam, kept so Write's own imports don't all
// have to move at once.
//
// Write binds one option for the whole app: Write is a surface that *stores*
// references (`#` a thing you're thinking about, `@` a day), so its sanitize
// keeps `data-ref-*` where the package default drops them. Bound here rather
// than passed at each of the dozen call sites, because a single one forgetting
// would silently eat a reference on save — and a reference that survives
// everywhere is the property the feature rests on.
//
// `data-anchor` is the one attribute whose policy depends on where the HTML
// came from. Paste, imports and model output drop it, so foreign markup can't
// claim a block a margin note points at. A draft's own stored layers keep it:
// margin notes are matched by those ids, and re-stamping on load renumbers in
// document order, which moves a note onto whatever paragraph now sits where
// its own used to.
import { sanitizeHtml as sanitize, REFERENCE_ATTRIBUTES, REFERENCE_SANITIZE_OPTIONS } from '@woodles/text';

export {
	ANCHOR_BLOCK_SELECTOR,
	countWords,
	ensureAnchorsOn,
	htmlToText,
	isEmptyHtml,
	previewText,
	readReferences,
	referenceHtml,
	stampAnchorsHtml,
	stripTags
} from '@woodles/text';

/** Write's sanitize: package defaults, plus references survive. */
export function sanitizeHtml(html: string, options = REFERENCE_SANITIZE_OPTIONS): string {
	return sanitize(html, options);
}

/** For layers Write stored itself — never for paste. */
export const STORED_SANITIZE_OPTIONS = Object.freeze({
	keepAttributes: Object.freeze([...REFERENCE_ATTRIBUTES, 'data-anchor'])
});

/** Write's sanitize for its own stored layers: references and anchors survive. */
export function sanitizeStoredHtml(html: string): string {
	return sanitize(html, STORED_SANITIZE_OPTIONS);
}
