/**
 * The small interaction contract between HomeSuite's persistent shell and a
 * native editing surface. An artifact still belongs to its original app; the
 * shell only knows how to present and invoke the active surface's verbs.
 *
 * The apps are separately built static sites, so an embedded native surface
 * talks to the shell with same-origin messages rather than sharing its model.
 */
export const HOMESUITE_CHANNEL = 'woodles.homesuite.v1' as const;

export type HomeSuiteArtifactKind = 'document' | 'board' | 'collection';

/** A handle for an entity in its owning app; resolution stays with that app. */
export type WoodlesRef = { app: string; kind: string; id: string };

export type HomeSuiteSurfaceState = {
	artifact: { id: string; kind: HomeSuiteArtifactKind; title: string };
	selection: { kind: string; label: string; count?: number } | null;
	inspector: {
		title: string;
		rows: { label: string; value: string }[];
		/** Domain commands shown in the shell's inspector slot. */
		actions?: { commandId: string; label: string; enabled?: boolean }[];
	} | null;
	modes: { id: string; label: string }[];
	activeMode: string;
	commands: { id: string; label: string; shortcut?: string; enabled?: boolean }[];
	canUndo: boolean;
	canRedo: boolean;
};

export type HomeSuiteSurfaceMessage =
	| { channel: typeof HOMESUITE_CHANNEL; source: 'surface'; type: 'state'; state: HomeSuiteSurfaceState }
	| { channel: typeof HOMESUITE_CHANNEL; source: 'surface'; type: 'request-palette' }
	| { channel: typeof HOMESUITE_CHANNEL; source: 'surface'; type: 'navigate'; target: 'index' };

export type HomeSuiteShellMessage =
	| { channel: typeof HOMESUITE_CHANNEL; source: 'shell'; type: 'action'; action: 'undo' | 'redo' | 'inspect' | 'focus' }
	| { channel: typeof HOMESUITE_CHANNEL; source: 'shell'; type: 'action'; action: 'command'; commandId: string }
	| { channel: typeof HOMESUITE_CHANNEL; source: 'shell'; type: 'action'; action: 'mode'; modeId: string };

export function postHomeSuiteState(state: HomeSuiteSurfaceState): void {
	if (typeof window === 'undefined' || window.parent === window) return;
	window.parent.postMessage({ channel: HOMESUITE_CHANNEL, source: 'surface', type: 'state', state } satisfies HomeSuiteSurfaceMessage, window.location.origin);
}

export function postHomeSuitePaletteRequest(): void {
	if (typeof window === 'undefined' || window.parent === window) return;
	window.parent.postMessage({ channel: HOMESUITE_CHANNEL, source: 'surface', type: 'request-palette' } satisfies HomeSuiteSurfaceMessage, window.location.origin);
}

export function isHomeSuiteShellMessage(data: unknown): data is HomeSuiteShellMessage {
	if (!data || typeof data !== 'object') return false;
	const value = data as Record<string, unknown>;
	return value.channel === HOMESUITE_CHANNEL && value.source === 'shell' && value.type === 'action';
}

export function isHomeSuiteSurfaceMessage(data: unknown): data is HomeSuiteSurfaceMessage {
	if (!data || typeof data !== 'object') return false;
	const value = data as Record<string, unknown>;
	return value.channel === HOMESUITE_CHANNEL && value.source === 'surface' &&
		(value.type === 'state' || value.type === 'request-palette' || value.type === 'navigate');
}
