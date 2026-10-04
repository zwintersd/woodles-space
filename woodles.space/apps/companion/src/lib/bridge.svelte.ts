import {
	envelope,
	isExtensionOrigin,
	readMessage,
	type Capture,
	type CompanionMessage,
	type PageContext
} from '@extension/protocol.js';

/**
 * A message this page should act on, or null. Only from the frame's own
 * parent, only from an extension page, only in this protocol — see
 * DESIGN.md's "trust" for why that is a check on honesty, not the boundary.
 */
export function readPanelMessage(
	event: { source: unknown; origin: string; data: unknown },
	parent: unknown
): CompanionMessage | null {
	if (event.source !== parent || !isExtensionOrigin(event.origin)) return null;
	return readMessage(event.data);
}

/**
 * The page's half of the bridge to the extension's side panel. Outside the
 * panel it stays quiet: `inPanel` is false and nothing is ever posted.
 */
export class PanelBridge {
	/** In Chrome's side panel — from `?panel=1` at first, confirmed by `hello`. */
	inPanel = $state(false);
	/** The extension's version, once it has said hello. */
	version = $state('');
	/** The tab beside the panel, when it is a page worth naming. */
	page = $state<PageContext | null>(null);

	#shell: string | null = null;
	#onCapture: (capture: Capture) => boolean;

	/** `onCapture` returns whether the capture is safely kept — only then is it acknowledged. */
	constructor(onCapture: (capture: Capture) => boolean) {
		this.#onCapture = onCapture;
	}

	start(): () => void {
		const embedded = window.parent !== window;
		this.inPanel = embedded && new URL(window.location.href).searchParams.get('panel') === '1';

		const listener = (event: MessageEvent) => {
			const message = readPanelMessage(event, window.parent);
			if (!message) return;
			this.#shell = event.origin;
			switch (message.kind) {
				case 'hello':
					this.inPanel = true;
					this.version = message.version;
					break;
				case 'page':
					this.page = message.page;
					break;
				case 'capture':
					if (this.#onCapture(message.capture)) this.#post({ kind: 'captured', id: message.capture.id });
					break;
			}
		};

		window.addEventListener('message', listener);
		// `ready` carries nothing, so it can go before the shell's origin is
		// known; everything after it goes only to that origin.
		if (embedded) window.parent.postMessage(envelope({ kind: 'ready' }), '*');
		return () => window.removeEventListener('message', listener);
	}

	#post(body: CompanionMessage) {
		if (this.#shell) window.parent.postMessage(envelope(body), this.#shell);
	}
}
