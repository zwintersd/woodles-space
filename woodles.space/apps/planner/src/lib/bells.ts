import type { Bell } from './types';

// Bell registry — audio files sourced separately (CC0/public domain, freesound.org)
// and placed in apps/planner/static/bells/
export const BELLS: Bell[] = [
	{ id: 'block-start', name: 'block start',  filePath: '/planner/bells/block-start.mp3',  defaultVolume: 0.7 },
	{ id: 'lead-time',   name: 'lead time',    filePath: '/planner/bells/lead-time.mp3',    defaultVolume: 0.5 },
	{ id: 'meal',        name: 'meal',         filePath: '/planner/bells/meal.mp3',         defaultVolume: 0.75 },
	{ id: 'wind-down',   name: 'wind-down',    filePath: '/planner/bells/wind-down.mp3',    defaultVolume: 0.8 },
	{ id: 'holiday',     name: 'holiday',      filePath: '/planner/bells/holiday.mp3',      defaultVolume: 0.65 }
];

let masterVolume = 1.0;
let masterMuted = false;

export function getBell(id: string): Bell | undefined {
	return BELLS.find((b) => b.id === id);
}

export function setMasterVolume(v: number): void {
	masterVolume = Math.max(0, Math.min(1, v));
}

export function setMasterMuted(m: boolean): void {
	masterMuted = m;
}

export function getMasterMuted(): boolean {
	return masterMuted;
}

export function playBell(id: string): void {
	if (masterMuted || typeof window === 'undefined') return;
	const bell = getBell(id);
	if (!bell) return;
	try {
		const audio = new Audio(bell.filePath);
		audio.volume = Math.max(0, Math.min(1, bell.defaultVolume * masterVolume));
		audio.play().catch(() => {
			// Audio autoplay may be blocked — silently skip
		});
	} catch {
		// Silently skip on any audio error
	}
}
