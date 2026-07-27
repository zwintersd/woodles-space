// A tiny reactive feed of short, timely notices for the arcade toolbar — e.g.
// the moment a game's daily play cap is reached, so the player learns why a
// later round pays nothing instead of just watching Insight stop moving.
// Same shape as resourceGains' queue (lib/witch/resourceGains.svelte.ts), but
// carries a message instead of a kind+amount.

export interface ArcadeNotice {
	id: number;
	text: string;
}

let nextId = 1;
const MAX_QUEUED = 10; // bounds memory over a long session

export const arcadeNotices = $state<ArcadeNotice[]>([]);

export function announceNotice(text: string) {
	arcadeNotices.push({ id: nextId++, text });
	if (arcadeNotices.length > MAX_QUEUED) {
		arcadeNotices.splice(0, arcadeNotices.length - MAX_QUEUED);
	}
}
