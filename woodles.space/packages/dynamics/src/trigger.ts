/**
 * Shape I — Trigger → Grant / Override. The catch-all for "this happens
 * exactly once, the moment something else crosses a line." `fired` is the
 * caller's own record of what's already happened — a `Set<string>` keyed by
 * instance id for a per-instance grant, or a single boolean for a world-wide
 * one — so this stays agnostic to what `apply` actually does: credit a Pool,
 * flip a sticky multiplier, overwrite a per-instance coefficient.
 */

export function fireOnce(fired: Set<string>, id: string, condition: boolean, apply: () => void): boolean {
	if (!condition || fired.has(id)) return false;
	fired.add(id);
	apply();
	return true;
}
