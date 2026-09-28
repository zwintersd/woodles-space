import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	CARILLON_COMMITMENTS_STORAGE_KEY,
	CARILLON_COMMITMENTS_VERSION,
	THINKING_ABOUT_SHELF_STORAGE_KEY,
	THINKING_ABOUT_SHELF_VERSION
} from './crossAppBlobs';

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

describe('the static landing page', () => {
	const page = readFileSync(join(ROOT, 'apps/landing/index.html'), 'utf8');

	// The desktop's today widget reads two ledgers. apps/landing has no build
	// step and can't import this package, so — as with apps/letter — assert
	// the page and the contract agree rather than make them import each other.
	it('reads the same localStorage keys Carillon and Thinking About write', () => {
		expect(page).toContain(`'${CARILLON_COMMITMENTS_STORAGE_KEY}'`);
		expect(page).toContain(`'${THINKING_ABOUT_SHELF_STORAGE_KEY}'`);
	});

	it('accepts only the ledger version it was written against', () => {
		expect(CARILLON_COMMITMENTS_VERSION).toBe(1);
		expect(THINKING_ABOUT_SHELF_VERSION).toBe(1);
		expect(page).toContain('blob.version === 1');
	});
});
