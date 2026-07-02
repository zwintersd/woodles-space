import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => sqlMock
}));

import handler from './public';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PASSPHRASE = 'test-passphrase';

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgres://test/db';
  process.env.SYNC_PASS_HASH = await sha256Hex(PASSPHRASE);
});

beforeEach(() => {
  sqlMock.mockReset();
});

function req(opts: { method: string; url: string; auth?: string; body?: unknown }): Request {
  const headers: Record<string, string> = {};
  if (opts.auth) headers.authorization = `Bearer ${opts.auth}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return new Request(opts.url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
}

describe('GET /api/public — no auth', () => {
  it('returns a published snapshot with no Authorization header, cacheably', async () => {
    sqlMock.mockResolvedValueOnce([
      { blob: { creatures: [] }, version: 2, published_at: '2026-07-01T00:00:00Z' }
    ]);

    const res = await handler(req({ method: 'GET', url: 'https://x/api/public?app=bestiary&slug=gallery' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('public');
    expect(await res.json()).toEqual({
      blob: { creatures: [] },
      version: 2,
      publishedAt: '2026-07-01T00:00:00Z'
    });
  });

  it('returns a null blob for an unpublished slug, not a 404', async () => {
    sqlMock.mockResolvedValueOnce([]);

    const res = await handler(req({ method: 'GET', url: 'https://x/api/public?app=bestiary&slug=nope' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blob: null, version: 0, publishedAt: null });
  });

  it('rejects a malformed app or slug before touching the database', async () => {
    const res = await handler(req({ method: 'GET', url: 'https://x/api/public?app=BAD!&slug=gallery' }));

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/public — auth required', () => {
  it('rejects a write with no passphrase at all', async () => {
    const res = await handler(
      req({
        method: 'POST',
        url: 'https://x/api/public',
        body: { app: 'bestiary', slug: 'gallery', blob: {} }
      })
    );

    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('rejects a write with the wrong passphrase', async () => {
    const res = await handler(
      req({
        method: 'POST',
        url: 'https://x/api/public',
        auth: 'wrong',
        body: { app: 'bestiary', slug: 'gallery', blob: {} }
      })
    );

    expect(res.status).toBe(401);
  });

  it('upserts the whole snapshot with the right passphrase — no baseVersion, no CAS', async () => {
    sqlMock.mockResolvedValueOnce([{ version: 4, published_at: '2026-07-02T00:00:00Z' }]);

    const res = await handler(
      req({
        method: 'POST',
        url: 'https://x/api/public',
        auth: PASSPHRASE,
        body: { app: 'bestiary', slug: 'gallery', blob: { creatures: [] } }
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 4, publishedAt: '2026-07-02T00:00:00Z' });
    // one INSERT ... ON CONFLICT DO UPDATE — no read-then-compare round trip
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a body missing app/slug/blob', async () => {
    const res = await handler(
      req({ method: 'POST', url: 'https://x/api/public', auth: PASSPHRASE, body: { app: 'bestiary' } })
    );

    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/public — auth required', () => {
  it('rejects with no passphrase', async () => {
    const res = await handler(
      req({ method: 'DELETE', url: 'https://x/api/public?app=bestiary&slug=gallery' })
    );

    expect(res.status).toBe(401);
  });

  it('deletes the row with the right passphrase', async () => {
    sqlMock.mockResolvedValueOnce([]);

    const res = await handler(
      req({ method: 'DELETE', url: 'https://x/api/public?app=bestiary&slug=gallery', auth: PASSPHRASE })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('method not allowed', () => {
  it('rejects unsupported methods', async () => {
    const res = await handler(
      req({ method: 'PATCH', url: 'https://x/api/public?app=bestiary&slug=gallery', auth: PASSPHRASE })
    );

    expect(res.status).toBe(405);
  });
});
