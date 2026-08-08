// Write's text/HTML layer. The mechanics now live in `@woodles/text`, which was
// extracted once three apps had converged on the same contract — see
// REFACTORING.md. This file is the seam, kept so Write's own imports don't all
// have to move at once.
//
// Write takes the package defaults, including stripping `data-anchor`: anchors
// here are re-stamped after a sanitize rather than carried through it, which is
// the opposite of Marginalia's passage sanitizer. That difference is exactly
// why the package takes options instead of hard-coding one policy.
//
// It also binds one option for the whole app: Write is a surface that *stores*
// references (`#` a thing you're thinking about, `@` a day), so its sanitize
// keeps `data-ref-*` where the package default drops them. Bound here rather
// than passed at each of the dozen call sites, because a single one forgetting
// would silently eat a reference on save — and a reference that survives
// everywhere is the property the feature rests on.
import { sanitizeHtml as sanitize, REFERENCE_SANITIZE_OPTIONS } from '@woodles/text';

export {
	ANCHOR_BLOCK_SELECTOR,
	countWords,
	ensureAnchorsOn,
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
