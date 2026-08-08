// What the writing was about — Write's answer to the rest of the spine.
//
// Every other ledger here points at writing's subjects; this one points back,
// so Carillon can say "you wrote about this day" and Thinking About can say
// "you wrote about this".
//
// Derived from the archive, and specifically from each letter's own prose:
// the references are read out of the stored HTML rather than maintained
// beside it, so there is no second copy to drift and no way to be about
// something the words don't mention.

import {
	mentionKey,
	WRITE_MENTIONS_VERSION,
	type Mention,
	type WriteMentionsBlob
} from '@woodles/sync';
import { readReferences } from './htmlTools';
import type { StoredLetter } from './letters';

/** Every layer's prose, since a reference is as real in the midground. */
function bodyOf(letter: StoredLetter): string {
	return Object.values(letter.layers ?? {})
		.map((layer) => layer?.html ?? '')
		.join('\n');
}

export function buildMentions(
	letters: StoredLetter[],
	publishedAt = new Date().toISOString()
): WriteMentionsBlob {
	const mentions: Mention[] = [];

	for (const letter of letters) {
		const refs = [
			...new Set(
				readReferences(bodyOf(letter)).map((ref) => mentionKey(ref.app, ref.kind, ref.id))
			)
		];
		// A letter that named nothing is not a mention of anything. Publishing
		// it anyway would make every reader filter an empty list.
		if (refs.length === 0) continue;
		mentions.push({
			letterId: letter.id,
			title: letter.title,
			date: (letter.publishedAt ?? '').slice(0, 10),
			refs
		});
	}

	return { version: WRITE_MENTIONS_VERSION, mentions, publishedAt };
}

/** True when the two ledgers would read identically to a consumer. */
export function mentionsMatch(a: WriteMentionsBlob, b: WriteMentionsBlob): boolean {
	if (a.mentions.length !== b.mentions.length) return false;
	return a.mentions.every((item, index) => {
		const other = b.mentions[index];
		return (
			item.letterId === other.letterId &&
			item.title === other.title &&
			item.date === other.date &&
			item.refs.length === other.refs.length &&
			item.refs.every((ref, i) => ref === other.refs[i])
		);
	});
}
