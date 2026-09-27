import { afterEach } from 'vitest';

class MemoryStorage implements Storage {
	private items = new Map<string, string>();

	get length() {
		return this.items.size;
	}

	clear() {
		this.items.clear();
	}

	getItem(key: string) {
		return this.items.get(String(key)) ?? null;
	}

	key(index: number) {
		return Array.from(this.items.keys())[index] ?? null;
	}

	removeItem(key: string) {
		this.items.delete(String(key));
	}

	setItem(key: string, value: string) {
		this.items.set(String(key), String(value));
	}
}

const storage = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: storage
});

if (globalThis.window) {
	Object.defineProperty(globalThis.window, 'localStorage', {
		configurable: true,
		value: storage
	});
}

// Give the worker one turn of the event loop between tests. Vitest runs a file's
// tests back to back as microtasks, so a file of synchronous work never reads
// the main process's replies to its progress reports, and the worker's RPC
// gives up on one after a fixed 60s. The test results are unaffected, but the
// timeout is an unhandled error and fails the run. Marginalia's sim.test.ts is
// about 40s of simulation on a quiet core and past 60s on a busy CI runner. With
// this hook the 60s applies to a single test rather than a whole file.
// setImmediate is captured here, before any test can swap in fake timers.
const realSetImmediate = globalThis.setImmediate;
afterEach(() => new Promise<void>((resolve) => realSetImmediate(resolve)));
