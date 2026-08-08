// The commitments ledger — what Carillon publishes back to Thinking About.
//
// The answer to the shelf, and the half that makes the pair feel connected
// rather than one-directional: the board can say "Thursday, 20:00" about a
// thing you're reading, without Thinking About knowing anything about day
// piles, domains, or blocks.
//
// Derived from `tasks` on every save and on load, never stored as its own
// truth. Shape and keys live in @woodles/sync (crossAppBlobs.ts) so the reader
// depends on the contract rather than on this app. See REFERENCES.md §4.2.

import {
	CARILLON_COMMITMENTS_VERSION,
	type CarillonCommitmentsBlob,
	type Commitment
} from '@woodles/sync';
import type { Block, Task } from './types';

/**
 * Every task that is about a Thinking About entry, soonest first.
 *
 * Dropped tasks are left out — that is what dropping meant — but done ones are
 * kept, because "you already read a chapter on Tuesday" is exactly what the
 * board wants to be able to say. `blocks` resolves a task's target block for
 * its start time; a task scheduled to a day but not an hour simply has none.
 */
export function buildCommitments(
	tasks: Task[],
	blocks: Block[],
	publishedAt = new Date().toISOString()
): CarillonCommitmentsBlob {
	const blockById = new Map(blocks.map((block) => [block.id, block]));

	const commitments: Commitment[] = tasks
		.filter((task) => task.thinkingAboutEntryId && task.status !== 'dropped')
		.map((task): Commitment => {
			const block = task.targetBlockId ? blockById.get(task.targetBlockId) : undefined;
			return {
				entryId: task.thinkingAboutEntryId as string,
				taskId: task.id,
				title: task.title,
				date: task.targetDate ?? null,
				time: block?.startTime ?? null,
				blockTitle: block?.title ?? null,
				// Carillon's third state, `dropped`, is filtered out above rather
				// than published — a board about what you're reading has no use for
				// a thing you decided not to do.
				status: task.status === 'done' ? 'done' : 'open'
			};
		})
		.sort((a, b) => (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99'));

	return { version: CARILLON_COMMITMENTS_VERSION, commitments, publishedAt };
}

/** True when the two ledgers would read identically to a consumer. */
export function commitmentsMatch(
	a: CarillonCommitmentsBlob,
	b: CarillonCommitmentsBlob
): boolean {
	if (a.commitments.length !== b.commitments.length) return false;
	return a.commitments.every((item, index) => {
		const other = b.commitments[index];
		return (
			item.entryId === other.entryId &&
			item.taskId === other.taskId &&
			item.title === other.title &&
			item.date === other.date &&
			item.time === other.time &&
			item.blockTitle === other.blockTitle &&
			item.status === other.status
		);
	});
}
