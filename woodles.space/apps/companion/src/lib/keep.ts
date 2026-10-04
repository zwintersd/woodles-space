import { createHandoffQueue, type HandoffDraft, type HandoffOptions, type HandoffTarget, type SendResult } from '@woodles/handoff';
import type { Capture, CaptureKind, PageContext } from '@extension/protocol.js';

/**
 * Anything the companion can keep: a capture from the page menu, or what was
 * typed into the keep card — a line of your own, with or without the page.
 */
export type Keepable = {
	kind: CaptureKind | 'note';
	note: string;
	text: string;
	url: string;
	page: PageContext | null;
};

export function keepableFromCapture(capture: Capture): Keepable {
	return { kind: capture.kind, note: '', text: capture.text, url: capture.url, page: capture.page };
}

/** The keep card's contents, or null when there is nothing to keep yet. */
export function keepableFromCard(note: string, page: PageContext | null): Keepable | null {
	const trimmed = note.trim();
	if (page) return { kind: 'page', note: trimmed, text: '', url: page.url, page };
	return trimmed ? { kind: 'note', note: trimmed, text: '', url: '', page: null } : null;
}

/** `example.com/a/b`, for a title or a link's text — the scheme and `www.` say nothing. */
export function prettyUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
		return (parsed.hostname.replace(/^www\./, '') + path).slice(0, 80);
	} catch {
		return url.slice(0, 80);
	}
}

export function titleFor(item: Keepable): string {
	switch (item.kind) {
		case 'note':
			return firstLine(item.note) || 'a thought';
		case 'page':
			return item.page?.title ?? prettyUrl(item.url);
		case 'selection':
			return item.page?.title ?? 'a quote';
		case 'link':
			return prettyUrl(item.url);
		case 'image':
			return item.page ? `an image from ${item.page.title}` : 'an image';
	}
}

/**
 * The handoff each receiver reads best. They differ because the two ingests do:
 *
 * - **Write** drops `source` when it makes a draft (`handoffToDraftBody` in
 *   apps/write/src/lib/drafts.ts), so the link back has to be in the body.
 *   It takes HTML and sanitizes it, so a quote is a quote and a link is a link.
 * - **Whiteboard** files a plain-text card and appends `source.href` to its
 *   body itself (`drainHandoffs` in apps/whiteboard/src/routes/+page.svelte),
 *   so the page's url stays out of the body here or the card says it twice.
 */
export function toHandoff(item: Keepable, target: HandoffTarget): HandoffDraft {
	const source = {
		app: 'companion',
		...(item.page ? { label: item.page.title, href: item.page.url } : {})
	};
	const title = titleFor(item);
	return target === 'write'
		? { title, body: writeBody(item), format: 'html', source }
		: { title, body: boardBody(item), format: 'text', source };
}

function writeBody(item: Keepable): string {
	const parts: string[] = [];
	if (item.note) parts.push(paragraphs(item.note));
	if (item.kind === 'selection') parts.push(`<blockquote>${paragraphs(item.text)}</blockquote>`);
	if (item.kind === 'link') parts.push(`<p>${anchor(item.url, prettyUrl(item.url))}</p>`);
	if (item.kind === 'image') parts.push(`<p>${anchor(item.url, 'the image')}</p>`);
	if (item.page) {
		const link = anchor(item.page.url, item.page.title);
		parts.push(item.kind === 'page' ? `<p>${link}</p>` : `<p>from ${link}</p>`);
	}
	return parts.join('');
}

function boardBody(item: Keepable): string {
	const parts: string[] = [];
	if (item.note) parts.push(item.note);
	if (item.kind === 'selection') parts.push(`“${item.text}”`);
	if (item.kind === 'link' || item.kind === 'image') parts.push(item.url);
	return parts.join('\n\n');
}

export type KeepResult = (SendResult & { duplicate: false }) | { ok: true; duplicate: true };

/**
 * Queue a keepable for a receiver. With an `id`, the handoff takes it — a
 * menu capture's id — and a second delivery of the same capture is noticed
 * here rather than filed twice. The queue is the place to look, because it
 * is the only record of a send that outlives this page.
 */
export function keep(
	item: Keepable,
	target: HandoffTarget,
	options: { id?: string; storage?: HandoffOptions['storage'] } = {}
): KeepResult {
	const queue = createHandoffQueue(target, {
		...(options.storage === undefined ? {} : { storage: options.storage }),
		...(options.id === undefined ? {} : { newId: () => options.id as string })
	});
	if (options.id !== undefined && queue.peek().some((handoff) => handoff.id === options.id)) {
		return { ok: true, duplicate: true };
	}
	return { ...queue.send(toHandoff(item, target)), duplicate: false };
}

// ── text ────────────────────────────────────────────────────────────────

function firstLine(text: string): string {
	const line = text.split('\n')[0].trim();
	return line.length > 80 ? line.slice(0, 79) + '…' : line;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Blank lines part paragraphs; a single newline stays a soft break — Write's own `textToHtml` rule. */
function paragraphs(text: string): string {
	return text
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean)
		.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

function anchor(href: string, text: string): string {
	return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
}
