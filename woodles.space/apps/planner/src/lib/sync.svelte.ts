import {
	createAppSync,
	createLedgerPublisher,
	CARILLON_COMMITMENTS_APP,
	CARILLON_SESSIONS_APP,
	type CarillonCommitmentsBlob,
	type CarillonSessionsBlob
} from '@woodles/sync';
import { store } from './store.svelte';
import { buildCommitments, commitmentsMatch } from './commitments';
import { buildSessions, sessionsMatch } from './sessions';
import type {
	IntervalObservation,
	PlannerBlob,
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

function mergeById<T extends { id: string }>(
	local: T[],
	remote: T[],
	resolve: (localItem: T, remoteItem: T) => T = (_local, remoteItem) => remoteItem
): T[] {
	const merged = new Map<string, T>();
	for (const item of local) merged.set(item.id, item);
	for (const item of remote) {
		const localItem = merged.get(item.id);
		merged.set(item.id, localItem ? resolve(localItem, item) : item);
	}
	return [...merged.values()];
}

function latestObservation(
	local: IntervalObservation,
	remote: IntervalObservation
): IntervalObservation {
	return local.updatedAt > remote.updatedAt ? local : remote;
}

function latestPractice(local: RoutinePractice, remote: RoutinePractice): RoutinePractice {
	return local.recordedAt > remote.recordedAt ? local : remote;
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

function mergeDayInstances(
	local: PlannerBlob['days'],
	remote: PlannerBlob['days']
): PlannerBlob['days'] {
	const merged = { ...local };
	for (const [date, remoteDay] of Object.entries(remote)) {
		const localDay = merged[date];
		merged[date] = localDay ? latestMutable(localDay, remoteDay) : remoteDay;
	}
	return merged;
}

/**
 * Planner sync is a whole JSONB snapshot in Neon, but observations are
 * append-like. Deterministic IDs + last-write timestamps let a phone tap and a
 * desktop tap survive the same CAS conflict instead of choosing one device.
 */
export function mergePlannerBlobs(local: PlannerBlob, remote: PlannerBlob): PlannerBlob {
	const observations = mergeById(
		local.observations ?? [],
		remote.observations ?? [],
		latestObservation
	);
	const observationById = new Map(observations.map((observation) => [observation.id, observation]));
	const spores = mergeById<SporeEvent>(local.spores ?? [], remote.spores ?? []).map(
		(event) => {
			const observation = observationById.get(event.observationId);
			return observation
				? { ...event, date: observation.date, kind: observation.kind, amount: 1 }
				: event;
		}
	);

	return {
		shapes: mergeById(local.shapes, remote.shapes, latestMutable),
		weekPattern: latestMutable(local.weekPattern, remote.weekPattern),
		days: mergeDayInstances(local.days, remote.days),
		obligations: mergeById(local.obligations, remote.obligations),
		rituals: mergeById(local.rituals, remote.rituals),
		tasks: mergeById(local.tasks, remote.tasks, latestMutable),
		settings: { ...local.settings, ...remote.settings },
		domains: mergeById(local.domains, remote.domains),
		observations,
		routines: mergeById(local.routines ?? [], remote.routines ?? [], latestMutable),
		routinePractices: mergeById(
			local.routinePractices ?? [],
			remote.routinePractices ?? [],
			latestPractice
		),
		surgeDrafts: mergeById(
			local.surgeDrafts ?? [],
			remote.surgeDrafts ?? [],
			latestSurge
		),
		spores,
		sleepLogs: mergeById(local.sleepLogs ?? [], remote.sleepLogs ?? [], latestMutable),
		signals: mergeById(local.signals ?? [], remote.signals ?? [], latestMutable),
		// Union, no resolver: a sitting is identified by entry-and-date, so two
		// devices logging the same one produce the same record, and there is
		// nothing to pick between.
		loggedSessions: mergeById(local.loggedSessions ?? [], remote.loggedSessions ?? [])
	};
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
	await commitmentsPublisher.publish(buildCommitments(store.tasks, store.getAllBlocks()));
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

const appSync = createAppSync<PlannerBlob>({
		adapter: {
			app: 'planner',
			read(): PlannerBlob {
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
					loggedSessions: store.loggedSessions
				};
			},
			write(blob: PlannerBlob): void {
				store.rehydrate(blob);
			},
			merge: mergePlannerBlobs
		},
		state: syncState,
	});

export const { disconnect } = appSync;

/**
 * Both ledgers ride every sync operation, hydrate included — a pull can bring
 * in tasks scheduled, or sittings accepted, on another device, and Thinking
 * About should learn about those too. Awaited but never able to fail the caller.
 */
async function withLedgers<T>(operation: () => Promise<T>): Promise<T> {
	const result = await operation();
	store.publishCommitmentsLocally();
	store.publishSessionsLocally();
	await publishCommitments();
	await publishSessions();
	return result;
}

export async function connectAndHydrate(pass: string): Promise<void> {
	await withLedgers(() => appSync.connectAndHydrate(pass));
}

export async function initSync(): Promise<void> {
	await withLedgers(() => appSync.initSync());
}

export async function flushSync(): Promise<void> {
	await withLedgers(() => appSync.flushSync());
}

let queuedFlush: ReturnType<typeof setTimeout> | null = null;

/** Keep taps offline-first, then coalesce connected interval writes to Neon. */
export function queueSync(delay = 650): void {
	if (!syncState.connected) return;
	if (queuedFlush) clearTimeout(queuedFlush);
	queuedFlush = setTimeout(() => {
		queuedFlush = null;
		void flushSync();
	}, delay);
}
