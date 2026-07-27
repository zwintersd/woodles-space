// A tiny reactive feed of resource gains, so UI (the arcade toolbar's meters)
// can pop up "+3 insight" style feedback exactly when a gain happens — rather
// than diffing the Book's raw $state numbers, which also drift for reasons
// that aren't a "gain" at all (Favor eases toward a target every tick, in
// either direction). Callers that grant insight/essence announce it here;
// consumers render whatever's new and let old entries fall off the queue.

export type ResourceGainKind = 'insight' | 'essence';
// 'reward' is a discrete, attention-worthy grant (a minigame payout, a study
// stage crossing, distilling); 'trickle' is the idle per-second accrual,
// batched so it reads as an ambient drip rather than a popup storm.
export type ResourceGainTone = 'reward' | 'trickle';

export interface ResourceGain {
	id: number;
	kind: ResourceGainKind;
	amount: number;
	tone: ResourceGainTone;
}

let nextId = 1;
const MAX_QUEUED = 20; // bounds memory over a long session; consumers only ever want the tail

export const resourceGains = $state<ResourceGain[]>([]);

export function announceGain(kind: ResourceGainKind, amount: number, tone: ResourceGainTone = 'reward') {
	const rounded = Math.round(amount * 10) / 10;
	if (rounded <= 0) return;
	resourceGains.push({ id: nextId++, kind, amount: rounded, tone });
	if (resourceGains.length > MAX_QUEUED) {
		resourceGains.splice(0, resourceGains.length - MAX_QUEUED);
	}
}
