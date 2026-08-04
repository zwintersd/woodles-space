import { describe, expect, it } from 'vitest';
import { sampleIntervalFor, simulate } from '../engine.js';
import { greedy, idlePolicy } from '../policies.js';
import { validateGameDef } from '../validate.js';
import { cozyGarden } from './index.js';

/**
 * The Phase 1 acceptance criteria, as a test rather than as a claim in a
 * README: the fixture is valid, ten hours of it simulate in well under half a
 * second, and a greedy player reaches the 1M milestone.
 */
describe('cozy garden fixture', () => {
	it('is a valid definition with nothing but intentional warnings', () => {
		const issues = validateGameDef(cozyGarden);
		expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
	});

	it('mirrors the mockup it was drawn from', () => {
		// Petal Farm at level 25 reads +120/sec on the mockup, Cloud Nursery at
		// level 10 reads +200/sec, and Rebirth shows ×2.45 at 145 units.
		const result = simulate(cozyGarden, idlePolicy, { duration: 1, sampleEvery: 1, seed: 1 });
		expect(result.finalState.currencies['soft-petals'].amount).toBeCloseTo(4.8, 6);

		const farm = cozyGarden.generators.find((generator) => generator.id === 'petal-farm');
		const nursery = cozyGarden.generators.find((generator) => generator.id === 'cloud-nursery');
		expect((farm?.baseRate ?? 0) * 25).toBeCloseTo(120, 6);
		expect((nursery?.baseRate ?? 0) * 10).toBeCloseTo(200, 6);

		const rebirth = cozyGarden.prestigeLayers[0];
		expect(1 + rebirth.multiplier.perUnit * 145).toBeCloseTo(2.45, 6);
	});

	it('reaches the 1M milestone under a greedy player', () => {
		const result = simulate(cozyGarden, greedy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		const reached = result.summary.timeToMilestone['one-million'];
		expect(reached).not.toBeNull();
		expect(reached).toBeLessThan(36000);
		expect(result.summary.totalPrestiges.rebirth).toBeGreaterThan(0);
	});

	it('never reaches it under an idle player, which is what makes the milestone mean anything', () => {
		const result = simulate(cozyGarden, idlePolicy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		expect(result.summary.timeToMilestone['one-million']).toBeNull();
	});

	it('simulates ten hours of game time in under 500ms', () => {
		const started = performance.now();
		const result = simulate(cozyGarden, greedy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		const elapsed = performance.now() - started;

		expect(result.finalState.gameTime).toBe(36000);
		expect(elapsed).toBeLessThan(500);
	});

	it('keeps the series chart-sized however long the run', () => {
		const result = simulate(cozyGarden, greedy, {
			duration: 36000,
			sampleEvery: sampleIntervalFor(36000),
			seed: 1
		});
		expect(result.series.length).toBeLessThanOrEqual(2001);
		expect(result.series.at(-1)?.t).toBe(36000);
	});
});
