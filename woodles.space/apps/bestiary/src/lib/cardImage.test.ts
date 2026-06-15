import { describe, expect, it } from 'vitest';
import { slugFilename } from './cardImage';

describe('slugFilename', () => {
	it('slugs a name and appends the suffix + extension', () => {
		expect(slugFilename('Hourling', '', 'png')).toBe('hourling.png');
		expect(slugFilename('Hourling', '-art', 'png')).toBe('hourling-art.png');
	});
	it('collapses spaces and punctuation into single hyphens', () => {
		expect(slugFilename('  The   Moss-Back!! ', '', 'png')).toBe('the-moss-back.png');
	});
	it('falls back to "creature" for an empty or symbol-only name', () => {
		expect(slugFilename('', '', 'png')).toBe('creature.png');
		expect(slugFilename('✶✶✶', '-art', 'png')).toBe('creature-art.png');
	});
	it('strips accents to keep filenames portable', () => {
		expect(slugFilename('Écho', '', 'png')).toBe('echo.png');
	});
});
