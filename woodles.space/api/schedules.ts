/// <reference types="node" />
import { db, json } from './_lib';
import { schedulePayload } from './_schedule-payload';
import { PUBLICATION_ID, configured, publisherHash, digest, equal, randomToken, hashPassword, verifyPassword, session, createSession, logout, allowAttempt } from './_schedule-security';

export const config = { runtime: 'edge' };
type Row = Record<string, any>;
const unavailable = () => json({ error: 'This schedule is unavailable.' }, 404);
const locked = () => json({ error: 'Enter the learner password.', locked: true }, 401);
const conflict = () => json({ error: 'The published plan changed on another device. Refresh before trying again.' }, 409);
function metadata(row: Row) {
  const plan = row.payload?.plan || {};
  return { id: row.id, sourceId: row.source_id, version: Number(row.version), active: row.active,
    expiresAt: row.expires_at, updatedAt: row.updated_at, learner: row.learner ?? plan.learner, name: row.name ?? plan.name,
    days: Number(row.days ?? plan.days?.length ?? 0), items: Number(row.items ?? plan.days?.reduce((sum: number, day: Row) => sum + day.activities.length, 0) ?? 0),
    passwordSet: true };
}
function validPassword(value: unknown) { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }
function expiry(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) throw new Error('Choose an expiry in the future, or leave it blank.');
  return new Date(value).toISOString();
}
function isLive(row: Row) { return row.active && (!row.expires_at || Date.parse(row.expires_at) > Date.now()); }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const id = url.searchParams.get('id') || '';
  let operation = req.method === 'GET' ? (action || 'view') : 'request';
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
  if (req.method === 'GET' && action === 'status' && !configured()) return json({ configured: false, authenticated: false });
  if (!configured()) return json({ error: 'Publishing is not configured yet. Ask the site owner to finish database setup.' }, 503);
  try {
    const sql = db();
    if (req.method === 'GET') {
      if (action === 'status') {
        // Environment variables alone do not establish that the publishing
        // migration has been applied. Resolve every required table without
        // reading learner data or changing the database.
        await sql`SELECT 1 FROM schedule_publications, schedule_revisions, schedule_sessions, schedule_attempts LIMIT 0`;
        return json({ configured: true, authenticated: await session(req, 'publisher') });
      }
      if (action) {
        if (!['list', 'detail', 'history'].includes(action)) return json({ error: 'Unknown action.' }, 400);
        if (!await session(req, 'publisher')) return json({ error: 'Unlock publishing first.' }, 401);
        if (action === 'list') return json({ publications: (await sql`SELECT id, source_id, version, active, expires_at, updated_at,
          payload->'plan'->>'learner' AS learner, payload->'plan'->>'name' AS name,
          jsonb_array_length(payload->'plan'->'days') AS days,
          (SELECT coalesce(sum(jsonb_array_length(entry.value->'activities')), 0) FROM jsonb_array_elements(payload->'plan'->'days') AS entry(value)) AS items
          FROM schedule_publications ORDER BY updated_at DESC LIMIT 200`).map(metadata) });
        if (!PUBLICATION_ID.test(id)) return unavailable();
        const rows = await sql`SELECT * FROM schedule_publications WHERE id = ${id}`;
        if (!rows.length) return unavailable();
        if (action === 'detail') {
          const revision = url.searchParams.get('revision');
          if (!revision) return json({ publication: metadata(rows[0]), payload: rows[0].payload });
          if (!/^\d{1,10}$/.test(revision)) return json({ error: 'Invalid saved version.' }, 400);
          const saved = await sql`SELECT payload FROM schedule_revisions WHERE publication_id = ${id} AND version = ${Number(revision)}`;
          return saved.length ? json({ payload: saved[0].payload }) : unavailable();
        }
        const revisions = await sql`SELECT version, published_at, payload->'plan'->>'name' AS name, payload->'plan'->>'learner' AS learner
          FROM schedule_revisions WHERE publication_id = ${id} ORDER BY version DESC LIMIT 10`;
        return json({ revisions: revisions.map(row => ({ version: Number(row.version), publishedAt: row.published_at, name: row.name, learner: row.learner })) });
      }
      if (!PUBLICATION_ID.test(id)) return unavailable();
      // Fetch access metadata first. The payload is never fetched or returned
      // until the learner's server-side session has been checked.
      const rows = await sql`SELECT id, active, expires_at, access_version, version FROM schedule_publications WHERE id = ${id}`;
      if (!rows.length || !isLive(rows[0])) return unavailable();
      if (!await session(req, id, Number(rows[0].access_version))) return locked();
      // Recheck the access epoch in the same query as the payload. A password
      // rotation or withdrawal racing with the first query must fail closed.
      const payloads = await sql`SELECT payload, version, updated_at FROM schedule_publications WHERE id = ${id}
        AND active = true AND access_version = ${Number(rows[0].access_version)} AND (expires_at IS NULL OR expires_at > now())`;
      if (!payloads.length) return locked();
      const etag = '"schedule-' + id + '-' + payloads[0].version + '"';
      if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { 'cache-control': 'no-store', etag } });
      return json({ payload: payloads[0].payload, version: Number(payloads[0].version), updatedAt: payloads[0].updated_at }, 200, { etag });
    }
    // JSON and an exact origin check prevent cross-site form/CSRF writes,
    // including login and learner unlock. No cross-origin access is offered.
    if (req.headers.get('origin') !== url.origin || !req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Use this site to manage schedules.' }, 403);
    const bodyText = await req.text();
    if (new TextEncoder().encode(bodyText).length > 3_750_000) return json({ error: 'This plan is too large to publish. Use smaller uploaded pictures.' }, 413);
    let body: Row;
    try { body = JSON.parse(bodyText); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); }
    catch { return json({ error: 'Invalid request.' }, 400); }
    operation = body.action;
    if (operation === 'login') {
      if (!await allowAttempt(req, 'publisher')) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, { 'retry-after': '900' });
      if (typeof body.password !== 'string' || body.password.length > 256 || !equal(await digest(body.password), publisherHash().toLowerCase())) return json({ error: 'The publisher passphrase did not match.' }, 401);
      return json({ authenticated: true }, 200, { 'set-cookie': await createSession(req, 'publisher') });
    }
    if (operation === 'logout') return json({ authenticated: false }, 200, { 'set-cookie': await logout(req, 'publisher') });
    if (operation === 'viewer-logout') {
      if (!PUBLICATION_ID.test(body.id || '')) return unavailable();
      return json({ locked: true }, 200, { 'set-cookie': await logout(req, body.id) });
    }
    if (operation === 'unlock') {
      if (!PUBLICATION_ID.test(body.id || '')) return unavailable();
      if (!await allowAttempt(req, body.id)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, { 'retry-after': '900' });
      const rows = await sql`SELECT id, active, expires_at, password_hash, access_version FROM schedule_publications WHERE id = ${body.id}`;
      if (!rows.length || !isLive(rows[0])) return unavailable();
      if (!validPassword(body.password) || !await verifyPassword(body.password, rows[0].password_hash)) return json({ error: 'That learner password did not match.', locked: true }, 401);
      return json({ unlocked: true }, 200, { 'set-cookie': await createSession(req, body.id, Number(rows[0].access_version)) });
    }
    if (!await session(req, 'publisher')) return json({ error: 'Unlock publishing first.' }, 401);
    if (!['publish', 'access', 'unpublish', 'restore'].includes(operation)) return json({ error: 'Unknown action.' }, 400);
    const publicationId = body.id || (operation === 'publish' ? randomToken(16) : '');
    if (!PUBLICATION_ID.test(publicationId) || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) return json({ error: 'Invalid publication or version.' }, 400);
    const rows = await sql`SELECT * FROM schedule_publications WHERE id = ${publicationId}`;
    const current = rows[0];
    if ((current ? Number(current.version) : 0) !== body.baseVersion || !current && operation !== 'publish') return conflict();
    if (body.password && !validPassword(body.password) || !current && !validPassword(body.password)) return json({ error: 'Use a learner password with 8 to 128 characters.' }, 400);
    let expiresAt: string | null;
    try { expiresAt = operation === 'unpublish' ? current.expires_at : expiry(body.expiresAt === undefined ? current?.expires_at || null : body.expiresAt); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    const passwordHash = body.password ? await hashPassword(body.password) : current?.password_hash;
    const accessVersion = current ? Number(current.access_version) + (body.password || operation === 'unpublish' ? 1 : 0) : 1;
    if (operation === 'access' || operation === 'unpublish') {
      const changed = await sql`UPDATE schedule_publications SET password_hash = ${passwordHash}, expires_at = ${expiresAt},
        active = ${operation === 'unpublish' ? false : current.active}, access_version = ${accessVersion}, version = version + 1, updated_at = now()
        WHERE id = ${publicationId} AND version = ${body.baseVersion} RETURNING *`;
      return changed.length ? json({ publication: metadata(changed[0]) }) : conflict();
    }
    let input = body.payload;
    if (operation === 'restore') {
      if (!Number.isInteger(body.revision)) return json({ error: 'Choose a saved version.' }, 400);
      const revisions = await sql`SELECT payload FROM schedule_revisions WHERE publication_id = ${publicationId} AND version = ${body.revision}`;
      if (!revisions.length) return json({ error: 'That saved version is unavailable.' }, 404);
      input = revisions[0].payload;
    }
    let payload;
    try { payload = schedulePayload(input, publicationId); }
    catch (error) { return json({ error: (error as Error).message }, 400); }
    const sourceId = current?.source_id || (typeof body.sourceId === 'string' ? body.sourceId.trim().slice(0, 100) : '');
    if (!sourceId) return json({ error: 'Choose a local plan to publish.' }, 400);
    // The version guard and revision insert share one SQL statement: neither
    // a stale editor nor a partially completed request can overwrite history.
    const changed = current
      ? await sql`WITH changed AS (UPDATE schedule_publications SET payload = ${JSON.stringify(payload)}::jsonb, password_hash = ${passwordHash},
          expires_at = ${expiresAt}, active = true, access_version = ${accessVersion}, version = version + 1, updated_at = now()
          WHERE id = ${publicationId} AND version = ${body.baseVersion} RETURNING *)
        , saved AS (INSERT INTO schedule_revisions (publication_id, version, payload) SELECT id, version, payload FROM changed)
        SELECT * FROM changed`
      : await sql`WITH changed AS (INSERT INTO schedule_publications (id, source_id, payload, password_hash, expires_at)
          VALUES (${publicationId}, ${sourceId}, ${JSON.stringify(payload)}::jsonb, ${passwordHash}, ${expiresAt}) ON CONFLICT DO NOTHING RETURNING *)
        , saved AS (INSERT INTO schedule_revisions (publication_id, version, payload) SELECT id, version, payload FROM changed)
        SELECT * FROM changed`;
    if (!changed.length) return conflict();
    try {
      await sql`DELETE FROM schedule_revisions WHERE publication_id = ${publicationId} AND version NOT IN
        (SELECT version FROM schedule_revisions WHERE publication_id = ${publicationId} ORDER BY version DESC LIMIT 10)`;
    } catch { /* Publication and history are already committed. Retry pruning on the next publish. */ }
    return json({ publication: metadata(changed[0]) }, current ? 200 : 201);
  } catch (error) {
    // Log only a validated SQLSTATE and a known operation. Error messages,
    // stacks and query parameters can contain credentials or learner data.
    const rawCode = (error as { code?: unknown } | null)?.code;
    const code = typeof rawCode === 'string' && /^[A-Z0-9]{5}$/.test(rawCode) ? rawCode : 'unknown';
    const knownOperations = ['status', 'view', 'list', 'detail', 'history', 'login', 'logout', 'viewer-logout', 'unlock', 'publish', 'access', 'unpublish', 'restore'];
    console.error('[schedules] request failed', { operation: knownOperations.includes(operation) ? operation : 'request', code });
    if (code === '42P01') return json({
      error: 'Schedule publishing database setup is incomplete. Ask the site owner to apply api/schema.sql to the production Neon database, then try again.'
    }, 503);
    if (code === '42703') return json({
      error: 'Schedule publishing database setup is incomplete. Ask the site owner to check the production Neon table columns against api/schema.sql.'
    }, 503);
    // Never expose database URLs, SQL, password hashes or schedule data in an error.
    return json({ error: 'Publishing is temporarily unavailable. Check site setup or try again shortly.' }, 503);
  }
}
