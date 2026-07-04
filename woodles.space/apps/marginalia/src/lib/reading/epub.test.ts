import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
	extractEpubHtml,
	parseContainerXml,
	parseOpfPackage,
	resolveEpubPath
} from './epub';
import { READING_TEXT_CAP } from './text';

describe('resolveEpubPath', () => {
	it('resolves a same-directory href against a non-empty base dir', () => {
		expect(resolveEpubPath('OEBPS', 'chapter1.xhtml')).toBe('OEBPS/chapter1.xhtml');
	});

	it('treats an empty base dir as root-relative', () => {
		expect(resolveEpubPath('', 'chapter1.xhtml')).toBe('chapter1.xhtml');
	});

	it('collapses ../ traversal', () => {
		expect(resolveEpubPath('OEBPS/text', '../images/cover.jpg')).toBe('OEBPS/images/cover.jpg');
	});

	it('strips a #fragment', () => {
		expect(resolveEpubPath('OEBPS', 'chapter1.xhtml#section2')).toBe('OEBPS/chapter1.xhtml');
	});

	it('decodes percent-encoded characters', () => {
		expect(resolveEpubPath('OEBPS', 'chapter%20one.xhtml')).toBe('OEBPS/chapter one.xhtml');
	});

	it('falls back to the raw string when percent-decoding would throw', () => {
		expect(resolveEpubPath('OEBPS', 'chapter%.xhtml')).toBe('OEBPS/chapter%.xhtml');
	});
});

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

describe('parseContainerXml', () => {
	it("extracts the rootfile's full-path", () => {
		expect(parseContainerXml(CONTAINER_XML)).toBe('OEBPS/content.opf');
	});

	it('throws when there is no rootfile', () => {
		expect(() =>
			parseContainerXml(
				'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles/></container>'
			)
		).toThrow();
	});
});

interface FixtureChapter {
	id: string;
	href: string;
	linear?: 'no';
	html: string;
}

function opfXml(chapters: FixtureChapter[], meta: { title?: string; author?: string } = {}): string {
	const items = chapters
		.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
		.join('');
	const spine = chapters
		.map((c) => `<itemref idref="${c.id}"${c.linear === 'no' ? ' linear="no"' : ''}/>`)
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${meta.title ? `<dc:title>${meta.title}</dc:title>` : ''}
    ${meta.author ? `<dc:creator>${meta.author}</dc:creator>` : ''}
  </metadata>
  <manifest>${items}</manifest>
  <spine>${spine}</spine>
</package>`;
}

describe('parseOpfPackage', () => {
	const chapters: FixtureChapter[] = [
		{ id: 'c1', href: 'chap1.xhtml', html: '' },
		{ id: 'note', href: 'footnote.xhtml', linear: 'no', html: '' },
		{ id: 'c2', href: 'chap2.xhtml', html: '' }
	];

	it('returns spine hrefs resolved against the opf directory, in spine order, skipping linear="no"', () => {
		const info = parseOpfPackage(opfXml(chapters), 'OEBPS/content.opf');
		expect(info.spinePaths).toEqual(['OEBPS/chap1.xhtml', 'OEBPS/chap2.xhtml']);
	});

	it('reads dc:title / dc:creator', () => {
		const info = parseOpfPackage(
			opfXml(chapters, { title: 'A Book', author: 'Some Author' }),
			'OEBPS/content.opf'
		);
		expect(info.title).toBe('A Book');
		expect(info.author).toBe('Some Author');
	});

	it('throws when the spine has no readable items', () => {
		expect(() => parseOpfPackage(opfXml([]), 'OEBPS/content.opf')).toThrow();
	});
});

function buildEpubFile(
	chapters: FixtureChapter[],
	opts: { title?: string; author?: string; encrypted?: boolean; noContainer?: boolean } = {}
): File {
	const files: Record<string, Uint8Array> = {};
	if (!opts.noContainer) files['META-INF/container.xml'] = strToU8(CONTAINER_XML);
	if (opts.encrypted) {
		files['META-INF/encryption.xml'] = strToU8(
			'<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"/>'
		);
	}
	files['OEBPS/content.opf'] = strToU8(opfXml(chapters, opts));
	for (const c of chapters) {
		files[`OEBPS/${c.href}`] = strToU8(
			`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${c.html}</body></html>`
		);
	}
	const zipped = zipSync(files);
	return new File([zipped], 'book.epub', { type: 'application/epub+zip' });
}

describe('extractEpubHtml', () => {
	it('concatenates chapters in spine order and surfaces title/author', async () => {
		const file = buildEpubFile(
			[
				{ id: 'c1', href: 'chap1.xhtml', html: '<h1>One</h1><p>first</p>' },
				{ id: 'c2', href: 'chap2.xhtml', html: '<h1>Two</h1><p>second</p>' }
			],
			{ title: 'A Book', author: 'Some Author' }
		);
		const result = await extractEpubHtml(file);
		expect(result.chapterCount).toBe(2);
		expect(result.truncated).toBe(false);
		expect(result.title).toBe('A Book');
		expect(result.author).toBe('Some Author');
		const oneIdx = result.html.indexOf('One');
		const twoIdx = result.html.indexOf('Two');
		expect(oneIdx).toBeGreaterThanOrEqual(0);
		expect(twoIdx).toBeGreaterThan(oneIdx);
	});

	it('reports per-chapter progress against the full spine count', async () => {
		const file = buildEpubFile([
			{ id: 'c1', href: 'chap1.xhtml', html: '<p>a</p>' },
			{ id: 'c2', href: 'chap2.xhtml', html: '<p>b</p>' }
		]);
		const seen: { chapter: number; totalChapters: number }[] = [];
		await extractEpubHtml(file, (p) => seen.push(p));
		expect(seen).toEqual([
			{ chapter: 1, totalChapters: 2 },
			{ chapter: 2, totalChapters: 2 }
		]);
	});

	it('skips a linear="no" chapter', async () => {
		const file = buildEpubFile([
			{ id: 'c1', href: 'chap1.xhtml', html: '<p>main</p>' },
			{ id: 'aside', href: 'footnote.xhtml', linear: 'no', html: '<p>a footnote</p>' }
		]);
		const result = await extractEpubHtml(file);
		expect(result.chapterCount).toBe(1);
		expect(result.html).not.toContain('footnote');
	});

	it('flags a drm-protected epub instead of extracting garbage', async () => {
		const file = buildEpubFile([{ id: 'c1', href: 'chap1.xhtml', html: '<p>x</p>' }], {
			encrypted: true
		});
		await expect(extractEpubHtml(file)).rejects.toThrow(/drm/i);
	});

	it('rejects a file with no container.xml', async () => {
		const file = buildEpubFile([{ id: 'c1', href: 'chap1.xhtml', html: '<p>x</p>' }], {
			noContainer: true
		});
		await expect(extractEpubHtml(file)).rejects.toThrow();
	});

	it('truncates once accumulated text passes the shared reading cap, but keeps the first chapter', async () => {
		const big = '<p>' + 'word '.repeat(Math.ceil((READING_TEXT_CAP * 0.6) / 5)) + '</p>';
		const file = buildEpubFile([
			{ id: 'c1', href: 'chap1.xhtml', html: big },
			{ id: 'c2', href: 'chap2.xhtml', html: big },
			{ id: 'c3', href: 'chap3.xhtml', html: '<p>never reached</p>' }
		]);
		const result = await extractEpubHtml(file);
		expect(result.truncated).toBe(true);
		expect(result.chapterCount).toBe(1);
		expect(result.html).not.toContain('never reached');
	});
});
