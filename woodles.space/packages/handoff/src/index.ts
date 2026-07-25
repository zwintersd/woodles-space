import { createVersionedStorage, type PersistenceIssue, type StorageLike } from '@woodles/persistence';

/**
 * The handoff spine: one app hands a thought to another without the person
 * having to decide, at capture time, which app it belonged in.
 *
 * The problem this exists for is written up in CONVERGENCE.md §3 — four
 * inboxes, no promotion path, so the first guess is permanent and therefore
 * feels high-stakes. A handoff makes the first guess cheap: put it anywhere,
 * move it later.
 *
 * Deliberately same-origin localStorage only. Making a capture on the phone
 * appear on the laptop means routing it through `api/sync.ts`, which is a much
 * bigger promise than the routing problem needs (CONVERGENCE.md §6.4).
 */

/** Apps that can receive a handoff. Read targets (echoes, ologypedia) can't. */
export const HANDOFF_TARGETS = ['notebook', 'spores', 'write'] as const;

export type HandoffTarget = (typeof HANDOFF_TARGETS)[number];

/** How to read `body`. Plain text is the safe default; HTML is sanitized by the receiver, never here. */
export type HandoffFormat = 'text' | 'html';

export interface HandoffSource {
	/** Manifest app id the thought came from, e.g. `notebook`. */
	app: string;
	/** Optional human label for provenance, e.g. the note's title. */
	label?: string;
	/** Optional deep link back to where it came from. */
	href?: string;
}

export interface Handoff {
	id: string;
	target: HandoffTarget;
	title: string;
	body: string;
	format: HandoffFormat;
	tags: string[];
	source: HandoffSource;
	createdAt: string;
}

/** What a caller supplies; the queue fills in id, target, and createdAt. */
export type HandoffDraft = {
	title?: string;
	body?: string;
	format?: HandoffFormat;
	tags?: string[];
	source: HandoffSource;
};

type Queue = { items: Handoff[] };

/**
 * Oldest handoffs past this are dropped on write. A queue is a hallway, not a
 * home — anything that sits here unclaimed for 200 captures is not being
 * collected, and an unbounded queue is a quota failure waiting to happen in the
 * one place that must never refuse a capture.
 */
export const QUEUE_LIMIT = 200;

export function handoffKey(target: HandoffTarget): string {
	return `woodles.handoff.${target}.v1`;
}

export type HandoffOptions = {
	storage?: StorageLike | null;
	now?: () => string;
	newId?: () => string;
};

export type SendResult = {
	ok: boolean;
	handoff: Handoff;
	/** True when older entries were dropped to stay under QUEUE_LIMIT. */
	trimmed: boolean;
	issue: PersistenceIssue | null;
};

export type DrainResult = {
	items: Handoff[];
	/**
	 * False when the queue could not be emptied after reading. The items are
	 * still returned — a duplicate is a far cheaper failure than a lost thought
	 * — so receivers should ignore ids they have already ingested.
	 */
	cleared: boolean;
	issue: PersistenceIssue | null;
};

function isHandoffSource(value: unknown): value is HandoffSource {
	if (!isRecord(value)) return false;
	return (
		typeof value.app === 'string' &&
		(value.label === undefined || typeof value.label === 'string') &&
		(value.href === undefined || typeof value.href === 'string')
	);
}

function isHandoff(value: unknown): value is Handoff {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.title === 'string' &&
		typeof value.body === 'string' &&
		typeof value.createdAt === 'string' &&
		(value.format === 'text' || value.format === 'html') &&
		HANDOFF_TARGETS.includes(value.target as HandoffTarget) &&
		Array.isArray(value.tags) &&
		value.tags.every((tag) => typeof tag === 'string') &&
		isHandoffSource(value.source)
	);
}

function isQueue(value: unknown): value is Queue {
	return isRecord(value) && Array.isArray(value.items) && value.items.every(isHandoff);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultId(): string {
	return 'h-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/**
 * A queue per target. Kept as its own versioned document rather than one shared
 * blob so a corrupt inbox for one app can never swallow another app's captures.
 */
export function createHandoffQueue(target: HandoffTarget, options: HandoffOptions = {}) {
	const storage = createVersionedStorage<Queue>({
		key: handoffKey(target),
		version: 1,
		fallback: () => ({ items: [] }),
		validate: isQueue,
		...(options.storage === undefined ? {} : { storage: options.storage }),
		...(options.now === undefined ? {} : { now: options.now })
	});
	const now = options.now ?? (() => new Date().toISOString());
	const newId = options.newId ?? defaultId;

	function read(): { items: Handoff[]; issue: PersistenceIssue | null } {
		const result = storage.load();
		return { items: result.value.items, issue: result.issue };
	}

	return {
		target,
		key: handoffKey(target),

		/** Queue a thought for this target. Never throws; reports failure instead. */
		send(draft: HandoffDraft): SendResult {
			const handoff: Handoff = {
				id: newId(),
				target,
				title: (draft.title ?? '').trim(),
				body: draft.body ?? '',
				format: draft.format ?? 'text',
				tags: (draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
				source: draft.source,
				createdAt: now()
			};

			// A corrupt queue still accepts the new item: load() falls back to an
			// empty document rather than refusing, which is the right trade here.
			const existing = read();
			const next = [...existing.items, handoff];
			const trimmed = next.length > QUEUE_LIMIT;
			const saved = storage.save({ items: trimmed ? next.slice(-QUEUE_LIMIT) : next });

			return {
				ok: saved.ok,
				handoff,
				trimmed,
				issue: saved.issue ?? existing.issue
			};
		},

		/** Read everything waiting and empty the queue. */
		drain(): DrainResult {
			const { items, issue } = read();
			if (items.length === 0) return { items: [], cleared: true, issue };
			const saved = storage.save({ items: [] });
			return { items, cleared: saved.ok, issue: saved.issue ?? issue };
		},

		/** How many are waiting, without consuming them. */
		count(): number {
			return read().items.length;
		},

		/** Read without consuming. */
		peek(): Handoff[] {
			return read().items;
		}
	};
}

export type HandoffQueue = ReturnType<typeof createHandoffQueue>;

/**
 * Convenience for the common one-shot send, e.g. wiring a "send to spores"
 * button. Prefer `createHandoffQueue` when a surface sends repeatedly.
 */
export function sendHandoff(
	target: HandoffTarget,
	draft: HandoffDraft,
	options: HandoffOptions = {}
): SendResult {
	return createHandoffQueue(target, options).send(draft);
}

/** Total waiting across every target — for a "you have things to file" hint. */
export function pendingCounts(options: HandoffOptions = {}): Record<HandoffTarget, number> {
	const counts = {} as Record<HandoffTarget, number>;
	for (const target of HANDOFF_TARGETS) {
		counts[target] = createHandoffQueue(target, options).count();
	}
	return counts;
}
