import type { Bell } from './types';

// The registry also supplies names and relative levels for the Web Audio chimes.
// filePath remains as a compatibility fallback for browsers without Web Audio.
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

const BELL_FREQUENCIES: Record<string, [number, number]> = {
	'block-start': [783.99, 987.77],
	'lead-time': [659.25, 783.99],
	meal: [523.25, 659.25],
	'wind-down': [440, 523.25],
	holiday: [987.77, 1318.51]
};

function playSynthBell(id: string, volume: number): boolean {
	const AudioContextClass =
		window.AudioContext ??
		(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) return false;

	try {
		const context = new AudioContextClass();
		const gain = context.createGain();
		const [low, high] = BELL_FREQUENCIES[id] ?? BELL_FREQUENCIES['block-start'];
		const now = context.currentTime;
		const duration = id === 'wind-down' ? 1.15 : 0.85;

		gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.16), now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		gain.connect(context.destination);

		[low, high].forEach((frequency, index) => {
			const oscillator = context.createOscillator();
			oscillator.type = index === 0 ? 'sine' : 'triangle';
			oscillator.frequency.setValueAtTime(frequency, now);
			oscillator.detune.setValueAtTime(index === 0 ? 0 : 3, now);
			oscillator.connect(gain);
			oscillator.start(now + index * 0.035);
			oscillator.stop(now + duration);
			if (index === 1) {
				oscillator.onended = () => {
					void context.close();
				};
			}
		});

		if (context.state === 'suspended') void context.resume();
		return true;
	} catch {
		return false;
	}
}

export function playBell(id: string): void {
	if (masterMuted || typeof window === 'undefined') return;
	const bell = getBell(id);
	if (!bell) return;
	const volume = Math.max(0, Math.min(1, bell.defaultVolume * masterVolume));
	if (playSynthBell(id, volume)) return;

	try {
		const audio = new Audio(bell.filePath);
		audio.volume = volume;
		audio.play().catch(() => {
			// Audio autoplay may be blocked — silently skip
		});
	} catch {
		// Silently skip on any audio error
	}
}
