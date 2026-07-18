#!/usr/bin/env node
// Publishes a shelf export (the JSON you get from add-page.html's "Export
// shelf as JSON") into the live app: writes each entry's HTML to
// textbook-{slug}.html and inserts/updates its card in index.html's deck.
//
// Replaces the old two-step-by-hand flow (drop the downloaded file in,
// hand-paste the card markup after the last <a class="card63">). Safe to
// re-run: entries whose slug is already published get their card block
// replaced in place instead of duplicated.
//
// Usage:
//   node apps/ologypedia/scripts/publish.mjs <shelf-export.json> [--dry-run]
//
// --dry-run prints what would change without writing anything.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const indexPath = path.join(appDir, 'index.html');

const RESERVED_SLUGS = new Set(['chrome-blocks', 'example-blocks']);
const SLUG_RE = /^[a-z0-9-]+$/;
// leading [ \t]* is captured too, so a replace swaps the whole indented line
// rather than stacking a second copy of the indent onto the original's.
const CARD_RE = /[ \t]*<a class="card63[^"]*" data-slug="([^"]+)"[\s\S]*?<\/a>/g;
const SHELVED_COMMENT = '<!-- shelved cards — committed, readable by anyone -->';
const EDITOR_CARD_RE = /<a class="editor-card"[\s\S]*?<\/a>/;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCard(entry) {
  const accent = entry.accent || 'rose';
  const fx = entry.finish && entry.finish !== 'none' ? ` fx-${entry.finish}` : '';
  const glyph = escapeHtml(entry.glyph || '✦');
  const blurb = escapeHtml(entry.desc || 'One line on what it covers and which example blocks it uses.');
  const lines = [
    `    <a class="card63 acc-${accent}${fx}" data-slug="${entry.slug}" href="/ologypedia/textbook-${entry.slug}.html">`,
    `      <div class="c-inner">`,
    `        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>`,
  ];
  if (entry.subject) lines.push(`        <span class="c-kicker">${escapeHtml(entry.subject)}</span>`);
  lines.push(
    `        <div class="c-core">`,
    `          <div class="c-medallion"><span class="c-glyph">${glyph}</span></div>`,
    `          <h2 class="c-title">${escapeHtml(entry.title)}</h2>`,
    `          <p class="c-blurb">${blurb}</p>`,
    `        </div>`,
    `        <span class="c-foot"><span class="c-read">Read &#10022;</span><span class="c-brand">Ologypedia</span></span>`,
    `      </div>`,
    `    </a>`,
  );
  return lines.join('\n');
}

function findCards(html) {
  return [...html.matchAll(CARD_RE)].map((m) => ({
    slug: m[1],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

function findInsertionPoint(html) {
  const existing = findCards(html);
  if (existing.length) return existing[existing.length - 1].end;

  const shelvedIdx = html.indexOf(SHELVED_COMMENT);
  if (shelvedIdx !== -1) return shelvedIdx + SHELVED_COMMENT.length;

  const editorMatch = EDITOR_CARD_RE.exec(html);
  if (editorMatch) return editorMatch.index + editorMatch[0].length;

  throw new Error(
    'Could not find a safe insertion point in index.html (no existing cards, ' +
    'no "shelved cards" comment, no editor-card). The deck markup may have ' +
    'changed shape — publish this entry by hand once, then re-run.'
  );
}

function publishToIndex(indexHtml, entries) {
  const existing = findCards(indexHtml);
  const existingBySlug = new Map(existing.map((c) => [c.slug, c]));

  const newEntries = entries.filter((e) => !existingBySlug.has(e.slug));
  const updateEntries = entries.filter((e) => existingBySlug.has(e.slug));

  let html = indexHtml;

  // Insert brand-new cards first — always after the last existing card, so
  // none of the offsets recorded above shift before we use them below.
  if (newEntries.length) {
    const insertAt = findInsertionPoint(html);
    const block = '\n\n' + newEntries.map(renderCard).join('\n\n');
    html = html.slice(0, insertAt) + block + html.slice(insertAt);
  }

  // Replace updated cards in place, highest offset first, so each splice
  // leaves the not-yet-processed offsets valid.
  const toReplace = updateEntries
    .map((e) => ({ entry: e, card: existingBySlug.get(e.slug) }))
    .sort((a, b) => b.card.start - a.card.start);
  for (const { entry, card } of toReplace) {
    html = html.slice(0, card.start) + renderCard(entry) + html.slice(card.end);
  }

  return { html, added: newEntries.map((e) => e.slug), updated: updateEntries.map((e) => e.slug) };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const shelfPath = args.find((a) => !a.startsWith('--'));

  if (!shelfPath) {
    console.error('Usage: node apps/ologypedia/scripts/publish.mjs <shelf-export.json> [--dry-run]');
    process.exit(1);
  }
  if (!existsSync(shelfPath)) {
    console.error(`No such file: ${shelfPath}`);
    process.exit(1);
  }

  let shelf;
  try {
    shelf = JSON.parse(readFileSync(shelfPath, 'utf8'));
  } catch (e) {
    console.error(`Not valid JSON: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(shelf)) {
    console.error('Expected a JSON array (the file from "Export shelf as JSON").');
    process.exit(1);
  }

  const valid = [];
  const skipped = [];
  for (const e of shelf) {
    if (!e || typeof e !== 'object' || !e.slug || !e.title || !e.html) {
      skipped.push({ slug: e && e.slug, reason: 'missing slug, title, or html' });
      continue;
    }
    if (!SLUG_RE.test(e.slug)) {
      skipped.push({ slug: e.slug, reason: 'slug has characters outside [a-z0-9-]' });
      continue;
    }
    if (RESERVED_SLUGS.has(e.slug)) {
      skipped.push({ slug: e.slug, reason: 'reserved slug (collides with a block-library file)' });
      continue;
    }
    valid.push(e);
  }

  if (skipped.length) {
    console.warn('Skipped entries:');
    for (const s of skipped) console.warn(`  - ${s.slug || '(no slug)'}: ${s.reason}`);
  }
  if (!valid.length) {
    console.log('Nothing publishable in this shelf.');
    return;
  }

  const indexHtml = readFileSync(indexPath, 'utf8');
  const { html: newIndexHtml, added, updated } = publishToIndex(indexHtml, valid);

  console.log(`Files ${dryRun ? 'to write' : 'written'}:`);
  for (const e of valid) {
    const rel = path.relative(process.cwd(), path.join(appDir, `textbook-${e.slug}.html`));
    console.log(`  - ${rel}`);
    if (!dryRun) writeFileSync(path.join(appDir, `textbook-${e.slug}.html`), e.html);
  }

  if (!dryRun) writeFileSync(indexPath, newIndexHtml);

  console.log(`\nindex.html: ${added.length} card(s) added, ${updated.length} updated.${dryRun ? ' (dry run — not written)' : ''}`);
  if (added.length) console.log(`  added:   ${added.join(', ')}`);
  if (updated.length) console.log(`  updated: ${updated.join(', ')}`);
  console.log('\nReview the diff before committing — this script edits a checked-in file.');
}

main();
