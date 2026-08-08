export interface SanitizeOptions {
	/** Upper-case tag names to keep. Defaults to ALLOWED_TAGS. */
	allowedTags?: readonly string[];
	/** Upper-case tag names replaced by their children. Defaults to UNWRAP_TAGS. */
	unwrapTags?: readonly string[];
	/** Lower-case attribute names to preserve, e.g. `data-anchor`. */
	keepAttributes?: readonly string[];
}

export const ANCHOR_BLOCK_SELECTOR: string;
export const ALLOWED_TAGS: readonly string[];
export const UNWRAP_TAGS: readonly string[];
export const SAFE_HREF_PROTOCOL: RegExp;

export function sanitizeHtml(html: string, options?: SanitizeOptions): string;
export function stripPresentation(html: string): string;
export function ensureAnchorsOn(blocks: ArrayLike<Element>, prefix?: string): void;
export function stampAnchorsHtml(html: string, selector?: string, prefix?: string): string;
export function isEmptyHtml(html: string): boolean;

export interface ProseReference {
	app: string;
	kind: string;
	id: string;
	text: string;
}

export const REFERENCE_ATTRIBUTES: readonly string[];
export const REFERENCE_SANITIZE_OPTIONS: SanitizeOptions;
export function referenceHtml(ref: ProseReference & { href?: string }): string;
export function readReferences(html: string): ProseReference[];
export function stripTags(html: string): string;
export function htmlToText(html: string): string;
export function countWords(html: string): number;
export function countWordsInText(text: string): number;
export function previewText(html: string, max?: number): string;
