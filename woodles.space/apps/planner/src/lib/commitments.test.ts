// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import {
	readCommitmentsBlob,
	CARILLON_COMMITMENTS_STORAGE_KEY,
	CARILLON_COMMITMENTS_VERSION
} from '@woodles/sync';
import { buildCommitments, commitmentsMatch } from './commitments';
import { PlannerStore } from './store.svelte';
import type { Block, Task } from './types';

function task(overrides: Partial<Task> & { id: string }): Task {
	return {
		title: 'read a chapter',
		status: 'open',
		createdAt: '2026-08-09T09:00:00.000Z',
		updatedAt: '2026-08-09T09:00:00.000Z',
		...overrides
	};
}

const blocks: Block[] = [
	{ id: 'evening', startTime: '20:00', endTime: '21:00', title: 'evening' }
];

describe('buildCommitments', () => {
	it('publishes only tasks that are about a Thinking About entry', () => {
		const blob = buildCommitments(
			[
				task({ id: 't1', thinkingAboutEntryId: 'piranesi' }),
				task({ id: 't2', title: 'unrelated errand' })
			],
			blocks
		);

		expect(blob.version).toBe(CARILLON_COMMITMENTS_VERSION);
		expect(blob.commitments.map((c) => c.taskId)).toEqual(['t1']);
	});

	it('resolves the block into a time, and copes without one', () => {
		const blob = buildCommitments(
			[
				task({
					id: 't1',
					thinkingAboutEntryId: 'p',
					targetDate: '2026-08-13',
					targetBlockId: 'evening'
				}),
				task({ id: 't2', thinkingAboutEntryId: 'p', targetDate: '2026-08-14' })
			],
			blocks
		);

		expect(blob.commitments[0]).toMatchObject({
			date: '2026-08-13',
			time: '20:00',
			blockTitle: 'evening'
		});
		// Scheduled to a day but not an hour — an intention without a time.
		expect(blob.commitments[1]).toMatchObject({ date: '2026-08-14', time: null, blockTitle: null });
	});

	it('leaves out a dropped task and keeps a done one', () => {
		const blob = buildCommitments(
			[
				task({ id: 'done', thinkingAboutEntryId: 'p', status: 'done' }),
				task({ id: 'dropped', thinkingAboutEntryId: 'p', status: 'dropped' })
			],
			blocks
		);

		expect(blob.commitments.map((c) => c.taskId)).toEqual(['done']);
		expect(blob.commitments[0].status).toBe('done');
	});

	it('carries nothing about the plan beyond when and whether', () => {
		const blob = buildCommitments(
			[
				task({
					id: 't1',
					thinkingAboutEntryId: 'p',
					domainId: 'domain-secret',
					notes: 'a private note',
					estimatedDuration: 45
				})
			],
			blocks
		);

		const published = JSON.stringify(blob);
		expect(published).not.toContain('domain-secret');
		expect(published).not.toContain('a private note');
	});

	it('puts the soonest first and the undated last', () => {
		const blob = buildCommitments(
			[
				task({ id: 'someday', thinkingAboutEntryId: 'p' }),
				task({ id: 'later', thinkingAboutEntryId: 'p', targetDate: '2026-08-20' }),
				task({ id: 'sooner', thinkingAboutEntryId: 'p', targetDate: '2026-08-10' })
			],
			blocks
		);

		expect(blob.commitments.map((c) => c.taskId)).toEqual(['sooner', 'later', 'someday']);
	});

	it('round-trips through the contract validator', () => {
		const blob = buildCommitments([task({ id: 't1', thinkingAboutEntryId: 'p' })], blocks);
		expect(readCommitmentsBlob(JSON.parse(JSON.stringify(blob)))).toEqual(blob);
	});
});

describe('commitmentsMatch', () => {
	it('ignores publishedAt, which changes on every save', () => {
		const one = [task({ id: 't1', thinkingAboutEntryId: 'p' })];
		expect(
			commitmentsMatch(
				buildCommitments(one, blocks, '2026-08-01T00:00:00.000Z'),
				buildCommitments(one, blocks, '2026-08-09T00:00:00.000Z')
			)
		).toBe(true);
	});

	it('notices a task that got finished', () => {
		expect(
			commitmentsMatch(
				buildCommitments([task({ id: 't1', thinkingAboutEntryId: 'p' })], blocks),
				buildCommitments([task({ id: 't1', thinkingAboutEntryId: 'p', status: 'done' })], blocks)
			)
		).toBe(false);
	});
});

describe('the local mirror', () => {
	beforeEach(() => localStorage.clear());

	it('is rebuilt on every task write, under the shared key', () => {
		const store = new PlannerStore();
		store.addTask({ title: 'read a chapter', thinkingAboutEntryId: 'piranesi' });

		const raw = localStorage.getItem(CARILLON_COMMITMENTS_STORAGE_KEY);
		expect(raw).not.toBeNull();
		expect(readCommitmentsBlob(JSON.parse(raw as string))?.commitments[0]).toMatchObject({
			entryId: 'piranesi',
			title: 'read a chapter'
		});
	});

	it('follows a task through completing and dropping', () => {
		const store = new PlannerStore();
		const created = store.addTask({ title: 'read', thinkingAboutEntryId: 'p' });

		store.completeTask(created.id);
		const afterDone = readCommitmentsBlob(
			JSON.parse(localStorage.getItem(CARILLON_COMMITMENTS_STORAGE_KEY) as string)
		);
		expect(afterDone?.commitments[0].status).toBe('done');

		store.dropTask(created.id);
		const afterDrop = readCommitmentsBlob(
			JSON.parse(localStorage.getItem(CARILLON_COMMITMENTS_STORAGE_KEY) as string)
		);
		expect(afterDrop?.commitments).toEqual([]);
	});

	it('can be rebuilt on load for a planner that predates the ledger', () => {
		// The step-3 lesson, applied before it can bite: a derived ledger that is
		// only written on save leaves an untouched app publishing nothing.
		localStorage.setItem(
			'planner.tasks.v1',
			JSON.stringify([task({ id: 't1', thinkingAboutEntryId: 'piranesi' })])
		);
		expect(localStorage.getItem(CARILLON_COMMITMENTS_STORAGE_KEY)).toBeNull();

		const store = new PlannerStore();
		store.publishCommitmentsLocally();

		const raw = localStorage.getItem(CARILLON_COMMITMENTS_STORAGE_KEY);
		expect(readCommitmentsBlob(JSON.parse(raw as string))?.commitments).toHaveLength(1);
	});
});
