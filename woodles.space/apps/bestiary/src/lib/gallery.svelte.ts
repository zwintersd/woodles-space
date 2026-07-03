// The gallery store — the visitor-facing read of the published bestiary
// snapshot (ROADMAP.md week 3). pullPublic never sends the passphrase, so
// this is exactly what an unauthenticated visitor's browser can see.

import {
	pullPublic,
	BESTIARY_PUBLIC_SLUG,
	type BestiaryPublicBlob,
	type PublicCreature
} from '@woodles/sync';
import { sortGalleryCreatures } from './gallery';

export type GalleryStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

class Gallery {
	creatures = $state<PublicCreature[]>([]);
	status = $state<GalleryStatus>('idle');
	publishedAt = $state<string | null>(null);

	// Fetches the published snapshot once and caches the result — first-run
	// routing (+layout.svelte) and a manual sidebar visit can both call this
	// without racing or double-fetching. Pass `force` to retry after an error
	// or to pick up a fresh publish.
	async load(force = false): Promise<void> {
		if (this.status === 'loading') return;
		if (!force && (this.status === 'ready' || this.status === 'empty')) return;
		this.status = 'loading';
		try {
			const snap = await pullPublic<BestiaryPublicBlob>('bestiary', BESTIARY_PUBLIC_SLUG);
			const creatures = sortGalleryCreatures(snap.blob?.creatures ?? []);
			this.creatures = creatures;
			this.publishedAt = snap.publishedAt;
			this.status = creatures.length > 0 ? 'ready' : 'empty';
		} catch {
			this.status = 'error';
		}
	}
}

export const gallery = new Gallery();
