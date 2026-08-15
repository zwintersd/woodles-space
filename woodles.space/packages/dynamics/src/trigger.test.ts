import { describe, expect, it } from 'vitest';
import { fireOnce } from './trigger.js';

describe('fireOnce', () => {
	it('fires and records the id the first time the condition holds', () => {
		const fired = new Set<string>();
		let applied = 0;
		expect(fireOnce(fired, 'algae_bloom', true, () => (applied += 1))).toBe(true);
		expect(applied).toBe(1);
		expect(fired.has('algae_bloom')).toBe(true);
	});

	it('never fires again for the same id', () => {
		const fired = new Set<string>(['algae_bloom']);
		let applied = 0;
		expect(fireOnce(fired, 'algae_bloom', true, () => (applied += 1))).toBe(false);
		expect(applied).toBe(0);
	});

	it('does not fire while the condition is false', () => {
		const fired = new Set<string>();
		expect(fireOnce(fired, 'algae_bloom', false, () => {})).toBe(false);
		expect(fired.has('algae_bloom')).toBe(false);
	});
});
