// api/public.ts — Woodles public read path (Vercel serverless function).
//
//   GET    /api/public?app=<name>&slug=<slug>  → no auth, cacheable
//                                                 → { blob, version, publishedAt }
//                                                 → { blob: null, version: 0, publishedAt: null } when unpublished
//   POST   /api/public                          → auth required, body { app, slug, blob }
//                                                 → whole-snapshot upsert (no CAS)
//                                                 → { ok: true, version, publishedAt }
//   DELETE /api/public?app=<name>&slug=<slug>   → auth required → { ok: true }
//
// Separate from `sync` (api/sync.ts): this table holds snapshots Z has
// explicitly published for anyone to read. `sync` stays single-user and
// password-gated on both read and write; this endpoint's GET has no auth at
// all — that's the point, it's the primitive a visitor's browser calls.
//
// Republishing is a whole-snapshot upsert, not a compare-and-swap: there's no
// concurrent editor racing the publish action, so the "ask before clobber"
// dance that `sync` needs doesn't apply here.

import { authed, db, json, APP_PATTERN } from './_lib';

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

const PUBLIC_CACHE = 'public, max-age=300, stale-while-revalidate=86400';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    return await route(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('public handler error:', err);
    return json({ ok: false, error: 'server', message }, 500);
  }
}

async function route(req: Request): Promise<Response> {
  const sql = db();

  // ── read: no auth ───────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const app = url.searchParams.get('app') ?? '';
    const slug = url.searchParams.get('slug') ?? '';
    if (!APP_PATTERN.test(app)) return json({ ok: false, error: 'bad app key' }, 400);
    if (!SLUG_PATTERN.test(slug)) return json({ ok: false, error: 'bad slug' }, 400);

    const rows = await sql`
      SELECT blob, version, published_at FROM published WHERE app = ${app} AND slug = ${slug}`;
    if (rows.length === 0) {
      return json({ blob: null, version: 0, publishedAt: null }, 200, { 'cache-control': PUBLIC_CACHE });
    }
    return json(
      { blob: rows[0].blob, version: Number(rows[0].version), publishedAt: rows[0].published_at },
      200,
      { 'cache-control': PUBLIC_CACHE }
    );
  }

  // ── write: passphrase required, same check as sync ──────────────────────
  if (!(await authed(req))) return json({ ok: false, error: 'unauthorized' }, 401);

  if (req.method === 'POST') {
    let body: { app?: string; slug?: string; blob?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ ok: false, error: 'bad json' }, 400);
    }
    const { app, slug, blob } = body;
    if (!app || !APP_PATTERN.test(app)) return json({ ok: false, error: 'bad app key' }, 400);
    if (!slug || !SLUG_PATTERN.test(slug)) return json({ ok: false, error: 'bad slug' }, 400);
    if (blob === undefined) return json({ ok: false, error: 'missing blob' }, 400);

    const payload = JSON.stringify(blob);
    const rows = await sql`
      INSERT INTO published (app, slug, blob, version, published_at)
      VALUES (${app}, ${slug}, ${payload}::jsonb, 1, now())
      ON CONFLICT (app, slug) DO UPDATE
        SET blob = ${payload}::jsonb, version = published.version + 1, published_at = now()
      RETURNING version, published_at`;
    return json({ ok: true, version: Number(rows[0].version), publishedAt: rows[0].published_at });
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const app = url.searchParams.get('app') ?? '';
    const slug = url.searchParams.get('slug') ?? '';
    if (!APP_PATTERN.test(app)) return json({ ok: false, error: 'bad app key' }, 400);
    if (!SLUG_PATTERN.test(slug)) return json({ ok: false, error: 'bad slug' }, 400);
    await sql`DELETE FROM published WHERE app = ${app} AND slug = ${slug}`;
    return json({ ok: true });
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
}
