import { SPORE_ACCENTS, type Spore, type SporeAccent, type SporeStatus } from './types';
import { stripWikilinks } from './wikilinks';

/**
 * Cover derivation, ported from the Ologypedia Textbook.
 *
 * The point of it: **a cover needs no design step.** Accent is a stable hash of
 * the id, the emblem defaults to ✦, and the blurb is excerpted from the opening
 * lines. Choosing any of them is an override, never a requirement — so a spore
 * you dashed off looks as intentional on the shelf as one you fussed over.
 */

export const DEFAULT_GLYPH = '✦';

export const GLYPH_PRESETS = ['✦', '✶', '✧', '❀', '❋', '✷', '☾', '✵', '❖', '✿'];

/** Named accents to the app's own palette. Kept here so a stored spore holds a
 *  name, not a hex — the re-skin in step 3 would otherwise have stranded it. */
export const ACCENT_COLOR: Record<SporeAccent, string> = {
	rose: '#8c3b4a',
	sage: '#6f7f5f',
	gold: '#856428',
	dust: '#a85f74',
	plum: '#6f4a63'
};

const BLURB_MAX = 150;
const SEED_BLURB = 'A seed — a title and a link, waiting to grow.';

/**
 * Status of a spore, defaulting for anything written before the Textbook
 * merge. An empty body is a seed; anything with words in it was already
 * growing. Never guesses "grown" — that is a claim only a person can make.
 */
export function sporeStatus(spore: Spore): SporeStatus {
	if (spore.status) return spore.status;
	return spore.body.trim() ? 'growing' : 'seed';
}

/** The next status, forward-only. `grown` stays put. */
export function nextStatus(status: SporeStatus): SporeStatus {
	if (status === 'seed') return 'growing';
	if (status === 'growing') return 'grown';
	return 'grown';
}

export function coverAccent(spore: Spore): SporeAccent {
	if (spore.accent && SPORE_ACCENTS.includes(spore.accent)) return spore.accent;
	let hash = 0;
	for (let i = 0; i < spore.id.length; i += 1) {
		hash = (hash * 31 + spore.id.charCodeAt(i)) >>> 0;
	}
	return SPORE_ACCENTS[hash % SPORE_ACCENTS.length];
}

export function coverGlyph(spore: Spore): string {
	const chosen = spore.glyph?.trim();
	return chosen ? [...chosen].slice(0, 2).join('') : DEFAULT_GLYPH;
}

export function coverBlurb(spore: Spore): string {
	const chosen = spore.blurb?.trim();
	if (chosen) return chosen;
	// Links read as their display text on a cover — brackets are authoring
	// syntax, not something to show on a shelf.
	const text = stripWikilinks(spore.body).replace(/\s+/g, ' ').trim();
	if (!text) return SEED_BLURB;
	if (text.length <= BLURB_MAX) return text;
	return text.slice(0, BLURB_MAX - 3).replace(/\s+\S*$/, '') + '…';
}
