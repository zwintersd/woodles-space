// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import * as sync from '@woodles/sync';
import {
	CARILLON_COMMITMENTS_STORAGE_KEY,
	CARILLON_COMMITMENTS_VERSION
} from '@woodles/sync';
import { Commitments } from './commitments.svelte';

function ledger(
	items: { taskId: string; entryId?: string; date?: string | null; status?: 'open' | 'done' }[]
) {
	return {
		version: CARILLON_COMMITMENTS_VERSION,
		publishedAt: '2026-08-09T00:00:00.000Z',
		commitments: items.map((item) => ({
			entryId: 'piranesi',
			title: 'read a chapter',
			date: '2026-08-13',
			time: '20:00',
			blockTitle: 'evening',
			status: 'open' as const,
			...item
		}))
	};
}

function writeLocal(blob: unknown): void {
	localStorage.setItem(CARILLON_COMMITMENTS_STORAGE_KEY, JSON.stringify(blob));
}

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('reading what Carillon scheduled', () => {
	it('reads the ledger Carillon left on this device', () => {
		writeLocal(ledger([{ taskId: 't1' }]));
		const c = new Commitments();
		c.loadLocal();

		expect(c.status).toBe('ready');
		expect(c.for('piranesi')).toHaveLength(1);
	});

	it('stays idle when Carillon has never published here', () => {
		const c = new Commitments();
		c.loadLocal();
		expect(c.status).toBe('idle');
		expect(c.for('piranesi')).toEqual([]);
	});

	it('survives a corrupt ledger', () => {
		localStorage.setItem(CARILLON_COMMITMENTS_STORAGE_KEY, '{not json');
		const c = new Commitments();
		c.loadLocal();
		expect(c.status).toBe('idle');
	});

	it('keeps entries apart', () => {
		writeLocal(
			ledger([
				{ taskId: 't1', entryId: 'piranesi' },
				{ taskId: 't2', entryId: 'solaris' }
			])
		);
		const c = new Commitments();
		c.loadLocal();

		expect(c.for('piranesi').map((x) => x.taskId)).toEqual(['t1']);
		expect(c.for('solaris').map((x) => x.taskId)).toEqual(['t2']);
	});
});

describe('the next thing still to happen', () => {
	it('skips what is already done', () => {
		writeLocal(
			ledger([
				{ taskId: 'past', date: '2026-08-10', status: 'done' },
				{ taskId: 'upcoming', date: '2026-08-13' }
			])
		);
		const c = new Commitments();
		c.loadLocal();

		expect(c.next('piranesi', '2026-08-09')?.taskId).toBe('upcoming');
	});

	it('skips a date that has passed', () => {
		writeLocal(ledger([{ taskId: 'yesterday', date: '2026-08-01' }]));
		const c = new Commitments();
		c.loadLocal();

		expect(c.next('piranesi', '2026-08-09')).toBeNull();
	});

	it('counts today', () => {
		writeLocal(ledger([{ taskId: 'today', date: '2026-08-09' }]));
		const c = new Commitments();
		c.loadLocal();

		expect(c.next('piranesi', '2026-08-09')?.taskId).toBe('today');
	});

	it('does not call an undated intention "next"', () => {
		writeLocal(ledger([{ taskId: 'someday', date: null }]));
		const c = new Commitments();
		c.loadLocal();

		expect(c.next('piranesi', '2026-08-09')).toBeNull();
		// It is still listed — it just isn't an answer to "when".
		expect(c.for('piranesi')).toHaveLength(1);
	});
});

describe('refreshing from sync', () => {
	it('does not reach the network without a passphrase', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(false);
		const pull = vi.spyOn(sync, 'pull');

		await new Commitments().refresh();
		expect(pull).not.toHaveBeenCalled();
	});

	it('picks up a ledger published from another device', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockResolvedValue({
			blob: ledger([{ taskId: 'remote' }]),
			version: 2
		});

		const c = new Commitments();
		await c.refresh();

		expect(c.status).toBe('ready');
		expect(c.for('piranesi').map((x) => x.taskId)).toEqual(['remote']);
	});

	it('keeps the local ledger when the network fails', async () => {
		writeLocal(ledger([{ taskId: 'local' }]));
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockRejectedValue(new sync.SyncError('network', 'offline'));

		const c = new Commitments();
		await c.refresh();

		expect(c.status).toBe('ready');
		expect(c.for('piranesi').map((x) => x.taskId)).toEqual(['local']);
	});

	it('reports an error only with nothing at all to show', async () => {
		vi.spyOn(sync, 'hasPassphrase').mockReturnValue(true);
		vi.spyOn(sync, 'pull').mockRejectedValue(new sync.SyncError('network', 'offline'));

		const c = new Commitments();
		await c.refresh();
		expect(c.status).toBe('error');
	});
});
