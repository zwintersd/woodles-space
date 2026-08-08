// What you wrote about a day.
//
// The last edge of the spine, and the one that points back at the instrument:
// Carillon publishes what it observed, and Write answers with what it had to
// say about it. Shown in Edition Review beside the day's own data — never as
// another thing to do, only as something that already happened.

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
import { entityHref } from '@woodles/app-manifest';

export class Mentions {
	all = $state<Mention[]>([]);

	/** Letters that named one day, newest first. */
	forDay(dateKey: string): Mention[] {
		const key = mentionKey('planner', 'day', dateKey);
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

export function letterHref(letterId: string): string {
	return entityHref('letter', 'letter', letterId);
}

export const mentions = new Mentions();
