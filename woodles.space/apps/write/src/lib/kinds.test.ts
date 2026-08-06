import { describe, expect, it } from 'vitest';
import {
	WRITING_KINDS,
	kindSpec,
	coerceKind,
	coerceGoal,
	parseGoalInput,
	goalLabel
} from './kinds';

describe('coerceKind', () => {
	it('passes every known kind through', () => {
		for (const kind of WRITING_KINDS) {
			expect(coerceKind(kind)).toBe(kind);
		}
	});

	it('reads absence as letter — the pre-kinds default', () => {
		expect(coerceKind(undefined)).toBe('letter');
		expect(coerceKind(null)).toBe('letter');
	});

	it('reads an unknown kind as letter rather than crashing on old data', () => {
		expect(coerceKind('novella')).toBe('letter');
		expect(coerceKind(42)).toBe('letter');
	});
});

describe('kindSpec', () => {
	it('gives every kind a label, an untitled fallback, and three placeholders', () => {
		for (const kind of WRITING_KINDS) {
			const spec = kindSpec(kind);
			expect(spec.id).toBe(kind);
			expect(spec.label.length).toBeGreaterThan(0);
			expect(spec.untitled).toContain('untitled');
			expect(spec.placeholders.foreground.length).toBeGreaterThan(0);
			expect(spec.placeholders.midground.length).toBeGreaterThan(0);
			expect(spec.placeholders.background.length).toBeGreaterThan(0);
		}
	});

	it('keeps the letter fallback the pre-kinds app shipped with', () => {
		// Pinned: stored letters and the e2e publish flow both lean on this string.
		expect(kindSpec('letter').untitled).toBe('untitled letter');
	});
});

describe('word goals', () => {
	it('coerces only finite positive numbers', () => {
		expect(coerceGoal(500)).toBe(500);
		expect(coerceGoal(499.6)).toBe(500);
		expect(coerceGoal(0)).toBeNull();
		expect(coerceGoal(-3)).toBeNull();
		expect(coerceGoal(NaN)).toBeNull();
		expect(coerceGoal('500')).toBeNull();
		expect(coerceGoal(undefined)).toBeNull();
	});

	it('parses typed input, tolerating commas and spaces', () => {
		expect(parseGoalInput('50,000')).toBe(50000);
		expect(parseGoalInput(' 1 200 ')).toBe(1200);
		expect(parseGoalInput('750')).toBe(750);
	});

	it('reads blank or nonsense as clearing the goal', () => {
		expect(parseGoalInput('')).toBeNull();
		expect(parseGoalInput('   ')).toBeNull();
		expect(parseGoalInput('a lot')).toBeNull();
		expect(parseGoalInput('0')).toBeNull();
	});

	it('labels a plain count without a goal', () => {
		expect(goalLabel(1, null)).toBe('1 word');
		expect(goalLabel(42, null)).toBe('42 words');
	});

	it('labels progress against a goal, flooring the percentage', () => {
		expect(goalLabel(250, 1000)).toBe('250 / 1000 words · 25%');
		expect(goalLabel(999, 1000)).toBe('999 / 1000 words · 99%');
		expect(goalLabel(1000, 1000)).toBe('1000 / 1000 words · 100%');
	});

	it('caps a runaway percentage so the label stays readable', () => {
		expect(goalLabel(100000, 10)).toBe('100000 / 10 words · 999%');
	});
});
