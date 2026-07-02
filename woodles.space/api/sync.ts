// api/sync.ts — Woodles single-user sync endpoint (Vercel serverless function).
//
//   GET  /api/sync?app=marginalia   → { blob, version } | { blob: null, version: 0 }
//   POST /api/sync                   → body { app, blob, baseVersion }
//                                       → 200 { ok: true, version }   (write applied)
//                                       → 409 { ok: false, conflict, server } (someone moved first)
//
// Auth: a single passphrase. The client sends it as `Authorization: Bearer <pass>`.
// We never store the passphrase — only a SHA-256 hash, compared in constant time
// against SYNC_PASS_HASH (an env var). Set it once with:
//   node -e "console.log(require('crypto').createHash('sha256').update('your long passphrase').digest('hex'))"
//
// DATABASE_URL is injected automatically by the Neon Vercel integration.

import { authed, db, json, APP_PATTERN } from './_lib';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  try {
    return await route(req);
  } catch (err) {
    // Surface the actual error message back to the client so 500s are
    // diagnosable without round-tripping through Vercel's log viewer.
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('sync handler error:', err);
    return json({ ok: false, error: 'server', message }, 500);
  }
}

async function route(req: Request): Promise<Response> {
  if (!(await authed(req))) return json({ ok: false, error: 'unauthorized' }, 401);
  const sql = db();

  // ── pull ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const app = new URL(req.url).searchParams.get('app') ?? '';
    if (!APP_PATTERN.test(app)) return json({ ok: false, error: 'bad app key' }, 400);
    const rows = await sql`SELECT blob, version FROM sync WHERE app = ${app}`;
    if (rows.length === 0) return json({ blob: null, version: 0 });
    return json({ blob: rows[0].blob, version: Number(rows[0].version) });
  }

  // ── push (compare-and-swap) ─────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: { app?: string; blob?: unknown; baseVersion?: number };
    try {
      body = await req.json() as typeof body;
    } catch {
      return json({ ok: false, error: 'bad json' }, 400);
    }
    const { app, blob, baseVersion } = body;
    if (!app || !APP_PATTERN.test(app)) return json({ ok: false, error: 'bad app key' }, 400);
    if (blob === undefined) return json({ ok: false, error: 'missing blob' }, 400);
    if (typeof baseVersion !== 'number') return json({ ok: false, error: 'missing baseVersion' }, 400);

    const payload = JSON.stringify(blob);

    // First write for this app: insert only if the row doesn't exist yet.
    if (baseVersion === 0) {
      const inserted = await sql`
        INSERT INTO sync (app, blob, version, updated_at)
        VALUES (${app}, ${payload}::jsonb, 1, now())
        ON CONFLICT (app) DO NOTHING
        RETURNING version`;
      if (inserted.length > 0) return json({ ok: true, version: 1 });
      // Row already existed — fall through to report the conflict.
      const cur = await sql`SELECT blob, version FROM sync WHERE app = ${app}`;
      return json(
        { ok: false, conflict: true, server: { blob: cur[0].blob, version: Number(cur[0].version) } },
        409
      );
    }

    // Subsequent writes: bump version only if it still matches what we read.
    const updated = await sql`
      UPDATE sync
      SET blob = ${payload}::jsonb, version = version + 1, updated_at = now()
      WHERE app = ${app} AND version = ${baseVersion}
      RETURNING version`;
    if (updated.length > 0) return json({ ok: true, version: Number(updated[0].version) });

    // Mismatch — the server moved under us. Hand back the current state so the
    // client can decide (this is the "ask before clobber" hook).
    const cur = await sql`SELECT blob, version FROM sync WHERE app = ${app}`;
    if (cur.length === 0) return json({ ok: false, error: 'vanished' }, 409);
    return json(
      { ok: false, conflict: true, server: { blob: cur[0].blob, version: Number(cur[0].version) } },
      409
    );
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
}
