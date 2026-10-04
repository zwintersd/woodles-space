import { db } from './_lib';

export const PUBLICATION_ID = /^[a-f0-9]{32}$/;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
const bytes = (value: string) => Uint8Array.from(value.match(/../g) || [], pair => parseInt(pair, 16));
export const publisherHash = () => process.env.SCHEDULE_PUBLISHER_PASS_HASH || process.env.SYNC_PASS_HASH || '';
export const configured = () => Boolean(process.env.DATABASE_URL && /^[a-f0-9]{64}$/i.test(publisherHash()));
export const randomToken = (size = 32) => hex(crypto.getRandomValues(new Uint8Array(size)));
export const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export function equal(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}
export async function hashPassword(password: string, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: 600_000 }, key, 256);
  return `pbkdf2-sha256:600000:${salt}:${hex(hash)}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts[0] !== 'pbkdf2-sha256' || parts[1] !== '600000' || !/^[a-f0-9]{32}$/.test(parts[2] || '') || !/^[a-f0-9]{64}$/.test(parts[3] || '')) return false;
  return equal(await hashPassword(password, parts[2]), stored);
}
export function cookieName(scope: string) { return scope === 'publisher' ? 'woodles_schedule_publisher' : 'woodles_schedule_' + scope; }
export function cookie(req: Request, scope: string, value: string, age: number) {
  return `${cookieName(scope)}=${value}; Path=/api/schedules; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function session(req: Request, scope: string, accessVersion = 0) {
  const name = cookieName(scope);
  const token = (req.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1) || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const rows = await db()`SELECT token_hash FROM schedule_sessions
    WHERE token_hash = ${await digest(token)} AND scope = ${scope} AND access_version = ${accessVersion}
      AND publisher_hash = ${publisherHash()} AND expires_at > now()`;
  return rows.length > 0;
}
export async function createSession(req: Request, scope: string, accessVersion = 0) {
  const token = randomToken();
  const age = scope === 'publisher' ? 8 * 3600 : 12 * 3600;
  await db()`INSERT INTO schedule_sessions (token_hash, scope, access_version, publisher_hash, expires_at)
    VALUES (${await digest(token)}, ${scope}, ${accessVersion}, ${publisherHash()}, now() + ${age} * interval '1 second')`;
  return cookie(req, scope, token, age);
}
export async function logout(req: Request, scope: string) {
  const name = cookieName(scope);
  const token = (req.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
  if (token) await db()`DELETE FROM schedule_sessions WHERE token_hash = ${await digest(token)} AND scope = ${scope}`;
  return cookie(req, scope, '', 0);
}
export async function allowAttempt(req: Request, scope: string) {
  // A durable database counter works across serverless instances. The broad
  // scope cap also bounds expensive password work even if clients rotate IPs.
  const ip = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown';
  const key = await digest(scope + ':' + ip.split(',')[0].trim());
  const window = Math.floor(Date.now() / 900_000);
  const sql = db();
  await sql`DELETE FROM schedule_attempts WHERE "window" < ${window - 2}`;
  await sql`DELETE FROM schedule_sessions WHERE expires_at <= now()`;
  const rows = await sql`INSERT INTO schedule_attempts (key, "window", attempts) VALUES (${key}, ${window}, 1)
    ON CONFLICT (key, "window") DO UPDATE SET attempts = schedule_attempts.attempts + 1 RETURNING attempts`;
  if (Number(rows[0]?.attempts) > 10) return false;
  const total = await sql`INSERT INTO schedule_attempts (key, "window", attempts) VALUES (${scope}, ${window}, 1)
    ON CONFLICT (key, "window") DO UPDATE SET attempts = schedule_attempts.attempts + 1 RETURNING attempts`;
  return Number(total[0]?.attempts) <= 300;
}
