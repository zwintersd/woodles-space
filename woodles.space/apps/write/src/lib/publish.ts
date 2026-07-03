// Pure, rune-free publish logic — assembling an EchoesPublicBlob from the
// local letters list. Kept separate from the Svelte routes so the one rule
// that actually matters here — a letter only leaves this device if `public`
// is explicitly true — is easy to read and easy to test in isolation.
// ROADMAP.md week 7: the reading room, actually public.

import { ECHOES_PUBLIC_SLUG, type EchoesPublicBlob, type PublicLetter } from '@woodles/sync';
import type { StoredLetter } from './letters';

export { ECHOES_PUBLIC_SLUG };

// Only letters explicitly marked public ever leave this function. Drafts
// never reach `StoredLetter` at all (they live in a separate draft store —
// see drafts.ts), and a published-but-not-public letter simply has
// `public` unset, so it's filtered here same as a draft would be.
export function buildEchoesPublicBlob(letters: StoredLetter[]): EchoesPublicBlob {
	return {
		letters: letters.filter((l) => l.public === true).map(toPublicLetter)
	};
}

function toPublicLetter(l: StoredLetter): PublicLetter {
	return {
		id: l.id,
		title: l.title,
		theme: l.theme,
		motif: l.motif,
		font: l.font,
		issue: l.issue,
		publishedAt: l.publishedAt,
		layers: l.layers,
		annotations: l.annotations,
		content: l.content,
		replyTo: l.replyTo
	};
}
