import { createAppSync } from '@woodles/sync';
import { store } from './store.svelte';
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
		spores
	};
}

export const { connectAndHydrate, initSync, flushSync, disconnect } =
	createAppSync<PlannerBlob>({
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
					spores: store.sporeEvents
				};
			},
			write(blob: PlannerBlob): void {
				store.rehydrate(blob);
			},
			merge: mergePlannerBlobs
		},
		state: syncState,
	});

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
