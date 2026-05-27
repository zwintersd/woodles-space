// Onboarding wizard state — transient working buffer that becomes
// the user's persisted settings/shapes/etc. once they reach the end.
//
// The wizard mutates `store` directly as the user advances (anchors,
// domains, obligations, rituals, week pattern, tone) so progress
// survives a refresh mid-flow. The completion screen flips
// settings.onboardingComplete = true.

import { store } from './store.svelte';
import { STARTER_SHAPES_V2 } from './onboarding.copy';
import type { WeekPattern } from './types';

export type WizardStage = 'welcome' | 1 | 2 | 3 | 4 | 5 | 6 | 'done';

class OnboardingStore {
	stage = $state<WizardStage>('welcome');

	advance(): void {
		this.stage = this.nextOf(this.stage);
	}

	back(): void {
		this.stage = this.prevOf(this.stage);
	}

	goto(stage: WizardStage): void {
		this.stage = stage;
	}

	finish(): void {
		store.updateSettings({ onboardingComplete: true });
		this.stage = 'welcome';
	}

	// Called by the welcome screen — installs the four starter shapes
	// (if the user has none yet) so by the time step 5 lands there are
	// cards to assign.
	beginFlow(): void {
		if (store.dayShapes.length === 0) {
			store.setDayShapes(STARTER_SHAPES_V2);
		} else {
			// Existing users: make sure the four starters are at least available.
			const haveIds = new Set(store.dayShapes.map((s) => s.id));
			const additions = STARTER_SHAPES_V2.filter((s) => !haveIds.has(s.id));
			if (additions.length > 0) {
				store.setDayShapes([...store.dayShapes, ...additions]);
			}
		}
		// Seed a reasonable default week pattern if the user has none.
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
		// Always overwrite during onboarding — the user's about to set this in step 5.
		store.setWeekPattern(defaultPattern);
		this.stage = 1;
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
