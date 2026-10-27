/**
 * A strict stand-in for Web Audio, for tests. It throws where real browsers
 * throw (non-finite parameter values, exponential ramps to zero or below),
 * records every oscillator, and lets a test decide whether the context is
 * locked and whether resume() is allowed.
 */

type ParamEvent = { kind: 'set' | 'linear' | 'exponential' | 'target'; value: number; time: number };

class FakeParam {
	value: number;
	events: ParamEvent[] = [];
	constructor(value = 1) { this.value = value; }
	#check(value: number, time: number) {
		if (!Number.isFinite(value) || !Number.isFinite(time)) throw new TypeError('The provided value is non-finite.');
	}
	setValueAtTime(value: number, time: number) { this.#check(value, time); this.events.push({ kind: 'set', value, time }); return this; }
	linearRampToValueAtTime(value: number, time: number) { this.#check(value, time); this.events.push({ kind: 'linear', value, time }); return this; }
	exponentialRampToValueAtTime(value: number, time: number) {
		this.#check(value, time);
		if (value <= 0) throw new RangeError('exponentialRampToValueAtTime target must be positive');
		this.events.push({ kind: 'exponential', value, time }); return this;
	}
	setTargetAtTime(value: number, time: number, constant: number) {
		this.#check(value, time); this.#check(constant, time);
		this.events.push({ kind: 'target', value, time }); return this;
	}
}

class FakeNode {
	connections: unknown[] = [];
	connect(target: unknown) { this.connections.push(target); return target; }
	disconnect() { this.connections = []; }
}

export class FakeGain extends FakeNode {
	gain = new FakeParam(1);
}

export class FakeOscillator extends FakeNode {
	type: OscillatorType = 'sine';
	frequency = new FakeParam(440);
	startedAt: number | null = null;
	stoppedAt: number | null = null;
	onended: (() => void) | null = null;
	constructor(private context: FakeAudioContext) { super(); }
	start(time = 0) { if (!Number.isFinite(time)) throw new TypeError('non-finite'); this.startedAt = time; }
	stop(time = this.context.currentTime) {
		if (!Number.isFinite(time)) throw new TypeError('non-finite');
		if (this.startedAt === null) throw new Error('InvalidStateError: stop before start');
		this.stoppedAt = this.stoppedAt === null ? time : Math.min(this.stoppedAt, time);
	}
	/** Fire onended, as the audio thread would once the stop time passes. */
	end() { this.onended?.(); }
	/** The peak level its envelope reaches (the gain node it connects to). */
	get peak(): number {
		const gain = this.connections[0] as FakeGain | undefined;
		return gain?.gain.events.find(event => event.kind === 'linear')?.value ?? NaN;
	}
}

export class FakeAudioContext {
	state: AudioContextState = 'suspended';
	currentTime = 0;
	/** Whether resume() is allowed — false models a page with no gesture yet. */
	allowResume = false;
	destination = new FakeNode();
	oscillators: FakeOscillator[] = [];
	gains: FakeGain[] = [];
	silentBuffersPlayed = 0;
	#listeners = new Set<() => void>();

	constructor(options: { running?: boolean; allowResume?: boolean } = {}) {
		if (options.running) this.state = 'running';
		this.allowResume = options.allowResume ?? Boolean(options.running);
	}

	resume(): Promise<void> {
		if (this.allowResume && this.state !== 'running' && this.state !== 'closed') this.setState('running');
		return Promise.resolve();
	}
	setState(state: AudioContextState) { this.state = state; this.#listeners.forEach(listener => listener()); }
	addEventListener(_type: 'statechange', listener: () => void) { this.#listeners.add(listener); }
	removeEventListener(_type: 'statechange', listener: () => void) { this.#listeners.delete(listener); }
	createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
	createOscillator() { const oscillator = new FakeOscillator(this); this.oscillators.push(oscillator); return oscillator; }
	createDynamicsCompressor() {
		const node = new FakeNode() as FakeNode & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', FakeParam>;
		for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release'] as const) node[key] = new FakeParam(0);
		return node;
	}
	createBuffer() { return {}; }
	createBufferSource() {
		const source = new FakeNode() as FakeNode & { buffer: unknown; start: () => void };
		source.start = () => { this.silentBuffersPlayed += 1; };
		return source;
	}
	/** Oscillators that have been started and not yet ended. */
	get live(): FakeOscillator[] { return this.oscillators.filter(oscillator => oscillator.startedAt !== null); }
}

/** Use as `setAudioContextFactory(fake.factory)`. */
export function fakeFactory(context: FakeAudioContext): () => AudioContext {
	return () => context as unknown as AudioContext;
}
