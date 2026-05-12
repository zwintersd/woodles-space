// PDF text extraction via pdfjs-dist.
//
// All work is local: we read the file into an ArrayBuffer, hand it to pdf.js,
// then walk each page's text content. The worker is loaded via Vite's `?url`
// import so it bundles correctly under adapter-static.

import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfExtractProgress {
	page: number;
	totalPages: number;
}

export interface PdfExtractResult {
	text: string;
	pageCount: number;
}

export async function extractPdfText(
	file: File,
	onProgress?: (p: PdfExtractProgress) => void
): Promise<PdfExtractResult> {
	const buf = await file.arrayBuffer();
	const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
	const pages: string[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const content = await page.getTextContent();
		// Each item has `str`. pdfjs already segments on visual line breaks via
		// `hasEOL` on items; join with a space, then collapse runs of whitespace
		// per page. Pages separated by a blank line.
		let text = '';
		for (const item of content.items) {
			const it = item as { str?: string; hasEOL?: boolean };
			if (it.str) text += it.str;
			if (it.hasEOL) text += '\n';
			else text += ' ';
		}
		pages.push(text.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').trim());
		onProgress?.({ page: i, totalPages: doc.numPages });
	}
	await doc.destroy();
	return {
		text: pages.join('\n\n').replace(/\n{3,}/g, '\n\n'),
		pageCount: pages.length
	};
}
