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
