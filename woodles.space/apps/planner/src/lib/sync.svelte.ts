import {
	canonical,
	createAppSync,
	createLedgerPublisher,
	fingerprint,
	fingerprintRecord,
	mergeKeyed,
	mergeRecords,
	type Fingerprints,
	CARILLON_COMMITMENTS_APP,
	CARILLON_SESSIONS_APP,
	type CarillonCommitmentsBlob,
	type CarillonSessionsBlob
} from '@woodles/sync';
import { store } from './store.svelte';
import { buildCommitments, commitmentsMatch } from './commitments';
import { buildSessions, sessionsMatch } from './sessions';
import { mergeFiveContactsRound, mergeLoopEvent, mergeOpenLoop, projectLoopLifecycle } from './openLoops';
import { mergeLoopReminder } from './reminders';
import type {
	IntervalObservation,
	PlannerBlob,
	PlannerSettings,
	RoutinePractice,
	SporeEvent,
	SurgeDraft
} from './types';

class SyncState {
	connected = $state(false);
	syncing = $state(false);
	status = $state<'idle' | 'ok' | 'error'>('idle');
	lastSyncedAt = $state<Date | null>(null);
	errorMessage = $state<string | null>(null);
}

export const syncState = new SyncState();

/**
 * The id-keyed lists in a planner blob. Each merges per item against the base:
 * what this device and the server last agreed on, so a record missing on one
 * side reads as never seen (kept) or deleted since (dropped).
 */
const LISTS = [
	'shapes', 'obligations', 'rituals', 'tasks', 'domains', 'observations', 'routines',
	'routinePractices', 'surgeDrafts', 'spores', 'sleepLogs', 'signals', 'loggedSessions',
	'openLoops', 'loopEvents', 'closureReflections', 'fiveContactsRounds', 'loopReminders'
] as const satisfies readonly (keyof PlannerBlob)[];

/**
 * Each record's fingerprint as of the last agreement, by section. Days merge
 * per date; the week pattern as one value. Settings are here only to notice a
 * change worth pushing — they merge per key by their own edit stamps.
 */
export type PlannerSyncBase = Partial<Record<(typeof LISTS)[number] | 'days' | 'weekPattern' | 'settings', Fingerprints>>;

function mergeById<T extends { id: string }>(
	local: T[] | undefined,
	remote: T[] | undefined,
	base: Fingerprints | undefined,
	resolve: (localItem: T, remoteItem: T) => T = (_local, remoteItem) => remoteItem
): T[] {
	const byId = (items: T[] = []) => new Map(items.map((item) => [item.id, item]));
	return [...mergeKeyed(byId(local), byId(remote), base, resolve).values()];
}

function latestObservation(
	local: IntervalObservation,
	remote: IntervalObservation
): IntervalObservation {
	return local.updatedAt > remote.updatedAt ? local : remote;
}

function latestPractice(local: RoutinePractice, remote: RoutinePractice): RoutinePractice {
	const winner = local.recordedAt > remote.recordedAt ? local : remote;
	return { ...winner, steps: winner.steps ?? local.steps ?? remote.steps, routineName: winner.routineName ?? local.routineName ?? remote.routineName };
}

// Deletion is final even if a device edits an older copy while offline.
function latestLifecycle<T extends { updatedAt?: string; deletedAt?: string }>(local: T, remote: T): T {
	if (local.deletedAt && !remote.deletedAt) return local;
	if (remote.deletedAt && !local.deletedAt) return remote;
	return latestMutable(local, remote);
}

function latestMutable<T extends { updatedAt?: string; createdAt?: string }>(
	local: T,
	remote: T
): T {
	const localTime = local.updatedAt ?? local.createdAt ?? '';
	const remoteTime = remote.updatedAt ?? remote.createdAt ?? '';
	return localTime > remoteTime ? local : remote;
}

function latestSurge(local: SurgeDraft, remote: SurgeDraft): SurgeDraft {
	const localTime = local.updatedAt ?? local.discardedAt ?? local.promotedAt ?? local.createdAt;
	const remoteTime = remote.updatedAt ?? remote.discardedAt ?? remote.promotedAt ?? remote.createdAt;
	const statusRank = { captured: 0, promoted: 1, discarded: 2 } as const;
	const winner =
		localTime === remoteTime
			? statusRank[local.status] > statusRank[remote.status]
				? local
				: remote
			: localTime > remoteTime
				? local
				: remote;
	const promotedTaskIds = [
		...new Set([...(local.promotedTaskIds ?? []), ...(remote.promotedTaskIds ?? [])])
	];
	return promotedTaskIds.length > 0 ? { ...winner, promotedTaskIds } : winner;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A stamp's time. Unreadable stamps lose, and so does one more than a day
 * ahead of this clock — a skewed device must not win every merge from now on.
 */
function stampTime(stamp: string | undefined, now: number): number {
	const time = stamp ? Date.parse(stamp) : NaN;
	return Number.isFinite(time) && time <= now + DAY_MS ? time : -Infinity;
}

/**
 * Settings merge per key: the newer deliberate edit wins, so turning bells
 * off on a phone isn't undone by a laptop that synced later. A tie, or a key
 * nobody stamped (older clients), keeps the old rule: remote wins.
 * Dismissed offers only accumulate.
 */
export function mergeSettings(local: PlannerSettings, remote: PlannerSettings, now = Date.now()): PlannerSettings {
	const localStamps = local.settingsStamps ?? {};
	const remoteStamps = remote.settingsStamps ?? {};
	const merged: Record<string, unknown> = { ...local, ...remote };
	const stamps: Record<string, string> = {};
	const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(localStamps), ...Object.keys(remoteStamps)]);
	keys.delete('settingsStamps');
	for (const key of keys) {
		const localTime = stampTime(localStamps[key], now);
		const remoteTime = stampTime(remoteStamps[key], now);
		const localWins = localTime > remoteTime;
		if (localWins) merged[key] = (local as Record<string, unknown>)[key];
		// A newer deliberate clear on the other device sticks too: JSON drops undefined keys.
		else if (remoteTime > localTime && !(key in remote)) delete merged[key];
		const stamp = localWins ? localStamps[key] : remoteStamps[key] ?? localStamps[key];
		if (stamp) stamps[key] = stamp;
	}
	const dismissedOffers = [...new Set([...(local.dismissedOffers ?? []), ...(remote.dismissedOffers ?? [])])];
	if (dismissedOffers.length) merged.dismissedOffers = dismissedOffers;
	if (Object.keys(stamps).length) merged.settingsStamps = stamps;
	return merged as PlannerSettings;
}

/**
 * Planner sync is a whole JSONB snapshot in Neon, merged per record. With a
 * base, a record only one side changed takes that side and a delete sticks;
 * deterministic IDs and last-write timestamps settle a record both devices
 * changed, so a phone tap and a desktop tap survive the same CAS conflict
 * instead of choosing one device. Without a base — a first sync — it is a
 * union. Returns `remote` itself when the merge adds nothing to it, so the
 * sync client sees there is nothing to push.
 */
export function mergePlannerBlobs(local: PlannerBlob, remote: PlannerBlob, base: PlannerSyncBase = {}): PlannerBlob {
	const loopEvents = mergeById(local.loopEvents, remote.loopEvents, base.loopEvents, mergeLoopEvent);
	const openLoops = projectLoopLifecycle(
		mergeById(local.openLoops, remote.openLoops, base.openLoops, mergeOpenLoop), loopEvents
	);
	const observations = mergeById(local.observations, remote.observations, base.observations, latestObservation);
	const observationById = new Map(observations.map((observation) => [observation.id, observation]));
	const spores = mergeById<SporeEvent>(local.spores, remote.spores, base.spores).map(
		(event) => {
			const observation = observationById.get(event.observationId);
			return observation
				? { ...event, date: observation.date, kind: observation.kind, amount: 1 }
				: event;
		}
	);

	const merged: PlannerBlob = {
		shapes: mergeById(local.shapes, remote.shapes, base.shapes, latestLifecycle),
		weekPattern: mergeKeyed(new Map([['pattern', local.weekPattern]]), new Map([['pattern', remote.weekPattern]]), base.weekPattern, latestMutable).get('pattern') ?? remote.weekPattern,
		days: mergeRecords(local.days ?? {}, remote.days ?? {}, base.days, latestMutable),
		obligations: mergeById(local.obligations, remote.obligations, base.obligations),
		rituals: mergeById(local.rituals, remote.rituals, base.rituals),
		tasks: mergeById(local.tasks, remote.tasks, base.tasks, latestMutable),
		settings: mergeSettings(local.settings, remote.settings),
		domains: mergeById(local.domains, remote.domains, base.domains),
		observations,
		routines: mergeById(local.routines, remote.routines, base.routines, latestLifecycle),
		routinePractices: mergeById(local.routinePractices, remote.routinePractices, base.routinePractices, latestPractice),
		surgeDrafts: mergeById(local.surgeDrafts, remote.surgeDrafts, base.surgeDrafts, latestSurge),
		spores,
		sleepLogs: mergeById(local.sleepLogs, remote.sleepLogs, base.sleepLogs, latestMutable),
		signals: mergeById(local.signals, remote.signals, base.signals, latestMutable),
		// No resolver: a sitting is identified by entry-and-date, so two devices
		// logging the same one produce the same record, and there is nothing to
		// pick between.
		loggedSessions: mergeById(local.loggedSessions, remote.loggedSessions, base.loggedSessions),
		openLoops,
		loopEvents,
		closureReflections: mergeById(local.closureReflections, remote.closureReflections, base.closureReflections, (a, b) => (a.updatedAt ?? a.recordedAt) > (b.updatedAt ?? b.recordedAt) ? a : b),
		fiveContactsRounds: mergeById(local.fiveContactsRounds, remote.fiveContactsRounds, base.fiveContactsRounds, mergeFiveContactsRound),
		loopReminders: mergeById(local.loopReminders, remote.loopReminders, base.loopReminders, mergeLoopReminder)
	};
	return canonical(merged) === canonical(remote) ? remote : merged;
}

/** What a blob holds, record by record — the base, once the server has it too. */
export function plannerFingerprints(blob: PlannerBlob): PlannerSyncBase {
	const base: PlannerSyncBase = {};
	for (const list of LISTS) {
		const items = (blob[list] ?? []) as { id: string }[];
		base[list] = Object.fromEntries(items.map((item) => [item.id, fingerprint(item)]));
	}
	base.days = fingerprintRecord(blob.days ?? {});
	base.weekPattern = { pattern: fingerprint(blob.weekPattern) };
	base.settings = { settings: fingerprint(blob.settings) };
	return base;
}

/** Local changes since the last agreement — the cue to push. */
export function differsFromBase(blob: PlannerBlob, base: PlannerSyncBase): boolean {
	const now = plannerFingerprints(blob);
	return (Object.keys(now) as (keyof PlannerSyncBase)[]).some((section) => canonical(now[section]) !== canonical(base[section] ?? {}));
}

const commitmentsPublisher = createLedgerPublisher<CarillonCommitmentsBlob>({
	app: CARILLON_COMMITMENTS_APP,
	matches: commitmentsMatch
});

/**
 * Push the commitments ledger so Thinking About sees it on a device where
 * Carillon has never been opened. Never throws — a stale ledger elsewhere must
 * not surface as a sync error here. The local mirror happens on every task
 * write regardless (`publishCommitmentsLocally`), so same-origin readers don't
 * depend on this succeeding.
 */
export async function publishCommitments(): Promise<void> {
	await commitmentsPublisher.publish(buildCommitments(store.tasks, store.getAllBlocks(), undefined, (date) => store.getBlocksForDateKey(date)));
}

const sessionsPublisher = createLedgerPublisher<CarillonSessionsBlob>({
	app: CARILLON_SESSIONS_APP,
	matches: sessionsMatch
});

/** Push the sittings ledger. Never throws, same reasoning as commitments. */
export async function publishSessions(): Promise<void> {
	await sessionsPublisher.publish(buildSessions(store.loggedSessions));
}

/** Test seam — the publishers' session caches would otherwise leak between cases. */
export function resetCommitmentsCache(): void {
	commitmentsPublisher.reset();
	sessionsPublisher.reset();
}

// ── the base: what this device and the server last agreed on ──────────────

export const PLANNER_SYNC_BASE_KEY = 'planner.sync.base.v1';

function loadBase(): PlannerSyncBase {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(PLANNER_SYNC_BASE_KEY) ?? '{}');
		return value && typeof value === 'object' && !Array.isArray(value) ? (value as PlannerSyncBase) : {};
	} catch {
		return {};
	}
}

function saveBase(base: PlannerSyncBase): void {
	try {
		localStorage.setItem(PLANNER_SYNC_BASE_KEY, JSON.stringify(base));
	} catch {
		/* an older base only makes the next merge keep more */
	}
}

function clearBase(): void {
	try {
		localStorage.removeItem(PLANNER_SYNC_BASE_KEY);
	} catch {
		/* as above */
	}
}

/**
 * A section this device could not read on load fell back to empty. It starts
 * over from a union, so that emptiness is never taken for deletions — and
 * at once, before anything is saved over the unreadable copy.
 */
function forgetUnreadable(): void {
	const sections = store.unreadableSections();
	if (sections.length === 0 || typeof localStorage === 'undefined') return;
	const base = loadBase();
	for (const section of sections) delete base[section as keyof PlannerSyncBase];
	saveBase(base);
}

forgetUnreadable();

// ── the adapter ────────────────────────────────────────────────────────────

/** The store as one blob, after taking anything another tab here saved. */
function readPlanner(): PlannerBlob {
	store.catchUp();
	return {
		shapes: store.dayShapes,
		weekPattern: store.weekPattern,
		days: store.dayOverrides,
		obligations: store.obligations,
		rituals: store.rituals,
		tasks: store.tasks,
		settings: store.settings,
		domains: store.domains,
		observations: store.intervalObservations,
		routines: store.routines,
		routinePractices: store.routinePractices,
		surgeDrafts: store.surgeDrafts,
		spores: store.sporeEvents,
		sleepLogs: store.sleepLogs,
		signals: store.signalEntries,
		loggedSessions: store.loggedSessions,
		openLoops: store.openLoops,
		loopEvents: store.loopEvents,
		closureReflections: store.closureReflections,
		fiveContactsRounds: store.fiveContactsRounds,
		loopReminders: store.loopReminders
	};
}

// The last blob read or written in an operation: what the server holds once it succeeds.
let settled: PlannerBlob | null = null;

const appSync = createAppSync<PlannerBlob>({
	adapter: {
		app: 'planner',
		read: () => (settled = readPlanner()),
		write(blob: PlannerBlob): void {
			// A sync that brings nothing new leaves the page alone.
			if (canonical(blob) !== canonical(readPlanner())) store.rehydrate(blob);
			settled = blob;
		},
		merge: (local, remote) => mergePlannerBlobs(local, remote, loadBase())
	},
	state: syncState
});

// ── one operation at a time ──────────────────────────────────────────────────

type Kind = 'connect' | 'sync' | 'push';
type Operation = { kind: Kind; done: Promise<void> };

let current: Operation | null = null;
let next: (Operation & { kind: 'sync' | 'push' }) | null = null;
let lastPull = 0;

/** Every tab on this device takes its turn, so two never merge against one base at once. */
function withSyncLock(run: () => Promise<void>): Promise<void> {
	const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
	return locks?.request ? locks.request('carillon-sync', run).then(() => undefined) : run();
}

/** Push only when something changed since the last agreement. */
async function pushChanges(): Promise<void> {
	if (!differsFromBase(readPlanner(), loadBase())) return;
	await appSync.flushSync();
}

/**
 * Both ledgers ride every sync operation, a pull included — it can bring in
 * tasks scheduled, or sittings accepted, on another device, and Thinking About
 * should learn about those too. Never able to fail the caller.
 */
async function publishLedgers(): Promise<void> {
	store.publishCommitmentsLocally();
	store.publishSessionsLocally();
	await publishCommitments();
	await publishSessions();
}

function start(kind: Kind, operation: () => Promise<void>): Promise<void> {
	if (kind !== 'push') lastPull = Date.now();
	const done = withSyncLock(async () => {
		const before = syncState.lastSyncedAt;
		settled = null;
		await operation();
		// The base moves only when the server took the blob and this device kept all of it.
		if (syncState.connected && syncState.status === 'ok' && syncState.lastSyncedAt !== before && settled && store.allSaved()) {
			saveBase(plannerFingerprints(settled));
		}
		await publishLedgers();
	}).finally(() => {
		if (current?.done === done) current = null;
	});
	current = { kind, done };
	return done;
}

const OPERATIONS = { sync: () => appSync.initSync(), push: pushChanges };

/**
 * Ask for a sync or a push. One already under way covers a sync asked for
 * meanwhile; anything else waits its turn, and later asks share that turn.
 */
function run(kind: 'sync' | 'push'): Promise<void> {
	if (!current) return start(kind, OPERATIONS[kind]);
	if (next) {
		if (kind === 'sync') next.kind = 'sync';
		return next.done;
	}
	if (kind === 'sync' && current.kind !== 'push') return current.done;
	const queued = { kind } as Operation & { kind: 'sync' | 'push' };
	const go = () => {
		next = null;
		return start(queued.kind, OPERATIONS[queued.kind]);
	};
	queued.done = current.done.then(go, go);
	next = queued;
	return queued.done;
}

// ── what the app calls ─────────────────────────────────────────────────────

let queuedFlush: ReturnType<typeof setTimeout> | null = null;

function cancelQueuedFlush(): void {
	if (queuedFlush) clearTimeout(queuedFlush);
	queuedFlush = null;
}

export async function connectAndHydrate(pass: string): Promise<void> {
	// Not folded into a sync already under way: this one carries a passphrase.
	while (current || next) await (next ?? current)!.done.catch(() => {});
	cancelQueuedFlush();
	return start('connect', () => appSync.connectAndHydrate(pass));
}

/**
 * Pull, merge, and push what the server is missing. Quiet without a
 * passphrase. A push queued by an edit stays queued: this may fold into a
 * sync that read the store before the edit, and if it didn't, the push finds
 * nothing changed and sends nothing.
 */
export function syncNow(): Promise<void> {
	return run('sync');
}

/** For moments with no time to pull first — leaving the page — and only when something changed. */
export function pushIfChanged(): Promise<void> {
	if (!syncState.connected) return Promise.resolve();
	cancelQueuedFlush();
	return run('push');
}

/** Keep taps offline-first, then coalesce connected writes to Neon. */
export function queueSync(delay = 650): void {
	if (!syncState.connected) return;
	cancelQueuedFlush();
	queuedFlush = setTimeout(() => {
		queuedFlush = null;
		void run('push');
	}, delay);
}

export function disconnect(): void {
	cancelQueuedFlush();
	appSync.disconnect();
	// Reconnecting later starts from a union, never from a stale idea of what was deleted.
	clearBase();
}

export const RESYNC_AFTER_MS = 20_000;
export const SYNC_EVERY_MS = 120_000;

/**
 * HomeSuite's rhythm: sync now, on coming back to the tab, and every two
 * minutes while it is in view; on the way out there is no time to pull, so
 * push whatever changed. Returns the cleanup.
 */
export function startAutoSync(): () => void {
	void syncNow();
	if (typeof window === 'undefined') return () => {};
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') void pushIfChanged();
		else if (syncState.connected && Date.now() - lastPull > RESYNC_AFTER_MS) void syncNow();
	};
	const onPageHide = () => void pushIfChanged();
	const every = setInterval(() => {
		if (syncState.connected && document.visibilityState !== 'hidden') void syncNow();
	}, SYNC_EVERY_MS);
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('pagehide', onPageHide);
	return () => {
		clearInterval(every);
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('pagehide', onPageHide);
	};
}
