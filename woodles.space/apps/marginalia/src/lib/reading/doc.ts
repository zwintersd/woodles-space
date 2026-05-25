import {
	paragraphsFromText,
	countWordsInText,
	type Paragraph,
	type MarginNote
} from './text';

export interface ReadingDoc {
	text: string;
	paragraphs: Paragraph[];
	notes: MarginNote[];
	wordCount: number;
}

const DOC_KEY = 'marginalia.reading.doc.v3';
const LEGACY_DOC_V2_KEY = 'marginalia.reading.doc.v2';
const LEGACY_PASTE_V1_KEY = 'marginalia.reading.paste.v1';

function paraHtmlFromContent(content: string): string {
	const escaped = content
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	return `<p data-anchor="placeholder">${escaped.replace(/\n/g, '<br>')}</p>`;
}

export function persistDoc(doc: { text: string; paragraphs: Paragraph[]; notes: MarginNote[] }): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(
			DOC_KEY,
			JSON.stringify({ text: doc.text, paragraphs: doc.paragraphs, notes: doc.notes })
		);
	} catch {
		// ignore quota
	}
}

export function wipeDoc(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(DOC_KEY);
	} catch {
		// ignore
	}
}

export function loadDoc(): ReadingDoc | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(DOC_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<ReadingDoc>;
			if (parsed?.text && Array.isArray(parsed.paragraphs)) {
				const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
				return {
					text: parsed.text,
					paragraphs: parsed.paragraphs,
					notes,
					wordCount: countWordsInText(parsed.text)
				};
			}
		}
		// v2 → v3: paragraphs were `{id, content}` (plain text). Convert.
		const v2 = sessionStorage.getItem(LEGACY_DOC_V2_KEY);
		if (v2) {
			const parsed = JSON.parse(v2) as {
				text: string;
				paragraphs?: { id: string; content?: string; html?: string }[];
				notes?: MarginNote[];
			};
			if (parsed?.text) {
				const paragraphs: Paragraph[] = parsed.paragraphs
					? parsed.paragraphs.map((p) =>
							p.html
								? { id: p.id, html: p.html }
								: { id: p.id, html: paraHtmlFromContent(p.content ?? '') }
					  )
					: paragraphsFromText(parsed.text);
				const doc: ReadingDoc = {
					text: parsed.text,
					paragraphs,
					notes: Array.isArray(parsed.notes) ? parsed.notes : [],
					wordCount: countWordsInText(parsed.text)
				};
				sessionStorage.removeItem(LEGACY_DOC_V2_KEY);
				persistDoc(doc);
				return doc;
			}
		}
		// v1 → v3: raw string.
		const v1 = sessionStorage.getItem(LEGACY_PASTE_V1_KEY);
		if (v1) {
			const doc: ReadingDoc = {
				text: v1,
				paragraphs: paragraphsFromText(v1),
				notes: [],
				wordCount: countWordsInText(v1)
			};
			sessionStorage.removeItem(LEGACY_PASTE_V1_KEY);
			persistDoc(doc);
			return doc;
		}
	} catch {
		// ignore
	}
	return null;
}
