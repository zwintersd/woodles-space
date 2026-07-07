// Svelte's transition directives (fly/fade/scale) are driven by JS, not CSS,
// so the usual `@media (prefers-reduced-motion: reduce)` block that silences
// CSS animations/transitions elsewhere in this app has no effect on them.
// Route every such transition's duration through here instead.

export function prefersReducedMotion(): boolean {
	if (typeof matchMedia !== 'function') return false;
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function motionDuration(ms: number): number {
	return prefersReducedMotion() ? 0 : ms;
}
