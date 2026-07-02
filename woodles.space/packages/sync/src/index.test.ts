import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publish, pullPublic, setPassphrase, SyncError } from './index';

describe('publish / pullPublic — the public read path client pair', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    setPassphrase('');
    vi.unstubAllGlobals();
  });

  it('pullPublic sends no Authorization header — the read path is unauthenticated', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ blob: { creatures: [] }, version: 3, publishedAt: '2026-07-01T00:00:00Z' }), {
        status: 200
      })
    );

    const snap = await pullPublic('bestiary', 'gallery');

    expect(snap).toEqual({ blob: { creatures: [] }, version: 3, publishedAt: '2026-07-01T00:00:00Z' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/public?app=bestiary&slug=gallery');
    expect(init?.headers).toBeUndefined();
  });

  it('pullPublic surfaces an unpublished slug as a null blob, not an error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ blob: null, version: 0, publishedAt: null }), { status: 200 })
    );

    const snap = await pullPublic('bestiary', 'gallery');

    expect(snap).toEqual({ blob: null, version: 0, publishedAt: null });
  });

  it('pullPublic throws SyncError on a server error response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));

    await expect(pullPublic('bestiary', 'gallery')).rejects.toBeInstanceOf(SyncError);
  });

  it('publish requires a passphrase and sends it as a bearer token', async () => {
    await expect(publish('bestiary', 'gallery', { creatures: [] })).rejects.toMatchObject({
      kind: 'no-passphrase'
    });
    expect(fetchMock).not.toHaveBeenCalled();

    setPassphrase('correct horse');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, version: 1, publishedAt: '2026-07-01T00:00:00Z' }), { status: 200 })
    );

    const result = await publish('bestiary', 'gallery', { creatures: [] });

    expect(result).toEqual({ ok: true, version: 1, publishedAt: '2026-07-01T00:00:00Z' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/public');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer correct horse');
    expect(JSON.parse(init.body)).toEqual({ app: 'bestiary', slug: 'gallery', blob: { creatures: [] } });
  });

  it('publish throws unauthorized on a wrong passphrase (401)', async () => {
    setPassphrase('wrong');
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }));

    await expect(publish('bestiary', 'gallery', { creatures: [] })).rejects.toMatchObject({
      kind: 'unauthorized'
    });
  });
});
