// @vitest-environment happy-dom
// Carillon's sync end to end, through the real store and sync client: each
// device (or tab) is its own copy of the modules, over its own storage — two
// tabs share one — against an in-memory /api/sync.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannerBlob } from './types';

class DeviceStorage implements Storage {
	items = new Map<string, string>();
	/** Keys whose writes fail, the way a full origin quota does. */
	failing = new Set<string>();
	get length() { return this.items.size; }
	clear() { this.items.clear(); }
	getItem(key: string) { return this.items.get(key) ?? null; }
	key(index: number) { return [...this.items.keys()][index] ?? null; }
	removeItem(key: string) { this.items.delete(key); }
	setItem(key: string, value: string) {
		if (this.failing.has(key)) throw new DOMException('quota', 'QuotaExceededError');
		this.items.set(key, String(value));
	}
}

function use(storage: Storage): void {
	Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
	Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

type Device = {
	storage: DeviceStorage;
	sync: typeof import('./sync.svelte');
	store: (typeof import('./store.svelte'))['store'];
};

/** A page load: fresh modules reading this storage. */
async function load(storage = new DeviceStorage()): Promise<Device> {
	use(storage);
	vi.resetModules();
	const sync = await import('./sync.svelte');
	const { store } = await import('./store.svelte');
	return { storage, sync, store };
}

/** Act as this device, with its storage in place. */
async function on<T>(device: Device, act: (device: Device) => T | Promise<T>): Promise<T> {
	use(device.storage);
	return act(device);
}

/** /api/sync in memory: compare-and-swap per app, keys handed back reordered like JSONB. */
function fakeServer() {
	const rows = new Map<string, { blob: unknown; version: number }>();
	const pushes = new Map<string, number>();
	const pulls = new Map<string, number>();
	let gate: Promise<void> | null = null;
	let open: () => void = () => {};
	const shuffle = (value: unknown): unknown => Array.isArray(value) ? value.map(shuffle)
		: value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, shuffle(v)])) : value;
	const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
	return {
		rows,
		pushes: (app = 'planner') => pushes.get(app) ?? 0,
		pulls: (app = 'planner') => pulls.get(app) ?? 0,
		planner: () => rows.get('planner')?.blob as PlannerBlob | undefined,
		/** Hold Carillon's pushes until `release`. */
		hold() { gate = new Promise((resolve) => { open = resolve; }); },
		release() { gate = null; open(); },
		fetch: vi.fn(async (url: string, init?: RequestInit) => {
			if (!init?.method || init.method === 'GET') {
				const app = new URL(url, 'http://local').searchParams.get('app') ?? '';
				pulls.set(app, (pulls.get(app) ?? 0) + 1);
				const row = rows.get(app) ?? { blob: null, version: 0 };
				return reply({ blob: shuffle(row.blob), version: row.version });
			}
			const { app, blob, baseVersion } = JSON.parse(init.body as string);
			if (app === 'planner' && gate) await gate;
			const row = rows.get(app) ?? { blob: null, version: 0 };
			if (baseVersion !== row.version) return reply({ conflict: true, server: { blob: shuffle(row.blob), version: row.version } }, 409);
			rows.set(app, { blob: JSON.parse(JSON.stringify(blob)), version: row.version + 1 });
			pushes.set(app, (pushes.get(app) ?? 0) + 1);
			return reply({ ok: true, version: row.version + 1 });
		})
	};
}

const realSetTimeout = globalThis.setTimeout;
/** Let background operations finish. */
async function settle(): Promise<void> {
	for (let i = 0; i < 20; i++) await new Promise((resolve) => realSetTimeout(resolve, 0));
}

const labels = (device: Device) => device.store.signalEntries.map((entry) => entry.label).sort();
const titles = (blob: PlannerBlob | undefined) => (blob?.tasks ?? []).map((task) => task.title).sort();

let server: ReturnType<typeof fakeServer>;

beforeEach(() => {
	server = fakeServer();
	vi.stubGlobal('fetch', server.fetch);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('Carillon sync between devices', () => {
	it('keeps a signal removed on the phone removed on the computer, instead of bringing it back', async () => {
		const computer = await load();
		await on(computer, async ({ store, sync }) => {
			store.addSignalEntry({ kind: 'custom', date: '2026-10-20', label: 'Cold' });
			store.addSignalEntry({ kind: 'custom', date: '2026-10-20', label: 'Busy week' });
			await sync.connectAndHydrate('pass');
			expect(sync.syncState.errorMessage).toBeNull();
		});

		const phone = await load();
		await on(phone, async ({ store, sync }) => {
			await sync.connectAndHydrate('pass');
			expect(labels(phone)).toEqual(['Busy week', 'Cold']);
			store.removeSignalEntry(store.signalEntries.find((entry) => entry.label === 'Cold')!.id);
			await sync.pushIfChanged();
		});

		await on(computer, async ({ sync }) => {
			await sync.syncNow();
			expect(labels(computer)).toEqual(['Busy week']);
			await sync.syncNow();
		});
		expect(server.planner()?.signals?.map((entry) => entry.label)).toEqual(['Busy week']);
	});

	it('pushes nothing when nothing changed, even with the keys reordered', async () => {
		const device = await load();
		await on(device, async ({ store, sync }) => {
			store.addTask({ title: 'Water the fern' });
			await sync.connectAndHydrate('pass');
			const pushes = server.pushes();
			await sync.syncNow();
			await sync.syncNow();
			await sync.pushIfChanged();
			expect(server.pushes()).toBe(pushes);
			// Nor does a reload: what it holds is what it agreed on.
			const reloaded = await load(device.storage);
			await reloaded.sync.syncNow();
			expect(server.pushes()).toBe(pushes);
		});
	});

	it('forgets what it agreed on when disconnected, so a later connect only adds', async () => {
		const device = await load();
		await on(device, async ({ sync, storage }) => {
			await sync.connectAndHydrate('pass');
			expect(storage.getItem(sync.PLANNER_SYNC_BASE_KEY)).not.toBeNull();
			sync.disconnect();
			expect(storage.getItem(sync.PLANNER_SYNC_BASE_KEY)).toBeNull();
		});
	});

	it('sends an edit made while a push is under way once that push lands', async () => {
		const device = await load();
		await on(device, async ({ store, sync }) => {
			await sync.connectAndHydrate('pass');
			store.addTask({ title: 'First' });
			server.hold();
			const first = sync.pushIfChanged();
			store.addTask({ title: 'Second' });
			const second = sync.pushIfChanged();
			server.release();
			await Promise.all([first, second]);
		});
		expect(titles(server.planner())).toEqual(['First', 'Second']);
	});
});

describe('Carillon sync on one device', () => {
	it('lets a tab that has been open a while take another tab’s saves before it syncs', async () => {
		const storage = new DeviceStorage();
		const first = await load(storage);
		await on(first, ({ sync }) => sync.connectAndHydrate('pass'));
		const second = await load(storage);
		await on(second, ({ sync }) => sync.syncNow());

		await on(first, ({ store, sync }) => {
			store.addTask({ title: 'Call the dentist' });
			return sync.pushIfChanged();
		});
		expect(second.store.tasks).toHaveLength(0);

		// Read as "deleted here" from the copy it loaded, this would take the task off every device.
		await on(second, ({ sync }) => sync.syncNow());
		expect(second.store.tasks.map((task) => task.title)).toEqual(['Call the dentist']);
		expect(titles(server.planner())).toEqual(['Call the dentist']);
	});

	it('follows another tab’s saves as they happen, so its own next save keeps them', async () => {
		const storage = new DeviceStorage();
		const first = await load(storage);
		const second = await load(storage);
		const stop = second.store.followOtherTabs();
		await on(first, ({ store }) => store.addTask({ title: 'From the first tab' }));
		window.dispatchEvent(new StorageEvent('storage', { key: 'planner.tasks.v1' }));
		await on(second, ({ store }) => store.addTask({ title: 'From the second tab' }));
		stop();
		expect(JSON.parse(storage.getItem('planner.tasks.v1')!).map((task: { title: string }) => task.title))
			.toEqual(['From the first tab', 'From the second tab']);
	});

	it('does not record an agreement over a save that failed', async () => {
		const computer = await load();
		await on(computer, async ({ store, sync }) => {
			store.addSignalEntry({ kind: 'custom', date: '2026-10-20', label: 'Cold' });
			await sync.connectAndHydrate('pass');
		});

		const phone = await load();
		await on(phone, async ({ sync, storage }) => {
			storage.failing.add('planner.signals.v1');
			await sync.connectAndHydrate('pass');
			expect(sync.syncState.status).toBe('ok');
			expect(storage.getItem(sync.PLANNER_SYNC_BASE_KEY)).toBeNull();
		});

		// Reloaded, the phone lacks the signal it never managed to keep — and does not read that as a delete.
		const reloaded = await load(phone.storage);
		await on(reloaded, async ({ sync }) => {
			phone.storage.failing.clear();
			await sync.syncNow();
			expect(labels(reloaded)).toEqual(['Cold']);
		});
		expect(server.planner()?.signals?.map((entry) => entry.label)).toEqual(['Cold']);
	});

	it('starts an unreadable section over from a union instead of deleting it everywhere', async () => {
		const device = await load();
		await on(device, async ({ store, sync }) => {
			store.addTask({ title: 'Renew passport' });
			await sync.connectAndHydrate('pass');
		});
		device.storage.items.set('planner.tasks.v1', '{"half a write');

		const reloaded = await load(device.storage);
		await on(reloaded, ({ sync }) => sync.syncNow());
		expect(reloaded.store.tasks.map((task) => task.title)).toEqual(['Renew passport']);
		expect(titles(server.planner())).toEqual(['Renew passport']);
	});

	it('syncs on coming back to the tab and every two minutes in view, and pushes on the way out', async () => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
		let visibility: DocumentVisibilityState = 'visible';
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
		const show = (state: DocumentVisibilityState) => {
			visibility = state;
			document.dispatchEvent(new Event('visibilitychange'));
		};

		const device = await load();
		await on(device, async ({ store, sync }) => {
			await sync.connectAndHydrate('pass');
			const stop = sync.startAutoSync();
			await settle();
			const pulls = server.pulls();
			const pushes = server.pushes();

			show('hidden');
			show('visible');
			await settle();
			expect(server.pushes(), 'nothing changed, nothing sent').toBe(pushes);
			expect(server.pulls(), 'just synced').toBe(pulls);

			vi.advanceTimersByTime(21_000);
			show('hidden');
			show('visible');
			await settle();
			expect(server.pulls()).toBe(pulls + 1);

			vi.advanceTimersByTime(120_000);
			await settle();
			expect(server.pulls()).toBe(pulls + 2);

			show('hidden');
			vi.advanceTimersByTime(120_000);
			await settle();
			expect(server.pulls(), 'no pulls out of view').toBe(pulls + 2);

			store.addTask({ title: 'Sent on leaving' });
			window.dispatchEvent(new Event('pagehide'));
			await settle();
			expect(server.pushes()).toBe(pushes + 1);
			expect(titles(server.planner())).toEqual(['Sent on leaving']);
			stop();
		});
		Reflect.deleteProperty(document, 'visibilityState');
	});
});
