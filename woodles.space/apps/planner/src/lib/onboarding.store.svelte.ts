// Onboarding wizard state — a checkpointed working buffer that becomes
// the user's persisted settings/shapes/etc. once they reach the end.
//
// The wizard mutates the planner directly as the user advances (anchors,
// domains, obligations, rituals, week pattern, tone). Its saved step lives in
// settings alongside those changes, so a refresh can return someone to the
// exact question they were answering. The completion screen flips
// settings.onboardingComplete = true.

import { store, type PlannerStore } from './store.svelte';
import { STARTER_SHAPES_V2 } from './onboarding.copy';
import type { OnboardingStep, WeekPattern } from './types';

export type WizardStage = 'welcome' | OnboardingStep | 'done';

function isOnboardingStep(value: unknown): value is OnboardingStep {
	return typeof value === 'number' && value >= 1 && value <= 6;
}

export class OnboardingStore {
	stage: WizardStage;
	// 'refresh' is a second, independent entry point into the same six step
	// components — reached from the running app rather than from welcome,
	// and never touching onboardingComplete/onboardingStep. It exists so
	// changing one thing (say, the week rhythm) doesn't require "resetting
	// setup" and doesn't risk stranding the resume-checkpoint the *real*
	// unfinished-wizard case relies on.
	mode: 'wizard' | 'refresh' = $state('wizard');
	refreshSteps: OnboardingStep[] = $state([]);

	constructor(private readonly planner: PlannerStore = store) {
		this.stage = $state<WizardStage>(this.savedStep ?? 'welcome');
	}

	get savedStep(): OnboardingStep | null {
		const step = this.planner.settings.onboardingStep;
		return isOnboardingStep(step) ? step : null;
	}

	get isRefreshing(): boolean {
		return this.mode === 'refresh';
	}

	get canGoBack(): boolean {
		if (this.mode === 'refresh') {
			return this.refreshSteps.indexOf(this.stage as OnboardingStep) > 0;
		}
		return typeof this.stage === 'number' && this.stage > 1;
	}

	/**
	 * Open one or more sections for editing, in the order given, without
	 * leaving the running app or touching onboarding progress. Steps reuse
	 * their existing prefill-from-current-settings behavior, so nothing here
	 * needs its own "load current values" path.
	 */
	startRefresh(steps: OnboardingStep[]): void {
		if (steps.length === 0) return;
		this.mode = 'refresh';
		this.refreshSteps = steps;
		this.stage = steps[0];
	}

	closeRefresh(): void {
		this.mode = 'wizard';
		this.refreshSteps = [];
		this.stage = this.savedStep ?? 'welcome';
	}

	advance(): void {
		if (this.mode === 'refresh') {
			this.advanceRefresh();
			return;
		}
		this.setStage(this.nextOf(this.stage));
	}

	back(): void {
		if (this.mode === 'refresh') {
			this.backRefresh();
			return;
		}
		this.setStage(this.prevOf(this.stage));
	}

	private advanceRefresh(): void {
		const idx = this.refreshSteps.indexOf(this.stage as OnboardingStep);
		if (idx === -1 || idx === this.refreshSteps.length - 1) {
			this.closeRefresh();
			return;
		}
		this.stage = this.refreshSteps[idx + 1];
	}

	private backRefresh(): void {
		const idx = this.refreshSteps.indexOf(this.stage as OnboardingStep);
		if (idx <= 0) {
			this.closeRefresh();
			return;
		}
		this.stage = this.refreshSteps[idx - 1];
	}

	goto(stage: WizardStage): void {
		this.setStage(stage);
	}

	finish(): void {
		this.planner.updateSettings({ onboardingComplete: true, onboardingStep: undefined });
		this.stage = 'welcome';
	}

	finishAndCompose(): void {
		this.finish();
		const block =
			this.planner.getCurrentBlockForDate(this.planner.now) ??
			this.planner.getNextBlockForDate(this.planner.now);
		this.planner.startCompose({ targetBlockId: block?.id });
	}

	quickStart(): void {
		this.ensureStarterWeek();
		this.planner.updateSettings({ onboardingComplete: true, onboardingStep: undefined });
		this.stage = 'welcome';
	}

	finishLater(): void {
		if (this.mode === 'refresh') {
			this.closeRefresh();
			return;
		}
		const step = isOnboardingStep(this.stage) ? this.stage : this.savedStep;
		this.planner.updateSettings({ onboardingComplete: true, onboardingStep: step ?? undefined });
		this.stage = 'welcome';
	}

	resumeFromPlanner(): void {
		const step = this.savedStep ?? 1;
		this.planner.updateSettings({ onboardingComplete: false });
		this.stage = step;
	}

	// Called by the welcome screen — installs the four starter shapes
	// (if the user has none yet) so by the time step 5 lands there are
	// cards to assign.
	beginFlow(): void {
		if (this.savedStep) {
			this.setStage(this.savedStep);
			return;
		}
		this.ensureStarterWeek();
		this.setStage(1);
	}

	private ensureStarterWeek(): void {
		if (this.planner.dayShapes.length === 0) {
			this.planner.setDayShapes(STARTER_SHAPES_V2);
		} else {
			// Existing users: make sure the four starters are at least available.
			const haveIds = new Set(this.planner.dayShapes.map((s) => s.id));
			const additions = STARTER_SHAPES_V2.filter((s) => !haveIds.has(s.id));
			if (additions.length > 0) {
				this.planner.setDayShapes([...this.planner.dayShapes, ...additions]);
			}
		}

		// Only seed a default when the saved pattern is genuinely unusable. A
		// returning person may have already tailored it before they paused setup.
		const defaultPattern: WeekPattern = {
			days: [
				'starter-recovery',
				'starter-office',
				'starter-office',
				'starter-office',
				'starter-office',
				'starter-office',
				'starter-recovery'
			]
		};
		const hasUsableWeekPattern =
			Array.isArray(this.planner.weekPattern?.days) &&
			this.planner.weekPattern.days.length === 7 &&
			this.planner.weekPattern.days.every((id) =>
				this.planner.dayShapes.some((shape) => shape.id === id)
			);
		if (!hasUsableWeekPattern) {
			this.planner.setWeekPattern(defaultPattern);
		}
	}

	private setStage(stage: WizardStage): void {
		this.stage = stage;
		const savedStep = isOnboardingStep(stage) ? stage : stage === 'done' ? 6 : undefined;
		this.planner.updateSettings({ onboardingStep: savedStep });
	}

	private nextOf(s: WizardStage): WizardStage {
		if (s === 'welcome') return 1;
		if (s === 'done') return 'done';
		if (s === 6) return 'done';
		return (s + 1) as WizardStage;
	}
	private prevOf(s: WizardStage): WizardStage {
		if (s === 'welcome' || s === 1) return 'welcome';
		if (s === 'done') return 6;
		return (s - 1) as WizardStage;
	}
}

export const onboarding = new OnboardingStore();
