import { beforeEach, describe, expect, it } from 'vitest';
import {
	MASTERY_XP_PER_PLAY,
	arcadeMasteryKey,
	clearPetMastery,
	levelForXp,
	loadPetMastery,
	masteryMultiplier,
	petMasteryProgress,
	recordMasteryPlay,
	totalXpForLevel
} from './arcadeMastery';

describe('arcadeMastery', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('totalXpForLevel / levelForXp', () => {
		it('follows the triangular ramp', () => {
			expect(totalXpForLevel(0)).toBe(0);
			expect(totalXpForLevel(1)).toBe(30);
			expect(totalXpForLevel(2)).toBe(90);
			expect(totalXpForLevel(3)).toBe(180);
		});

		it('derives the level a total xp amount has reached', () => {
			expect(levelForXp(0)).toBe(0);
			expect(levelForXp(29)).toBe(0);
			expect(levelForXp(30)).toBe(1);
			expect(levelForXp(89)).toBe(1);
			expect(levelForXp(90)).toBe(2);
			expect(levelForXp(179)).toBe(2);
			expect(levelForXp(180)).toBe(3);
		});

		it('treats missing or non-finite xp as level 0', () => {
			expect(levelForXp(-5)).toBe(0);
			expect(levelForXp(Number.NaN)).toBe(0);
		});

		it('stays exact at large xp values', () => {
			for (let level = 0; level <= 50; level += 1) {
				expect(levelForXp(totalXpForLevel(level))).toBe(level);
				expect(levelForXp(totalXpForLevel(level + 1) - 1)).toBe(level);
			}
		});
	});

	describe('masteryMultiplier', () => {
		it('is 1x at level 0 and +10% per level after that', () => {
			expect(masteryMultiplier(0)).toBe(1);
			expect(masteryMultiplier(1)).toBeCloseTo(1.1);
			expect(masteryMultiplier(2)).toBeCloseTo(1.2);
			expect(masteryMultiplier(10)).toBeCloseTo(2);
		});

		it('floors negative levels at 1x', () => {
			expect(masteryMultiplier(-3)).toBe(1);
		});
	});

	describe('petMasteryProgress', () => {
		it('reads as untrained baseline with no active pet', () => {
			expect(petMasteryProgress('margin-miner', null)).toMatchObject({
				level: 0,
				xp: 0,
				multiplier: 1,
				progress: 0,
				leveledUp: false
			});
			expect(petMasteryProgress('margin-miner', undefined)).toMatchObject({ level: 0, multiplier: 1 });
		});

		it('reads a fresh pet as untrained too', () => {
			expect(petMasteryProgress('margin-miner', 'bee-1')).toMatchObject({
				level: 0,
				xp: 0,
				multiplier: 1
			});
		});
	});

	describe('recordMasteryPlay', () => {
		it('is a no-op with no active pet', () => {
			const progress = recordMasteryPlay('margin-miner', null);
			expect(progress).toMatchObject({ level: 0, xp: 0, multiplier: 1, leveledUp: false });
			expect(loadPetMastery('margin-miner', 'bee-1').plays).toBe(0);
		});

		it('banks flat xp per play and reaches level 1 after a few plays', () => {
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');
			const third = recordMasteryPlay('margin-miner', 'bee-1');

			expect(MASTERY_XP_PER_PLAY).toBe(10);
			expect(third.xp).toBe(30);
			expect(third.level).toBe(1);
			expect(third.multiplier).toBeCloseTo(1.1);
			expect(third.leveledUp).toBe(true);
		});

		it('only reports leveledUp on the play that crosses the threshold', () => {
			const first = recordMasteryPlay('margin-miner', 'bee-1');
			const second = recordMasteryPlay('margin-miner', 'bee-1');
			const third = recordMasteryPlay('margin-miner', 'bee-1');
			const fourth = recordMasteryPlay('margin-miner', 'bee-1');

			expect(first.leveledUp).toBe(false);
			expect(second.leveledUp).toBe(false);
			expect(third.leveledUp).toBe(true);
			expect(fourth.leveledUp).toBe(false);
		});

		it('persists plays and xp across separate reads', () => {
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');

			const record = loadPetMastery('margin-miner', 'bee-1');
			expect(record.plays).toBe(2);
			expect(record.xp).toBe(20);
			expect(record.updatedAt).not.toBeNull();
		});

		it('tracks mastery separately per game for the same pet', () => {
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('color-pop', 'bee-1');

			expect(petMasteryProgress('margin-miner', 'bee-1').level).toBe(1);
			expect(petMasteryProgress('color-pop', 'bee-1').level).toBe(0);
		});

		it('tracks mastery separately per pet for the same game', () => {
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-1');
			recordMasteryPlay('margin-miner', 'bee-2');

			expect(petMasteryProgress('margin-miner', 'bee-1').level).toBe(1);
			expect(petMasteryProgress('margin-miner', 'bee-2').level).toBe(0);
		});

		it('accepts a custom xp amount per play', () => {
			const progress = recordMasteryPlay('margin-miner', 'bee-1', 30);
			expect(progress.xp).toBe(30);
			expect(progress.level).toBe(1);
		});
	});

	describe('storage plumbing', () => {
		it('can clear a stored mastery record', () => {
			recordMasteryPlay('margin-miner', 'bee-1');
			clearPetMastery('margin-miner', 'bee-1');

			expect(localStorage.getItem(arcadeMasteryKey('margin-miner', 'bee-1'))).toBeNull();
			expect(loadPetMastery('margin-miner', 'bee-1').xp).toBe(0);
		});

		it('ignores malformed storage', () => {
			localStorage.setItem(arcadeMasteryKey('margin-miner', 'bee-1'), '{"v":1,');

			expect(loadPetMastery('margin-miner', 'bee-1')).toMatchObject({
				gameId: 'margin-miner',
				creatureId: 'bee-1',
				xp: 0,
				plays: 0
			});
		});

		it('ignores a record saved under a different game or creature id', () => {
			recordMasteryPlay('margin-miner', 'bee-1');

			expect(loadPetMastery('color-pop', 'bee-1').xp).toBe(0);
			expect(loadPetMastery('margin-miner', 'bee-2').xp).toBe(0);
		});
	});
});
