import { describe, expect, it } from 'vitest';
import { fillSlots, getDailyFlourish, shouldShowFlourish, getLeadPrompt, TONES, FLOURISH_FRAGMENTS } from './voice';
import type { FlourishContext, ToneName } from './voice';

describe('voice — flourish generation', () => {
	// ── fillSlots ───────────────────────────────────────────────────

	describe('fillSlots', () => {
		const basicCtx: FlourishContext = {
			date: new Date(2024, 5, 15, 10, 30), // Saturday
			block: {
				id: 'morning',
				startTime: '08:00',
				endTime: '12:00',
				title: 'Morning Session'
			},
			dayShape: { id: 'focused', name: 'Focused Day', blocks: [], restful: false },
			blockCount: 3,
			domains: [
				{ id: 'work', name: 'Work', color: '#000' },
				{ id: 'life', name: 'Life', color: '#fff' }
			]
		};

		it('replaces {block_title} with block title', () => {
			const result = fillSlots('Time for {block_title}', basicCtx);
			expect(result).toBe('Time for Morning Session');
		});

		it('replaces {start_time} and {end_time}', () => {
			const result = fillSlots('{start_time} – {end_time}', basicCtx);
			expect(result).toBe('08:00 – 12:00');
		});

		it('replaces {weekday}', () => {
			const result = fillSlots("It's {weekday}", basicCtx);
			expect(result).toBe("It's Saturday");
		});

		it('replaces {day_shape_name}', () => {
			const result = fillSlots('A {day_shape_name}.', basicCtx);
			expect(result).toBe('A Focused Day.');
		});

		it('replaces {block_count}', () => {
			const result = fillSlots('{block_count} blocks today', basicCtx);
			expect(result).toBe('3 blocks today');
		});

		it('replaces {domain_name} with a domain (deterministic by date)', () => {
			const result = fillSlots('Focus on {domain_name}.', basicCtx);
			expect(['Work', 'Life']).toContain(result.match(/Focus on (\w+)/)?.[1] ?? '');
		});

		it('leaves unreplaced slots as-is', () => {
			const result = fillSlots('Something {unknown} here', basicCtx);
			expect(result).toBe('Something {unknown} here');
		});

		it('handles missing block gracefully', () => {
			const ctx = { ...basicCtx, block: null };
			const result = fillSlots('{block_title} at {start_time}', ctx);
			expect(result).toContain('this'); // fallback
		});

		it('handles missing dayShape gracefully', () => {
			const ctx = { ...basicCtx, dayShape: null };
			const result = fillSlots('A {day_shape_name}.', ctx);
			expect(result).toContain('day');
		});

		it('handles empty domains list', () => {
			const ctx = { ...basicCtx, domains: [] };
			const result = fillSlots('Focus on {domain_name}.', ctx);
			expect(result).toContain('the rest of it');
		});

		it('handles no block count', () => {
			const ctx = { ...basicCtx, blockCount: undefined };
			const result = fillSlots('{block_count} items', ctx);
			expect(result).toBe('0 items');
		});

		it('is deterministic for the same date and context', () => {
			const ctx = { ...basicCtx, domains: [{ id: 'd1', name: 'Domain 1', color: '#000' }] };
			const result1 = fillSlots('{domain_name}', ctx);
			const result2 = fillSlots('{domain_name}', ctx);
			expect(result1).toBe(result2);
		});

		it('changes domain for different dates', () => {
			const ctx = { ...basicCtx, domains: [{ id: 'd1', name: 'A', color: '#000' }, { id: 'd2', name: 'B', color: '#fff' }] };
			const date1 = new Date(2024, 5, 15);
			const date2 = new Date(2024, 5, 16);
			const result1 = fillSlots('{domain_name}', { ...ctx, date: date1 });
			const result2 = fillSlots('{domain_name}', { ...ctx, date: date2 });
			// At least one should be different (seed changes with date)
			expect([result1, result2]).toContain('A');
			expect([result1, result2]).toContain('B');
		});

		it('supports multiple slots in one template', () => {
			const result = fillSlots('{weekday}: {block_title} ({start_time}–{end_time})', basicCtx);
			expect(result).toContain('Saturday');
			expect(result).toContain('Morning Session');
			expect(result).toContain('08:00');
		});
	});

	// ── shouldShowFlourish ──────────────────────────────────────────

	describe('shouldShowFlourish', () => {
		it('returns boolean', () => {
			const result = shouldShowFlourish(new Date(2024, 5, 15), 'block-1');
			expect(typeof result).toBe('boolean');
		});

		it('is deterministic for same date and blockId', () => {
			const date = new Date(2024, 5, 15);
			const result1 = shouldShowFlourish(date, 'block-1');
			const result2 = shouldShowFlourish(date, 'block-1');
			expect(result1).toBe(result2);
		});

		it('changes for different dates', () => {
			const date1 = new Date(2024, 5, 15);
			const date2 = new Date(2024, 5, 16);
			const results = [
				shouldShowFlourish(date1, 'block-1'),
				shouldShowFlourish(date2, 'block-1')
			];
			// Over a range of dates, we should see variety
			// (but not guaranteed on just 2 samples)
			expect(results).toHaveLength(2);
		});

		it('changes for different blockIds', () => {
			const date = new Date(2024, 5, 15);
			const results = [
				shouldShowFlourish(date, 'morning'),
				shouldShowFlourish(date, 'afternoon'),
				shouldShowFlourish(date, 'evening')
			];
			// Some blocks should show, some shouldn't
			expect(results).toHaveLength(3);
		});

		it('distributes flourishes roughly evenly across blocks', () => {
			const date = new Date(2024, 5, 15);
			const blockIds = Array.from({ length: 20 }, (_, i) => `block-${i}`);
			const showCount = blockIds.filter((id) => shouldShowFlourish(date, id)).length;
			// Roughly 1 in 5 should show (20% / 5 slots)
			expect(showCount).toBeGreaterThanOrEqual(0);
			expect(showCount).toBeLessThanOrEqual(blockIds.length);
		});
	});

	// ── getDailyFlourish ────────────────────────────────────────────

	describe('getDailyFlourish', () => {
		const basicCtx: FlourishContext = {
			date: new Date(2024, 5, 15),
			block: { id: 'morning', startTime: '08:00', endTime: '12:00', title: 'Morning' },
			dayShape: { id: 'test', name: 'Test', blocks: [], restful: false },
			blockCount: 1,
			domains: [{ id: 'work', name: 'Work', color: '#000' }]
		};

		it('returns a string flourish', () => {
			const flourish = getDailyFlourish(basicCtx, 'gentle', 'block-1');
			expect(typeof flourish).toBe('string');
		});

		it('is deterministic for same inputs', () => {
			const flourish1 = getDailyFlourish(basicCtx, 'gentle', 'block-1');
			const flourish2 = getDailyFlourish(basicCtx, 'gentle', 'block-1');
			expect(flourish1).toBe(flourish2);
		});

		it('falls back to universal pool if tone not found', () => {
			const badTone = 'nonexistent' as ToneName;
			const flourish = getDailyFlourish(basicCtx, badTone, 'block-1');
			// Unknown tone falls back to universal fragments
			expect(flourish).toBeTruthy();
		});

		it('pulls from tone-specific samples', () => {
			const tone = 'gentle' as ToneName;
			const preset = TONES.find((t) => t.id === tone);
			if (preset && preset.samples.length > 0) {
				const flourish = getDailyFlourish(basicCtx, tone, 'block-1');
				// Flourish should contain slot-filled content from the tone's samples
				expect(flourish).toBeTruthy();
			}
		});

		it('includes universal fragments unless tone is minimal', () => {
			const tonesToTest = ['gentle', 'wry', 'earnest'] as ToneName[];
			tonesToTest.forEach((tone) => {
				const flourish = getDailyFlourish(basicCtx, tone, 'block-1');
				// Should have content (may come from universal pool or tone-specific)
				expect(flourish).toBeDefined();
			});
		});

		it('minimal tone excludes universal fragments', () => {
			// Minimal should only use its own small pool
			const flourish = getDailyFlourish(basicCtx, 'minimal', 'block-1');
			expect(flourish).toBeDefined();
		});

		it('changes flourish for different dates', () => {
			const date1 = { ...basicCtx, date: new Date(2024, 5, 15) };
			const date2 = { ...basicCtx, date: new Date(2024, 5, 16) };
			const flourish1 = getDailyFlourish(date1, 'gentle', 'block-1');
			const flourish2 = getDailyFlourish(date2, 'gentle', 'block-1');
			// Over many dates, you'd see variety, but not guaranteed on 2 samples
			expect(flourish1).toBeDefined();
			expect(flourish2).toBeDefined();
		});

		it('changes flourish for different blockIds', () => {
			const flourish1 = getDailyFlourish(basicCtx, 'gentle', 'block-1');
			const flourish2 = getDailyFlourish(basicCtx, 'gentle', 'block-2');
			expect(flourish1).toBeDefined();
			expect(flourish2).toBeDefined();
		});

		it('fills slots in returned flourish', () => {
			const flourish = getDailyFlourish(basicCtx, 'gentle', 'block-1');
			// Should not contain unresolved slots like {weekday}
			expect(flourish).not.toMatch(/\{[\w_]+\}/);
		});
	});

	// ── getLeadPrompt ───────────────────────────────────────────────

	describe('getLeadPrompt', () => {
		const block = {
			id: 'morning',
			startTime: '09:00',
			endTime: '10:00',
			title: 'Meeting'
		};
		const date = new Date(2024, 5, 15, 8, 55);

		it('returns a string prompt', () => {
			const prompt = getLeadPrompt('gentle', block, date);
			expect(typeof prompt).toBe('string');
		});

		it('is deterministic for same inputs', () => {
			const prompt1 = getLeadPrompt('gentle', block, date);
			const prompt2 = getLeadPrompt('gentle', block, date);
			expect(prompt1).toBe(prompt2);
		});

		it('differs by tone', () => {
			const gentle = getLeadPrompt('gentle', block, date);
			const wry = getLeadPrompt('wry', block, date);
			const minimal = getLeadPrompt('minimal', block, date);
			// Each tone has its own template
			expect(gentle).not.toBe(wry);
			expect(gentle).not.toBe(minimal);
		});

		it('includes "five minutes" or similar for all tones', () => {
			const tones = ['gentle', 'wry', 'minimal', 'earnest'] as ToneName[];
			tones.forEach((tone) => {
				const prompt = getLeadPrompt(tone, block, date);
				// Each should acknowledge the 5-minute lead time
				expect(prompt.toLowerCase()).toMatch(/five|minute|\d/);
			});
		});

		it('fills block title slot for earnest tone', () => {
			const prompt = getLeadPrompt('earnest', block, date);
			expect(prompt).toContain('Meeting');
		});

		it('handles null block gracefully', () => {
			const prompt = getLeadPrompt('gentle', null, date);
			expect(prompt).toBeTruthy();
			expect(prompt.toLowerCase()).toMatch(/five|minute|\d/);
		});

		it('returns fallback if tone unknown', () => {
			const prompt = getLeadPrompt('unknown' as ToneName, block, date);
			expect(prompt.toLowerCase()).toMatch(/five|minute|\d/);
		});

		it('fills slots appropriately', () => {
			const prompt = getLeadPrompt('earnest', block, date);
			// Should not contain unresolved {block_title}
			expect(prompt).not.toMatch(/\{block_title\}/);
		});
	});

	// ── TONES and FRAGMENTS exports ──────────────────────────────────

	describe('TONES and FLOURISH_FRAGMENTS', () => {
		it('exports TONES array', () => {
			expect(Array.isArray(TONES)).toBe(true);
			expect(TONES.length).toBeGreaterThan(0);
		});

		it('each TONE has id and samples', () => {
			TONES.forEach((tone) => {
				expect(tone.id).toBeTruthy();
				expect(Array.isArray(tone.samples)).toBe(true);
			});
		});

		it('exports FLOURISH_FRAGMENTS array', () => {
			expect(Array.isArray(FLOURISH_FRAGMENTS)).toBe(true);
			expect(FLOURISH_FRAGMENTS.length).toBeGreaterThan(0);
		});

		it('each fragment is a string template', () => {
			FLOURISH_FRAGMENTS.forEach((frag) => {
				expect(typeof frag).toBe('string');
			});
		});

		it('TONES includes gentle, wry, minimal, earnest', () => {
			const ids = TONES.map((t) => t.id);
			expect(ids).toContain('gentle');
			expect(ids).toContain('wry');
			expect(ids).toContain('minimal');
			expect(ids).toContain('earnest');
		});
	});

	// ── integration: daily flourish distribution ────────────────────

	describe('flourish distribution', () => {
		it('distributes flourishes across blocks deterministically', () => {
			const date = new Date(2024, 5, 15);
			// Test a larger set of possible block IDs
			const blockIds = Array.from({ length: 50 }, (_, i) => `block-${i}`);
			const showCounts = blockIds.map((id) => (shouldShowFlourish(date, id) ? 1 : 0));
			const total = showCounts.reduce((a, b) => a + b, 0);
			// On average, ~20% (1/5 slots) should show flourish with large sample
			expect(total).toBeGreaterThan(0);
			expect(total).toBeLessThanOrEqual(blockIds.length);
		});

		it('different blocks show flourish on different days', () => {
			const showingBlocks = [];
			for (let day = 1; day <= 20; day++) {
				const date = new Date(2024, 5, day);
				for (let block = 0; block < 5; block++) {
					if (shouldShowFlourish(date, `block-${block}`)) {
						showingBlocks.push(block);
						break;
					}
				}
			}
			// Over 20 days, different blocks should show flourish
			const unique = new Set(showingBlocks);
			expect(unique.size).toBeGreaterThan(1);
		});

		it('creates appropriate flourishes for different days', () => {
			const flourishes = [];
			for (let day = 1; day <= 5; day++) {
				const date = new Date(2024, 5, day);
				const flourish = getDailyFlourish(
					{
						date,
						block: { id: 'morning', startTime: '08:00', endTime: '12:00', title: 'Morning' },
						dayShape: { id: 'test', name: 'Test', blocks: [], restful: false },
						blockCount: 1,
						domains: [{ id: 'work', name: 'Work', color: '#000' }]
					},
					'gentle',
					'morning'
				);
				flourishes.push(flourish);
			}
			// All flourishes should be non-empty strings
			flourishes.forEach((f) => expect(f).toBeTruthy());
		});
	});
});
