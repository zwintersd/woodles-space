// Reading Carillon's commitments — when a thing on the board is actually
// scheduled — so an entry can say "Thursday, 20:00" without this app knowing
// anything about day piles, domains, or blocks.
//
// Same two sources and the same degradation as Carillon's reader of this app's
// shelf: localStorage first (synchronous, same origin, instant), then the sync
// server when a passphrase is connected, which is what makes it work on a
// device where Carillon has never been opened.
//
// Every state is survivable. No ledger means the entry simply doesn't mention
// scheduling, exactly as it did before this existed.

import {
	hasPassphrase,
	pullLedger,
	readCommitmentsBlob,
	readLocalLedger,
	CARILLON_COMMITMENTS_APP,
	CARILLON_COMMITMENTS_STORAGE_KEY,
	type Commitment
} from '@woodles/sync';

export type CommitmentsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export class Commitments {
	all = $state<Commitment[]>([]);
	status = $state<CommitmentsStatus>('idle');

	/** Everything scheduled about one entry, soonest first (Carillon sorts on publish). */
	for(entryId: string): Commitment[] {
		return this.all.filter((item) => item.entryId === entryId);
	}

	/**
	 * The next thing still to happen for an entry — the one an entry's detail
	 * actually wants to show. Undated commitments are intentions without a time
	 * and never count as "next"; a done one is in the past whatever its date.
	 */
	next(entryId: string, today: string): Commitment | null {
		return (
			this.for(entryId).find(
				(item) => item.status === 'open' && item.date !== null && item.date >= today
			) ?? null
		);
	}

	loadLocal(): void {
		const blob = readLocalLedger(CARILLON_COMMITMENTS_STORAGE_KEY, readCommitmentsBlob);
		if (!blob) return;
		this.all = blob.commitments;
		this.status = blob.commitments.length > 0 ? 'ready' : 'empty';
	}

	/**
	 * Refresh from the server. Only replaces what we have on a pull that
	 * actually returned a ledger — a network failure leaves the local copy,
	 * because a slightly stale "Thursday, 20:00" beats no answer.
	 */
	async refresh(): Promise<void> {
		this.loadLocal();
		if (!hasPassphrase()) return;

		if (this.all.length === 0) this.status = 'loading';
		try {
			const blob = await pullLedger(CARILLON_COMMITMENTS_APP, readCommitmentsBlob);
			if (blob) {
				this.all = blob.commitments;
				this.status = blob.commitments.length > 0 ? 'ready' : 'empty';
			} else if (this.all.length === 0) {
				this.status = 'empty';
			}
		} catch {
			if (this.all.length === 0) this.status = 'error';
		}
	}
}

export const commitments = new Commitments();
