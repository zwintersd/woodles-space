import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	readArchiveBlob,
	WRITE_ARCHIVE_APP,
	WRITE_LETTERS_STORAGE_KEY
} from './crossAppBlobs';

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

function letter(overrides: Record<string, unknown> = {}) {
	return {
		id: 'l-1',
		title: 'a letter',
		theme: 'cream',
		motif: 'paper',
		font: 'body',
		issue: 1,
		publishedAt: '2026-08-09T00:00:00.000Z',
		layers: { foreground: { html: '<p>hello</p>', updatedAt: '2026-08-09T00:00:00.000Z' } },
		annotations: { pocketNotes: [], marginNotes: [] },
		content: '<p>hello</p>',
		replyTo: null,
		...overrides
	};
}

describe('readArchiveBlob', () => {
	it('accepts a well-formed archive', () => {
		expect(readArchiveBlob({ letters: [letter()] })?.letters).toHaveLength(1);
	});

	it('refuses anything that is not an archive', () => {
		expect(readArchiveBlob(null)).toBeNull();
		expect(readArchiveBlob({})).toBeNull();
		expect(readArchiveBlob({ letters: 'no' })).toBeNull();
	});

	it('drops a letter missing the parts a reader needs, keeping the rest', () => {
		const parsed = readArchiveBlob({
			letters: [letter({ id: 'good' }), { id: 'no-prose' }, letter({ id: 'also-good' })]
		});
		expect(parsed?.letters.map((l) => l.id)).toEqual(['good', 'also-good']);
	});

	it('rides the app blob, not a ledger key of its own', () => {
		// The archive is Write's own data under its own app key — the
		// bloomforge-player relationship, not a projection.
		expect(WRITE_ARCHIVE_APP).toBe('write');
	});
});

describe('the static Echoes reader', () => {
	const page = readFileSync(join(ROOT, 'apps/letter/index.html'), 'utf8');

	// apps/letter is a static page with no build step, so it cannot import this
	// package and hand-rolls its fetch. Same stance the manifest's route tests
	// take toward vercel.json: don't make them import each other, assert they
	// agree.
	it('reads the same localStorage key Write writes', () => {
		expect(page).toContain(`'${WRITE_LETTERS_STORAGE_KEY}'`);
	});

	it('asks the sync endpoint for the archive app, authenticated', () => {
		expect(page).toContain(`'${WRITE_ARCHIVE_APP}'`);
		expect(page).toContain('/api/sync?app=');
		expect(page).toContain('authorization');
	});

	it('no longer reaches for the public read path', () => {
		// Echoes left /api/public when it stopped being public. Bestiary is now
		// its only tenant, and this page must not quietly become a second one.
		expect(page).not.toContain('/api/public');
	});
});
