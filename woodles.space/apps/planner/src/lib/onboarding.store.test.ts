// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingStore } from './onboarding.store.svelte';
import { PlannerStore } from './store.svelte';
import type { WeekPattern } from './types';

const localStorageMock = (() => {
	let values: Record<string, string> = {};
	return {
		getItem: (key: string) => values[key] ?? null,
		setItem: (key: string, value: string) => {
			values[key] = value;
		},
		removeItem: (key: string) => {
			delete values[key];
		},
		clear: () => {
			values = {};
		}
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('OnboardingStore', () => {
	let planner: PlannerStore;
	let wizard: OnboardingStore;

	beforeEach(() => {
		localStorage.clear();
		planner = new PlannerStore();
		wizard = new OnboardingStore(planner);
	});

	it('checkpoints each question and resumes at the saved step', () => {
		wizard.beginFlow();
		wizard.advance();
		wizard.advance();

		expect(planner.settings.onboardingStep).toBe(3);
		expect(new OnboardingStore(planner).stage).toBe(3);
	});

	it('does not overwrite a usable week pattern when setup starts', () => {
		const customWeek: WeekPattern = {
			days: [
				'starter-recovery',
				'starter-maker',
				'starter-maker',
				'starter-office',
				'starter-office',
				'starter-out',
				'starter-recovery'
			]
		};
		planner.setWeekPattern(customWeek);

		wizard.beginFlow();

		expect(planner.weekPattern).toEqual(customWeek);
	});

	it('lets someone use the planner and later resume the same question', () => {
		wizard.beginFlow();
		wizard.advance();
		wizard.finishLater();

		expect(planner.settings.onboardingComplete).toBe(true);
		expect(planner.settings.onboardingStep).toBe(2);

		wizard.resumeFromPlanner();

		expect(planner.settings.onboardingComplete).toBe(false);
		expect(wizard.stage).toBe(2);
	});

	it('finishing into the first-task composer clears the draft checkpoint', () => {
		wizard.beginFlow();
		wizard.finishAndCompose();

		expect(planner.settings.onboardingComplete).toBe(true);
		expect(planner.settings.onboardingStep).toBeUndefined();
		expect(planner.composing).toBe(true);
	});

	// ── refresh: revisiting a slice of setup mid-use ─────────────────

	describe('refresh mode', () => {
		beforeEach(() => {
			planner.updateSettings({ onboardingComplete: true });
		});

		it('opens directly on the first chosen section', () => {
			wizard.startRefresh([4, 2]);
			expect(wizard.isRefreshing).toBe(true);
			expect(wizard.stage).toBe(4);
		});

		it('does nothing for an empty selection', () => {
			wizard.startRefresh([]);
			expect(wizard.isRefreshing).toBe(false);
		});

		it('walks only the chosen sections, in the order given, then closes', () => {
			wizard.startRefresh([1, 5]);
			expect(wizard.stage).toBe(1);
			wizard.advance();
			expect(wizard.stage).toBe(5);
			wizard.advance();
			expect(wizard.isRefreshing).toBe(false);
		});

		it('never touches onboardingComplete or the resume checkpoint', () => {
			wizard.startRefresh([1, 2, 3]);
			wizard.advance();
			wizard.advance();

			expect(planner.settings.onboardingComplete).toBe(true);
			expect(planner.settings.onboardingStep).toBeUndefined();
		});

		it('closes rather than backing past the first chosen section', () => {
			wizard.startRefresh([3, 6]);
			expect(wizard.canGoBack).toBe(false);
			wizard.back();
			expect(wizard.isRefreshing).toBe(false);
		});

		it('goes back to the previous chosen section, skipping unselected ones', () => {
			wizard.startRefresh([2, 4]);
			wizard.advance();
			expect(wizard.stage).toBe(4);
			expect(wizard.canGoBack).toBe(true);
			wizard.back();
			expect(wizard.stage).toBe(2);
		});

		it('closes on "done for now" (finishLater) without touching settings', () => {
			wizard.startRefresh([1]);
			wizard.finishLater();

			expect(wizard.isRefreshing).toBe(false);
			expect(planner.settings.onboardingComplete).toBe(true);
			expect(planner.settings.onboardingStep).toBeUndefined();
		});

		it('leaves an in-progress real onboarding checkpoint alone if one exists', () => {
			planner.updateSettings({ onboardingComplete: true, onboardingStep: 3 });
			wizard.startRefresh([5]);
			wizard.advance();

			expect(planner.settings.onboardingStep).toBe(3);
		});
	});
});
