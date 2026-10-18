import type { Contact, FiveContactsRound, LoopEvent, OpenLoop } from './types';

const lifecycleTypes = new Set(['paused', 'closed', 'released', 'reopened']);

/** Recorded order controls lifecycle; the separate occurrence time describes the observation. */
export function projectLoopLifecycle(loops: OpenLoop[], events: LoopEvent[]): OpenLoop[] {
	return loops.map(loop => {
		const latest = events.filter(event => event.loopId === loop.id && lifecycleTypes.has(event.type))
			.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || (a.sequence ?? 0) - (b.sequence ?? 0) || a.id.localeCompare(b.id)).at(-1);
		if (!latest) return loop;
		const resolved = latest.type === 'closed' || latest.type === 'released';
		return {
			...loop,
			status: resolved ? 'resolved' : latest.type === 'paused' ? 'paused' : 'open',
			updatedAt: latest.recordedAt,
			resolvedAt: resolved ? latest.occurredAt : undefined,
			resolution: resolved ? latest.type === 'released' ? 'released' : 'completed' : undefined
		};
	});
}

function contactOrder(a: Contact, b: Contact): number {
	return a.at.localeCompare(b.at) || (a.sequence ?? 0) - (b.sequence ?? 0) || a.id.localeCompare(b.id);
}

/** A round admits five contacts. Concurrent offline additions remain in the ledger. */
export function activeContacts(round: FiveContactsRound): Contact[] {
	return round.contacts.filter(contact => !contact.removedAt && !contact.overflow).sort(contactOrder).slice(0, 5);
}

/** Once evidence falls outside the round's five, Undo must not silently count it. */
export function retainContactBoundary(contacts: Contact[]): Contact[] {
	let admitted = 0;
	return [...contacts].sort(contactOrder).map(contact => {
		if (contact.removedAt || contact.overflow) return contact;
		admitted += 1;
		return admitted > 5 ? { ...contact, overflow: true } : contact;
	});
}

function reflectionTime(round: FiveContactsRound): string {
	// The fallback preserves notes written before the independent clock existed.
	return round.reflectionUpdatedAt ?? (round.reflectionNote !== undefined ? round.updatedAt : '');
}

export function mergeFiveContactsRound(local: FiveContactsRound, remote: FiveContactsRound): FiveContactsRound {
	const contacts = new Map(local.contacts.map(contact => [contact.id, contact]));
	for (const contact of remote.contacts) {
		const old = contacts.get(contact.id);
		// A removed record wins regardless of a stale device's round timestamp.
		const winner = old?.removedAt ? old : contact;
		contacts.set(contact.id, { ...winner, overflow: old?.overflow || contact.overflow || undefined });
	}
	const winner = local.updatedAt > remote.updatedAt ? local : remote;
	const localReflectionTime = reflectionTime(local);
	const remoteReflectionTime = reflectionTime(remote);
	const reflection = localReflectionTime > remoteReflectionTime ? local
		: remoteReflectionTime > localReflectionTime ? remote
		: (local.reflectionNote ?? '').localeCompare(remote.reflectionNote ?? '') <= 0 ? local : remote;
	const merged = {
		...winner, contacts: retainContactBoundary([...contacts.values()]),
		reflectionNote: reflection.reflectionNote,
		reflectionUpdatedAt: reflection.reflectionUpdatedAt
	};
	// Early exit is explicit and terminal, including against later offline taps.
	if (local.status === 'stopped' || remote.status === 'stopped') {
		const stopped = local.status === 'stopped' ? local : remote;
		return { ...merged, status: 'stopped', endedAt: stopped.endedAt };
	}
	const counted = activeContacts(merged);
	return {
		...merged,
		status: counted.length === 5 ? 'completed' : 'active',
		endedAt: counted.length === 5 ? counted[4].at : undefined
	};
}
