import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const OUTPUT_MD = path.join(ROOT_DIR, 'marginalia_text.md');
const OUTPUT_CSV = path.join(ROOT_DIR, 'marginalia_text.csv');

// List of files to process (relative to ROOT_DIR)
const contentFiles = [
	'src/lib/witch/content/assumptions.ts',
	'src/lib/witch/content/conditions.ts',
	'src/lib/witch/content/emergences.ts',
	'src/lib/witch/content/journal.ts',
	'src/lib/witch/content/life.ts',
	'src/lib/witch/content/titles.ts'
];

const svelteFiles = [
	'src/routes/+page.svelte',
	'src/routes/+layout.svelte',
	'src/lib/arcade/Arcade.svelte',
	'src/lib/arcade/TwoZeroFourEight.svelte',
	'src/lib/components/reading/EditorToolbar.svelte',
	'src/lib/components/reading/MarginNotes.svelte',
	'src/lib/components/reading/Passage.svelte',
	'src/lib/components/reading/PdfIntake.svelte',
	'src/lib/components/reading/ReadingRoom.svelte',
	'src/lib/components/reading/SelectionBubble.svelte',
	'src/lib/components/reading/Star.svelte',
	'src/lib/components/reading/StarShelf.svelte',
	'src/lib/witch/Ledger.svelte',
	'src/lib/witch/TheWeb.svelte',
	'src/lib/witch/TheWorld.svelte',
	'src/app.html'
];

const results = [];

// Helper to escape CSV fields
function escapeCSV(text) {
	if (!text) return '';
	return '"' + text.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

// 1. Process TS Content Files
for (const file of contentFiles) {
	const filePath = path.join(ROOT_DIR, file);
	if (!fs.existsSync(filePath)) continue;
	const code = fs.readFileSync(filePath, 'utf-8');

	const regex = /(phrase|enables|text|notice|observe|study|know|earnedNote|name):\s*(['"`])([\s\S]*?)(?<!\\)\2/g;
	let match;
	while ((match = regex.exec(code)) !== null) {
		const key = match[1];
		let val = match[3].trim();
		if (key === 'name' && (val.length < 3 || val === val.toUpperCase())) continue;
		const quote = match[2];
		if (quote === "'") val = val.replace(/\\'/g, "'");
		if (quote === '"') val = val.replace(/\\"/g, '"');
		if (val) {
			results.push({
				source: `${file} (${key})`,
				text: val
			});
		}
	}
}

// 2. Process Svelte Files
const BLOCK_TAGS = /<\/?(address|article|aside|blockquote|details|dialog|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hgroup|hr|li|main|menu|nav|ol|p|pre|section|table|ul|tr|td|th|label|textarea|option|select)(?:\s+[^>]*)*>/gi;
const INLINE_TAGS = /<[a-z0-9]+(?:\s+[^>]*)*>|<\/[a-z0-9]+>/gi;
const SVELTE_DIRECTIVES = /\{\s*(?:[#\/:]\w+|@(?:const|html|debug))[^}]*\}/gi;

for (const file of svelteFiles) {
	const filePath = path.join(ROOT_DIR, file);
	if (!fs.existsSync(filePath)) continue;
	let code = fs.readFileSync(filePath, 'utf-8');

	// Remove Svelte comments
	code = code.replace(/<!--[\s\S]*?-->/g, '');
	// Remove script blocks
	code = code.replace(/<script[\s\S]*?<\/script>/g, '');
	// Remove style blocks
	code = code.replace(/<style[\s\S]*?<\/style>/g, '');

	// Replace block-level tags with newlines
	let textOnly = code.replace(BLOCK_TAGS, '\n');
	// Strip Svelte directives like {#if ...}, {@const ...}, {:else}
	textOnly = textOnly.replace(SVELTE_DIRECTIVES, '');
	// Strip all remaining inline HTML tags (a, span, strong, em, etc.) WITHOUT introducing newlines
	textOnly = textOnly.replace(INLINE_TAGS, '');

	const lines = textOnly.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		// Skip empty lines or pure symbols/formatting leftovers
		if (!trimmed) continue;
		if (trimmed.startsWith(':') || trimmed.startsWith('/') || trimmed.startsWith('#')) continue;
		if (trimmed === 'else' || trimmed === 'then') continue;
		if (/^[0-9\s\p{P}]+$/u.test(trimmed)) continue; // only numbers and symbols
		if (trimmed.length < 3) continue;

		// Skip if the line has no actual literal text (only variables/expressions like {cat.label})
		const noExpressions = trimmed.replace(/\{[^{}]+\}/g, '').trim();
		const hasText = /[a-zA-Z]{2,}/.test(noExpressions);
		if (!hasText) continue;

		results.push({
			source: file,
			text: trimmed
		});
	}
}

// 3. Deduplicate
const uniqueResults = [];
const seen = new Set();
for (const r of results) {
	const key = `${r.source}::${r.text}`;
	if (!seen.has(key)) {
		seen.add(key);
		uniqueResults.push(r);
	}
}

// 4. Generate Markdown Spreadsheet format
let mdContent = `# Marginalia User Facing Text

This document lists all user-facing text extracted from the **Marginalia** app.

## Spreadsheet Format (Table)

| Original Line | Edits / Changes | Notes | File Source |
| :--- | :--- | :--- | :--- |
`;

for (const r of uniqueResults) {
	mdContent += `| ${r.text.replace(/\|/g, '\\|')} | | | [${path.basename(r.source)}](${r.source}) |\n`;
}

mdContent += `\n## Block Format (Editable List)\n\n`;
for (const [index, r] of uniqueResults.entries()) {
	mdContent += `### Line ${index + 1}
**Original**: ${r.text}
**Edit**: 
**Note**: 
**Source**: ${r.source}

---\n\n`;
}

fs.writeFileSync(OUTPUT_MD, '\ufeff' + mdContent, 'utf-8');

// 5. Generate CSV Spreadsheet format
let csvContent = 'Original Line,Edits/Changes,Notes,Source\n';
for (const r of uniqueResults) {
	csvContent += `${escapeCSV(r.text)},,,${escapeCSV(r.source)}\n`;
}
fs.writeFileSync(OUTPUT_CSV, '\ufeff' + csvContent, 'utf-8');

console.log(`Successfully extracted ${uniqueResults.length} unique text lines.`);
console.log(`Saved Markdown to: ${OUTPUT_MD}`);
console.log(`Saved CSV to: ${OUTPUT_CSV}`);
