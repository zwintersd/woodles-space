// @woodles/sync — the client half of the sync layer.
//
// Apps already own their localStorage. This adds, on top of that:
//   • pull(app)  — fetch the server blob + version
//   • push(...)  — write back, guarded by the version we based the edit on
//   • syncedStore — a thin orchestration helper that wires those into the
//     load/save calls each app already makes, including the "ask before
//     clobber" conflict prompt.
//
// The passphrase is held in memory for the session. Storing it in
// localStorage is acceptable for a personal single-user tool, but it is a
// bearer credential: anyone with the device can read it. Don't keep anything
// in here you'd be harmed to leak.

const ENDPOINT = '/api/sync';

let passphrase: string | null = null;

export function setPassphrase(pass: string): void {
  passphrase = pass;
}

export function hasPassphrase(): boolean {
  return passphrase !== null && passphrase.length > 0;
}

function authHeader(): Record<string, string> {
  if (!passphrase) throw new SyncError('no-passphrase', 'set a passphrase before syncing');
  return { authorization: `Bearer ${passphrase}` };
}

export type SyncErrorKind =
  | 'no-passphrase'
  | 'unauthorized'
  | 'network'
  | 'server'
  | 'conflict';

export class SyncError extends Error {
  constructor(public kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface Snapshot<T = unknown> {
  blob: T | null;
  version: number;
}

export interface Conflict<T = unknown> {
  conflict: true;
  server: Snapshot<T>;
}

// ── pull ────────────────────────────────────────────────────────────────
export async function pull<T = unknown>(app: string): Promise<Snapshot<T>> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?app=${encodeURIComponent(app)}`, {
      headers: authHeader()
    });
  } catch {
    throw new SyncError('network', 'could not reach the sync server');
  }
  if (res.status === 401) throw new SyncError('unauthorized', 'wrong passphrase');
  if (!res.ok) throw new SyncError('server', `pull failed (${res.status})`);
  const data = (await res.json()) as Snapshot<T>;
  return { blob: data.blob, version: data.version };
}

// ── push ────────────────────────────────────────────────────────────────
// Resolves to the new version on success, or a Conflict if the server moved
// under us. Network/auth problems throw.
export async function push<T = unknown>(
  app: string,
  blob: T,
  baseVersion: number
): Promise<{ ok: true; version: number } | Conflict<T>> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader() },
      body: JSON.stringify({ app, blob, baseVersion })
    });
  } catch {
    throw new SyncError('network', 'could not reach the sync server');
  }
  if (res.status === 401) throw new SyncError('unauthorized', 'wrong passphrase');
  if (res.status === 409) {
    const data = (await res.json()) as { server: Snapshot<T> };
    return { conflict: true, server: data.server };
  }
  if (!res.ok) throw new SyncError('server', `push failed (${res.status})`);
  const data = (await res.json()) as { ok: true; version: number };
  return data;
}

// ── syncedStore: the per-app orchestration each app reuses ───────────────
//
// You give it adapters onto the storage the app already has. It owns the
// version bookkeeping and the conflict decision, so no app has to think about
// compare-and-swap. `onConflict` is where "ask before clobber" lives — return
// 'mine' to force-push local over the server, 'theirs' to adopt the server's
// copy, or 'cancel' to leave both untouched.

export interface StoreAdapter<T> {
  app: string;
  read(): T | null;             // current local state (your existing load())
  write(blob: T): void;         // apply a remote state locally (your existing save() + rehydrate)
  isNewer?(local: T, remote: T): boolean; // optional: domain-aware "local wins"
}

export type ConflictChoice = 'mine' | 'theirs' | 'cancel';

const VERSION_KEY = (app: string) => `woodles_sync_version_${app}`;

function readVersion(app: string): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY(app)) ?? '0') || 0;
  } catch {
    return 0;
  }
}
function writeVersion(app: string, v: number): void {
  try {
    localStorage.setItem(VERSION_KEY(app), String(v));
  } catch {
    /* ignore quota */
  }
}

export function createSyncedStore<T>(adapter: StoreAdapter<T>) {
  const { app } = adapter;

  // Pull on load. If the server has something and it differs from what we
  // hold, decide via isNewer (if given) or hand off to onConflict.
  async function hydrate(
    onConflict: (local: T | null, remote: T) => Promise<ConflictChoice> | ConflictChoice
  ): Promise<void> {
    const snap = await pull<T>(app);
    if (snap.blob === null) {
      // Nothing on the server yet. If we have local data, seed the server.
      const local = adapter.read();
      if (local !== null) await flush();
      return;
    }
    const local = adapter.read();
    writeVersion(app, snap.version);

    if (local === null) {
      adapter.write(snap.blob);
      return;
    }
    // Both sides have data. Cheap domain heuristic first, then ask.
    if (adapter.isNewer && adapter.isNewer(local, snap.blob)) {
      await flush(); // local is genuinely ahead — push it
      return;
    }
    const choice = await onConflict(local, snap.blob);
    if (choice === 'theirs') adapter.write(snap.blob);
    else if (choice === 'mine') await flush();
    // 'cancel' leaves local untouched and server unchanged
  }

  // Push current local state, guarded by the version we last saw.
  // Returns a Conflict object (not thrown) when the server moved first.
  async function flush(): Promise<{ ok: true; version: number } | Conflict<T>> {
    const local = adapter.read();
    if (local === null) return { ok: true, version: readVersion(app) };
    const base = readVersion(app);
    const result = await push<T>(app, local, base);
    if ('conflict' in result) return result;
    writeVersion(app, result.version);
    return result;
  }

  return { hydrate, flush, app };
}
