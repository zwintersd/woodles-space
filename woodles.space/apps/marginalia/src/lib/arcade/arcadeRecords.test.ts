import { beforeEach, describe, expect, it } from 'vitest';
import {
	arcadeRecordKey,
	clearArcadeRecord,
	loadArcadeRecord,
	recordArcadeRun
} from './arcadeRecords';

describe('arcadeRecords', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('starts with an empty record', () => {
		expect(loadArcadeRecord('type-witch')).toMatchObject({
			gameId: 'type-witch',
			bestScore: 0,
			highlights: {},
			plays: 0,
			recentRuns: [],
			updatedAt: null
		});
	});

	it('records plays, best score, and recent run summaries', () => {
		recordArcadeRun('type-witch', {
			score: 8,
			summary: { chars: 40 },
			endedAt: '2026-06-28T12:00:00.000Z'
		});
		const record = recordArcadeRun('type-witch', {
			score: 4,
			summary: { chars: 20 },
		endedAt: '2026-06-28T12:01:00.000Z'
		});

		expect(record.plays).toBe(2);
		expect(record.bestScore).toBe(8);
		expect(record.updatedAt).toBe('2026-06-28T12:01:00.000Z');
		expect(record.recentRuns).toEqual([
			{ chars: 20, score: 4 },
			{ chars: 40, score: 8 }
		]);
	});

	it('preserves game-specific highlights beyond the recent-run limit', () => {
		recordArcadeRun('margin-miner', {
			score: 500,
			highlights: { bestLevel: 2, fastestClearSeconds: 8.4 }
		});
		const record = recordArcadeRun('margin-miner', {
			score: 900,
			highlights: { bestLevel: 3 }
		});

		expect(record.highlights).toEqual({ bestLevel: 3, fastestClearSeconds: 8.4 });
	});

	it('caps recent runs to the latest five', () => {
		for (let score = 1; score <= 6; score += 1) {
			recordArcadeRun('insight-rush', { score, summary: { streak: score } });
		}

		const record = loadArcadeRecord('insight-rush');
		expect(record.plays).toBe(6);
		expect(record.bestScore).toBe(6);
		expect(record.recentRuns).toHaveLength(5);
		expect(record.recentRuns.map((run) => run.score)).toEqual([6, 5, 4, 3, 2]);
	});

	it('can clear a stored record', () => {
		recordArcadeRun('inkblot', { score: 2, summary: { correct: true } });
		clearArcadeRecord('inkblot');

		expect(localStorage.getItem(arcadeRecordKey('inkblot'))).toBeNull();
		expect(loadArcadeRecord('inkblot').plays).toBe(0);
	});

	it('ignores malformed storage', () => {
		localStorage.setItem(arcadeRecordKey('inkblot'), '{"v":1,');

		expect(loadArcadeRecord('inkblot')).toMatchObject({
			gameId: 'inkblot',
			bestScore: 0,
			plays: 0
		});
	});
});
