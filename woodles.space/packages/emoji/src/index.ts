/**
 * The single source of truth for which emoji characters Bloomforge Studio and
 * Bloomforge Player know how to draw as OpenMoji artwork, and by which
 * codepoint. Both apps bundle their own copy of the actual SVGs (each is an
 * independently deployed static site), but they render from the *same*
 * character → codepoint mapping — a symbol picked in the Studio has to look
 * identical in the Player, not fall back to a native glyph there because the
 * two apps' tables drifted apart.
 *
 * Codepoints are OpenMoji's own filenames (uppercase hex, no `.svg`), from
 * https://openmoji.org (CC BY-SA 4.0).
 */
export const OPENMOJI_CODEPOINTS: Record<string, string> = {
	// Entity-kind icons and other fixed UI glyphs.
	'🪙': '1FA99',
	'🌱': '1F331',
	'✨': '2728',
	'💎': '1F48E',
	'🔒': '1F512',
	'🔓': '1F513',
	'🏆': '1F3C6',
	'🌸': '1F338',
	'🌿': '1F33F',
	'📋': '1F4CB',
	'🗑': '1F5D1',
	'💠': '1F4A0',
	'🎯': '1F3AF',
	'✅': '2705',
	'📈': '1F4C8',
	'⚖': '2696',
	'📜': '1F4DC',
	'⏩': '23E9',

	// Extra options offered only in the currency symbol picker.
	'🌻': '1F33B',
	'🌼': '1F33C',
	'🍄': '1F344',
	'🍯': '1F36F',
	'🍀': '1F340',
	'🐚': '1F41A',
	'⭐': '2B50',
	'🌙': '1F319',
	'🔥': '1F525',
	'💧': '1F4A7',
	'🍎': '1F34E',
	'🌰': '1F330',
	'🪵': '1FAB5',
	'🌾': '1F33E',
	'🫧': '1FAE7',
	'🦋': '1F98B',
	'🐝': '1F41D',
	'🐌': '1F40C',
	'🍇': '1F347',
	'🌈': '1F308'
};

/** What a currency's symbol picker offers, in display order. */
export const CURRENCY_SYMBOL_PALETTE: readonly string[] = [
	'🌸',
	'🪙',
	'💎',
	'🌻',
	'🌼',
	'🍄',
	'🍯',
	'🍀',
	'🐚',
	'⭐',
	'🌙',
	'🔥',
	'💧',
	'🍎',
	'🌰',
	'🪵',
	'🌾',
	'🫧',
	'🦋',
	'🐝',
	'🐌',
	'🍇',
	'🌈',
	'🌿',
	'✨',
	'🏆'
];

/** The codepoint stem for `char`'s bundled OpenMoji SVG, if it has one. */
export function openmojiCodepoint(char: string): string | undefined {
	return OPENMOJI_CODEPOINTS[char];
}
