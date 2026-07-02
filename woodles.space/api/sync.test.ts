import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: () => sqlMock
}));

import handler from './sync';

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

describe('sync — every request is password-gated (unlike public)', () => {
  it('rejects a GET with no passphrase', async () => {
    const res = await handler(req({ method: 'GET', url: 'https://x/api/sync?app=bestiary' }));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('pulls the blob + version with the right passphrase', async () => {
    sqlMock.mockResolvedValueOnce([{ blob: { hi: 1 }, version: 3 }]);
    const res = await handler(req({ method: 'GET', url: 'https://x/api/sync?app=bestiary', auth: PASSPHRASE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blob: { hi: 1 }, version: 3 });
  });

  it('first write (baseVersion 0) inserts without a compare-and-swap read', async () => {
    sqlMock.mockResolvedValueOnce([{ version: 1 }]);
    const res = await handler(
      req({
        method: 'POST',
        url: 'https://x/api/sync',
        auth: PASSPHRASE,
        body: { app: 'bestiary', blob: { hi: 1 }, baseVersion: 0 }
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 1 });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it('a stale baseVersion reports a 409 conflict with the server state', async () => {
    sqlMock.mockResolvedValueOnce([]); // UPDATE ... WHERE version = baseVersion matches nothing
    sqlMock.mockResolvedValueOnce([{ blob: { hi: 2 }, version: 5 }]); // fallback SELECT

    const res = await handler(
      req({
        method: 'POST',
        url: 'https://x/api/sync',
        auth: PASSPHRASE,
        body: { app: 'bestiary', blob: { hi: 1 }, baseVersion: 2 }
      })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      conflict: true,
      server: { blob: { hi: 2 }, version: 5 }
    });
  });
});
