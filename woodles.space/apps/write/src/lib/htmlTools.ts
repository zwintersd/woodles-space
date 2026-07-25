// Write's text/HTML layer. The mechanics now live in `@woodles/text`, which was
// extracted once three apps had converged on the same contract — see
// REFACTORING.md. This file is the seam, kept so Write's own imports don't all
// have to move at once.
//
// Write takes the package defaults, including stripping `data-anchor`: anchors
// here are re-stamped after a sanitize rather than carried through it, which is
// the opposite of Marginalia's passage sanitizer. That difference is exactly
// why the package takes options instead of hard-coding one policy.
export {
	ANCHOR_BLOCK_SELECTOR,
	countWords,
	ensureAnchorsOn,
	isEmptyHtml,
	previewText,
	sanitizeHtml,
	stampAnchorsHtml,
	stripTags
} from '@woodles/text';
