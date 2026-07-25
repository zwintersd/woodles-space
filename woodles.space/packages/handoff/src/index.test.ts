import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageLike } from '@woodles/persistence';
import {
	HANDOFF_TARGETS,
	QUEUE_LIMIT,
	createHandoffQueue,
	handoffKey,
	pendingCounts,
	sendHandoff,
	type HandoffSource
} from './index';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: (key) => void map.delete(key)
	};
}

/** A storage that accepts reads but refuses every write, like a full quota. */
function readOnlyStorage(seed: Map<string, string>): StorageLike {
	return {
		getItem: (key) => seed.get(key) ?? null,
		setItem: () => {
			throw new Error('quota');
		},
		removeItem: () => void 0
	};
}

const SOURCE: HandoffSource = { app: 'notebook', label: 'a thought' };

let storage: ReturnType<typeof memoryStorage>;
let counter: number;
const options = () => ({
	storage,
	now: () => '2026-07-25T00:00:00.000Z',
	newId: () => `h-${++counter}`
});

beforeEach(() => {
	storage = memoryStorage();
	counter = 0;
});

describe('the envelope', () => {
	it('stamps id, target, and time, and normalizes what the caller left loose', () => {
		const queue = createHandoffQueue('spores', options());
		const result = queue.send({
			title: '  a spore  ',
			body: 'some words',
			tags: [' garden ', '', '   ', 'notes'],
			source: SOURCE
		});

		expect(result.ok).toBe(true);
		expect(result.handoff).toEqual({
			id: 'h-1',
			target: 'spores',
			title: 'a spore',
			body: 'some words',
			format: 'text',
			tags: ['garden', 'notes'],
			source: SOURCE,
			createdAt: '2026-07-25T00:00:00.000Z'
		});
	});

	it('defaults an empty capture rather than refusing it', () => {
		// The front door must never reject. An empty thought is still a thought.
		const queue = createHandoffQueue('notebook', options());
		const result = queue.send({ source: SOURCE });

		expect(result.ok).toBe(true);
		expect(result.handoff.title).toBe('');
		expect(result.handoff.body).toBe('');
		expect(result.handoff.tags).toEqual([]);
		expect(result.handoff.format).toBe('text');
	});

	it('carries html through untouched, leaving sanitizing to the receiver', () => {
		const queue = createHandoffQueue('write', options());
		const body = '<p>kept <em>as-is</em></p>';
		queue.send({ body, format: 'html', source: SOURCE });

		expect(queue.peek()[0].body).toBe(body);
		expect(queue.peek()[0].format).toBe('html');
	});
});

describe('queues', () => {
	it('keeps one queue per target so targets cannot swallow each other', () => {
		createHandoffQueue('spores', options()).send({ title: 'for spores', source: SOURCE });
		createHandoffQueue('write', options()).send({ title: 'for write', source: SOURCE });

		expect(createHandoffQueue('spores', options()).peek().map((h) => h.title)).toEqual([
			'for spores'
		]);
		expect(createHandoffQueue('write', options()).peek().map((h) => h.title)).toEqual(['for write']);
		expect(createHandoffQueue('notebook', options()).peek()).toEqual([]);
	});

	it('preserves arrival order across separate sends', () => {
		const queue = createHandoffQueue('notebook', options());
		queue.send({ title: 'first', source: SOURCE });
		queue.send({ title: 'second', source: SOURCE });
		queue.send({ title: 'third', source: SOURCE });

		expect(queue.peek().map((h) => h.title)).toEqual(['first', 'second', 'third']);
	});

	it('drains everything once and leaves the queue empty', () => {
		const queue = createHandoffQueue('spores', options());
		queue.send({ title: 'a', source: SOURCE });
		queue.send({ title: 'b', source: SOURCE });

		const drained = queue.drain();
		expect(drained.cleared).toBe(true);
		expect(drained.items.map((h) => h.title)).toEqual(['a', 'b']);
		expect(queue.drain().items).toEqual([]);
		expect(queue.count()).toBe(0);
	});

	it('drops the oldest rather than the newest once past the limit', () => {
		const queue = createHandoffQueue('notebook', options());
		for (let i = 0; i < QUEUE_LIMIT; i += 1) queue.send({ title: `n${i}`, source: SOURCE });
		expect(queue.count()).toBe(QUEUE_LIMIT);

		const overflow = queue.send({ title: 'newest', source: SOURCE });
		expect(overflow.trimmed).toBe(true);

		const items = queue.peek();
		expect(items).toHaveLength(QUEUE_LIMIT);
		expect(items.at(-1)?.title).toBe('newest');
		expect(items[0].title).toBe('n1');
	});

	it('counts every target for a file-these-somewhere hint', () => {
		createHandoffQueue('spores', options()).send({ source: SOURCE });
		createHandoffQueue('spores', options()).send({ source: SOURCE });
		createHandoffQueue('write', options()).send({ source: SOURCE });

		expect(pendingCounts(options())).toEqual({ notebook: 0, spores: 2, write: 1 });
	});
});

describe('failure is never silent loss', () => {
	it('still accepts a capture when the existing queue is corrupt', () => {
		storage.map.set(handoffKey('spores'), '{ not json at all');
		const queue = createHandoffQueue('spores', options());

		const result = queue.send({ title: 'survives', source: SOURCE });
		expect(result.ok).toBe(true);
		expect(result.issue).not.toBeNull();
		expect(queue.peek().map((h) => h.title)).toEqual(['survives']);
	});

	it('discards entries of the wrong shape instead of failing the whole queue', () => {
		storage.map.set(
			handoffKey('notebook'),
			JSON.stringify({ items: [{ id: 'x', title: 'malformed' }] })
		);
		const queue = createHandoffQueue('notebook', options());

		queue.send({ title: 'good', source: SOURCE });
		expect(queue.peek().map((h) => h.title)).toEqual(['good']);
	});

	it('reports a failed write rather than pretending the send worked', () => {
		const queue = createHandoffQueue('spores', { ...options(), storage: readOnlyStorage(new Map()) });
		const result = queue.send({ title: 'lost', source: SOURCE });

		expect(result.ok).toBe(false);
		expect(result.issue).not.toBeNull();
	});

	it('returns items even when the queue cannot be emptied, flagging the risk', () => {
		// Better to hand the same thought over twice than to drop it. Receivers
		// dedupe on id; nothing recovers a capture that was silently dropped.
		const queue = createHandoffQueue('write', options());
		queue.send({ title: 'kept', source: SOURCE });

		const stuck = createHandoffQueue('write', {
			...options(),
			storage: readOnlyStorage(storage.map)
		});
		const drained = stuck.drain();

		expect(drained.items.map((h) => h.title)).toEqual(['kept']);
		expect(drained.cleared).toBe(false);
	});

	it('works with no storage at all instead of throwing', () => {
		const queue = createHandoffQueue('notebook', { ...options(), storage: null });
		expect(() => queue.send({ title: 'nowhere', source: SOURCE })).not.toThrow();
		expect(queue.peek()).toEqual([]);
	});
});

describe('the target list', () => {
	it('covers only apps that can receive, and keys them distinctly', () => {
		expect([...HANDOFF_TARGETS]).toEqual(['notebook', 'spores', 'write']);
		const keys = HANDOFF_TARGETS.map(handoffKey);
		expect(new Set(keys).size).toBe(keys.length);
		for (const key of keys) expect(key).toMatch(/^woodles\.handoff\.[a-z]+\.v1$/);
	});

	it('exposes a one-shot send for wiring a single button', () => {
		const result = sendHandoff('spores', { title: 'one shot', source: SOURCE }, options());
		expect(result.ok).toBe(true);
		expect(createHandoffQueue('spores', options()).peek().map((h) => h.title)).toEqual(['one shot']);
	});
});
