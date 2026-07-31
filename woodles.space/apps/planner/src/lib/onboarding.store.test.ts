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
});
