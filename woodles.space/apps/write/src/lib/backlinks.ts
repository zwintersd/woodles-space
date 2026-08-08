import { readReferences } from './htmlTools';
import { loadDraft, type DraftIndexItem } from './drafts';

/**
 * Which other drafts reference this one — Write's answer to Spores'
 * `backlinksOf`. Spores stored `[[wikilinks]]` as plain text and derived
 * backlinks from a title match; Write already stores references as
 * `data-ref-*` anchors (the `#`/`@` picker, see `references.svelte.ts`), so
 * this reads the same way the mentions ledger does — by scanning stored HTML
 * for `data-ref-app="write" data-ref-kind="draft"` rather than inventing a
 * second link syntax.
 *
 * Derived, never stored, for the same reason as everywhere else this pattern
 * appears in this workspace: a rename can't leave a backlink lying, and there
 * is no second copy of "what points here" to drift from the prose itself.
 */
export function draftsReferencing(targetId: string, index: DraftIndexItem[]): DraftIndexItem[] {
	const out: DraftIndexItem[] = [];
	for (const item of index) {
		if (item.id === targetId) continue;
		const body = loadDraft(item.id);
		if (!body?.layers) continue;
		const html = Object.values(body.layers)
			.map((layer) => layer?.html ?? '')
			.join('\n');
		if (html.length === 0) continue;
		const references = readReferences(html);
		if (references.some((ref) => ref.app === 'write' && ref.kind === 'draft' && ref.id === targetId)) {
			out.push(item);
		}
	}
	return out;
}

/**
 * How many other drafts reference each draft, in one pass over the index —
 * what a "referenced by N" badge in a list needs, without the O(n²) reads
 * that calling `draftsReferencing` once per item would do.
 */
export function backlinkCounts(index: DraftIndexItem[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const item of index) {
		const body = loadDraft(item.id);
		if (!body?.layers) continue;
		const html = Object.values(body.layers)
			.map((layer) => layer?.html ?? '')
			.join('\n');
		if (html.length === 0) continue;
		for (const ref of readReferences(html)) {
			if (ref.app !== 'write' || ref.kind !== 'draft' || ref.id === item.id) continue;
			counts.set(ref.id, (counts.get(ref.id) ?? 0) + 1);
		}
	}
	return counts;
}
