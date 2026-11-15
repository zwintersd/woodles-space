import { describe, expect, it } from 'vitest';
import { addField, addRecord, createCollection, isCollection, type Collection } from './collections';
import { classifyText, parseClipboard, parseTsv, pasteGrid } from './paste';

const sheetsCell = (value: object, display: string, format?: object, attrs = '') =>
	`<td data-sheets-value='${JSON.stringify(value)}'${format ? ` data-sheets-numberformat='${JSON.stringify(format)}'` : ''}${attrs}>${display}</td>`;
const sheetsHtml = (rows: string[][]) =>
	`<meta charset="utf-8"><google-sheets-html-origin><table xmlns="http://www.w3.org/1999/xhtml"><tbody>${rows.map((row) => `<tr>${row.join('')}</tr>`).join('')}</tbody></table></google-sheets-html-origin>`;

function target(collection: Collection, row = 0, col = 0) {
	return { recordIds: collection.records.map((r) => r.id), fieldIds: collection.views.table.columnOrder, row, col };
}

describe('reading plain text', () => {
	it('splits tabs into columns and lines into rows, ignoring the trailing newline', () => {
		expect(parseTsv('a\tb\nc\td\n')).toEqual([['a', 'b'], ['c', 'd']]);
		expect(parseTsv('a\r\nb')).toEqual([['a'], ['b']]);
	});

	it('keeps quoted cells whole, the way Sheets writes cells with tabs, quotes, or line breaks', () => {
		expect(parseTsv('"line one\nline two"\t"say ""hi"""\tplain')).toEqual([['line one\nline two', 'say "hi"', 'plain']]);
	});

	it('keeps empty cells so columns stay aligned', () => {
		expect(parseTsv('a\t\tc\n\tb\t')).toEqual([['a', '', 'c'], ['', 'b', '']]);
	});

	it('types cells by how they read', () => {
		expect(classifyText('1,234.5')).toMatchObject({ kind: 'number', value: 1234.5 });
		expect(classifyText('45%')).toMatchObject({ kind: 'percent', value: 0.45 });
		expect(classifyText('$1,200.00')).toMatchObject({ kind: 'currency', value: 1200 });
		expect(classifyText('($5.00)')).toMatchObject({ kind: 'currency', value: -5 });
		expect(classifyText('TRUE')).toMatchObject({ kind: 'boolean', value: true });
		expect(classifyText('3/7/2026')).toMatchObject({ kind: 'date', value: '2026-03-07' });
		expect(classifyText('Mar 7, 2026')).toMatchObject({ kind: 'date', value: '2026-03-07' });
		expect(classifyText('2026-03-07')).toMatchObject({ kind: 'date', value: '2026-03-07' });
		expect(classifyText('https://woodles.space')).toMatchObject({ kind: 'url' });
		expect(classifyText('')).toMatchObject({ kind: 'empty' });
	});

	it('leaves identifiers and impossible dates as text', () => {
		expect(classifyText('007').kind).toBe('text');
		expect(classifyText('13/45/2026').kind).toBe('text');
		expect(classifyText('555-1234').kind).toBe('text');
	});
});

describe('reading Google Sheets HTML', () => {
	it('lays cells out by row and column and reads their real values', () => {
		const html = sheetsHtml([
			[sheetsCell({ 1: 2, 2: 'Rent' }, 'Rent'), sheetsCell({ 1: 3, 3: 1200 }, '$1,200.00', { 1: 4, 2: '"$"#,##0.00' }), sheetsCell({ 1: 4, 4: 1 }, 'TRUE')],
			[sheetsCell({ 1: 2, 2: 'Tax' }, 'Tax'), sheetsCell({ 1: 3, 3: 0.075 }, '7.5%', { 1: 3, 2: '0.0%' }), sheetsCell({ 1: 4, 4: 0 }, 'FALSE')]
		]);
		const grid = parseClipboard(html, 'ignored')!;
		expect(grid.map((row) => row.map((cell) => cell.kind))).toEqual([['text', 'currency', 'boolean'], ['text', 'percent', 'boolean']]);
		expect(grid[0][1]).toMatchObject({ text: '$1,200.00', value: 1200 });
		expect(grid[1][1]).toMatchObject({ text: '7.5%', value: 0.075 });
		expect(grid[1][2]).toMatchObject({ value: false });
	});

	it('turns a date serial into an ISO date, but keeps a date with a time as shown', () => {
		const html = sheetsHtml([[
			sheetsCell({ 1: 3, 3: 46088 }, 'Mar 7, 2026', { 1: 5, 2: 'mmm d, yyyy' }),
			sheetsCell({ 1: 3, 3: 46088.5 }, '3/7/2026 12:00:00', { 1: 5, 2: 'M/d/yyyy H:mm:ss' })
		]]);
		const [date, stamp] = parseClipboard(html, '')![0];
		expect(date).toMatchObject({ kind: 'date', value: '2026-03-07' });
		expect(stamp).toMatchObject({ kind: 'text', text: '3/7/2026 12:00:00' });
	});

	it('does not read a text-formatted "007" as a number, and keeps literal currency words out of dates', () => {
		const html = sheetsHtml([[sheetsCell({ 1: 2, 2: '007' }, '007'), sheetsCell({ 1: 3, 3: 5 }, '5 USD', { 1: 2, 2: '0 "USD"' })]]);
		const [code, amount] = parseClipboard(html, '')![0];
		expect(code).toMatchObject({ kind: 'text', text: '007' });
		expect(amount).toMatchObject({ kind: 'number', value: 5 });
	});

	it('unwraps Google redirect links and keeps the link beside the label', () => {
		const html = sheetsHtml([[`<td data-sheets-value='${JSON.stringify({ 1: 2, 2: 'Docs' })}'><a href="https://www.google.com/url?q=https://example.com/a%3Fb%3D1&amp;sa=D">Docs</a></td>`]]);
		expect(parseClipboard(html, '')![0][0]).toMatchObject({ text: 'Docs', href: 'https://example.com/a?b=1' });
	});

	it('expands merged cells so columns stay aligned and keeps line breaks', () => {
		const html = '<table><tr><td colspan="2">wide</td><td>x</td></tr><tr><td rowspan="2">tall</td><td>b</td><td>c<br>d</td></tr><tr><td>e</td><td>f</td></tr></table>';
		const grid = parseClipboard(html, '')!;
		expect(grid.map((row) => row.map((cell) => cell.text))).toEqual([['wide', '', 'x'], ['tall', 'b', 'c\nd'], ['', 'e', 'f']]);
	});

	it('falls back to the text when the HTML holds no table', () => {
		expect(parseClipboard('<p>hi</p>', 'a\tb')![0].map((cell) => cell.text)).toEqual(['a', 'b']);
	});
});

describe('pasting into a Collection', () => {
	const tracker = () => {
		let collection = createCollection('Budget', 'blank');
		collection = addField(collection, 'Amount', 'number');
		collection = addField(collection, 'Paid', 'checkbox');
		collection = addField(collection, 'Due', 'date');
		return collection;
	};
	const grid = parseClipboard('', 'Rent\t1,200\tTRUE\t3/7/2026\nPhone\t$45.50\tFALSE\t3/9/2026')!;

	it('fills across rows and columns, adding records, and converts each value to its field', () => {
		const collection = tracker();
		const result = pasteGrid(collection, grid, target(collection));
		expect(result.newRecords).toBe(2);
		expect(result.newFields).toBe(0);
		expect(isCollection(result.collection)).toBe(true);
		const [first, second] = result.collection.records;
		const [name, amount, paid, due] = collection.fields.map((field) => field.id);
		expect(first.values).toMatchObject({ [name]: 'Rent', [amount]: 1200, [paid]: true, [due]: '2026-03-07' });
		expect(second.values).toMatchObject({ [name]: 'Phone', [amount]: 45.5, [paid]: false, [due]: '2026-03-09' });
	});

	it('starts at the selected cell and overwrites existing records before adding more', () => {
		let collection = tracker();
		collection = addRecord(addRecord(collection));
		const result = pasteGrid(collection, grid, target(collection, 1, 1));
		expect(result.newRecords).toBe(1);
		expect(result.collection.records).toHaveLength(3);
		const [name, amount] = collection.fields.map((field) => field.id);
		expect(result.collection.records[0].values[amount]).toBeNull();
		// Column 1 receives "Rent" in a number field; words cannot become a number, so it is left alone.
		expect(result.collection.records[1].values[amount]).toBeNull();
		expect(result.skipped).toBeGreaterThan(0);
		expect(result.collection.records[1].values[name]).toBeNull();
	});

	it('adds fields past the last column, typed from what was pasted', () => {
		const collection = createCollection('Wide', 'blank');
		const pasted = parseClipboard('', 'Rent\t1200\tTRUE\t3/7/2026\t$5.00\thttps://a.example\nPhone\t45\tFALSE\t3/9/2026\t$6.00\thttps://b.example')!;
		const result = pasteGrid(collection, pasted, target(collection));
		expect(result.newFields).toBe(5);
		expect(result.collection.fields.map((field) => field.type)).toEqual(['text', 'number', 'checkbox', 'date', 'text', 'url']);
		expect(result.collection.views.table.columnOrder).toHaveLength(6);
		expect(isCollection(result.collection)).toBe(true);
		// Currency stays as shown, since a Number field would drop the symbol.
		expect(result.collection.records[0].values[result.collection.fields[4].id]).toBe('$5.00');
	});

	it('matches select options by label and adds the ones it has not seen', () => {
		let collection = createCollection('Status', 'tracker');
		const result = pasteGrid(collection, parseClipboard('', 'A\tdone\nB\tBlocked')!, target(collection));
		const status = result.collection.fields[1];
		const done = status.config!.options!.find((option) => option.label === 'Done')!;
		const blocked = status.config!.options!.find((option) => option.label === 'Blocked')!;
		expect(blocked).toBeTruthy();
		expect(status.config!.options).toHaveLength(4);
		expect(result.collection.records[0].values[status.id]).toBe(done.id);
		expect(result.collection.records[1].values[status.id]).toBe(blocked.id);
		expect(isCollection(result.collection)).toBe(true);
	});

	it('uses a link as the value of a URL field', () => {
		const collection = createCollection('Links', 'research');
		const html = sheetsHtml([[
			sheetsCell({ 1: 2, 2: 'Docs' }, 'Docs'),
			`<td data-sheets-value='${JSON.stringify({ 1: 2, 2: 'example' })}'><a href="https://example.com">example</a></td>`
		]]);
		const result = pasteGrid(collection, parseClipboard(html, '')!, target(collection));
		expect(result.collection.records[0].values[result.collection.fields[1].id]).toBe('https://example.com');
	});

	it('never writes to synced columns or Relations', () => {
		const collection = createCollection('People', 'mycelium-people');
		const result = pasteGrid(collection, parseClipboard('', 'Ada\tshe/her')!, target(collection));
		expect(result.collection.records[0].values[collection.fields[0].id]).toBeNull();
		expect(result.collection.records[0].values[collection.fields[1].id]).toBeNull();
	});

	it('does nothing for an empty grid', () => {
		const collection = tracker();
		expect(pasteGrid(collection, [], target(collection)).collection).toBe(collection);
	});
});
