const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * For an `aria-modal` dialog: focus moves in when it opens (to
 * `[data-autofocus]`, else the first control), Tab stays inside, and focus
 * goes back where it was when it closes — or, if that control has gone (a
 * menu item that opened the dialog), to `returnFocus`.
 */
export function modal(node: HTMLElement, options: { returnFocus?: string } = {}) {
	const active = document.activeElement;
	const returnTo = active instanceof HTMLElement && active !== document.body ? active : null;
	const focusables = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.tabIndex >= 0 && (element.offsetParent !== null || element === document.activeElement));

	queueMicrotask(() => (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node).focus());

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		const within = focusables();
		if (!within.length) { event.preventDefault(); return; }
		const first = within[0];
		const last = within[within.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}
	node.addEventListener('keydown', onKeydown);

	return {
		destroy() {
			node.removeEventListener('keydown', onKeydown);
			const target = returnTo?.isConnected ? returnTo : options.returnFocus ? document.querySelector<HTMLElement>(options.returnFocus) : null;
			if (target && (!document.activeElement || document.activeElement === document.body || node.contains(document.activeElement))) target.focus();
		}
	};
}
