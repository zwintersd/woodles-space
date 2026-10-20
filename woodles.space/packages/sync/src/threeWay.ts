// The three-way, per-item merge that lets a delete on one device stay deleted
// on the others. HomeSuite built it first; Carillon is the second user.
//
// A device keeps a *base*: each item's fingerprint as of the last time it and
// the server agreed. With it, a thing missing on one side can be told apart —
// never seen here (keep it) or deleted here since (drop it). Without one (a
// first sync, or after disconnecting) every missing thing reads as never seen,
// so the merge is a union.
//
// Fingerprints are of canonical JSON, because the server stores blobs as
// JSONB and hands them back with their keys reordered.

/** Each item's fingerprint, by key, as of the last agreement. */
export type Fingerprints = Record<string, string>;

/** JSON with object keys sorted and `undefined` members left out, as JSONB would. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** FNV-1a over canonical JSON, with the length to make collisions duller still. */
export function fingerprint(value: unknown): string {
  const text = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`;
}

/**
 * Merge one keyed collection three ways. Both sides hold an item: whichever
 * side moved since the base wins, and when both did, `resolve` decides. One
 * side lacks it: deleted over there, unless it is new here or changed here
 * since — an edit beats a delete. Order is the local one, then what only the
 * remote holds, in its order.
 */
export function mergeKeyed<T>(
  local: ReadonlyMap<string, T>,
  remote: ReadonlyMap<string, T>,
  base: Fingerprints | undefined,
  resolve: (mine: T, theirs: T) => T
): Map<string, T> {
  const was = base ?? {};
  const merged = new Map<string, T>();
  for (const key of new Set([...local.keys(), ...remote.keys()])) {
    const mine = local.get(key);
    const theirs = remote.get(key);
    const agreed = Object.hasOwn(was, key) ? was[key] : undefined;
    if (mine !== undefined && theirs !== undefined) {
      const mineFp = fingerprint(mine);
      const theirsFp = fingerprint(theirs);
      if (mineFp === theirsFp || agreed === theirsFp) merged.set(key, mine);
      else if (agreed === mineFp) merged.set(key, theirs);
      else merged.set(key, resolve(mine, theirs));
    } else if (mine !== undefined) {
      if (agreed === undefined || agreed !== fingerprint(mine)) merged.set(key, mine);
    } else if (theirs !== undefined) {
      if (agreed === undefined || agreed !== fingerprint(theirs)) merged.set(key, theirs);
    }
  }
  return merged;
}

/** `mergeKeyed` over plain records, the shape most blobs keep their sections in. */
export function mergeRecords<T>(
  local: Record<string, T>,
  remote: Record<string, T>,
  base: Fingerprints | undefined,
  resolve: (mine: T, theirs: T) => T
): Record<string, T> {
  return Object.fromEntries(mergeKeyed(new Map(Object.entries(local)), new Map(Object.entries(remote)), base, resolve));
}

/** Fingerprint every member of a record. */
export function fingerprintRecord(record: Record<string, unknown>): Fingerprints {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fingerprint(value)]));
}
