/**
 * Bell voices as plain note lists, so every sound Carillon can make is a
 * value a test can read. `bells.ts` renders them with Web Audio; nothing here
 * touches audio.
 */

export type BellVoiceId = 'bell' | 'soft-bell' | 'low-bell' | 'chime' | 'bowl' | 'wood' | 'pip' | 'westminster' | 'silent';

/** One oscillator: when it starts (seconds from now), its pitch, and how it fades. */
export type BellNote = {
	at: number;
	freq: number;
	type: OscillatorType;
	/** Peak level before master volume, 0..1. */
	gain: number;
	/** Seconds from peak to silence. */
	decay: number;
	/** Seconds from silence to peak; a soft onset avoids clicks. */
	attack?: number;
};

export const BELL_VOICES: { id: BellVoiceId; name: string; description: string }[] = [
	{ id: 'bell', name: 'Bell', description: 'The original two-note bell.' },
	{ id: 'soft-bell', name: 'Lower bell', description: 'The original bell, a third lower — Carillon’s lead-time bell.' },
	{ id: 'low-bell', name: 'Low bell', description: 'A deep tower bell with a long hum.' },
	{ id: 'chime', name: 'Glass chime', description: 'Three rising glassy notes.' },
	{ id: 'bowl', name: 'Singing bowl', description: 'A low, slowly fading bowl.' },
	{ id: 'wood', name: 'Wood block', description: 'A short, dry knock.' },
	{ id: 'pip', name: 'Soft pip', description: 'One small, quiet tone.' },
	{ id: 'westminster', name: 'Westminster quarters', description: 'The clock-tower tune: one phrase at quarter past, up to four on the hour.' },
	{ id: 'silent', name: 'Silent', description: 'No sound at this mark.' }
];

export function isBellVoice(value: unknown): value is BellVoiceId {
	return typeof value === 'string' && BELL_VOICES.some(voice => voice.id === value);
}

/**
 * A struck bell: hum, prime, minor third, fifth, nominal and an upper
 * partial. The upper partials carry real weight so a low bell still reads on
 * a phone or laptop speaker, which can't play its hum.
 */
function struck(at: number, freq: number, level = 1, length = 1): BellNote[] {
	return [
		{ ratio: 0.5, gain: 0.1, decay: 3.2 },
		{ ratio: 1, gain: 0.26, decay: 2.4 },
		{ ratio: 1.19, gain: 0.16, decay: 1.6 },
		{ ratio: 1.5, gain: 0.14, decay: 1.2 },
		{ ratio: 2, gain: 0.26, decay: 1.1 },
		{ ratio: 3, gain: 0.1, decay: 0.7 }
	].map(partial => ({ at, freq: freq * partial.ratio, type: 'sine' as const, gain: partial.gain * level, decay: partial.decay * length, attack: 0.004 }));
}

/** The original Carillon bell: a sine and a triangle a third apart. */
function twoTone(low: number, high: number): BellNote[] {
	return [
		{ at: 0, freq: low, type: 'sine', gain: 0.5, decay: 0.85, attack: 0.004 },
		{ at: 0.035, freq: high, type: 'triangle', gain: 0.5, decay: 0.85, attack: 0.004 }
	];
}

// The Westminster quarters on G#4 F#4 E4 B3, and the hour bell on A3 — low, but still within a phone speaker's reach.
const G_SHARP = 415.3, F_SHARP = 369.99, E = 329.63, B = 246.94, HOUR_BELL = 220;
const CHANGES = [
	[G_SHARP, F_SHARP, E, B],
	[E, G_SHARP, F_SHARP, B],
	[E, F_SHARP, G_SHARP, E],
	[G_SHARP, E, F_SHARP, B],
	[B, F_SHARP, G_SHARP, E]
];

/** Which of the five changes ring at a minute past the hour. */
export function westminsterPhrases(minute: number): number[] {
	if (minute === 15) return [0];
	if (minute === 30) return [1, 2];
	if (minute === 45) return [3, 4, 0];
	if (minute === 0) return [1, 2, 3, 4];
	return [0];
}

function westminster(minute: number): BellNote[] {
	const notes: BellNote[] = [];
	let at = 0;
	for (const phrase of westminsterPhrases(minute)) {
		CHANGES[phrase].forEach((freq, index) => {
			notes.push(...struck(at, freq, 1.2, index === 3 ? 1.1 : 0.7));
			at += index === 3 ? 1.1 : 0.62;
		});
		at += 0.35;
	}
	return notes;
}

export type VoiceContext = {
	/** Minutes past the hour, for voices that follow the clock face. */
	minute?: number;
};

export function voiceNotes(voice: BellVoiceId, context: VoiceContext = {}): BellNote[] {
	switch (voice) {
		case 'bell': return twoTone(783.99, 987.77);
		case 'soft-bell': return twoTone(659.25, 783.99);
		case 'low-bell': return struck(0, 329.63, 1.15);
		case 'chime': return [1046.5, 1318.51, 1567.98].flatMap((freq, index) => [
			{ at: index * 0.18, freq, type: 'sine' as const, gain: 0.26, decay: 1.5, attack: 0.003 },
			{ at: index * 0.18, freq: freq * 2.76, type: 'sine' as const, gain: 0.05, decay: 0.6, attack: 0.003 }
		]);
		// A bowl near middle C with real weight in its rim partials, so its slow beat carries on small speakers.
		case 'bowl': return [
			{ at: 0, freq: 261.6, type: 'sine', gain: 0.3, decay: 4.5, attack: 0.03 },
			{ at: 0, freq: 263.1, type: 'sine', gain: 0.2, decay: 4.2, attack: 0.03 },
			{ at: 0, freq: 261.6 * 2.71, type: 'sine', gain: 0.32, decay: 3, attack: 0.03 },
			{ at: 0, freq: 261.6 * 5.1, type: 'sine', gain: 0.14, decay: 1.6, attack: 0.03 }
		];
		case 'wood': return [
			{ at: 0, freq: 880, type: 'sine', gain: 0.85, decay: 0.18, attack: 0.001 },
			{ at: 0, freq: 1840, type: 'triangle', gain: 0.3, decay: 0.08, attack: 0.001 },
			{ at: 0, freq: 440, type: 'sine', gain: 0.15, decay: 0.2, attack: 0.001 },
			{ at: 0.11, freq: 880, type: 'sine', gain: 0.6, decay: 0.16, attack: 0.001 }
		];
		case 'pip': return [{ at: 0, freq: 1046.5, type: 'sine', gain: 0.75, decay: 0.6, attack: 0.006 }];
		case 'westminster': return westminster(context.minute ?? 15);
		case 'silent': return [];
	}
}

/** When the last note has faded. */
export function notesEnd(notes: BellNote[]): number {
	return notes.reduce((end, note) => Math.max(end, note.at + (note.attack ?? 0) + note.decay), 0);
}

/** The hour counted on the hour bell, 1–12, after the voice has rung. */
export function hourStrikes(hour24: number, after: number): BellNote[] {
	const count = hour24 % 12 || 12;
	const start = after + 0.8;
	return Array.from({ length: count }, (_, index) => struck(start + index * 1.5, HOUR_BELL, 1.2, 1)).flat();
}

/** A-weighting gain at a frequency (IEC 61672), as a linear factor. */
function aWeight(freq: number): number {
	const f2 = freq * freq;
	const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
	return ra * 1.2589; // +2 dB normalises 1 kHz to 1
}

/**
 * Rough perceived loudness of the first `window` seconds (the first note or two), in dB: A-weighted
 * energy of each decaying partial. Small-speaker roll-off is folded in by
 * also discounting below 300 Hz, so a bowl isn't judged as a hi-fi would.
 */
export function voiceLoudness(notes: BellNote[], window = 1): number {
	let energy = 0;
	for (const note of notes) {
		if (note.at >= window) continue;
		const speaker = note.freq < 300 ? (note.freq / 300) ** 2 : 1;
		const weight = aWeight(note.freq) * speaker;
		const k = Math.log(Math.max(note.gain, 0.0002) / 0.0001) / note.decay;
		const span = Math.min(window - note.at, note.decay);
		// ∫ (g·e^{-kt})² dt from 0 to span.
		energy += (weight * note.gain) ** 2 * (1 - Math.exp(-2 * k * span)) / (2 * k);
	}
	return 10 * Math.log10(Math.max(energy, 1e-12));
}

/** The loudest the summed envelopes get at any moment, before master volume. */
export function peakLevel(notes: BellNote[], step = 0.01): number {
	const end = notesEnd(notes);
	let peak = 0;
	for (let t = 0; t <= end; t += step) {
		let sum = 0;
		for (const note of notes) {
			const attack = note.attack ?? 0.004;
			if (t < note.at || t > note.at + attack + note.decay) continue;
			const local = t - note.at;
			sum += local < attack ? note.gain * (local / attack) : note.gain * Math.pow(0.0001 / note.gain, (local - attack) / note.decay);
		}
		peak = Math.max(peak, sum);
	}
	return peak;
}
