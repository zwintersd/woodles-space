// A tiny reactive feed of newly-unlocked achievements, so a toast can pop up
// the moment one is earned. Same shape as resourceGains'/arcadeNotices' queues
// (resourceGains.svelte.ts, arcade/arcadeNotices.svelte.ts) — a bounded
// $state array a component drains, not the source of truth. That's
// Book.achievementsUnlocked, which is persisted; this queue is transient and
// only exists to animate the moment it changed.

import type { Achievement } from './content/achievements';

export interface AchievementToast {
	id: number;
	achievement: Achievement;
}

let nextId = 1;
const MAX_QUEUED = 10; // bounds memory over a long session

export const achievementToasts = $state<AchievementToast[]>([]);

export function announceAchievement(achievement: Achievement) {
	achievementToasts.push({ id: nextId++, achievement });
	if (achievementToasts.length > MAX_QUEUED) {
		achievementToasts.splice(0, achievementToasts.length - MAX_QUEUED);
	}
}
