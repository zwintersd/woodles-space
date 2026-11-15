import { addField, createRecord, type Collection, type CollectionField, type FieldType, type FieldValue, type SelectOption } from './collections';

/**
 * Turns what a spreadsheet puts on the clipboard into rows and columns of
 * typed cells, and lays them into a Collection from a chosen cell.
 *
 * Google Sheets (and Excel) copy an HTML table beside the plain text. The HTML
 * carries what the text loses: the real number behind "45%", whether a cell is
 * a checkbox, the date behind a serial number, a link's target. Plain
 * tab-separated text is the fallback, and its cells are typed by how they look.
 */

export type CellKind = 'empty' | 'text' | 'number' | 'percent' | 'currency' | 'boolean' | 'date' | 'url';
export type PastedCell = {
	/** What the cell showed, e.g. "$1,200.00". */
	text: string;
	kind: CellKind;
	/** The underlying value: a number (a fraction for percent), a boolean, or an ISO date. */
	value: number | boolean | string | null;
	href?: string;
};
export type PastedGrid = PastedCell[][];

export const MAX_PASTE_COLUMNS = 100;
const EMPTY: PastedCell = { text: '', kind: 'empty', value: null };
const TINTS = ['#e8dff0', '#f5e5d9', '#e0ece5', '#e5eafa', '#f4ebc9'];

// ── reading the clipboard ──

export function parseClipboard(html: string, text: string): PastedGrid | null {
	if (html && /<table[\s>]/i.test(html) && typeof DOMParser !== 'undefined') {
		const grid = parseHtmlTable(html);
		if (grid) return grid;
	}
	if (!text) return null;
	const rows = parseTsv(text);
	if (!rows.length) return null;
	return rows.map((row) => row.slice(0, MAX_PASTE_COLUMNS).map(classifyText));
}

/** Tab-separated text, with the quoting Sheets uses for cells holding tabs, quotes, or line breaks. */
export function parseTsv(input: string): string[][] {
	const text = input.replace(/\r\n?/g, '\n');
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
			else cell += ch;
		} else if (ch === '"' && cell === '') quoted = true;
		else if (ch === '\t') { row.push(cell); cell = ''; }
		else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
		else cell += ch;
	}
	if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
	return rows;
}

function parseHtmlTable(html: string): PastedGrid | null {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const table = doc.querySelector('table');
	if (!table) return null;
	const carry: number[] = [];
	const grid: PastedGrid = [];
	for (const tr of Array.from(table.querySelectorAll('tr'))) {
		const row: PastedCell[] = [];
		let col = 0;
		const skipCarried = () => { while ((carry[col] ?? 0) > 0) { carry[col]--; row[col] = EMPTY; col++; } };
		for (const td of Array.from(tr.children).filter((node) => node.tagName === 'TD' || node.tagName === 'TH')) {
			skipCarried();
			const colspan = Math.min(MAX_PASTE_COLUMNS, Math.max(1, Number.parseInt(td.getAttribute('colspan') ?? '1', 10) || 1));
			const rowspan = Math.min(1000, Math.max(1, Number.parseInt(td.getAttribute('rowspan') ?? '1', 10) || 1));
			row[col] = parseHtmlCell(td, doc);
			for (let k = 1; k < colspan; k++) row[col + k] = EMPTY;
			if (rowspan > 1) for (let k = 0; k < colspan; k++) carry[col + k] = rowspan - 1;
			col += colspan;
		}
		skipCarried();
		grid.push(Array.from(row, (cell) => cell ?? EMPTY).slice(0, MAX_PASTE_COLUMNS));
	}
	return grid.length ? grid : null;
}

function parseHtmlCell(td: Element, doc: Document): PastedCell {
	const clone = td.cloneNode(true) as Element;
	for (const br of Array.from(clone.querySelectorAll('br'))) br.replaceWith(doc.createTextNode('\n'));
	const text = (clone.textContent ?? '').replace(/ /g, ' ').trim();
	const href = linkOf(td);
	const withHref = (cell: PastedCell): PastedCell => (href && cell.kind !== 'empty' ? { ...cell, href } : cell);
	const raw = readJson(td.getAttribute('data-sheets-value'));
	if (!raw) return withHref(classifyText(text));
	const type = raw['1'];
	if (type === 4) return { text: text || (raw['4'] ? 'TRUE' : 'FALSE'), kind: 'boolean', value: !!raw['4'] };
	if (type === 3 && typeof raw['3'] === 'number' && Number.isFinite(raw['3'])) {
		const pattern = String(readJson(td.getAttribute('data-sheets-numberformat'))?.['2'] ?? '');
		return withHref(numericCell(raw['3'], text, pattern));
	}
	// A string in Sheets is text on purpose, even when it looks like a number.
	if (!text) return EMPTY;
	return withHref(URL_TEXT.test(text) ? { text, kind: 'url', value: null } : { text, kind: 'text', value: null });
}

function readJson(source: string | null): Record<string, any> | null {
	if (!source) return null;
	try { const value = JSON.parse(source); return value && typeof value === 'object' ? value : null; } catch { return null; }
}

/** Sheets routes links through google.com/url; the page behind it is what was meant. */
function linkOf(td: Element): string | undefined {
	const raw = td.querySelector('a[href]')?.getAttribute('href')?.trim();
	if (!raw) return undefined;
	let target = raw;
	try {
		const url = new URL(raw);
		if (/(^|\.)google\.com$/.test(url.hostname) && url.pathname === '/url') target = url.searchParams.get('q') ?? raw;
	} catch { /* a relative link is not one worth keeping */ return undefined; }
	return /^(https?:|mailto:)/i.test(target) ? target : undefined;
}

// ── typing cells ──

function numericCell(value: number, text: string, pattern: string): PastedCell {
	const bare = pattern.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
	if (/%/.test(bare)) return { text: text || `${value * 100}%`, kind: 'percent', value };
	if (/[$€£¥]/.test(pattern)) return { text: text || String(value), kind: 'currency', value };
	const hasDate = /y/i.test(bare) || (/d/i.test(bare) && /m/i.test(bare));
	if (hasDate || (/[hs]/i.test(bare) && /:/.test(bare))) {
		// A date and time shows both, which a date field cannot keep: stay text.
		if (hasDate && !/[hs]/i.test(bare)) return { text, kind: 'date', value: serialToIso(value) };
		return { text, kind: 'text', value: null };
	}
	return { text: text || String(value), kind: 'number', value };
}

/** Sheets and Excel count days from 1899-12-30. */
function serialToIso(serial: number): string {
	return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
const URL_TEXT = /^https?:\/\/\S+$/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseNumber(text: string): number | null {
	// "007" is an identifier, not a number.
	if (!NUMBER.test(text) || /^[-+]?0\d/.test(text)) return null;
	return Number(text.replace(/,/g, ''));
}

function isoDate(year: number, month: number, day: number): string | null {
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return date.toISOString().slice(0, 10);
}

export function parseDateText(text: string): string | null {
	let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (m) return isoDate(+m[1], +m[2], +m[3]);
	m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
	if (m) return isoDate(+m[3], +m[1], +m[2]);
	m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(text);
	const month = m ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
	return m && month !== -1 ? isoDate(+m[3], month + 1, +m[2]) : null;
}

/** Types a cell by how it reads — for plain text, and for HTML that says nothing more. */
export function classifyText(input: string): PastedCell {
	const text = input.trim();
	if (!text) return EMPTY;
	if (/^(true|false)$/i.test(text)) return { text, kind: 'boolean', value: text.toLowerCase() === 'true' };
	const percent = /^(-?[\d,]*\.?\d+)%$/.exec(text);
	const percentValue = percent ? parseNumber(percent[1]) : null;
	if (percentValue !== null) return { text, kind: 'percent', value: Number((percentValue / 100).toPrecision(12)) };
	const money = /^(\()?(-)?\s*[$€£¥]\s*(-)?(\d[\d,]*(?:\.\d+)?)(\))?$/.exec(text);
	const moneyValue = money ? parseNumber(money[4]) : null;
	if (money && moneyValue !== null) return { text, kind: 'currency', value: money[1] || money[2] || money[3] ? -moneyValue : moneyValue };
	const number = parseNumber(text);
	if (number !== null) return { text, kind: 'number', value: number };
	const date = parseDateText(text);
	if (date) return { text, kind: 'date', value: date };
	if (URL_TEXT.test(text)) return { text, kind: 'url', value: null };
	return { text, kind: 'text', value: null };
}

// ── laying cells into a Collection ──

export type PasteTarget = {
	/** The records and fields on screen, in order, as the table shows them. */
	recordIds: string[];
	fieldIds: string[];
	/** Where the top-left pasted cell lands, as indexes into those lists. */
	row: number;
	col: number;
};
export type PasteResult = { collection: Collection; rows: number; columns: number; newRecords: number; newFields: number; skipped: number };

/** A new column takes the type its pasted cells share, so a checkbox column stays checkboxes. */
function inferFieldType(cells: PastedCell[]): FieldType {
	const kinds = new Set(cells.filter((cell) => cell.kind !== 'empty').map((cell) => cell.kind));
	if (kinds.size !== 1) return 'text';
	const [kind] = kinds;
	// Percent and currency would lose their symbols as plain numbers; the text keeps them as shown.
	return kind === 'boolean' ? 'checkbox' : kind === 'number' ? 'number' : kind === 'date' ? 'date' : kind === 'url' ? 'url' : 'text';
}

function optionIdFor(field: CollectionField, label: string, added: Map<string, SelectOption[]>): string {
	const known = [...(field.config?.options ?? []), ...(added.get(field.id) ?? [])];
	const wanted = label.trim().toLowerCase();
	const found = known.find((option) => option.id === label || option.label.trim().toLowerCase() === wanted);
	if (found) return found.id;
	const option: SelectOption = { id: `opt-${crypto.randomUUID()}`, label: label.trim(), tint: TINTS[known.length % TINTS.length] };
	added.set(field.id, [...(added.get(field.id) ?? []), option]);
	return option.id;
}

/** What a cell becomes in a field, or undefined when it cannot become one and the cell is left alone. */
function convert(cell: PastedCell, field: CollectionField, added: Map<string, SelectOption[]>): FieldValue | undefined {
	if (field.sourceKey || field.type === 'relation') return undefined;
	const blank = cell.kind === 'empty';
	switch (field.type) {
		case 'text': return cell.text;
		case 'url': return blank ? '' : cell.href ?? cell.text;
		case 'number':
			if (blank) return null;
			return typeof cell.value === 'number' ? cell.value : undefined;
		case 'checkbox':
			if (blank) return false;
			return typeof cell.value === 'boolean' ? cell.value : undefined;
		case 'date': {
			if (blank) return null;
			const iso = cell.kind === 'date' && typeof cell.value === 'string' ? cell.value : parseDateText(cell.text);
			return iso ?? undefined;
		}
		case 'select': return blank ? null : optionIdFor(field, cell.text, added);
		case 'multi-select':
			return blank ? [] : [...new Set(cell.text.split(/[,\n]/).map((part) => part.trim()).filter(Boolean).map((label) => optionIdFor(field, label, added)))];
	}
}

/**
 * Pastes a grid with its top-left cell on `target`. Rows past the last record
 * become new records, and columns past the last field become new fields typed
 * from what was pasted. Synced columns and Relations are left alone, and a cell
 * that cannot become its field's type (words into a Number) keeps what it had.
 * The result is one change, so one undo.
 */
export function pasteGrid(collection: Collection, grid: PastedGrid, target: PasteTarget): PasteResult {
	const width = Math.min(MAX_PASTE_COLUMNS, Math.max(0, ...grid.map((row) => row.length)));
	if (!grid.length || !width) return { collection, rows: 0, columns: 0, newRecords: 0, newFields: 0, skipped: 0 };
	let next = collection;

	const fieldIds = [...target.fieldIds];
	let newFields = 0;
	for (let column = fieldIds.length - target.col; column < width; column++) {
		const type = inferFieldType(grid.map((row) => row[column] ?? EMPTY));
		next = addField(next, `Column ${next.fields.length + 1}`, type);
		fieldIds.push(next.fields.at(-1)!.id);
		newFields++;
	}

	const recordIds = [...target.recordIds];
	const created = [];
	while (recordIds.length < target.row + grid.length) {
		const record = createRecord(next);
		created.push(record);
		recordIds.push(record.id);
	}
	if (created.length) next = { ...next, records: [...next.records, ...created] };

	const fields = new Map(next.fields.map((entry) => [entry.id, entry]));
	const added = new Map<string, SelectOption[]>();
	const changed = new Map<string, Record<string, FieldValue>>();
	const byId = new Map(next.records.map((record) => [record.id, record]));
	let skipped = 0;
	grid.forEach((cells, r) => {
		const recordId = recordIds[target.row + r];
		const record = byId.get(recordId);
		if (!record) return;
		for (let c = 0; c < width; c++) {
			const field = fields.get(fieldIds[target.col + c]);
			if (!field) continue;
			const value = convert(cells[c] ?? EMPTY, field, added);
			if (value === undefined) { if ((cells[c] ?? EMPTY).kind !== 'empty' && !field.sourceKey && field.type !== 'relation') skipped++; continue; }
			const values = changed.get(recordId) ?? { ...record.values };
			values[field.id] = value;
			changed.set(recordId, values);
		}
	});

	const stamp = new Date().toISOString();
	next = {
		...next,
		fields: next.fields.map((entry) => added.has(entry.id) ? { ...entry, config: { ...entry.config, options: [...(entry.config?.options ?? []), ...added.get(entry.id)!] } } : entry),
		records: next.records.map((record) => changed.has(record.id) ? { ...record, values: changed.get(record.id)!, updatedAt: stamp } : record),
		updatedAt: stamp
	};
	return { collection: next, rows: grid.length, columns: width, newRecords: created.length, newFields, skipped };
}

// ── copying out ──

export type CopyLabel = (record: Collection['records'][number], field: CollectionField) => string | undefined;

function cellText(record: Collection['records'][number], field: CollectionField, label?: CopyLabel): string {
	const custom = label?.(record, field);
	if (custom !== undefined) return custom;
	const value = record.values[field.id] ?? null;
	if (value === null) return field.type === 'checkbox' ? 'FALSE' : '';
	const options = field.config?.options ?? [];
	const named = (id: string) => options.find((option) => option.id === id)?.label ?? id;
	switch (field.type) {
		case 'checkbox': return value === true ? 'TRUE' : 'FALSE';
		case 'select': return typeof value === 'string' ? named(value) : '';
		case 'multi-select': return Array.isArray(value) ? value.map(named).join(', ') : '';
		case 'relation': return '';
		default: return String(value);
	}
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/**
 * The records × fields as a spreadsheet would put them on the clipboard: tab-
 * separated text (quoted where a cell holds a tab, quote, or line break), and
 * an HTML table. What it writes reads back through `parseClipboard`, so a
 * copied column pastes into another column as it was.
 */
export function serializeGrid(records: Collection['records'], fields: CollectionField[], label?: CopyLabel): { text: string; html: string } {
	const rows = records.map((record) => fields.map((field) => cellText(record, field, label)));
	const quote = (cell: string) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
	return {
		text: rows.map((row) => `${row.map(quote).join('\t')}\n`).join(''),
		html: `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`
	};
}

/** What cutting leaves behind: each cell as a new record has it. Synced columns are not yours to clear. */
export function clearCells(collection: Collection, recordIds: string[], fieldIds: string[]): { collection: Collection; cleared: number } {
	const fields = collection.fields.filter((field) => fieldIds.includes(field.id) && !field.sourceKey);
	if (!fields.length) return { collection, cleared: 0 };
	const rows = new Set(recordIds);
	const stamp = new Date().toISOString();
	let cleared = 0;
	const records = collection.records.map((record) => {
		if (!rows.has(record.id)) return record;
		const values = { ...record.values };
		for (const field of fields) values[field.id] = field.type === 'checkbox' ? false : field.type === 'multi-select' ? [] : field.type === 'text' || field.type === 'url' ? '' : null;
		cleared++;
		return { ...record, values, updatedAt: stamp };
	});
	return { collection: { ...collection, records, updatedAt: stamp }, cleared };
}
