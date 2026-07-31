import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppSync, createSyncedStore, setPassphrase } from './index';
import type { AppSyncState } from './index';

describe('sync merge conflicts', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
		setPassphrase('carillon-test');
	});

	afterEach(() => {
		fetchMock.mockReset();
		setPassphrase('');
		vi.unstubAllGlobals();
	});

	it('merges a CAS conflict and retries against the observed server version', async () => {
		type Ledger = { observations: string[] };
		let local: Ledger = { observations: ['phone-mark'] };
		const writes: Ledger[] = [];

		fetchMock
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						server: {
							blob: { observations: ['desktop-mark'] },
							version: 4
						}
					}),
					{ status: 409 }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, version: 5 }), { status: 200 })
			);

		const synced = createSyncedStore<Ledger>({
			app: 'planner-carillon-merge-test',
			read: () => local,
			write: (next) => {
				local = next;
				writes.push(next);
			},
			merge: (mine, theirs) => ({
				observations: [...new Set([...mine.observations, ...theirs.observations])]
			})
		});

		await expect(synced.flush()).resolves.toEqual({ ok: true, version: 5 });
		expect(writes).toEqual([
			{ observations: ['phone-mark', 'desktop-mark'] }
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(JSON.parse(retryInit.body as string)).toEqual({
			app: 'planner-carillon-merge-test',
			blob: { observations: ['phone-mark', 'desktop-mark'] },
			baseVersion: 4
		});
	});

	it('keeps local and latest server state after a second consecutive conflict', async () => {
		type Ledger = { observations: string[] };
		let local: Ledger = { observations: ['phone-mark'] };
		const writes: Ledger[] = [];
		const merge = (mine: Ledger, theirs: Ledger): Ledger => ({
			observations: [...new Set([...mine.observations, ...theirs.observations])]
		});
		const state: AppSyncState = {
			connected: true,
			syncing: false,
			status: 'idle',
			lastSyncedAt: null,
			errorMessage: null
		};

		fetchMock
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						server: {
							blob: { observations: ['desktop-mark'] },
							version: 4
						}
					}),
					{ status: 409 }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						server: {
							blob: { observations: ['tablet-mark'] },
							version: 5
						}
					}),
					{ status: 409 }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true, version: 6 }), { status: 200 })
			);

		const sync = createAppSync<Ledger>({
			adapter: {
				app: 'planner-carillon-second-conflict-test',
				read: () => local,
				write: (next) => {
					local = next;
					writes.push(next);
				},
				merge
			},
			state
		});

		await sync.flushSync();

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(writes).toEqual([
			{ observations: ['phone-mark', 'desktop-mark'] },
			{ observations: ['phone-mark', 'desktop-mark', 'tablet-mark'] }
		]);
		expect(local).toEqual({
			observations: ['phone-mark', 'desktop-mark', 'tablet-mark']
		});
		expect(state.status).toBe('ok');
		expect(state.errorMessage).toBeNull();
	});

	it('keeps the latest merge locally and reports attention after three conflicts', async () => {
		type Ledger = { observations: string[] };
		let local: Ledger = { observations: ['phone'] };
		const state: AppSyncState = {
			connected: true,
			syncing: false,
			status: 'idle',
			lastSyncedAt: null,
			errorMessage: null
		};
		for (const [mark, version] of [
			['desktop', 2],
			['tablet', 3],
			['laptop', 4]
		] as const) {
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ server: { blob: { observations: [mark] }, version } }),
					{ status: 409 }
				)
			);
		}

		const sync = createAppSync<Ledger>({
			adapter: {
				app: 'planner-carillon-busy-sync-test',
				read: () => local,
				write: (next) => (local = next),
				merge: (mine, theirs) => ({
					observations: [...new Set([...mine.observations, ...theirs.observations])]
				})
			},
			state
		});

		await sync.flushSync();

		expect(local.observations).toEqual(['phone', 'desktop', 'tablet', 'laptop']);
		expect(state.status).toBe('error');
		expect(state.lastSyncedAt).toBeNull();
		expect(state.errorMessage).toContain('not yet synced');
	});

	it('keeps wrong-passphrase feedback after disconnecting the credential', async () => {
		type Ledger = { observations: string[] };
		const state: AppSyncState = {
			connected: true,
			syncing: false,
			status: 'idle',
			lastSyncedAt: null,
			errorMessage: null
		};
		fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }));
		const sync = createAppSync<Ledger>({
			adapter: {
				app: 'planner-carillon-auth-test',
				read: () => ({ observations: ['phone'] }),
				write: () => {}
			},
			state
		});

		await sync.flushSync();

		expect(state.connected).toBe(false);
		expect(state.status).toBe('error');
		expect(state.errorMessage).toBe('wrong passphrase');
	});
});
