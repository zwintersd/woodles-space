/** Focus a control that has just been revealed by an explicit user action. */
export function focusOnMount(node: HTMLElement): void {
	queueMicrotask(() => node.focus());
}
