import type { Page } from '@playwright/test';

export type BellLog = {
	/** Every oscillator the page started: frequency and start time on the audio clock. */
	oscillators: { freq: number; start: number }[];
	/** Every `carillon:bell` the page announced. */
	bells: { mark: string; voice: string; at: string }[];
	state: string;
};

/**
 * Replace Web Audio with a recorder before the page loads. With `locked`, the
 * context starts suspended and resume() only works during a real user
 * gesture — the way browsers treat a page nobody has touched yet.
 *
 * Plain functions and objects only: this is serialized into the page, where
 * compiled class-field helpers don't exist.
 */
export async function installFakeAudio(page: Page, options: { locked?: boolean } = {}): Promise<void> {
	await page.addInitScript(({ locked }) => {
		type Log = { oscillators: { freq: number; start: number }[]; bells: unknown[]; state: string };
		const log: Log = { oscillators: [], bells: [], state: locked ? 'suspended' : 'running' };
		(window as unknown as { __bellLog: Log }).__bellLog = log;
		window.addEventListener('carillon:bell', event => log.bells.push((event as CustomEvent).detail));
		// Playwright's browser counts every page as already activated, so the
		// fake tracks real gestures itself: resume() works only just after one,
		// like a browser's transient activation. Registered first, so it runs
		// before the page's own listeners.
		let gestureAt = -Infinity;
		for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
			window.addEventListener(type, event => { if (event.isTrusted) gestureAt = Date.now(); }, true);
		}
		const gesture = () => Date.now() - gestureAt < 1000;
		const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
		const node = () => ({ connect() {}, disconnect() {} });
		function makeContext() {
			const listeners = new Set<() => void>();
			const born = performance.now();
			const context = {
				state: log.state,
				destination: node(),
				get currentTime() { return (performance.now() - born) / 1000; },
				resume() {
					if (context.state !== 'running' && (!locked || gesture())) {
						context.state = 'running'; log.state = 'running';
						listeners.forEach(listener => listener());
					}
					return Promise.resolve();
				},
				addEventListener(_type: string, listener: () => void) { listeners.add(listener); },
				removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); },
				createGain() { return { ...node(), gain: param() }; },
				createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; },
				createBuffer() { return {}; },
				createBufferSource() { return { ...node(), buffer: null, start() {} }; },
				createOscillator() {
					let freq = 0;
					return {
						...node(), type: 'sine', onended: null,
						frequency: { ...param(), setValueAtTime(value: number) { freq = value; } },
						start(time: number) { log.oscillators.push({ freq, start: time }); },
						stop() {}
					};
				}
			};
			return context;
		}
		// `new` on a function that returns an object yields that object.
		(window as unknown as { AudioContext: unknown }).AudioContext = function FakeAudioContext() { return makeContext(); };
	}, { locked: Boolean(options.locked) });
}

export function bellLog(page: Page): Promise<BellLog> {
	return page.evaluate(() => structuredClone((window as unknown as { __bellLog: BellLog }).__bellLog));
}
