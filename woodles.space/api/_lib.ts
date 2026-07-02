// api/_lib.ts — shared helpers for the sync and public edge functions.
// Underscore prefix keeps Vercel from treating this as a route.

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Lazy: defer the DATABASE_URL check + neon() call until the first request, so
// a missing env var surfaces as a useful 500 body rather than a module-load
// crash that produces an opaque 500.
let _sql: NeonQueryFunction<false, false> | null = null;
export function db(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = neon(url);
  return _sql;
}

export const APP_PATTERN = /^[a-z0-9-]{1,40}$/;

// Web Crypto API — works in both Edge and Node runtimes, so we don't have to
// fight Vercel's autodetection. Plain JS replacements for node:crypto helpers.
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// The single passphrase check shared by every write path (sync's reads and
// writes, public's writes only). We never store the passphrase — only its
// SHA-256, compared in constant time against SYNC_PASS_HASH.
export async function authed(req: Request): Promise<boolean> {
  const expected = process.env.SYNC_PASS_HASH;
  if (!expected) return false; // fail closed if misconfigured
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const gotBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const got = new Uint8Array(gotBuf);
  const want = hexToBytes(expected);
  return constantTimeEqual(got, want);
}

export function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
  });
}
