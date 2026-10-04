import { beforeEach, describe, expect, it } from 'vitest';
import { sendHandoff } from '@woodles/handoff';
import { LIFE_POINTS_STORAGE_KEY, publishLifePoints } from '@woodles/life-points';
import { HOMESUITE_RECENT_STORAGE_KEY, buildHomeSuiteRecent } from '@shared/homesuiteRecent.js';
import { GLANCE_KEYS, ago, greeting, readGlance } from './glance';

beforeEach(() => localStorage.clear());

describe('the glance', () => {
	it('is empty, not broken, on a browser that has never been here', () => {
		expect(readGlance()).toEqual({ waiting: { write: 0, whiteboard: 0, 'thinking-about': 0 }, recent: null, life: null });
	});

	it('counts what is waiting in each queue without draining it', () => {
		sendHandoff('write', { title: 'a', source: { app: 'companion' } });
		sendHandoff('write', { title: 'b', source: { app: 'companion' } });
		sendHandoff('thinking-about', { title: 'c', source: { app: 'companion' } });
		expect(readGlance().waiting).toEqual({ write: 2, whiteboard: 0, 'thinking-about': 1 });
		expect(readGlance().waiting).toEqual({ write: 2, whiteboard: 0, 'thinking-about': 1 });
	});

	it('links each recent thing to where HomeSuite opens it', () => {
		const blob = buildHomeSuiteRecent(
			[{ kind: 'document', ref: { id: 'd 1' }, title: '', updatedAt: '2026-10-04T10:00:00.000Z' }],
			'2026-10-04T11:00:00.000Z'
		);
		localStorage.setItem(HOMESUITE_RECENT_STORAGE_KEY, JSON.stringify(blob));
		expect(readGlance().recent).toEqual({
			publishedAt: '2026-10-04T11:00:00.000Z',
			items: [{ kind: 'document', title: 'untitled', updatedAt: '2026-10-04T10:00:00.000Z', href: '/homesuite?document=d%201' }]
		});
	});

	it('reads Life Points from landing’s ledger, with the way to the next rank', () => {
		localStorage.setItem(LIFE_POINTS_STORAGE_KEY, JSON.stringify(publishLifePoints({ earned: 50 }, '2026-10-04T11:00:00.000Z')));
		expect(readGlance().life).toEqual({
			balance: 50,
			earned: 50,
			rank: 'stepped outside',
			next: { at: 75, name: 'took the long way' },
			progress: 0.5
		});
	});

	it('shrugs off a ledger it cannot read', () => {
		localStorage.setItem(LIFE_POINTS_STORAGE_KEY, '{not json');
		localStorage.setItem(HOMESUITE_RECENT_STORAGE_KEY, JSON.stringify({ version: 99 }));
		expect(readGlance()).toMatchObject({ recent: null, life: null });
	});

	it('watches every key it reads', () => {
		expect(GLANCE_KEYS).toEqual([
			'woodles.handoff.write.v1',
			'woodles.handoff.whiteboard.v1',
			'woodles.handoff.thinking-about.v1',
			HOMESUITE_RECENT_STORAGE_KEY,
			LIFE_POINTS_STORAGE_KEY
		]);
	});
});

it('says how long ago, plainly', () => {
	const now = new Date('2026-10-04T12:00:00.000Z');
	expect(ago('2026-10-04T11:59:40.000Z', now)).toBe('just now');
	expect(ago('2026-10-04T11:48:00.000Z', now)).toBe('12 min ago');
	expect(ago('2026-10-04T09:00:00.000Z', now)).toBe('3 h ago');
	expect(ago('2026-10-03T09:00:00.000Z', now)).toBe('yesterday');
	expect(ago('2026-09-30T09:00:00.000Z', now)).toBe('4 days ago');
	expect(ago('', now)).toBe('');
});

it('greets the way the homepage does', () => {
	expect([3, 9, 14, 19, 23].map(greeting)).toEqual(['still up', 'good morning', 'good afternoon', 'good evening', 'goodnight']);
});
