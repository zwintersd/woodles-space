// The echoes library — marginalia's reading room reading the same published
// letters echoes itself does (ROADMAP.md week 7), so a visitor can read one
// of Z's letters instead of (or alongside) pasting their own text. Mirrors
// bestiary's gallery.svelte.ts: pullPublic never sends the passphrase, so
// this is exactly what an unauthenticated visitor's browser can see.

import { pullPublic, ECHOES_PUBLIC_SLUG, type EchoesPublicBlob, type PublicLetter } from '@woodles/sync';

export type EchoesLibraryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

class EchoesLibrary {
	letters = $state<PublicLetter[]>([]);
	status = $state<EchoesLibraryStatus>('idle');

	// Fetches once and caches the result — reopening the picker after a
	// first load is a no-op unless forced. Pass `force` to retry after an
	// error or to pick up a fresh publish.
	async load(force = false): Promise<void> {
		if (this.status === 'loading') return;
		if (!force && (this.status === 'ready' || this.status === 'empty')) return;
		this.status = 'loading';
		try {
			const snap = await pullPublic<EchoesPublicBlob>('echoes', ECHOES_PUBLIC_SLUG);
			const letters = snap.blob?.letters ?? [];
			this.letters = letters;
			this.status = letters.length > 0 ? 'ready' : 'empty';
		} catch {
			this.status = 'error';
		}
	}
}

export const echoesLibrary = new EchoesLibrary();
