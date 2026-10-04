import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleStore } from '../e2e/support/schedule-store.mjs';
const sqlMock = vi.fn();
vi.mock('@neondatabase/serverless', () => ({ neon: () => sqlMock }));
import handler from './schedules';
import { digest, hashPassword, verifyPassword } from './_schedule-security';
import { schedulePayload } from './_schedule-payload';

let store: ReturnType<typeof scheduleStore>;
const origin = 'https://schedules.test';
const draft = (): any => ({ plan: { id: 'local-plan', learner: 'Sam', name: 'Afternoon', days: [{ key: 'monday', start: '15:00', end: '18:00', activities: [
  { kind: 'activity', occurrenceId: 'read', title: 'Read', start: '15:00', duration: 15, icon: '📚' },
  { kind: 'activity', occurrenceId: 'ghost', title: 'PRIVATE GHOST', start: '15:00', duration: 60, ghost: true }
] }, { key: 'tuesday', removed: true, activities: [{ title: 'PRIVATE DAY' }] }] }, images: [], activityLibrary: [{ title: 'PRIVATE LIBRARY' }] });
function request(query = '', body?: any, cookie = '', headers: Record<string, string> = {}) {
  return handler(new Request(origin + '/api/schedules' + query, { method: body ? 'POST' : 'GET', headers: { origin, 'content-type': 'application/json', cookie, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
}
function cookie(response: Response) { return response.headers.get('set-cookie')!.split(';')[0]; }
async function publisher() { return cookie(await request('', { action: 'login', password: 'publisher-passphrase' })); }
async function publish(auth: string, extra: any = {}) {
  const response = await request('', { action: 'publish', sourceId: 'local-plan', baseVersion: 0, password: 'learner-pass', payload: draft(), ...extra }, auth);
  expect(response.status).toBe(201); return (await response.json() as any).publication;
}
beforeAll(async () => { process.env.DATABASE_URL = 'postgres://test/db'; process.env.SCHEDULE_PUBLISHER_PASS_HASH = await digest('publisher-passphrase'); });
beforeEach(() => { store = scheduleStore(); sqlMock.mockReset().mockImplementation(store.sql); });

describe('protected publishing', () => {
  it('fails closed when setup is missing and never exposes server errors', async () => {
    const hash = process.env.SCHEDULE_PUBLISHER_PASS_HASH; delete process.env.SCHEDULE_PUBLISHER_PASS_HASH; delete process.env.SYNC_PASS_HASH;
    expect(await (await request('?action=status')).json()).toEqual({ configured: false, authenticated: false });
    expect((await request('?id=' + 'a'.repeat(32))).status).toBe(503); process.env.SCHEDULE_PUBLISHER_PASS_HASH = hash;
    sqlMock.mockRejectedValueOnce(new Error('postgres://SECRET@host SQL private payload'));
    const response = await request('?id=' + 'a'.repeat(32)); expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/SECRET|SQL|postgres/);
  });
  it('requires publisher authentication for every management read and write', async () => {
    for (const action of ['list', 'detail', 'history']) expect((await request('?action=' + action)).status).toBe(401);
    for (const action of ['publish', 'restore', 'unpublish', 'access']) expect((await request('', { action })).status).toBe(401);
    expect(store.publications.size).toBe(0); expect(store.calls).toHaveLength(0);
  });
  it('checks database readiness before offering publisher login', async () => {
    expect(await (await request('?action=status')).json()).toEqual({ configured: true, authenticated: false });
    expect(store.calls[0].q).toContain('schedule_publications, schedule_revisions, schedule_sessions, schedule_attempts LIMIT 0');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const code of ['42P01', '42703']) {
        sqlMock.mockRejectedValueOnce(Object.assign(new Error('PRIVATE database details'), { code }));
        const response = await request('?action=status');
        expect(response.status).toBe(503);
        expect(await response.text()).toContain(code === '42P01' ? 'apply api/schema.sql' : 'table columns against api/schema.sql');
        expect(log).toHaveBeenLastCalledWith('[schedules] request failed', { operation: 'status', code });
      }
    } finally { log.mockRestore(); }
  });
  it('never logs raw errors, SQL, credentials, payloads or user-supplied actions', async () => {
    const auth = await publisher();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      sqlMock.mockRejectedValueOnce(Object.assign(new Error('postgres://SECRET@host PRIVATE payload'), { code: 'SECRET' }));
      const response = await request('', { action: 'PRIVATE ACTION' }, auth);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toMatch(/SECRET|PRIVATE|postgres/);
      expect(log).toHaveBeenCalledExactlyOnceWith('[schedules] request failed', { operation: 'request', code: 'unknown' });
    } finally { log.mockRestore(); }
  });
  it('rejects cross-site writes and non-JSON requests', async () => {
    const cases: Record<string, string>[] = [{ origin: 'https://attacker.test' }, { 'content-type': 'text/plain' }, { origin: '' }];
    for (const headers of cases) expect((await request('', { action: 'login', password: 'publisher-passphrase' }, '', headers)).status).toBe(403);
    expect(store.sessions.size).toBe(0);
  });
  it('rejects oversized requests before attempting password or payload work', async () => {
    const response = await request('', { action: 'publish', padding: 'x'.repeat(3_750_001) });
    expect(response.status).toBe(413); expect(store.calls).toHaveLength(0);
  });
  it('uses opaque, secure HttpOnly sessions and clears them on logout', async () => {
    const response = await request('', { action: 'login', password: 'publisher-passphrase' });
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
    const auth = cookie(response); expect(auth).not.toContain('publisher-passphrase');
    expect(store.sessions.has(auth.split('=')[1])).toBe(false);
    expect((await request('?action=list', undefined, auth)).status).toBe(200);
    expect((await request('', { action: 'logout' }, auth)).headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await request('?action=list', undefined, auth)).status).toBe(401);
  });
  it('always requires a learner password, excludes private draft content, and gates payload reads', async () => {
    const auth = await publisher();
    expect((await request('', { action: 'publish', baseVersion: 0, payload: draft() }, auth)).status).toBe(400);
    const publication = await publish(auth);
    expect(publication.passwordSet).toBe(true); expect(publication).not.toHaveProperty('password_hash'); expect(publication.id).toMatch(/^[a-f0-9]{32}$/);
    store.calls.length = 0;
    const locked = await request('?id=' + publication.id); expect(locked.status).toBe(401); expect(await locked.text()).not.toMatch(/Sam|Read|Afternoon/);
    expect(store.calls.some(call => call.q.startsWith('SELECT payload'))).toBe(false);
    expect((await request('', { action: 'unlock', id: publication.id, password: 'wrong-pass' })).status).toBe(401);
    const unlock = await request('', { action: 'unlock', id: publication.id, password: 'learner-pass' });
    const view = await request('?id=' + publication.id, undefined, cookie(unlock));
    expect(view.status).toBe(200); expect(view.headers.get('cache-control')).toBe('no-store');
    const text = await view.text(); expect(text).toContain('Read'); expect(text).not.toMatch(/PRIVATE|password|library|local-plan/);
    expect(store.publications.get(publication.id).password_hash).toMatch(/^pbkdf2-sha256:600000:/);
  });
  it('republishes with compare-and-swap, keeps the stable link and restores saved content', async () => {
    const auth = await publisher(), p = await publish(auth);
    const payload = draft(); payload.plan.days[0].activities[0].title = 'Blocks';
    const update = await request('', { action: 'publish', id: p.id, baseVersion: p.version, payload }, auth);
    expect(update.status).toBe(200); expect((await update.json() as any).publication.id).toBe(p.id);
    expect((await request('', { action: 'publish', id: p.id, baseVersion: 1, payload }, auth)).status).toBe(409);
    const history = await request('?action=history&id=' + p.id, undefined, auth); expect((await history.json() as any).revisions.map((r: any) => r.version)).toEqual([2, 1]);
    const restore = await request('', { action: 'restore', id: p.id, baseVersion: 2, revision: 1 }, auth); expect(restore.status).toBe(200);
    expect(store.publications.get(p.id).payload.plan.days[0].activities[0].title).toBe('Read');
    expect(store.publications.get(p.id).version).toBe(3);
  });
  it('password changes, expiry and withdrawal revoke existing learner access', async () => {
    const auth = await publisher(), p = await publish(auth);
    const viewer = cookie(await request('', { action: 'unlock', id: p.id, password: 'learner-pass' }));
    expect((await request('', { action: 'access', id: p.id, baseVersion: 1, password: 'new-learner-pass' }, auth)).status).toBe(200);
    expect((await request('?id=' + p.id, undefined, viewer)).status).toBe(401);
    expect((await request('', { action: 'unlock', id: p.id, password: 'learner-pass' })).status).toBe(401);
    const next = cookie(await request('', { action: 'unlock', id: p.id, password: 'new-learner-pass' }));
    expect((await request('?id=' + p.id, undefined, next)).status).toBe(200);
    store.publications.get(p.id).expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await request('?id=' + p.id, undefined, next)).status).toBe(404);
    store.publications.get(p.id).expires_at = null;
    expect((await request('', { action: 'unpublish', id: p.id, baseVersion: 2 }, auth)).status).toBe(200);
    expect((await request('?id=' + p.id, undefined, next)).status).toBe(404);
    expect((await request('?action=detail&id=' + p.id, undefined, auth)).status).toBe(200);
  });
  it('limits password attempts durably and invalidates sessions after publisher key rotation', async () => {
    for (let i = 0; i < 10; i++) expect((await request('', { action: 'login', password: 'wrong' })).status).toBe(401);
    expect((await request('', { action: 'login', password: 'publisher-passphrase' })).status).toBe(429);
    store.attempts.clear(); const auth = await publisher(); const previous = process.env.SCHEDULE_PUBLISHER_PASS_HASH;
    process.env.SCHEDULE_PUBLISHER_PASS_HASH = await digest('rotated-publisher-passphrase');
    expect((await request('?action=list', undefined, auth)).status).toBe(401); process.env.SCHEDULE_PUBLISHER_PASS_HASH = previous;
  });
  it('rechecks access when withdrawal races with a learner read', async () => {
    const auth = await publisher(), p = await publish(auth), viewer = cookie(await request('', { action: 'unlock', id: p.id, password: 'learner-pass' }));
    sqlMock.mockImplementation(async (strings, ...values) => { const result = await store.sql(strings, ...values); if (strings.join('').startsWith('SELECT token_hash')) store.publications.get(p.id).access_version++; return result; });
    expect((await request('?id=' + p.id, undefined, viewer)).status).toBe(401);
  });
  it('prevents simultaneous first publications from creating two links for one draft', async () => {
    const auth = await publisher(); await publish(auth);
    expect((await request('', { action: 'publish', sourceId: 'local-plan', baseVersion: 0, password: 'learner-pass', payload: draft() }, auth)).status).toBe(409);
    expect(store.publications.size).toBe(1);
  });
  it('keeps sessions scoped to one publication and handles conditional reads after access checks', async () => {
    const auth = await publisher(), p = await publish(auth), other = await publish(auth, { sourceId: 'another-plan' });
    const viewer = cookie(await request('', { action: 'unlock', id: p.id, password: 'learner-pass' }));
    expect((await request('?id=' + other.id, undefined, viewer)).status).toBe(401);
    expect((await request('?id=' + p.id, undefined, auth)).status).toBe(401);
    const response = await request('?id=' + p.id, undefined, viewer); const etag = response.headers.get('etag')!;
    expect((await request('?id=' + p.id, undefined, viewer, { 'if-none-match': etag })).status).toBe(304);
    await request('', { action: 'viewer-logout', id: p.id }, viewer);
    expect((await request('?id=' + p.id, undefined, viewer, { 'if-none-match': etag })).status).toBe(401);
  });
  it('preserves successful publication if later history cleanup fails', async () => {
    const auth = await publisher();
    sqlMock.mockImplementation((strings, ...values) => strings.join('').startsWith('DELETE FROM schedule_revisions') ? Promise.reject(new Error('cleanup unavailable')) : store.sql(strings, ...values));
    await publish(auth); expect(store.publications.size).toBe(1); expect(store.revisions.size).toBe(1);
  });
  it('retains the latest ten content revisions', async () => {
    const auth = await publisher(), p = await publish(auth);
    for (let version = 1; version <= 11; version++) expect((await request('', { action: 'publish', id: p.id, baseVersion: version, payload: draft() }, auth)).status).toBe(200);
    expect(store.revisions.size).toBe(10); expect(store.revisions.has(p.id + ':1')).toBe(false); expect(store.revisions.has(p.id + ':12')).toBe(true);
  });
});

describe('snapshot validation and passwords', () => {
  it('rejects overlap, missing pictures and duplicate days while allowing ghosts', () => {
    expect(schedulePayload(draft(), 'a'.repeat(32)).plan.days[0].activities).toHaveLength(1);
    const overlapping = draft(); overlapping.plan.days[0].activities[1].ghost = false;
    expect(() => schedulePayload(overlapping, 'a'.repeat(32))).toThrow(/overlapping/);
    const missing: any = draft(); missing.plan.days[0].activities[0].imageAssetId = 'missing'; expect(() => schedulePayload(missing, 'a'.repeat(32))).toThrow(/picture/);
    const duplicate = draft(); duplicate.plan.days.push(duplicate.plan.days[0]); expect(() => schedulePayload(duplicate, 'a'.repeat(32))).toThrow(/days/);
  });
  it('preserves choices, nested suggestion rules, video links and custom symbol credit', () => {
    const payload: any = draft(); payload.plan.days[0].activities = [
      { kind: 'choice', occurrenceId: 'choice', start: '15:00', duration: 20, options: [{ id: 'option-a', title: 'Blocks' }, { id: 'option-b', title: 'Crafts', kind: 'suggestion', duration: 20, rerollMode: 'limited', maxRerolls: 2, candidates: [{ id: 'craft', title: 'Draw', duration: 10, symbolAssetId: 'pic', symbolCredit: 'Artist', symbolPixelated: true }] }] },
      { kind: 'video', occurrenceId: 'video', start: '15:20', duration: 10, videos: [{ id: 'v', title: 'Song', url: 'https://example.com/video' }] }
    ]; payload.images = [{ id: 'pic', data: 'data:image/png;base64,AAAA' }, { id: 'unshared', data: 'PRIVATE' }];
    const clean: any = schedulePayload(payload, 'b'.repeat(32)); expect(clean.images).toHaveLength(1);
    expect(clean.plan.days[0].activities[0].options[1]).toMatchObject({ kind: 'suggestion', maxRerolls: 2, candidates: [{ title: 'Draw', symbolCredit: 'Artist', symbolPixelated: true }] });
    expect(clean.plan.days[0].activities[1].videos[0].url).toBe('https://example.com/video');
  });
  it('uses unique salts and verifies only the right learner password', async () => {
    const a = await hashPassword('learner-pass'), b = await hashPassword('learner-pass'); expect(a).not.toBe(b);
    expect(await verifyPassword('learner-pass', a)).toBe(true); expect(await verifyPassword('wrong', a)).toBe(false); expect(await verifyPassword('learner-pass', 'malformed')).toBe(false);
  });
});
