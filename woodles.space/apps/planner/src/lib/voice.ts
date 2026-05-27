// Voice engine — tone presets + slot-templated flourish fragments.
// Driven by the user's onboarding choices (tone, domains, shape names).

import { FLOURISH_FRAGMENTS, TONES, type ToneName } from './onboarding.copy';
import type { Block, DayShape, Domain } from './types';

export { TONES, FLOURISH_FRAGMENTS };
export type { ToneName };

// ── Slot context ───────────────────────────────────────────────────

export type FlourishContext = {
	date: Date;
	block?: Block | null;
	dayShape?: DayShape | null;
	blockCount?: number;
	domains?: Domain[];
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Fills {block_title}, {weekday}, {day_shape_name}, {start_time}, {end_time}, {block_count}, {domain_name}.
export function fillSlots(template: string, ctx: FlourishContext): string {
	const block = ctx.block;
	const slots: Record<string, string> = {
		block_title: block?.title ?? 'this',
		start_time: block?.startTime ?? '—',
		end_time: block?.endTime ?? '—',
		weekday: WEEKDAYS[ctx.date.getDay()],
		day_shape_name: ctx.dayShape?.name ?? 'day',
		block_count: String(ctx.blockCount ?? 0),
		domain_name: pickRandom(ctx.domains, ctx.date)?.name ?? 'the rest of it',
		item_count: '0' // reserved for future use
	};
	return template.replace(/\{(\w+)\}/g, (_, key) => slots[key] ?? `{${key}}`);
}

// Deterministic-but-rotating choice based on the date.
function pickRandom<T>(arr: T[] | undefined, date: Date): T | undefined {
	if (!arr || arr.length === 0) return undefined;
	const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
	return arr[seed % arr.length];
}

// ── Daily flourish selection ───────────────────────────────────────

// Pick a tone-appropriate template for the given context.
// Wry/gentle/earnest draw from their tone-specific samples; minimal draws
// from its own pool. The universal FLOURISH_FRAGMENTS pool is mixed in
// for variety unless the tone is 'minimal'.
export function getDailyFlourish(
	ctx: FlourishContext,
	tone: ToneName,
	blockId: string
): string {
	const preset = TONES.find((t) => t.id === tone);
	const tonePool = preset?.samples ?? [];
	const pool = tone === 'minimal' ? tonePool : [...tonePool, ...FLOURISH_FRAGMENTS];
	if (pool.length === 0) return '';

	const seed = ctx.date.getFullYear() * 10000 + (ctx.date.getMonth() + 1) * 100 + ctx.date.getDate();
	const blockSeed = blockId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
	const idx = (seed + blockSeed) % pool.length;
	return fillSlots(pool[idx], ctx);
}

// Decide whether *this* block carries today's flourish.
// One flourish per day across the eligible blocks.
export function shouldShowFlourish(date: Date, blockId: string): boolean {
	const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
	const daySlot = seed % 5;
	const blockSlot = blockId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
	return daySlot === blockSlot;
}

// ── Lead-time prompts (5 minutes before block start) ───────────────

const TONE_LEAD: Record<ToneName, string> = {
	wry: 'Five minutes. The schedule is keeping its end of the bargain.',
	gentle: 'Five minutes. No rush — just a heads-up.',
	minimal: 'Five minutes.',
	earnest: 'Five minutes until {block_title}. You’ve got this.'
};

export function getLeadPrompt(tone: ToneName, block: Block | null, date: Date): string {
	const template = TONE_LEAD[tone] ?? 'Five minutes.';
	return fillSlots(template, { date, block });
}
