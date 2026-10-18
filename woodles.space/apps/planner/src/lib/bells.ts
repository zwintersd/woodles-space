import type { Bell } from './types';
import { hourStrikes, notesEnd, voiceNotes, type BellNote, type BellVoiceId } from './bellVoices';

/**
 * Carillon's bells are synthesized: every sound is a list of notes
 * (bellVoices.ts) played on one shared Web Audio graph. There are no audio
 * files; where Web Audio is missing, bells are simply unavailable and the
 * panel says so.
 */

// Block bells a planned block can name (`Block.bellId`), at their original pitches.
export const BELLS: Bell[] = [
	{ id: 'block-start', name: 'block start', defaultVolume: 0.7 },
	{ id: 'lead-time',   name: 'lead time',   defaultVolume: 0.5 },
	{ id: 'meal',        name: 'meal',        defaultVolume: 0.75 },
	{ id: 'wind-down',   name: 'wind-down',   defaultVolume: 0.8 },
	{ id: 'holiday',     name: 'holiday',     defaultVolume: 0.65 }
];

let masterVolume = 1.0;
let masterMuted = false;

export function getBell(id: string): Bell | undefined {
	return BELLS.find((b) => b.id === id);
}

export function setMasterVolume(v: number): void {
	if (Number.isFinite(v)) masterVolume = Math.max(0, Math.min(1, v));
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

/** A registry bell as notes: the original two-tone synth at its own pitches. */
export function registryNotes(id: string): BellNote[] {
	const [low, high] = BELL_FREQUENCIES[id] ?? BELL_FREQUENCIES['block-start'];
	const decay = id === 'wind-down' ? 1.15 : 0.85;
	return [
		{ at: 0, freq: low, type: 'sine', gain: 0.5, decay, attack: 0.004 },
		{ at: 0.035, freq: high, type: 'triangle', gain: 0.5, decay, attack: 0.004 }
	];
}

// ── one shared audio graph ─────────────────────────────────────────

type Graph = { context: AudioContext; input: GainNode };
export type SoundKind = 'auto' | 'preview';
type Sequence = { gain: GainNode; oscillators: Set<OscillatorNode>; kind: SoundKind; endsAt: number };

let graph: Graph | null = null;
/** Set once making a context has failed — the browser has Web Audio in name only. */
let contextFailed = false;
const sequences = new Set<Sequence>();
let contextFactory: (() => AudioContext | null) | null = null;

/** Test seam: supply a context (or null for "no Web Audio"); pass undefined to restore. */
export function setAudioContextFactory(factory: (() => AudioContext | null) | undefined): void {
	contextFactory = factory ?? null;
	resetAudioForTests();
}

/** Forget the shared graph and anything sounding, so tests don't leak into each other. */
export function resetAudioForTests(): void {
	graph = null;
	contextFailed = false;
	sequences.clear();
	notifySounding();
}

const soundingListeners = new Set<(sounding: SoundKind | null) => void>();

/** What is sounding now: the latest sequence's kind, or null. */
function soundingKind(): SoundKind | null {
	return [...sequences].at(-1)?.kind ?? null;
}

function notifySounding(): void {
	const kind = soundingKind();
	for (const listener of soundingListeners) listener(kind);
}

/**
 * Follow what is sounding — a preview, an automatic bell, or nothing — so a
 * stop control can appear only while something plays, and a preview's own
 * stop button can clear when an automatic bell takes over.
 */
export function watchSounding(listener: (sounding: SoundKind | null) => void): () => void {
	soundingListeners.add(listener);
	listener(soundingKind());
	return () => soundingListeners.delete(listener);
}

function createContext(): AudioContext | null {
	if (!contextFactory && typeof window === 'undefined') return null;
	const AudioContextClass = contextFactory ? null : window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!contextFactory && !AudioContextClass) return null;
	try {
		return contextFactory ? contextFactory() : new AudioContextClass!({ latencyHint: 'playback' });
	} catch {
		contextFailed = true;
		return null;
	}
}

export type AudioReadiness = 'running' | 'suspended' | 'unavailable';
const readinessListeners = new Set<(state: AudioReadiness) => void>();

function notifyReadiness(): void {
	const state = audioReadiness();
	for (const listener of readinessListeners) listener(state);
}

/**
 * One context for the life of the page — a context per bell would hit
 * browser limits and start locked each time. No compressor on the way out:
 * every voice's summed envelope stays well under full scale (bellVoices
 * tests check it), and a compressor's automatic makeup gain would raise
 * every bell above the original level.
 */
function audioGraph(): Graph | null {
	if (graph && graph.context.state !== 'closed') return graph;
	const context = createContext();
	if (!context) { notifyReadiness(); return null; }
	try {
		const input = context.createGain();
		input.connect(context.destination);
		context.addEventListener?.('statechange', () => {
			// A context that stops running mid-sequence would play the rest late; let it go instead.
			if (context.state !== 'running') stopBells(0);
			notifyReadiness();
		});
		graph = { context, input };
		notifyReadiness();
		return graph;
	} catch {
		contextFailed = true;
		notifyReadiness();
		return null;
	}
}

/** "suspended" covers Safari's "interrupted" and a context not made yet. */
export function audioReadiness(): AudioReadiness {
	if (graph) return graph.context.state === 'running' ? 'running' : graph.context.state === 'closed' ? 'unavailable' : 'suspended';
	if (contextFailed) return 'unavailable';
	if (contextFactory) return 'suspended';
	if (typeof window === 'undefined') return 'unavailable';
	return window.AudioContext || (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext ? 'suspended' : 'unavailable';
}

export function watchAudioReadiness(listener: (state: AudioReadiness) => void): () => void {
	readinessListeners.add(listener);
	listener(audioReadiness());
	return () => readinessListeners.delete(listener);
}

/**
 * Browsers only let a page make sound after a gesture. Called from one, this
 * resumes the context synchronously (before any await, which iOS requires)
 * and plays one silent frame for older iOS.
 */
export function unlockAudio(): Promise<AudioReadiness> {
	const current = audioGraph();
	if (!current) return Promise.resolve('unavailable');
	let resumed: Promise<unknown> = Promise.resolve();
	try {
		if (current.context.state !== 'running') resumed = current.context.resume();
		const source = current.context.createBufferSource();
		source.buffer = current.context.createBuffer(1, 1, 22050);
		source.connect(current.context.destination);
		source.start(0);
	} catch {
		// Still locked; the next gesture tries again.
	}
	return resumed.catch(() => {}).then(() => { notifyReadiness(); return audioReadiness(); });
}

/**
 * Listen to gestures for the life of the page: iOS and Safari suspend or
 * interrupt the context after a call or a trip to the background, and the
 * next tap must wake it again. Skips work while running or while bells are
 * off, so a page with bells off never opens the audio device.
 */
export function installAudioUnlock(wanted: () => boolean = () => true, target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
	// The events that count as user activation, including pen and touch.
	const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
	const handler = () => {
		if (graph?.context.state === 'running' || !wanted()) return;
		void unlockAudio();
	};
	events.forEach(event => target.addEventListener(event, handler, { capture: true, passive: true }));
	const visibility = () => notifyReadiness();
	if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
	return () => {
		events.forEach(event => target.removeEventListener(event, handler, { capture: true } as EventListenerOptions));
		if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
	};
}

/** Perceived loudness is roughly logarithmic; a squared curve makes the low end of a slider usable. */
export function levelFor(volume: number): number {
	const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
	return clamped * clamped;
}

// Matches the original bell: two oscillators at 0.5 peaked at 0.16 each at full volume.
const HEADROOM = 0.32;

/** How long a locked context may take to wake before a bell is let go rather than played late. */
const RESUME_WINDOW_MS = 500;

/** Resolve true only once the context is running; never wait long. */
async function ensureRunning(context: AudioContext): Promise<boolean> {
	if (context.state === 'running') return true;
	try {
		await Promise.race([context.resume(), new Promise(resolve => setTimeout(resolve, RESUME_WINDOW_MS))]);
	} catch {
		// Refused without a gesture.
	}
	// Read again: resume() may have changed it while we waited.
	return (context.state as AudioContextState) === 'running';
}

export type PlayResult = 'scheduled' | 'silent' | 'locked' | 'muted' | 'unavailable';

function schedule(current: Graph, notes: BellNote[], level: number, kind: SoundKind, delay = 0): Sequence {
	const { context, input } = current;
	const now = context.currentTime + 0.03 + delay;
	const sequence: Sequence = { gain: context.createGain(), oscillators: new Set(), kind, endsAt: now + notesEnd(notes) };
	sequence.gain.connect(input);
	sequences.add(sequence);
	notifySounding();
	for (const note of notes) {
		const start = now + note.at;
		const attack = Math.max(0.001, note.attack ?? 0.004);
		const peak = Math.max(0.0002, note.gain * level);
		const gain = context.createGain();
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.linearRampToValueAtTime(peak, start + attack);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + note.decay);
		gain.connect(sequence.gain);
		const oscillator = context.createOscillator();
		oscillator.type = note.type;
		oscillator.frequency.setValueAtTime(note.freq, start);
		oscillator.connect(gain);
		oscillator.onended = () => {
			sequence.oscillators.delete(oscillator);
			oscillator.disconnect();
			gain.disconnect();
			if (!sequence.oscillators.size) { sequence.gain.disconnect(); sequences.delete(sequence); notifySounding(); }
		};
		sequence.oscillators.add(oscillator);
		oscillator.start(start);
		oscillator.stop(start + attack + note.decay + 0.05);
	}
	return sequence;
}

/** Fade a sequence out over a few milliseconds — stopping mid-note would click. */
function fadeOut(sequence: Sequence, seconds: number, notify = true): void {
	const context = graph?.context;
	sequences.delete(sequence);
	if (notify) notifySounding();
	if (!context) return;
	const at = context.currentTime;
	try {
		sequence.gain.gain.setTargetAtTime(0, at, Math.max(0.001, seconds / 4));
		for (const oscillator of sequence.oscillators) oscillator.stop(at + seconds + 0.02);
	} catch {
		// Already stopped.
	}
}

/**
 * Play notes as one sequence. Only a running context gets notes: a locked
 * one's clock stands still, and anything queued on it would all sound at
 * once on the first tap. Bells never stack: a preview (an explicit request)
 * fades whatever is sounding, and an automatic bell fades a preview but
 * waits for another automatic bell to finish — a counted hour is never cut
 * off by a reminder that came due during it.
 */
export async function playNotes(notes: BellNote[], volume: number, kind: SoundKind = 'auto'): Promise<PlayResult> {
	if (masterMuted) return 'muted';
	const level = levelFor(volume) * HEADROOM;
	if (level <= 0 || !notes.length) return 'silent';
	try {
		const current = audioGraph();
		if (!current) return 'unavailable';
		if (!(await ensureRunning(current.context))) { notifyReadiness(); return 'locked'; }
		const now = current.context.currentTime;
		let delay = 0;
		// The next sequence takes over without a moment of "nothing sounding".
		for (const sequence of [...sequences]) {
			if (kind === 'auto' && sequence.kind === 'auto' && sequence.endsAt > now) delay = Math.max(delay, sequence.endsAt - now + 0.3);
			else fadeOut(sequence, 0.08, false);
		}
		schedule(current, notes, level, kind, delay);
		return 'scheduled';
	} catch {
		return 'unavailable';
	}
}

/** Silence everything already scheduled — a long hour can be cut short. */
export function stopBells(seconds = 0.08): void {
	for (const sequence of [...sequences]) fadeOut(sequence, seconds);
}

export function isSounding(): boolean {
	return sequences.size > 0;
}

/** Shift notes later, to follow another sound. */
export function after(notes: BellNote[], seconds: number): BellNote[] {
	return seconds > 0 ? notes.map(note => ({ ...note, at: note.at + seconds })) : notes;
}

/** The notes for a voice, followed by the hour counted on the hour bell. */
export function voiceWithStrikes(voice: BellVoiceId, options: { minute?: number; strikeHour?: number }): BellNote[] {
	const notes = voiceNotes(voice, { minute: options.minute });
	const strikes = options.strikeHour === undefined ? [] : hourStrikes(options.strikeHour, notesEnd(notes));
	return [...notes, ...strikes];
}

export function playVoice(voice: BellVoiceId, options: { volume: number; minute?: number; strikeHour?: number; kind?: SoundKind }): Promise<PlayResult> {
	return playNotes(voiceWithStrikes(voice, options), options.volume, options.kind);
}

/** A registry bell at its own level. Never rejects. */
export function playBell(id: string): Promise<PlayResult> {
	const bell = getBell(id);
	if (!bell || typeof window === 'undefined' && !contextFactory) return Promise.resolve('silent');
	// Registry bells keep their original linear level under the squared curve.
	return playNotes(registryNotes(id), Math.sqrt(Math.max(0, Math.min(1, bell.defaultVolume * masterVolume)))).catch(() => 'unavailable' as const);
}
