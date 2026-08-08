// What you wrote about this — Write's answer, read on the board.
//
// The last edge of the spine. The shelf tells Write what it can name; this
// tells the board which letters named it, so an entry carries not just when
// it's scheduled and when you sat with it, but what you had to say.

import {
	hasPassphrase,
	mentionKey,
	pullLedger,
	readLocalLedger,
	readMentionsBlob,
	WRITE_MENTIONS_APP,
	WRITE_MENTIONS_STORAGE_KEY,
	type Mention
} from '@woodles/sync';

export class Mentions {
	all = $state<Mention[]>([]);

	/** Letters that named one entry, newest first. */
	for(entryId: string): Mention[] {
		const key = mentionKey('thinking-about', 'entry', entryId);
		return this.all
			.filter((mention) => mention.refs.includes(key))
			.sort((a, b) => b.date.localeCompare(a.date));
	}

	loadLocal(): void {
		const blob = readLocalLedger(WRITE_MENTIONS_STORAGE_KEY, readMentionsBlob);
		if (blob) this.all = blob.mentions;
	}

	async refresh(): Promise<void> {
		this.loadLocal();
		if (!hasPassphrase()) return;
		try {
			const blob = await pullLedger(WRITE_MENTIONS_APP, readMentionsBlob);
			if (blob) this.all = blob.mentions;
		} catch {
			// Whatever this device already knows still stands.
		}
	}
}

export const mentions = new Mentions();
