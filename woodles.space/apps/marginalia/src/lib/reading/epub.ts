// EPUB extraction: unzip in memory with fflate, then walk the standard
// container.xml -> package document (OPF) -> spine chain to read chapters
// in reading order. Chapters are concatenated into one HTML blob and handed
// back raw — sanitizing and turning that into Paragraph[] is the same job
// `paragraphsFromLetterHtml` already does for echoes letters, so the room
// doesn't need a third sanitize pass.
//
// container.xml and the OPF are real XML (self-closing tags throughout), so
// they're parsed in 'application/xml' mode. Chapter bodies are parsed as
// 'text/html' instead — real-world epub chapters aren't always well-formed
// XML, and the browser's lenient HTML parser copes with that better than a
// strict XML parser would.
//
// `unzipSync` (not fflate's async `unzip`) is deliberate: the async path
// spins up a real Worker, which is unnecessary ceremony for the
// novel-sized archives this room expects, and keeps this module runnable
// under happy-dom in tests without a Worker shim. A couple of explicit
// yields keep the "extracting" UI responsive around the synchronous work.

import { strFromU8, unzipSync, type Unzipped } from 'fflate';
import { READING_TEXT_CAP } from './text';

export interface EpubExtractProgress {
	chapter: number;
	totalChapters: number;
}

export interface EpubExtractResult {
	html: string;
	chapterCount: number;
	truncated: boolean;
	title?: string;
	author?: string;
}

const CONTAINER_PATH = 'META-INF/container.xml';
const ENCRYPTION_PATH = 'META-INF/encryption.xml';
const DC_NS = 'http://purl.org/dc/elements/1.1/';

// Media fflate shouldn't bother inflating — none of it feeds the text pipeline.
const SKIP_EXTENSIONS = new Set([
	'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
	'otf', 'ttf', 'woff', 'woff2',
	'mp3', 'mp4', 'm4a', 'm4v', 'ogg', 'webm',
	'css'
]);

function yieldToUi(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function extensionOf(name: string): string {
	const i = name.lastIndexOf('.');
	return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function safeDecodeUriComponent(s: string): string {
	try {
		return decodeURIComponent(s);
	} catch {
		return s;
	}
}

function dirnameOf(path: string): string {
	const i = path.lastIndexOf('/');
	return i === -1 ? '' : path.slice(0, i);
}

// Resolve a manifest/container href (relative, possibly with a `#fragment`
// and percent-encoding) against the directory it was declared in, producing
// a zip-root-relative path with `.`/`..` segments collapsed.
export function resolveEpubPath(baseDir: string, href: string): string {
	const withoutFragment = href.split('#')[0];
	const decoded = safeDecodeUriComponent(withoutFragment);
	const combined = baseDir ? `${baseDir}/${decoded}` : decoded;
	const out: string[] = [];
	for (const part of combined.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return out.join('/');
}

// container.xml -> the package document's path.
export function parseContainerXml(xml: string): string {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const fullPath = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
	if (!fullPath) throw new Error('missing rootfile in container.xml');
	return fullPath;
}

export interface EpubPackageInfo {
	spinePaths: string[];
	title?: string;
	author?: string;
}

// The package document (OPF): manifest (id -> href) + spine (reading order
// of idrefs) + Dublin Core title/creator. Non-linear spine items (footnotes,
// pop-up asides) are skipped — they aren't meant to be read start to finish.
export function parseOpfPackage(xml: string, opfPath: string): EpubPackageInfo {
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	const opfDir = dirnameOf(opfPath);

	const manifestHrefById = new Map<string, string>();
	for (const item of Array.from(doc.getElementsByTagName('item'))) {
		const id = item.getAttribute('id');
		const href = item.getAttribute('href');
		if (id && href) manifestHrefById.set(id, href);
	}

	const spinePaths: string[] = [];
	for (const itemref of Array.from(doc.getElementsByTagName('itemref'))) {
		if (itemref.getAttribute('linear') === 'no') continue;
		const idref = itemref.getAttribute('idref');
		const href = idref ? manifestHrefById.get(idref) : undefined;
		if (href) spinePaths.push(resolveEpubPath(opfDir, href));
	}
	if (spinePaths.length === 0) throw new Error('epub has no readable spine');

	return {
		spinePaths,
		title: firstDcText(doc, 'title'),
		author: firstDcText(doc, 'creator')
	};
}

function firstDcText(doc: Document, localName: string): string | undefined {
	const byNs = doc.getElementsByTagNameNS(DC_NS, localName)[0];
	const byName = doc.getElementsByTagName('dc:' + localName)[0] ?? doc.getElementsByTagName(localName)[0];
	const text = (byNs ?? byName)?.textContent?.trim();
	return text || undefined;
}

function unzipEpub(data: Uint8Array): Unzipped {
	return unzipSync(data, {
		filter: (file) => !SKIP_EXTENSIONS.has(extensionOf(file.name))
	});
}

export async function extractEpubHtml(
	file: File,
	onProgress?: (p: EpubExtractProgress) => void
): Promise<EpubExtractResult> {
	const buf = new Uint8Array(await file.arrayBuffer());
	await yieldToUi();
	const entries = unzipEpub(buf);

	if (ENCRYPTION_PATH in entries) throw new Error('drm-protected epub');

	const containerBytes = entries[CONTAINER_PATH];
	if (!containerBytes) throw new Error('missing container.xml');
	const opfPath = parseContainerXml(strFromU8(containerBytes));

	const opfBytes = entries[opfPath];
	if (!opfBytes) throw new Error('missing package document');
	const { spinePaths, title, author } = parseOpfPackage(strFromU8(opfBytes), opfPath);

	const parser = new DOMParser();
	const chapters: string[] = [];
	let plainLength = 0;
	let truncated = false;

	for (const path of spinePaths) {
		const bytes = entries[path];
		if (!bytes) continue;
		const body = parser.parseFromString(strFromU8(bytes), 'text/html').body;
		if (!body) continue;

		const bodyText = body.textContent ?? '';
		if (chapters.length > 0 && plainLength + bodyText.length > READING_TEXT_CAP) {
			truncated = true;
			break;
		}
		plainLength += bodyText.length;
		chapters.push(body.innerHTML);
		onProgress?.({ chapter: chapters.length, totalChapters: spinePaths.length });
		await yieldToUi();
	}

	if (chapters.length === 0) throw new Error('epub had no readable chapters');

	return { html: chapters.join(''), chapterCount: chapters.length, truncated, title, author };
}
