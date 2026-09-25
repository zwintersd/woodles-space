// A dependency-free renderer for the handful of root markdown docs
// (ARCHITECTURE.md, CHANGELOG.md, LORE.md) that get their own memorable
// address (/architecture, /changelog, /lore). Each of those pages fetches
// its own .md file at runtime and renders it here, so the doc and the page
// can never drift apart the way a hand-copied HTML page would.
//
// It covers exactly what those three files use — headings, paragraphs,
// bold/italic, inline code, fenced code blocks, links, blockquotes, tables,
// lists, and rules — not the whole of GFM. `renderMarkdown` is plain string
// in, string out (no DOM), so it runs the same in a browser and in Node.

function escapeHtml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text) {
	let escaped = escapeHtml(text);

	// Code spans first, and protected behind placeholders, so `**`, `*`, and
	// `[...]` inside a code span are never mistaken for emphasis or a link.
	const codeSpans = [];
	escaped = escaped.replace(/`([^`]+?)`/g, (_, code) => {
		codeSpans.push(`<code>${code}</code>`);
		return `\u0000${codeSpans.length - 1}\u0000`;
	});

	escaped = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
	escaped = escaped.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
	escaped = escaped.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, '<em>$1</em>');

	return escaped.replace(/\u0000(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
}

function isTableSeparator(line) {
	return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
}

function splitTableRow(line) {
	const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
	return trimmed.split('|').map((cell) => cell.trim());
}

export function renderMarkdown(markdown) {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const html = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.trim() === '') {
			i++;
			continue;
		}

		const fence = line.match(/^```(\w*)\s*$/);
		if (fence) {
			const body = [];
			i++;
			while (i < lines.length && !/^```\s*$/.test(lines[i])) {
				body.push(lines[i]);
				i++;
			}
			i++; // skip closing fence
			const lang = fence[1] ? ` class="language-${fence[1]}"` : '';
			html.push(`<pre><code${lang}>${escapeHtml(body.join('\n'))}</code></pre>`);
			continue;
		}

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
			i++;
			continue;
		}

		if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
			html.push('<hr>');
			i++;
			continue;
		}

		// Table: a row followed by a separator row
		if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
			const headerCells = splitTableRow(line);
			i += 2;
			const bodyRows = [];
			while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
				bodyRows.push(splitTableRow(lines[i]));
				i++;
			}
			html.push('<table><thead><tr>');
			for (const cell of headerCells) html.push(`<th>${renderInline(cell)}</th>`);
			html.push('</tr></thead><tbody>');
			for (const row of bodyRows) {
				html.push('<tr>');
				for (const cell of row) html.push(`<td>${renderInline(cell)}</td>`);
				html.push('</tr>');
			}
			html.push('</tbody></table>');
			continue;
		}

		if (/^>\s?/.test(line)) {
			const body = [];
			while (i < lines.length && /^>\s?/.test(lines[i])) {
				body.push(lines[i].replace(/^>\s?/, ''));
				i++;
			}
			html.push(`<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`);
			continue;
		}

		// Lists (unordered or ordered), including indented continuation lines
		const listItem = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
		if (listItem) {
			const ordered = /\d+\./.test(listItem[2]);
			const tag = ordered ? 'ol' : 'ul';
			const items = [];
			while (i < lines.length) {
				const match = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
				if (match) {
					items.push([match[3]]);
					i++;
				} else if (lines[i].trim() !== '' && /^\s+\S/.test(lines[i]) && items.length > 0) {
					items[items.length - 1].push(lines[i].trim());
					i++;
				} else {
					break;
				}
			}
			html.push(`<${tag}>`);
			for (const parts of items) html.push(`<li>${renderInline(parts.join(' '))}</li>`);
			html.push(`</${tag}>`);
			continue;
		}

		// Paragraph: consume until a blank line or the start of another block
		const paragraph = [line];
		i++;
		while (
			i < lines.length &&
			lines[i].trim() !== '' &&
			!/^#{1,6}\s+/.test(lines[i]) &&
			!/^```/.test(lines[i]) &&
			!/^>\s?/.test(lines[i]) &&
			!/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
			!(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
		) {
			paragraph.push(lines[i]);
			i++;
		}
		html.push(`<p>${renderInline(paragraph.join(' ').trim())}</p>`);
	}

	return html.join('\n');
}

// Root markdown docs link to each other by repo-relative path
// (`./README.md`, `apps/marginalia/BALANCE.md`) since that's how they read
// in an editor. Every one of them deploys straight from the repo root, so
// resolving against `/` — rather than the doc page's own URL — is what
// keeps those links pointing at the plain-text file instead of a 404.
function resolveRepoRelativeLinks(container) {
	for (const anchor of container.querySelectorAll('a[href]')) {
		const href = anchor.getAttribute('href');
		if (!href || /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) {
			continue;
		}
		anchor.setAttribute('href', `/${href.replace(/^\.\//, '')}`);
	}
}

/**
 * Fetches a markdown doc and renders it into `target`. Used directly by
 * /changelog, /architecture, and /lore's index.html.
 *
 * @param {{ source: string, target: Element }} options
 */
export async function loadDocPage({ source, target }) {
	target.setAttribute('aria-busy', 'true');
	try {
		const response = await fetch(source);
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
		const markdown = await response.text();
		target.innerHTML = renderMarkdown(markdown);
		resolveRepoRelativeLinks(target);
	} catch (error) {
		target.innerHTML = `<p class="doc-error">couldn't load <code>${source}</code> (${escapeHtml(String(error.message ?? error))}). it's still in the repo — try refreshing.</p>`;
	} finally {
		target.removeAttribute('aria-busy');
	}
}
