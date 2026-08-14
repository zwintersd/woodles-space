import type { Viewport } from './camera';
import { fitBoardCamera, focusCamera, frameSequence, frameTitle, itemLabel } from './navigation';
import {
	clampHold,
	createStop,
	DEFAULT_STOP_HOLD,
	type Camera,
	type JourneyStop,
	type WhiteboardDocument
} from './model';

export type ResolvedStop = {
	stop: JourneyStop;
	label: string;
	kind: 'item' | 'viewpoint' | 'board';
	/** Null when the destination is momentarily unresolvable, never for `board`. */
	camera: Camera | null;
};

/**
 * The journey as places rather than ids. Stops resolve every time they are
 * read, so a frame that moved or was renamed is followed rather than remembered
 * wrongly.
 */
export function resolveJourney(document: WhiteboardDocument, viewport: Viewport): ResolvedStop[] {
	return document.journey.stops.map((stop) => {
		const target = stop.target;
		if (target.kind === 'board') {
			return { stop, label: 'Overview', kind: 'board' as const, camera: fitBoardCamera(document, viewport) };
		}
		if (target.kind === 'viewpoint') {
			const viewpoint = document.viewpoints.find((candidate) => candidate.id === target.id);
			return {
				stop,
				label: viewpoint?.name ?? 'Missing view',
				kind: 'viewpoint' as const,
				camera: viewpoint ? { ...viewpoint.camera } : null
			};
		}
		const item = document.items.find((candidate) => candidate.id === target.id);
		return {
			stop,
			label: item ? itemLabel(item) : 'Missing stop',
			kind: 'item' as const,
			camera: item ? focusCamera(document.items, item.id, viewport) : null
		};
	});
}

/**
 * A journey the board can already take: an overview, then every frame in
 * reading order. Offered when nothing has been arranged by hand, so Play means
 * something the first time it is pressed.
 */
export function suggestedStops(document: WhiteboardDocument): JourneyStop[] {
	const sequence = frameSequence(document.items);
	if (!sequence.length) return [];
	return [createStop({ kind: 'board' }), ...sequence.map((frame) => createStop({ kind: 'item', id: frame.id }))];
}

export function suggestedOutline(document: WhiteboardDocument): string[] {
	const sequence = frameSequence(document.items);
	return sequence.length ? ['Overview', ...sequence.map(frameTitle)] : [];
}

export function addStop(document: WhiteboardDocument, target: JourneyStop['target'], hold = DEFAULT_STOP_HOLD): WhiteboardDocument {
	const stops = [...document.journey.stops, createStop(target, hold)];
	return { ...document, journey: { ...document.journey, stops } };
}

export function removeStop(document: WhiteboardDocument, stopId: string): WhiteboardDocument {
	const stops = document.journey.stops.filter((stop) => stop.id !== stopId);
	return { ...document, journey: { ...document.journey, stops } };
}

export function moveStop(document: WhiteboardDocument, stopId: string, direction: -1 | 1): WhiteboardDocument {
	const stops = [...document.journey.stops];
	const index = stops.findIndex((stop) => stop.id === stopId);
	const next = index + direction;
	if (index === -1 || next < 0 || next >= stops.length) return document;
	[stops[index], stops[next]] = [stops[next], stops[index]];
	return { ...document, journey: { ...document.journey, stops } };
}

export function setStopHold(document: WhiteboardDocument, stopId: string, hold: number): WhiteboardDocument {
	const stops = document.journey.stops.map((stop) => (stop.id === stopId ? { ...stop, hold: clampHold(hold) } : stop));
	return { ...document, journey: { ...document.journey, stops } };
}

export function setJourneyStops(document: WhiteboardDocument, stops: JourneyStop[]): WhiteboardDocument {
	return { ...document, journey: { ...document.journey, stops } };
}

export function setJourneyLoop(document: WhiteboardDocument, loop: boolean): WhiteboardDocument {
	return { ...document, journey: { ...document.journey, loop } };
}

export function hasStop(document: WhiteboardDocument, target: JourneyStop['target']): boolean {
	return document.journey.stops.some((stop) =>
		stop.target.kind === target.kind &&
		(target.kind === 'board' || (stop.target.kind !== 'board' && stop.target.id === target.id))
	);
}

/** The next index to play, or null when a non-looping journey has finished. */
export function advanceStop(index: number, count: number, loop: boolean): number | null {
	if (count <= 0) return null;
	const next = index + 1;
	if (next < count) return next;
	return loop ? 0 : null;
}

export function stepStop(index: number, count: number, direction: -1 | 1): number {
	if (count <= 0) return 0;
	return (index + direction + count) % count;
}
