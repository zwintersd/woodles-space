// The echoes library — marginalia's reading room reading the same archive
// Echoes itself does, so you can read one of your own letters instead of (or
// alongside) pasting text in.
//
// This used to read the public snapshot. Echoes is private now (HANDOFF.md
// §3), so it reads the passphrase-gated archive instead: an unconnected
// device sees nothing rather than seeing a stranger's-eye view, which is the
// honest consequence of the archive being yours alone.

import {
	hasPassphrase,
	pullLedger,
	readArchiveBlob,
	WRITE_ARCHIVE_APP,
	type ArchiveLetter
} from '@woodles/sync';

export type EchoesLibraryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

class EchoesLibrary {
	letters = $state<ArchiveLetter[]>([]);
	status = $state<EchoesLibraryStatus>('idle');

	// Fetches once and caches the result — reopening the picker after a
	// first load is a no-op unless forced. Pass `force` to retry after an
	// error or to pick up a fresh publish.
	async load(force = false): Promise<void> {
		if (this.status === 'loading') return;
		if (!force && (this.status === 'ready' || this.status === 'empty')) return;
		// Not connected is 'empty', not 'error' — there is nothing wrong, the
		// archive just isn't reachable from this device yet.
		if (!hasPassphrase()) {
			this.status = 'empty';
			return;
		}
		this.status = 'loading';
		try {
			const blob = await pullLedger(WRITE_ARCHIVE_APP, readArchiveBlob);
			const letters = blob?.letters ?? [];
			this.letters = letters;
			this.status = letters.length > 0 ? 'ready' : 'empty';
		} catch {
			this.status = 'error';
		}
	}
}

export const echoesLibrary = new EchoesLibrary();
