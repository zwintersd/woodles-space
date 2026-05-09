// timing windows and hit quality for the reading pass.

export const TIMING = {
	tight: 80,  // ±80ms — word nearly centred on seam
	wide: 250,  // ±250ms — word anywhere in seam region
} as const;

export type HitQuality = 'luminous' | 'tight' | 'wide' | 'miss';

// absOffsetMs: Math.abs(peakTime - clickTime)
// isCharged: whether the word is a charged token
export function classifyHit(absOffsetMs: number, isCharged: boolean): HitQuality {
	if (absOffsetMs <= TIMING.tight) return isCharged ? 'luminous' : 'tight';
	if (absOffsetMs <= TIMING.wide) return 'wide';
	return 'miss';
}

export const HIT_MULTIPLIER: Record<Exclude<HitQuality, 'miss'>, number> = {
	luminous: 25,
	tight: 5,
	wide: 1,
};

export const HIT_LABEL: Record<Exclude<HitQuality, 'miss'>, string> = {
	luminous: 'luminous',
	tight: 'tight gloss',
	wide: 'gloss',
};
