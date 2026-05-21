// Flourish pool — soft-sweet-curious + Night Vale tone
// Surfaces approximately once per day, randomised across flourish-eligible blocks.
export const FLOURISH_POOL = [
	'Friday. The clock continues to behave as expected, which is itself a small miracle.',
	'Evening reading. The day was a long sentence and is now a short one.',
	'Dinner. The evening has an appetite, which is convenient, because so do you.',
	'The afternoon is doing what afternoons do. This is fine.',
	'Something about the light right now. Let it be noted.',
	'The transition between blocks is a very small kind of door. You are walking through it.',
	'Wind-down. The day has been informed that it is over.',
	'Dinner. The stove has been waiting very patiently.',
	'17:05. Home again. The room remembers you.',
	'Morning. The day has not yet decided what it is.',
	'Lights out. The night shift begins. You are not on it.',
	'The evening is its own country. You have arrived.',
	'Open block. The hour is yours and does not require anything of you.',
	'The schedule continues. Somewhere, a bell is satisfied.',
	'There is a particular quality of light at this hour. You may have noticed.'
];

// Deterministic daily selection — same flourish for a given date + blockId combination.
export function getDailyFlourish(date: Date, blockId: string): string {
	const seed =
		date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
	const blockSeed = blockId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
	const idx = (seed + blockSeed) % FLOURISH_POOL.length;
	return FLOURISH_POOL[idx];
}

// Whether this block should show the flourish today.
// Roughly one flourish per day across the eligible pool of blocks.
export function shouldShowFlourish(date: Date, blockId: string): boolean {
	const seed =
		date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
	// Pick a slot 0–4; blocks whose slot matches today's slot get the flourish.
	const daySlot = seed % 5;
	const blockSlot =
		blockId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
	return daySlot === blockSlot;
}

// Lead-time prompts (5 minutes before block start)
const LEAD_PROMPTS: Record<string, string> = {
	dinner: 'Dinner in five.',
	'weekend-dinner': 'Dinner in five.',
	'wind-down': 'Wind-down in five.',
	'pre-bed': 'Five minutes.',
	'weekend-pre-bed': 'Five minutes.'
};

export function getLeadPrompt(blockId: string): string {
	return LEAD_PROMPTS[blockId] ?? 'Five minutes.';
}
