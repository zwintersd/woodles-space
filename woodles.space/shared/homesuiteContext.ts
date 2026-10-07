import { HOMESUITE_CHANNEL, type HomeSuiteContextAction, type HomeSuiteContextTarget, type HomeSuiteShellMessage, type HomeSuiteSurfaceMessage } from './homesuiteBridge';

export type ContextAction = HomeSuiteContextAction & { run: () => void };

/** The surface keeps its verbs and target snapshot; only presentation crosses the frame. */
export function createHomeSuiteContext() {
	let pending: { id: string; actions: ContextAction[]; focus: HTMLElement | null } | null = null;
	return {
		open(point: { x: number; y: number }, target: Omit<HomeSuiteContextTarget, 'actions'>, actions: ContextAction[]): void {
			if (typeof window === 'undefined' || window.parent === window) return;
			const id = crypto.randomUUID();
			pending = { id, actions, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
			window.parent.postMessage({
				channel: HOMESUITE_CHANNEL, source: 'surface', type: 'context-menu', requestId: id,
				x: point.x, y: point.y, target: {
					label: target.label, detail: target.detail,
					ref: target.ref ? { app: target.ref.app, kind: target.ref.kind, id: target.ref.id } : undefined,
					actions: actions.map(({ run: _run, ...action }) => action)
				}
			} satisfies HomeSuiteSurfaceMessage, window.location.origin);
		},
		handle(message: HomeSuiteShellMessage): boolean {
			if (message.action !== 'context-command' && message.action !== 'context-dismiss') return false;
			if (!pending || pending.id !== message.requestId) return true;
			const snapshot = pending;
			pending = null;
			if (snapshot.focus?.isConnected) snapshot.focus.focus({ preventScroll: true });
			if (message.action === 'context-command') {
				const action = snapshot.actions.find((entry) => entry.id === message.commandId);
				if (action && action.enabled !== false) action.run();
			}
			return true;
		}
	};
}
