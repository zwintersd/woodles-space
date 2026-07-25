import type { Spore } from './types';

/**
 * `[[Wikilinks]]` in a spore body.
 *
 * The Ologypedia Textbook stored links as `<a class="entry-link" data-entry>`
 * inside sanitized HTML. A spore body is plain text, so the port uses the
 * bracket syntax instead — which is what the Textbook's own "draft it with a
 * prompt" already asked models to emit, so the authoring format and the
 * storage format finally agree.
 *
 * Keeping it plain text also means rendering never needs `innerHTML`: a body
 * becomes a list of text and link segments the component renders directly, and
 * there is no sanitizer to get wrong.
 *
 * Links resolve by **title**, case- and space-insensitively, because that is
 * what you actually type. A link with no matching spore is not an error — it
 * is a red link, an invitation to create one (CONVERGENCE.md §2B).
 */

const WIKILINK = /\[\[([^\]|[]+)(?:\|([^\][]*))?\]\]/g;

export type Wikilink = {
	/** The spore title being linked to, trimmed. */
	target: string;
	/** What to show. Defaults to the target when no `|alias` was given. */
	display: string;
	/** Offsets of the whole `[[…]]` in the source body. */
	start: number;
	end: number;
};

export type Segment =
	| { kind: 'text'; text: string }
	| { kind: 'link'; link: Wikilink; sporeId: string | null };

/** Compare titles the way a person means them: case and spacing don't count. */
export function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function sameTitle(a: string, b: string): boolean {
	return normalizeTitle(a) === normalizeTitle(b);
}

/** Every `[[link]]` in a body, in the order they appear. */
export function parseWikilinks(body: string): Wikilink[] {
	const links: Wikilink[] = [];
	WIKILINK.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = WIKILINK.exec(body)) !== null) {
		const target = match[1].trim();
		if (!target) continue;
		const alias = match[2]?.trim();
		links.push({
			target,
			display: alias || target,
			start: match.index,
			end: match.index + match[0].length
		});
	}
	return links;
}

/** Distinct link targets, first spelling wins. */
export function linkTargets(body: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const link of parseWikilinks(body)) {
		const key = normalizeTitle(link.target);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(link.target);
	}
	return out;
}

/** Index spores by normalized title. First one wins on a duplicate title. */
export function titleIndex(spores: Spore[]): Map<string, Spore> {
	const index = new Map<string, Spore>();
	for (const spore of spores) {
		const key = normalizeTitle(spore.title);
		if (key && !index.has(key)) index.set(key, spore);
	}
	return index;
}

/**
 * Split a body into text and link segments for rendering. Unresolved links
 * come back with `sporeId: null` — the caller decides whether that is a red
 * link to draw or a spore to create.
 */
export function toSegments(body: string, spores: Spore[]): Segment[] {
	const index = titleIndex(spores);
	const links = parseWikilinks(body);
	if (links.length === 0) return body ? [{ kind: 'text', text: body }] : [];

	const segments: Segment[] = [];
	let cursor = 0;
	for (const link of links) {
		if (link.start > cursor) {
			segments.push({ kind: 'text', text: body.slice(cursor, link.start) });
		}
		segments.push({
			kind: 'link',
			link,
			sporeId: index.get(normalizeTitle(link.target))?.id ?? null
		});
		cursor = link.end;
	}
	if (cursor < body.length) segments.push({ kind: 'text', text: body.slice(cursor) });
	return segments;
}

/** The body with its links flattened to their display text. */
export function stripWikilinks(body: string): string {
	return body.replace(WIKILINK, (_whole, target: string, alias?: string) =>
		(alias?.trim() || target.trim())
	);
}

/**
 * Spores whose body links to `spore`, derived rather than stored — the same
 * contract the Textbook had. Explicit `Flight`s remain separate and are not
 * folded in here: a flight is a link you drew, a backlink is one you wrote.
 */
export function backlinksOf(spore: Spore, spores: Spore[]): Spore[] {
	const key = normalizeTitle(spore.title);
	if (!key) return [];
	return spores.filter(
		(other) =>
			other.id !== spore.id &&
			linkTargets(other.body).some((target) => normalizeTitle(target) === key)
	);
}

/** Link targets in this body that no spore answers to yet. */
export function brokenTargets(body: string, spores: Spore[]): string[] {
	const index = titleIndex(spores);
	return linkTargets(body).filter((target) => !index.has(normalizeTitle(target)));
}

/** Wrap a phrase as a link, for turning a selection into a new entry. */
export function wikilinkFor(target: string, display?: string): string {
	const clean = target.trim();
	if (display && !sameTitle(display, clean)) return `[[${clean}|${display.trim()}]]`;
	return `[[${clean}]]`;
}

/**
 * Replace one occurrence of `phrase` in `body` with a link to it. Used by
 * highlight-to-spawn: the link is planted exactly where you found the idea.
 * Returns the body unchanged when the phrase isn't there.
 */
export function plantLink(body: string, phrase: string, target?: string): string {
	const at = body.indexOf(phrase);
	if (!phrase.trim() || at < 0) return body;
	const link = wikilinkFor(target ?? phrase, phrase);
	return body.slice(0, at) + link + body.slice(at + phrase.length);
}
